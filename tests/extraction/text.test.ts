import { describe, expect, it } from 'vitest';
import {
	hasUsableEmbeddedText,
	normalizeExtractedText,
} from '../../src/extraction/text';

describe('normalizeExtractedText', () => {
	it('removes nulls and normalizes excessive whitespace', () => {
		expect(
			normalizeExtractedText(' First\u0000 page  \n\n\nSecond page '),
		).toBe('First page\n\nSecond page');
	});
});

describe('hasUsableEmbeddedText', () => {
	it('rejects short PDF text-layer noise', () => {
		expect(hasUsableEmbeddedText('Page 1')).toBe(false);
	});

	it('accepts a meaningful text layer', () => {
		expect(
			hasUsableEmbeddedText(
				'This document contains enough meaningful text for local extraction.',
			),
		).toBe(true);
	});
});
