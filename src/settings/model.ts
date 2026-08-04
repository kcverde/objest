export interface ObjestSettings {
	largeRunPageThreshold: number;
	modelIdOverride: string;
	ocrLanguages: string[];
	openAiSecretId: string;
	privacyConsentVersion: number | null;
}

export const DEFAULT_SETTINGS: ObjestSettings = {
	largeRunPageThreshold: 50,
	modelIdOverride: '',
	ocrLanguages: ['eng'],
	openAiSecretId: '',
	privacyConsentVersion: null,
};

const TESSERACT_LANGUAGE_CODE = /^[a-z0-9_]{3,12}$/;

export function normalizeOcrLanguages(value: string): string[] {
	const normalized = value
		.split(',')
		.map((language) => language.trim().toLowerCase())
		.filter((language) => TESSERACT_LANGUAGE_CODE.test(language));

	return [...new Set(normalized.length > 0 ? normalized : ['eng'])];
}
