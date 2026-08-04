import { MarkdownView, Notice } from 'obsidian';
import type ObjestPlugin from '../main';
import { discoverEmbeddedPdfs } from '../discovery/embedded-pdfs';
import { V1_CONSENT_VERSION, V1_LIMITS } from '../domain/v1-constants';
import { PdfExtractor } from '../extraction/pdf-extractor';
import { TesseractOcrEngine } from '../extraction/tesseract-ocr';
import { ObsidianNoteWriter } from '../persistence/obsidian-note-writer';
import { OpenAIAnalysisProvider } from '../providers/openai/openai-analysis-provider';
import { AnalysisProgressModal } from '../ui/analysis-progress-modal';
import { PrivacyConsentModal } from '../ui/privacy-consent-modal';
import { runAnalysis, type RunAttachment } from './run-analysis';

export function registerCommands(plugin: ObjestPlugin): void {
	let running = false;
	plugin.addCommand({
		id: 'analyze-embedded-pdfs',
		name: ['Analyze embedded ', 'PDFs'].join(''),
		checkCallback: (checking) => {
			const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view?.file || running) return false;
			if (checking) return true;
			running = true;
			void startAnalysis(plugin, view.file)
				.catch(() => {
					new Notice(
						'Objest could not start. Check its settings and try again.',
					);
				})
				.finally(() => {
					running = false;
				});
			return true;
		},
	});
}

async function startAnalysis(
	plugin: ObjestPlugin,
	note: NonNullable<MarkdownView['file']>,
): Promise<void> {
	const embedded = discoverEmbeddedPdfs(plugin.app, note);
	if (embedded.length === 0) {
		new Notice('Objest found no directly embedded local PDF files.');
		return;
	}
	if (embedded.length > V1_LIMITS.pdfsPerCommand) {
		new Notice(
			`Objest supports at most ${V1_LIMITS.pdfsPerCommand} PDFs per command. Remove extra embeds and try again.`,
		);
		return;
	}

	const secretId = plugin.settings.openAiSecretId;
	const apiKey = secretId
		? plugin.app.secretStorage.getSecret(secretId)
		: null;
	if (!apiKey) {
		new Notice(
			'Select an existing OpenAI API key secret in Objest settings, then try again.',
		);
		return;
	}

	if (plugin.settings.privacyConsentVersion !== V1_CONSENT_VERSION) {
		const accepted = await new PrivacyConsentModal(plugin.app).request();
		if (!accepted) {
			new Notice(
				'Objest analysis was cancelled before processing began.',
			);
			return;
		}
		plugin.settings.privacyConsentVersion = V1_CONSENT_VERSION;
		await plugin.saveSettings();
	}

	const attachments: RunAttachment[] = embedded.map(({ file }) => ({
		byteSize: file.stat.size,
		displayName: file.name,
		path: file.path,
	}));
	const filesByPath = new Map(embedded.map(({ file }) => [file.path, file]));
	const writer = new ObsidianNoteWriter(plugin.app, note);

	await new AnalysisProgressModal(plugin.app, async (signal, onProgress) => {
		const extractor = new PdfExtractor();
		const ocr = new TesseractOcrEngine();
		try {
			return await runAnalysis(
				attachments,
				{
					provider: new OpenAIAnalysisProvider({ apiKey }),
					read: async (attachment, readSignal) => {
						throwIfAborted(readSignal);
						const file = filesByPath.get(attachment.path);
						if (!file)
							throw new Error(
								'The embedded PDF is no longer available.',
							);
						const data = await plugin.app.vault.readBinary(file);
						throwIfAborted(readSignal);
						return data;
					},
					extract: (data, extractionSignal, progress) =>
						extractor.extract(
							data,
							ocr,
							extractionSignal,
							progress,
						),
					persist: (attachment, analysis) =>
						writer.write({
							analysis,
							attachmentPath: attachment.path,
						}),
				},
				signal,
				onProgress,
			);
		} finally {
			await ocr.dispose();
			extractor.dispose();
		}
	}).openAndWait();
}

function throwIfAborted(signal: AbortSignal): void {
	if (!signal.aborted) return;
	throw signal.reason instanceof Error
		? signal.reason
		: new DOMException('Processing was cancelled.', 'AbortError');
}
