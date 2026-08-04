export interface ObjestSettings {
	openAiSecretId: string;
	privacyConsentVersion: number | null;
}

export const DEFAULT_SETTINGS: ObjestSettings = {
	openAiSecretId: '',
	privacyConsentVersion: null,
};

const SECRET_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseSettings(value: unknown): ObjestSettings {
	if (!isRecord(value)) return { ...DEFAULT_SETTINGS };

	return {
		openAiSecretId: parseSecretId(value.openAiSecretId),
		privacyConsentVersion: parseConsentVersion(value.privacyConsentVersion),
	};
}

function parseSecretId(value: unknown): string {
	if (
		typeof value !== 'string' ||
		value.length > 128 ||
		(value.length > 0 && !SECRET_ID.test(value))
	) {
		return '';
	}
	return value;
}

function parseConsentVersion(value: unknown): number | null {
	return typeof value === 'number' &&
		Number.isSafeInteger(value) &&
		value >= 1
		? value
		: null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
