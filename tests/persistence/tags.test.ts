import { describe, expect, it } from 'vitest';
import {
	FrontmatterTagsError,
	mergeGeneratedTags,
} from '../../src/persistence/tags';

describe('mergeGeneratedTags', () => {
	it('adds tags to an absent property', () => {
		expect(mergeGeneratedTags(undefined, ['one', 'two'])).toEqual([
			'one',
			'two',
		]);
	});

	it('preserves scalar and list tags without duplicates or removal', () => {
		expect(mergeGeneratedTags('existing', ['existing', 'new'])).toEqual([
			'existing',
			'new',
		]);
		expect(mergeGeneratedTags(['a', 'b'], ['b', 'c'])).toEqual([
			'a',
			'b',
			'c',
		]);
	});

	it('rejects unsupported existing tag values', () => {
		expect(() => mergeGeneratedTags({ tag: true }, ['new'])).toThrow(
			FrontmatterTagsError,
		);
		expect(() => mergeGeneratedTags(['ok', 1], ['new'])).toThrow(
			FrontmatterTagsError,
		);
	});
});
