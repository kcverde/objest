import { describe, expect, it } from 'vitest';
import { normalizeTag, normalizeTags } from '../../src/analysis/tags';

describe('normalizeTag', () => {
	it.each([
		['### Project Notes', 'project-notes'],
		['A__B', 'a-b'],
		[' Crème brûlée ', 'crème-brûlée'],
		['Parent / Child', 'parent/child'],
		['A//--B', 'a/b'],
		['Ｆｕｌｌ Ｗｉｄｔｈ', 'full-width'],
	])('normalizes %j to %j', (input, expected) => {
		expect(normalizeTag(input)).toBe(expected);
	});

	it.each(['', '###', '12345', '---///', 'a'.repeat(65)])(
		'rejects unusable tag %j',
		(input) => {
			expect(normalizeTag(input)).toBeNull();
		},
	);
});

describe('normalizeTags', () => {
	it('drops invalid values and deduplicates in first-seen order', () => {
		expect(
			normalizeTags(['#Research', 'research', '123', 'Project Notes']),
		).toEqual(['research', 'project-notes']);
	});
});
