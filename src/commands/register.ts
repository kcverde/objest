import { MarkdownView, Notice } from 'obsidian';
import type ObjestPlugin from '../main';
import { discoverEmbeddedPdfs } from '../discovery/embedded-pdfs';
import { ExtractionSpikeModal } from '../ui/extraction-spike-modal';

export function registerCommands(plugin: ObjestPlugin): void {
	registerExtractionSpikeCommand(plugin);
}

function registerExtractionSpikeCommand(plugin: ObjestPlugin): void {
	plugin.addCommand({
		id: 'run-pdf-ocr-compatibility-check',
		name: 'Run PDF and OCR compatibility check',
		checkCallback: (checking) => {
			const view = plugin.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view?.file) return false;
			if (checking) return true;

			const embeddedPdfs = discoverEmbeddedPdfs(plugin.app, view.file);
			if (embeddedPdfs.length === 0) {
				new Notice(
					'Objest found no directly embedded local PDF files.',
				);
				return true;
			}

			new ExtractionSpikeModal(
				plugin.app,
				embeddedPdfs,
				plugin.settings.ocrLanguages,
			).open();
			return true;
		},
	});
}
