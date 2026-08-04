export class FrontmatterTagsError extends Error {
	override readonly name = 'FrontmatterTagsError';
}

export function mergeGeneratedTags(
	existing: unknown,
	generated: readonly string[],
): string[] {
	const current = parseExistingTags(existing);
	const seen = new Set(current);
	const merged = [...current];
	for (const tag of generated) {
		if (!seen.has(tag)) {
			seen.add(tag);
			merged.push(tag);
		}
	}
	return merged;
}

function parseExistingTags(value: unknown): string[] {
	if (value === undefined || value === null) return [];
	if (typeof value === 'string') return [value];
	if (Array.isArray(value) && value.every((item) => typeof item === 'string'))
		return [...value];
	throw new FrontmatterTagsError(
		'The note tags property must be a string or a list of strings.',
	);
}
