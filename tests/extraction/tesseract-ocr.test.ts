import { describe, expect, it } from 'vitest';
import { TesseractOcrEngine } from '../../src/extraction/tesseract-ocr';

type PostedJob = {
	action: string;
	jobId: string;
};

type ProtocolMessage = {
	action: string;
	data: unknown;
	jobId: string;
	status: 'resolve';
};

class ProtocolWorker {
	onerror: ((event: ErrorEvent) => void) | null = null;
	onmessage: ((event: MessageEvent<ProtocolMessage>) => void) | null = null;
	terminated = false;

	constructor(
		private readonly hangOnRecognize: boolean,
		private readonly onRecognize?: () => void,
	) {}

	postMessage(message: unknown): void {
		const job = message as PostedJob;
		if (job.action === 'recognize') {
			this.onRecognize?.();
			if (this.hangOnRecognize) return;
		}
		queueMicrotask(() => {
			if (this.terminated) return;
			this.onmessage?.({
				data: {
					action: job.action,
					data:
						job.action === 'recognize'
							? { text: 'Recovered OCR text.' }
							: {},
					jobId: job.jobId,
					status: 'resolve',
				},
			} as MessageEvent<ProtocolMessage>);
		});
	}

	terminate(): void {
		this.terminated = true;
	}
}

function testCanvas(): HTMLCanvasElement {
	return {
		toBlob(callback: BlobCallback) {
			callback(new Blob(['synthetic image'], { type: 'image/png' }));
		},
	} as HTMLCanvasElement;
}

describe('TesseractOcrEngine worker lifecycle', () => {
	it('reinitializes after an aborted recognition', async () => {
		let firstRecognitionStarted: (() => void) | null = null;
		const started = new Promise<void>((resolve) => {
			firstRecognitionStarted = resolve;
		});
		const workers: ProtocolWorker[] = [];
		const engine = new TesseractOcrEngine(undefined, () => {
			const worker = new ProtocolWorker(
				workers.length === 0,
				workers.length === 0
					? () => firstRecognitionStarted?.()
					: undefined,
			);
			workers.push(worker);
			return worker;
		});

		try {
			const controller = new AbortController();
			const first = engine.recognize(testCanvas(), controller.signal);
			await started;
			controller.abort();
			await expect(first).rejects.toMatchObject({ name: 'AbortError' });
			expect(workers[0]?.terminated).toBe(true);

			await expect(
				engine.recognize(testCanvas(), new AbortController().signal),
			).resolves.toBe('Recovered OCR text.');
			expect(workers).toHaveLength(2);
		} finally {
			await engine.dispose();
		}
	});
});
