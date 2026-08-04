import { describe, expect, it } from 'vitest';
import {
	createAttachmentAnalysis,
	ModelGeneratedAnalysisSchema,
	V1AttachmentAnalysisSchema,
	type ModelGeneratedAnalysis,
} from '../../src/analysis/attachment-analysis';

const now = '2026-08-03T12:34:56.000Z';

function generated(
	overrides: Partial<ModelGeneratedAnalysis> = {},
): ModelGeneratedAnalysis {
	return {
		title: 'Synthetic research report',
		summary: 'A grounded summary.',
		tags: ['Research Notes', '#Archive'],
		documentType: 'Report',
		documentDate: '2026-08-03',
		entities: ['Objest'],
		sourceLanguage: 'English',
		warnings: [],
		...overrides,
	};
}

describe('ModelGeneratedAnalysisSchema', () => {
	it('is strict and enforces every array/count bound', () => {
		expect(() =>
			ModelGeneratedAnalysisSchema.parse({
				...generated(),
				extra: 'not allowed',
			}),
		).toThrow();
		expect(() =>
			ModelGeneratedAnalysisSchema.parse(
				generated({ tags: Array(8).fill('tag') as string[] }),
			),
		).toThrow();
		expect(() =>
			ModelGeneratedAnalysisSchema.parse(
				generated({ entities: Array(16).fill('Entity') as string[] }),
			),
		).toThrow();
		expect(() =>
			ModelGeneratedAnalysisSchema.parse(
				generated({ warnings: Array(11).fill('Warning') as string[] }),
			),
		).toThrow();
	});

	it.each([
		['title', { title: 'x'.repeat(121) }],
		['summary', { summary: 'x'.repeat(2_001) }],
		['tag', { tags: ['x'.repeat(65)] }],
		['document type', { documentType: 'x'.repeat(81) }],
		['entity', { entities: ['x'.repeat(121)] }],
		['source language', { sourceLanguage: 'x'.repeat(65) }],
		['warning', { warnings: ['x'.repeat(241)] }],
	])('rejects an overlong %s', (_name, overrides) => {
		expect(() =>
			ModelGeneratedAnalysisSchema.parse(generated(overrides)),
		).toThrow();
	});

	it.each(['\n', '\r'])(
		'rejects %s in every line-oriented model field',
		(separator) => {
			const invalidValues: Partial<ModelGeneratedAnalysis>[] = [
				{ documentType: `Report${separator}Injected` },
				{ entities: [`Objest${separator}Injected`] },
				{ sourceLanguage: `English${separator}Injected` },
				{ warnings: [`Warning${separator}Injected`] },
			];
			for (const overrides of invalidValues) {
				expect(() =>
					ModelGeneratedAnalysisSchema.parse(generated(overrides)),
				).toThrow();
			}
		},
	);
});

