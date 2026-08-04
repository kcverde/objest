import { App, ButtonComponent, Modal, TFile } from 'obsidian';
import type { EmbeddedPdf } from '../discovery/embedded-pdfs';
import { PdfExtractor } from '../extraction/pdf-extractor';
import { TesseractOcrEngine } from '../extraction/tesseract-ocr';

interface FileResult {
	embeddedPages: number;
	name: string;
	ocrPages: number;
	pageCount: number;
	textCharacters: number;
}

export class ExtractionSpikeModal extends Modal {
	private readonly abortController = new AbortController();
	private closeAfterCompletion = false;
	private currentStatusEl: HTMLElement | null = null;
	private resultsEl: HTMLElement | null = null;

	constructor(
		app: App,
		private readonly files: EmbeddedPdf[],
		private readonly ocrLanguages: string[],
	) {
		super(app);
	}

	override onOpen(): void {
		this.setTitle('Objest PDF and OCR compatibility check');
		this.contentEl.createEl('p', {
			text: 'This development check extracts embedded PDF text locally and OCRs scanned pages locally. English OCR data is bundled; Tesseract may download other selected languages from jsDelivr on first use. It does not call OpenAI or change the note.',
		});
		this.currentStatusEl = this.contentEl.createEl('p', {
			cls: 'objest-status',
			text: `Queued ${this.files.length} PDF${this.files.length === 1 ? '' : 's'}.`,
		});
		this.resultsEl = this.contentEl.createDiv({ cls: 'objest-results' });

		const actions = this.contentEl.createDiv({ cls: 'objest-actions' });
		new ButtonComponent(actions)
			.setButtonText('Cancel')
			.onClick(() => this.abortController.abort());

		void this.run();
	}

	override onClose(): void {
		if (!this.closeAfterCompletion) {
			this.abortController.abort();
		}
		this.contentEl.empty();
	}

	private async run(): Promise<void> {
		const pdfExtractor = new PdfExtractor();
		const ocr = new TesseractOcrEngine(this.ocrLanguages, (progress) => {
			if (this.currentStatusEl && progress.status) {
				this.currentStatusEl.setText(
					`OCR: ${progress.status}${typeof progress.progress === 'number' ? ` ${Math.round(progress.progress * 100)}%` : ''}`,
				);
			}
		});

		try {
			for (const [index, embedded] of this.files.entries()) {
				this.throwIfCancelled();
				this.setStatus(
					`Reading ${embedded.file.name} (${index + 1}/${this.files.length})…`,
				);
				const data = await this.app.vault.readBinary(embedded.file);
				const extracted = await pdfExtractor.extract(
					data,
					ocr,
					this.abortController.signal,
					(progress) => {
						const stageLabel = {
							extracting: 'Extracting',
							ocr: 'OCR',
							rendering: 'Rendering',
						}[progress.stage];
						this.setStatus(
							`${stageLabel} ${embedded.file.name}, page ${progress.pageNumber}/${progress.pageCount}…`,
						);
					},
				);

				this.appendResult({
					embeddedPages: extracted.pages.filter(
						(page) => page.method === 'embedded',
					).length,
					name: embedded.file.name,
					ocrPages: extracted.pages.filter(
						(page) => page.method === 'ocr',
					).length,
					pageCount: extracted.pageCount,
					textCharacters: extracted.pages.reduce(
						(total, page) => total + page.text.length,
						0,
					),
				});
			}

			this.setStatus(
				'Compatibility check completed. No note content changed.',
			);
		} catch (error) {
			if (this.abortController.signal.aborted) {
				this.setStatus('Compatibility check cancelled.');
			} else {
				this.setStatus(
					`Compatibility check failed: ${errorMessage(error)}`,
				);
			}
		} finally {
			await ocr.dispose();
			pdfExtractor.dispose();
			this.addCloseButton();
		}
	}

	private appendResult(result: FileResult): void {
		const item = this.resultsEl?.createDiv({ cls: 'objest-result' });
		item?.createEl('strong', { text: result.name });
		item?.createDiv({
			text: `${result.pageCount} pages · ${result.embeddedPages} text · ${result.ocrPages} OCR · ${result.textCharacters.toLocaleString()} characters`,
		});
	}

	private addCloseButton(): void {
		const actions = this.contentEl.querySelector('.objest-actions');
		if (!(actions instanceof HTMLElement)) return;
		actions.empty();
		new ButtonComponent(actions)
			.setButtonText('Close')
			.setCta()
			.onClick(() => {
				this.closeAfterCompletion = true;
				this.close();
			});
	}

	private setStatus(message: string): void {
		this.currentStatusEl?.setText(message);
	}

	private throwIfCancelled(): void {
		if (this.abortController.signal.aborted) {
			throw new DOMException(
				'The compatibility check was cancelled.',
				'AbortError',
			);
		}
	}
}

export function isPdf(file: TFile): boolean {
	return file.extension.toLowerCase() === 'pdf';
}

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unknown error';
}
