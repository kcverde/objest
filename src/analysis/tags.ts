import { V1_LIMITS } from '../domain/v1-constants';

const INVALID_TAG_CHARACTER = /[^\p{L}\p{N}/-]+/gu;

export function normalizeTag(value: string): string | null {
	const withoutHash = value
		.normalize('NFKC')
		.trim()
		.replace(/^#+/u, '')
		.toLocaleLowerCase('en-US')
		.replace(/[\s_]+/gu, '-')
		.replace(INVALID_TAG_CHARACTER, '')
		.replace(/-+/gu, '-')
		.replace(/\/+/gu, '/');

	const normalized = withoutHash
		.split('/')
		.map((segment) => segment.replace(/^-+|-+$/gu, ''))
		.filter((segment) => segment.length > 0)
		.join('/');

	if (
		normalized.length === 0 ||
		!/[\p{L}]/u.test(normalized) ||
		characterLength(normalized) > V1_LIMITS.tagCharacters
	) {
		return null;
	}

	return normalized;
}

export function normalizeTags(values: readonly string[]): string[] {
	const normalized: string[] = [];
	const seen = new Set<string>();

	for (const value of values) {
		const tag = normalizeTag(value);
		if (tag !== null && !seen.has(tag)) {
			seen.add(tag);
			normalized.push(tag);
		}
	}

	return normalized;
}

export function characterLength(value: string): number {
	return Array.from(value).length;
}