describe('createAttachmentAnalysis', () => {
	it('normalizes model fields and attaches trusted provenance', () => {
		const analysis = createAttachmentAnalysis(
			generated({
				title: ' Synthetic research report ',
				summary: '  A grounded summary.  ',
				tags: ['#Research Notes', 'research-notes', '123'],
				documentType: ' Report ',
				entities: [' Objest ', 'Objest', 'OpenAI'],
				sourceLanguage: ' English ',
				warnings: [' OCR was used. '],
			}),
			'gpt-returned-snapshot',
			now,
		);

		expect(analysis).toEqual({
			schemaVersion: 2,
			promptVersion: 2,
			title: 'Synthetic research report',
			summary: 'A grounded summary.',
			tags: ['research-notes'],
			documentType: 'Report',
			documentDate: '2026-08-03',
			entities: ['Objest', 'OpenAI'],
			sourceLanguage: 'English',
			warnings: ['OCR was used.'],
			model: 'gpt-returned-snapshot',
			processedAt: now,
		});
	});

	it.each(['Bad\ntitle', 'Bad\rtitle'])(
		'rejects multiline title %s',
		(value) => {
			expect(() =>
				createAttachmentAnalysis(
					generated({ title: value }),
					'gpt-returned-snapshot',
					now,
				),
			).toThrow();
		},
	);

	it.each([
		['LF', 'First paragraph.\n\nSecond paragraph.'],
		['CRLF', 'First paragraph.\r\n\r\nSecond paragraph.'],
		['lone CR', 'First paragraph.\r\rSecond paragraph.'],
	])('normalizes %s summary line endings', (_name, summary) => {
		expect(
			createAttachmentAnalysis(
				generated({ summary }),
				'gpt-returned-snapshot',
				now,
			).summary,
		).toBe('First paragraph.\n\nSecond paragraph.');
	});

	it.each(['2025-02-29', '2026-13-01', '2026-04-31', '03/01/2026'])(
		'rejects invalid document date %s',
		(value) => {
			expect(() =>
				createAttachmentAnalysis(
					generated({ documentDate: value }),
					'gpt-returned-snapshot',
					now,
				),
			).toThrow();
		},
	);

	it('accepts nullable unknowns and maximum valid field sizes', () => {
		const analysis = createAttachmentAnalysis(
			generated({
				title: 't'.repeat(120),
				summary: 's'.repeat(2_000),
				tags: Array.from({ length: 7 }, (_, index) => `tag-${index}`),
				documentType: null,
				documentDate: null,
				entities: Array.from(
					{ length: 15 },
					(_, index) => `Entity ${index}`,
				),
				sourceLanguage: null,
				warnings: Array.from(
					{ length: 10 },
					(_, index) => `Warning ${index}`,
				),
			}),
			'm'.repeat(128),
			now,
		);
		expect(analysis.tags).toHaveLength(7);
		expect(analysis.entities).toHaveLength(15);
		expect(analysis.warnings).toHaveLength(10);
	});
});

describe('V1AttachmentAnalysisSchema', () => {
	const valid = createAttachmentAnalysis(
		generated(),
		'gpt-returned-snapshot',
		now,
	);

	it('rejects extra fields and incorrect trusted versions', () => {
		expect(() =>
			V1AttachmentAnalysisSchema.parse({ ...valid, extra: true }),
		).toThrow();
		expect(() =>
			V1AttachmentAnalysisSchema.parse({ ...valid, schemaVersion: 1 }),
		).toThrow();
		expect(() =>
			V1AttachmentAnalysisSchema.parse({ ...valid, promptVersion: 1 }),
		).toThrow();
	});

	it.each(['2026-08-03T12:34:56+01:00', '2026-08-03', 'not-a-timestamp'])(
		'rejects non-UTC processed timestamp %s',
		(processedAt) => {
			expect(() =>
				V1AttachmentAnalysisSchema.parse({ ...valid, processedAt }),
			).toThrow();
		},
	);

	it.each(['\n', '\r'])(
		'rejects %s in every final line-oriented field',
		(separator) => {
			const invalidValues: Record<string, unknown>[] = [
				{ documentType: `Report${separator}Injected` },
				{ entities: [`Objest${separator}Injected`] },
				{ sourceLanguage: `English${separator}Injected` },
				{ warnings: [`Warning${separator}Injected`] },
				{ model: `gpt-5.6-luna${separator}Injected` },
			];
			for (const overrides of invalidValues) {
				expect(() =>
					V1AttachmentAnalysisSchema.parse({
						...valid,
						...overrides,
					}),
				).toThrow();
			}
		},
	);

	it('rejects non-normalized or duplicate final tags and entities', () => {
		expect(() =>
			V1AttachmentAnalysisSchema.parse({
				...valid,
				tags: ['Not Normalized'],
			}),
		).toThrow();
		expect(() =>
			V1AttachmentAnalysisSchema.parse({
				...valid,
				entities: ['Objest', 'Objest'],
			}),
		).toThrow();
	});
});
