import { describe, expect, it } from 'vitest';
import { createAttachmentAnalysis } from '../../src/analysis/attachment-analysis';
import { FakeAnalysisProvider } from '../fakes/fake-analysis-provider';

const result = createAttachmentAnalysis(
	{
		summary: 'Synthetic summary.',
		tags: ['test'],
		documentType: null,
		documentDate: null,
		entities: [],
		sourceLanguage: 'English',
		warnings: [],
	},
	'gpt-test',
	'2026-08-03T00:00:00.000Z',
);

describe('FakeAnalysisProvider', () => {
	it('records safe page-only calls and returns queued results', async () => {
		const provider = new FakeAnalysisProvider([result]);
		const pages = [{ pageNumber: 1, text: 'Synthetic text.' }];
		await expect(
			provider.analyze(pages, new AbortController().signal),
		).resolves.toEqual(result);
		expect(provider.calls).toEqual([pages]);
	});

	it('returns queued failures', async () => {
		const provider = new FakeAnalysisProvider([new Error('test failure')]);
		await expect(
			provider.analyze(
				[{ pageNumber: 1, text: 'Synthetic text.' }],
				new AbortController().signal,
			),
		).rejects.toThrow('test failure');
	});

	it('honors a pre-aborted signal without recording document text', async () => {
		const controller = new AbortController();
		controller.abort();
		const provider = new FakeAnalysisProvider([result]);
		await expect(
			provider.analyze(
				[{ pageNumber: 1, text: 'Synthetic text.' }],
				controller.signal,
			),
		).rejects.toMatchObject({ name: 'AbortError' });
		expect(provider.calls).toEqual([]);
	});
});
