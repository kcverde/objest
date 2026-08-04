import { describe, expect, it } from 'vitest';
import { V1AttachmentAnalysisSchema } from '../../src/analysis/attachment-analysis';
import { OpenAIAnalysisProvider } from '../../src/providers/openai/openai-analysis-provider';

const apiKey = process.env.OPENAI_API_KEY;

describe.skipIf(!apiKey)('OpenAI live contract', () => {
	it('returns a valid analysis for synthetic non-sensitive text', async () => {
		if (!apiKey) throw new Error('OPENAI_API_KEY is required.');
		const provider = new OpenAIAnalysisProvider({ apiKey });
		const result = await provider.analyze(
			[
				{
					pageNumber: 1,
					text: 'Synthetic test document. Objest is a fictional software project. The document date is 2026-08-03.',
				},
			],
			new AbortController().signal,
		);
		expect(V1AttachmentAnalysisSchema.safeParse(result).success).toBe(true);
		expect(result.model.length).toBeGreaterThan(0);
	});
});
