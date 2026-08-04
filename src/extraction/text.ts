const MIN_USABLE_NON_WHITESPACE_CHARACTERS = 32;

export function normalizeExtractedText(value: string): string {
	return value
		.split('\u0000')
		.join('')
		.replace(/[\t ]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export function hasUsableEmbeddedText(value: string): boolean {
	const nonWhitespaceLength = value.replace(/\s/g, '').length;
	return nonWhitespaceLength >= MIN_USABLE_NON_WHITESPACE_CHARACTERS;
}
