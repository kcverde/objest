export const V1_MODEL_ID = 'gpt-5.6-luna';
export const V1_OCR_LANGUAGE = 'eng';
export const V1_SCHEMA_VERSION = 2 as const;
export const V1_PROMPT_VERSION = 2 as const;

export const V1_CONSENT_VERSION = 1 as const;

export const V1_TIMEOUTS = {
	localProcessingMs: 15 * 60 * 1000,
	openAiMs: 2 * 60 * 1000,
} as const;

export const V1_LIMITS = {
	entities: 15,
	entityCharacters: 120,
	modelCharacters: 128,
	normalizedTextCharacters: 150_000,
	openAiRetries: 1,
	pagesPerPdf: 50,
	pdfBytes: 25 * 1024 * 1024,
	pdfsPerCommand: 5,
	renderedPixelsPerPage: 16_000_000,
	sourceLanguageCharacters: 64,
	summaryCharacters: 2_000,
	tagCharacters: 64,
	tags: 7,
	titleCharacters: 120,
	documentTypeCharacters: 80,
	warnings: 10,
	warningCharacters: 240,
} as const;

export const MIN_USABLE_NON_WHITESPACE_CHARACTERS = 32;
