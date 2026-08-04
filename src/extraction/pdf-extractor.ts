import {
	GlobalWorkerOptions,
	getDocument,
	type PDFPageProxy,
} from 'pdfjs-dist';
import pdfWorkerSource from 'pdfjs-dist/build/pdf.worker.min.mjs';
import { hasUsableEmbeddedText, normalizeExtractedText } from './text';

const DEFAULT_RENDER_SCALE = 2;
const MAX_RENDER_PIXELS = 16_000_000;

export interface ExtractedPage {
	method: 'embedded' | 'ocr';
	pageNumber: number;
	text: string;
	warnings: string[];
}

export interface ExtractedPdf {
	pageCount: number;
	pages: ExtractedPage[];
}

export interface OcrEngine {
	recognize(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<string>;
}

export interface ExtractionProgress {
	completedPages: number;
	pageCount: number;
	pageNumber: number;
	stage: 'extracting' | 'ocr' | 'rendering';
}

export type ExtractionProgressCallback = (progress: ExtractionProgress) => void;

export class PdfExtractor {
	private readonly workerUrl: string;

	constructor() {
		this.workerUrl = URL.createObjectURL(
			new Blob([pdfWorkerSource], { type: 'text/javascript' }),
		);
		GlobalWorkerOptions.workerSrc = this.workerUrl;
	}

	async extract(
		data: ArrayBuffer,
		ocr: OcrEngine,
		signal: AbortSignal,
		onProgress?: ExtractionProgressCallback,
	): Promise<ExtractedPdf> {
		throwIfAborted(signal);
		const loadingTask = getDocument({
			data: new Uint8Array(data),
			useWorkerFetch: false,
		});
		const document = await loadingTask.promise;

		try {
			const pages: ExtractedPage[] = [];
			for (
				let pageNumber = 1;
				pageNumber <= document.numPages;
				pageNumber++
			) {
				throwIfAborted(signal);
				onProgress?.({
					completedPages: pageNumber - 1,
					pageCount: document.numPages,
					pageNumber,
					stage: 'extracting',
				});

				const page = await document.getPage(pageNumber);
				try {
					pages.push(
						await this.extractPage(
							page,
							pageNumber,
							ocr,
							signal,
							(documentPage, stage) =>
								onProgress?.({
									completedPages: pageNumber - 1,
									pageCount: document.numPages,
									pageNumber: documentPage,
									stage,
								}),
						),
					);
				} finally {
					page.cleanup();
				}
			}

			onProgress?.({
				completedPages: document.numPages,
				pageCount: document.numPages,
				pageNumber: document.numPages,
				stage: 'extracting',
			});

			return { pageCount: document.numPages, pages };
		} finally {
			await loadingTask.destroy();
		}
	}

	dispose(): void {
		URL.revokeObjectURL(this.workerUrl);
	}

	private async extractPage(
		page: PDFPageProxy,
		pageNumber: number,
		ocr: OcrEngine,
		signal: AbortSignal,
		onOcrStage: (pageNumber: number, stage: 'ocr' | 'rendering') => void,
	): Promise<ExtractedPage> {
		const textContent = await page.getTextContent();
		const embeddedText = normalizeExtractedText(
			textContent.items
				.map((item) =>
					'str' in item
						? `${item.str}${item.hasEOL ? '\n' : ' '}`
						: '',
				)
				.join(''),
		);

		if (hasUsableEmbeddedText(embeddedText)) {
			return {
				method: 'embedded',
				pageNumber,
				text: embeddedText,
				warnings: [],
			};
		}

		throwIfAborted(signal);
		onOcrStage(pageNumber, 'rendering');
		const canvas = await renderPage(page, signal);
		try {
			onOcrStage(pageNumber, 'ocr');
			const ocrText = normalizeExtractedText(
				await ocr.recognize(canvas, signal),
			);
			return {
				method: 'ocr',
				pageNumber,
				text: ocrText,
				warnings:
					ocrText.length === 0
						? ['OCR produced no text for this page.']
						: [],
			};
		} finally {
			canvas.width = 0;
			canvas.height = 0;
			canvas.remove();
		}
	}
}

async function renderPage(
	page: PDFPageProxy,
	signal: AbortSignal,
): Promise<HTMLCanvasElement> {
	const baseViewport = page.getViewport({ scale: 1 });
	const scaleByPixels = Math.sqrt(
		MAX_RENDER_PIXELS / (baseViewport.width * baseViewport.height),
	);
	const scale = Math.min(DEFAULT_RENDER_SCALE, scaleByPixels);
	const viewport = page.getViewport({ scale });
	const canvas = createEl('canvas');
	canvas.width = Math.max(1, Math.floor(viewport.width));
	canvas.height = Math.max(1, Math.floor(viewport.height));

	const context = canvas.getContext('2d', { alpha: false });
	if (!context) {
		throw new Error('Could not create a canvas context for PDF OCR.');
	}

	throwIfAborted(signal);
	const renderTask = page.render({
		canvas: null,
		canvasContext: context,
		intent: 'print',
		viewport,
	});
	const onAbort = () => renderTask.cancel();
	signal.addEventListener('abort', onAbort, { once: true });
	try {
		await renderTask.promise;
	} finally {
		signal.removeEventListener('abort', onAbort);
	}
	throwIfAborted(signal);
	return canvas;
}

function throwIfAborted(signal: AbortSignal): void {
	if (signal.aborted) {
		throw new DOMException(
			'The PDF extraction was cancelled.',
			'AbortError',
		);
	}
}
