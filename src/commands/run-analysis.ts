import { characterLength } from '../analysis/tags';
import type { V1AttachmentAnalysis } from '../analysis/attachment-analysis';
import { V1_LIMITS, V1_TIMEOUTS } from '../domain/v1-constants';
import type {
	ExtractedPdf,
	ExtractionProgress,
} from '../extraction/pdf-extractor';
import type { AnalysisProvider } from '../providers/analysis-provider';
import type { NoteWriteResult } from '../persistence/obsidian-note-writer';

export type RunStage =
	| 'reading'
	| 'extracting'
	| 'rendering'
	| 'ocr'
	| 'analyzing'
	| 'validating'
	| 'writing';

export interface RunAttachment {
	byteSize: number;
	displayName: string;
	path: string;
}

export interface RunProgress {
	attachment: RunAttachment;
	index: number;
	stage: RunStage;
	total: number;
}

export interface RunOutcome {
	attachment: RunAttachment;
	message?: string;
	status: 'cancelled' | 'failed' | 'partial' | 'written';
}

export interface RunAnalysisDependencies {
	extract(
		data: ArrayBuffer,
		signal: AbortSignal,
		onProgress: (progress: ExtractionProgress) => void,
	): Promise<ExtractedPdf>;
	persist(
		attachment: RunAttachment,
		analysis: V1AttachmentAnalysis,
	): Promise<NoteWriteResult>;
	provider: AnalysisProvider;
	read(attachment: RunAttachment, signal: AbortSignal): Promise<ArrayBuffer>;
}

export class RunLimitError extends Error {
	override readonly name = 'RunLimitError';
}

export async function runAnalysis(
	attachments: readonly RunAttachment[],
	dependencies: RunAnalysisDependencies,
	signal: AbortSignal,
	onProgress?: (progress: RunProgress) => void,
): Promise<RunOutcome[]> {
	if (attachments.length === 0)
		throw new RunLimitError('Objest found no embedded PDF files.');
	if (attachments.length > V1_LIMITS.pdfsPerCommand)
		throw new RunLimitError(
			`Objest supports at most ${V1_LIMITS.pdfsPerCommand} PDFs per command.`,
		);

	const outcomes: RunOutcome[] = [];
	for (const [index, attachment] of attachments.entries()) {
		if (signal.aborted) {
			appendCancelled(outcomes, attachments.slice(index));
			break;
		}
		try {
			if (attachment.byteSize > V1_LIMITS.pdfBytes)
				throw new RunLimitError('The PDF exceeds the 25 MiB limit.');

			const local = createDeadlineSignal(
				signal,
				V1_TIMEOUTS.localProcessingMs,
				'Local PDF processing timed out.',
			);
			let extracted: ExtractedPdf;
			try {
				onProgress?.({
					attachment,
					index,
					total: attachments.length,
					stage: 'reading',
				});
				const data = await awaitWithAbort(
					dependencies.read(attachment, local.signal),
					local.signal,
				);
				throwIfAborted(local.signal);
				if (data.byteLength > V1_LIMITS.pdfBytes)
					throw new RunLimitError(
						'The PDF exceeds the 25 MiB limit.',
					);
				extracted = await awaitWithAbort(
					dependencies.extract(data, local.signal, (progress) => {
						onProgress?.({
							attachment,
							index,
							total: attachments.length,
							stage: progress.stage,
						});
					}),
					local.signal,
				);
			} finally {
				local.dispose();
			}

			validateExtracted(extracted);
			const pages = extracted.pages.map(({ pageNumber, text }) => ({
				pageNumber,
				text,
			}));
			onProgress?.({
				attachment,
				index,
				total: attachments.length,
				stage: 'analyzing',
			});
			const provider = createDeadlineSignal(
				signal,
				V1_TIMEOUTS.openAiMs,
				'OpenAI analysis timed out.',
			);
			let analysis: V1AttachmentAnalysis;
			try {
				analysis = await awaitWithAbort(
					dependencies.provider.analyze(pages, provider.signal),
					provider.signal,
				);
			} finally {
				provider.dispose();
			}
			onProgress?.({
				attachment,
				index,
				total: attachments.length,
				stage: 'validating',
			});
			throwIfAborted(signal);

			onProgress?.({
				attachment,
				index,
				total: attachments.length,
				stage: 'writing',
			});
			const write = await dependencies.persist(attachment, analysis);
			outcomes.push(
				write.tagsWritten
					? { attachment, status: 'written' }
					: {
							attachment,
							status: 'partial',
							message: `The summary was written, but tags failed: ${write.tagError ?? 'unknown error'}`,
						},
			);
		} catch (error) {
			if (signal.aborted || isAbortError(error)) {
				appendCancelled(outcomes, attachments.slice(index));
				break;
			}
			outcomes.push({
				attachment,
				status: 'failed',
				message: safeErrorMessage(error),
			});
		}
	}
	return outcomes;
}

function appendCancelled(
	outcomes: RunOutcome[],
	attachments: readonly RunAttachment[],
): void {
	for (const attachment of attachments) {
		outcomes.push({ attachment, status: 'cancelled' });
	}
}

function validateExtracted(extracted: ExtractedPdf): void {
	if (extracted.pageCount < 1)
		throw new RunLimitError('The PDF contains no pages.');
	if (extracted.pageCount > V1_LIMITS.pagesPerPdf)
		throw new RunLimitError('The PDF exceeds the 50-page limit.');
	const characters = extracted.pages.reduce(
		(total, page) => total + characterLength(page.text),
		0,
	);
	if (characters === 0)
		throw new RunLimitError('No usable text was extracted from the PDF.');
	if (characters > V1_LIMITS.normalizedTextCharacters)
		throw new RunLimitError(
			'The PDF exceeds the 150,000-character text limit.',
		);
}

function createDeadlineSignal(
	parent: AbortSignal,
	timeoutMs: number,
	message: string,
): { dispose(): void; signal: AbortSignal } {
	const controller = new AbortController();
	const onAbort = () => controller.abort(parent.reason);
	parent.addEventListener('abort', onAbort, { once: true });
	if (parent.aborted) onAbort();
	const timeout = window.setTimeout(
		() => controller.abort(new DOMException(message, 'TimeoutError')),
		timeoutMs,
	);
	return {
		signal: controller.signal,
		dispose: () => {
			window.clearTimeout(timeout);
			parent.removeEventListener('abort', onAbort);
		},
	};
}

function awaitWithAbort<T>(
	operation: Promise<T>,
	signal: AbortSignal,
): Promise<T> {
	if (signal.aborted) {
		void operation.catch(() => undefined);
		return Promise.reject(abortReason(signal));
	}
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(abortReason(signal));
		signal.addEventListener('abort', onAbort, { once: true });
		void operation.then(
			(value) => {
				signal.removeEventListener('abort', onAbort);
				resolve(value);
			},
			(error: unknown) => {
				signal.removeEventListener('abort', onAbort);
				reject(
					error instanceof Error
						? error
						: new Error('Operation failed.'),
				);
			},
		);
	});
}

function abortReason(signal: AbortSignal): Error {
	return signal.reason instanceof Error
		? signal.reason
		: new DOMException('Processing was cancelled.', 'AbortError');
}

function throwIfAborted(signal: AbortSignal): void {
	if (!signal.aborted) return;
	throw abortReason(signal);
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError';
}

function safeErrorMessage(error: unknown): string {
	if (error instanceof RunLimitError) return error.message;
	if (error instanceof DOMException && error.name === 'TimeoutError')
		return error.message;
	if (error instanceof Error) return error.message;
	return 'Unknown processing error.';
}
