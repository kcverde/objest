import { describe, expect, it } from 'vitest';
import { normalizeOcrLanguages } from '../../src/settings/model';

describe('normalizeOcrLanguages', () => {
	it('normalizes and deduplicates valid Tesseract codes', () => {
		expect(normalizeOcrLanguages(' ENG, spa, eng, deu_frak ')).toEqual([
			'eng',
			'spa',
			'deu_frak',
		]);
	});

	it('falls back to English when no valid code remains', () => {
		expect(normalizeOcrLanguages('!')).toEqual(['eng']);
	});
});
