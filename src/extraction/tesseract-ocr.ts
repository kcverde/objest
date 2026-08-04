import bundledEnglish from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
import tesseractCoreSource from 'tesseract.js-core/tesseract-core-lstm.wasm.js';
import tesseractWorkerSource from 'tesseract.js/dist/worker.min.js';
import type { OcrEngine } from './pdf-extractor';

const LSTM_ONLY_OEM = 1;

export interface OcrProgress {
	progress?: number;
	status?: string;
}

export type OcrProgressCallback = (message: OcrProgress) => void;

type PendingJob = {
	reject: (reason: unknown) => void;
	resolve: (value: unknown) => void;
};

type WorkerMessage = {
	action: string;
	data: unknown;
	jobId: string;
	status: 'progress' | 'reject' | 'resolve';
};

export class TesseractOcrEngine implements OcrEngine {
	private readonly coreBaseUrl: string;
	private readonly coreUrl: string;
	private jobSequence = 0;
	private readonly pending = new Map<string, PendingJob>();
	private worker: Worker | null = null;
	private workerReady: Promise<void> | null = null;
	private readonly workerScriptUrl: string;

	constructor(
		private readonly languages: string[],
		private readonly onProgress?: OcrProgressCallback,
	) {
		this.workerScriptUrl = createScriptUrl(tesseractWorkerSource);
		this.coreBaseUrl = createScriptUrl(tesseractCoreSource);
		// Tesseract uses the .js suffix to distinguish a file from a directory.
		this.coreUrl = `${this.coreBaseUrl}#tesseract-core-lstm.wasm.js`;
	}

	async recognize(
		canvas: HTMLCanvasElement,
		signal: AbortSignal,
	): Promise<string> {
		throwIfAborted(signal);
		await this.initialize(signal);
		throwIfAborted(signal);

		const image = new Uint8Array(await canvasToArrayBuffer(canvas));
		const result = await this.send<{ text: string }>(
			'recognize',
			{
				image,
				options: {},
				output: { text: true },
			},
			signal,
			[image.buffer],
		);
		return result.text;
	}

	async dispose(): Promise<void> {
		this.worker?.terminate();
		this.worker = null;
		this.workerReady = null;
		this.rejectPending(
			new DOMException('OCR worker disposed.', 'AbortError'),
		);
		URL.revokeObjectURL(this.workerScriptUrl);
		URL.revokeObjectURL(this.coreBaseUrl);
	}

	private initialize(signal: AbortSignal): Promise<void> {
		this.workerReady ??= this.initializeWorker(signal);
		return this.workerReady;
	}

	private async initializeWorker(signal: AbortSignal): Promise<void> {
		this.worker = new Worker(this.workerScriptUrl);
		this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
			const message = event.data;
			if (message.status === 'progress') {
				this.onProgress?.(
					isProgress(message.data)
						? message.data
						: { status: message.action },
				);
				return;
			}

			const pending = this.pending.get(message.jobId);
			if (!pending) return;
			this.pending.delete(message.jobId);
			if (message.status === 'resolve') pending.resolve(message.data);
			else pending.reject(new Error(workerErrorMessage(message.data)));
		};
		this.worker.onerror = (event) => {
			this.rejectPending(
				new Error(
					event.message || 'The Tesseract worker failed to start.',
				),
			);
		};

		await this.send(
			'load',
			{
				options: {
					corePath: this.coreUrl,
					logging: false,
					lstmOnly: true,
				},
			},
			signal,
		);
		await this.send(
			'loadLanguage',
			{
				langs: this.languages.map((language) =>
					language === 'eng'
						? { code: 'eng', data: bundledEnglish }
						: language,
				),
				options: {
					cacheMethod: 'write',
					gzip: true,
					lstmOnly: true,
				},
			},
			signal,
		);
		await this.send(
			'initialize',
			{
				config: {},
				langs: this.languages,
				oem: LSTM_ONLY_OEM,
			},
			signal,
		);
	}

	private send<T = unknown>(
		action: string,
		payload: unknown,
		signal: AbortSignal,
		transfer: Transferable[] = [],
	): Promise<T> {
		throwIfAborted(signal);
		if (!this.worker)
			throw new Error('The Tesseract worker is not available.');
		const jobId = `objest-${action}-${this.jobSequence++}`;

		return new Promise<T>((resolve, reject) => {
			const onAbort = () => {
				this.pending.delete(jobId);
				this.worker?.terminate();
				this.worker = null;
				reject(new DOMException('OCR was cancelled.', 'AbortError'));
			};
			signal.addEventListener('abort', onAbort, { once: true });

			this.pending.set(jobId, {
				reject: (reason) => {
					signal.removeEventListener('abort', onAbort);
					reject(
						reason instanceof Error
							? reason
							: new Error(workerErrorMessage(reason)),
					);
				},
				resolve: (value) => {
					signal.removeEventListener('abort', onAbort);
					resolve(value as T);
				},
			});

			this.worker?.postMessage(
				{
					action,
					jobId,
					payload,
					workerId: 'objest-ocr-worker',
				},
				transfer,
			);
		});
	}

	private rejectPending(error: Error): void {
		for (const pending of this.pending.values()) pending.reject(error);
		this.pending.clear();
	}
}

function createScriptUrl(source: string): string {
	return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}

function canvasToArrayBuffer(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(
					new Error(
						'Could not encode the rendered PDF page for OCR.',
					),
				);
				return;
			}
			void blob.arrayBuffer().then(resolve, reject);
		}, 'image/png');
	});
}

function isProgress(value: unknown): value is OcrProgress {
	return typeof value === 'object' && value !== null;
}

function workerErrorMessage(value: unknown): string {
	if (typeof value === 'string') return value;
	if (value instanceof Error) return value.message;
	return 'The Tesseract worker rejected an OCR operation.';
}

function throwIfAborted(signal: AbortSignal): void {
	if (signal.aborted) {
		throw new DOMException('OCR was cancelled.', 'AbortError');
	}
}
