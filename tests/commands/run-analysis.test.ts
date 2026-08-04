import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { V1AttachmentAnalysis } from '../../src/analysis/attachment-analysis';
import {
	runAnalysis,
	RunLimitError,
	type RunAnalysisDependencies,
	type RunAttachment,
} from '../../src/commands/run-analysis';
import type { AnalysisProvider } from '../../src/providers/analysis-provider';

const analysis: V1AttachmentAnalysis = {
	schemaVersion: 1,
	promptVersion: 1,
	summary: 'Summary',
	tags: ['tag'],
	documentType: null,
	documentDate: null,
	entities: [],
	sourceLanguage: 'English',
	warnings: [],
	model: 'gpt-5.6-luna',
	processedAt: '2026-08-03T00:00:00.000Z',
};

const attachment = (path: string, byteSize = 10): RunAttachment => ({
	path,
	displayName: path,
	byteSize,
});

function dependencies(provider: AnalysisProvider): RunAnalysisDependencies {
	return {
		provider,
		read: async () => new ArrayBuffer(1),
		extract: async () => ({
			pageCount: 1,
			pages: [
				{
					method: 'embedded',
					pageNumber: 1,
					text: 'text',
					warnings: [],
				},
			],
		}),
		persist: async () => ({ bodyWritten: true, tagsWritten: true }),
	};
}

const successfulProvider: AnalysisProvider = {
	analyze: async () => analysis,
};

beforeEach(() => {
	vi.stubGlobal('window', {
		clearTimeout,
		setTimeout,
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('runAnalysis', () => {
	it('rejects more than five PDFs before reading', async () => {
		const deps = dependencies(successfulProvider);
		const read = vi.spyOn(deps, 'read');
		await expect(
			runAnalysis(
				Array.from({ length: 6 }, (_, index) =>
					attachment(`${index}.pdf`),
				),
				deps,
				new AbortController().signal,
			),
		).rejects.toBeInstanceOf(RunLimitError);
		expect(read).not.toHaveBeenCalled();
	});

	it('rejects an oversized PDF independently and continues', async () => {
		const deps = dependencies(successfulProvider);
		const outcomes = await runAnalysis(
			[
				attachment('large.pdf', 25 * 1024 * 1024 + 1),
				attachment('ok.pdf'),
			],
			deps,
			new AbortController().signal,
		);
		expect(outcomes.map(({ status }) => status)).toEqual([
			'failed',
			'written',
		]);
	});

	it('processes sequentially and continues after an independent failure', async () => {
		let active = 0;
		let maximum = 0;
		let call = 0;
		const provider: AnalysisProvider = {
			analyze: async () => {
				active++;
				maximum = Math.max(maximum, active);
				try {
					if (call++ === 0)
						throw new Error('Synthetic provider failure.');
					return analysis;
				} finally {
					active--;
				}
			},
		};
		const persist = vi.fn(async () => ({
			bodyWritten: true as const,
			tagsWritten: true,
		}));
		const deps = { ...dependencies(provider), persist };
		const outcomes = await runAnalysis(
			[attachment('a.pdf'), attachment('b.pdf')],
			deps,
			new AbortController().signal,
		);
		expect(outcomes.map(({ status }) => status)).toEqual([
			'failed',
			'written',
		]);
		expect(maximum).toBe(1);
		expect(persist).toHaveBeenCalledTimes(1);
	});

	it('counts normalized input by Unicode code point', async () => {
		const deps = dependencies(successfulProvider);
		deps.extract = async () => ({
			pageCount: 1,
			pages: [
				{
					method: 'embedded',
					pageNumber: 1,
					text: '😀'.repeat(150_000),
					warnings: [],
				},
			],
		});
		await expect(
			runAnalysis(
				[attachment('unicode.pdf')],
				deps,
				new AbortController().signal,
			),
		).resolves.toMatchObject([{ status: 'written' }]);
	});

	it('reports a body-written tag failure as partial', async () => {
		const deps = dependencies(successfulProvider);
		deps.persist = async () => ({
			bodyWritten: true,
			tagsWritten: false,
			tagError: 'Malformed tags property.',
		});
		await expect(
			runAnalysis(
				[attachment('a.pdf')],
				deps,
				new AbortController().signal,
			),
		).resolves.toMatchObject([{ status: 'partial' }]);
	});

	it('finishes an active write after cancellation and does not start the next PDF', async () => {
		const controller = new AbortController();
		const deps = dependencies(successfulProvider);
		const read = vi.spyOn(deps, 'read');
		deps.persist = async () => {
			controller.abort();
			return { bodyWritten: true, tagsWritten: true };
		};
		const outcomes = await runAnalysis(
			[attachment('a.pdf'), attachment('b.pdf')],
			deps,
			controller.signal,
		);
		expect(outcomes).toMatchObject([
			{ status: 'written' },
			{ status: 'cancelled' },
		]);
		expect(read).toHaveBeenCalledTimes(1);
	});

	it('marks the active and remaining PDFs cancelled when processing aborts', async () => {
		const controller = new AbortController();
		const provider: AnalysisProvider = {
			analyze: async () => {
				controller.abort();
				throw new DOMException('Cancelled.', 'AbortError');
			},
		};
		const outcomes = await runAnalysis(
			[attachment('a.pdf'), attachment('b.pdf')],
			dependencies(provider),
			controller.signal,
		);
		expect(outcomes).toMatchObject([
			{ status: 'cancelled' },
			{ status: 'cancelled' },
		]);
	});

	it('fails a local operation that ignores abort and continues to the next PDF', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('window', {
			clearTimeout,
			setTimeout,
		});
		const deps = dependencies(successfulProvider);
		let reads = 0;
		deps.read = async () => {
			if (reads++ === 0)
				return await new Promise<ArrayBuffer>(() => undefined);
			return new ArrayBuffer(1);
		};
		const pending = runAnalysis(
			[attachment('stuck.pdf'), attachment('next.pdf')],
			deps,
			new AbortController().signal,
		);
		await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
		await expect(pending).resolves.toMatchObject([
			{ status: 'failed', message: 'Local PDF processing timed out.' },
			{ status: 'written' },
		]);
	});

	it('aborts a provider that exceeds the fixed deadline', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('window', {
			clearTimeout,
			setTimeout,
		});
		const provider: AnalysisProvider = {
			analyze: (_pages, signal) =>
				new Promise((_resolve, reject) => {
					signal.addEventListener(
						'abort',
						() =>
							reject(
								signal.reason instanceof Error
									? signal.reason
									: new DOMException(
											'Provider timed out.',
											'TimeoutError',
										),
							),
						{ once: true },
					);
				}),
		};
		const pending = runAnalysis(
			[attachment('slow.pdf')],
			dependencies(provider),
			new AbortController().signal,
		);
		await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
		await expect(pending).resolves.toMatchObject([
			{ status: 'failed', message: 'OpenAI analysis timed out.' },
		]);
	});
});
