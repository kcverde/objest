import bundledEnglish from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';
import tesseractCoreSource from 'tesseract.js-core/tesseract-core-lstm.wasm.js';
import tesseractWorkerSource from 'tesseract.js/dist/worker.min.js';
import { V1_OCR_LANGUAGE } from '../domain/v1-constants';
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

type OcrWorker = Pick<
	Worker,
	'onerror' | 'onmessage' | 'postMessage' | 'terminate'
>;

type OcrWorkerFactory = (scriptUrl: string) => OcrWorker;

export class TesseractOcrEngine implements OcrEngine {
	private readonly coreBaseUrl: string;
	private readonly coreUrl: string;
	private jobSequence = 0;
	private readonly pending = new Map<string, PendingJob>();
	private worker: OcrWorker | null = null;
	private workerReady: Promise<void> | null = null;
	private readonly workerScriptUrl: string;

	constructor(
		private readonly onProgress?: OcrProgressCallback,
		private readonly createWorker: OcrWorkerFactory = (scriptUrl) =>
			new Worker(scriptUrl),
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
		this.resetWorker(
			new DOMException('OCR worker disposed.', 'AbortError'),
		);
		URL.revokeObjectURL(this.workerScriptUrl);
		URL.revokeObjectURL(this.coreBaseUrl);
	}

	private initialize(signal: AbortSignal): Promise<void> {
		if (!this.workerReady) {
			const ready = this.initializeWorker(signal);
			this.workerReady = ready;
			void ready.catch((error: unknown) => {
				if (this.workerReady === ready) {
					this.resetWorker(asError(error));
				}
			});
		}
		return this.workerReady;
	}

	private async initializeWorker(signal: AbortSignal): Promise<void> {
		const worker = this.createWorker(this.workerScriptUrl);
		this.worker = worker;
		worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
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
		worker.onerror = (event) => {
			if (this.worker !== worker) return;
			this.resetWorker(
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
				langs: [{ code: V1_OCR_LANGUAGE, data: bundledEnglish }],
				options: {
					cacheMethod: 'none',
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
				langs: [V1_OCR_LANGUAGE],
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
				const error = new DOMException(
					'OCR was cancelled.',
					'AbortError',
				);
				this.resetWorker(error);
				reject(error);
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

	private resetWorker(error: Error): void {
		const worker = this.worker;
		this.worker = null;
		this.workerReady = null;
		worker?.terminate();
		this.rejectPending(error);
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

function asError(value: unknown): Error {
	return value instanceof Error
		? value
		: new Error(workerErrorMessage(value));
}

function throwIfAborted(signal: AbortSignal): void {
	if (signal.aborted) {
		throw new DOMException('OCR was cancelled.', 'AbortError');
	}
}
