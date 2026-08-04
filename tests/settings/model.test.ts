import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from '../../src/settings/model';

describe('parseSettings', () => {
	it('returns independent defaults for non-object input', () => {
		expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings('invalid')).toEqual(DEFAULT_SETTINGS);
		expect(parseSettings([])).toEqual(DEFAULT_SETTINGS);
	});

	it('accepts only valid minimal-v1 values', () => {
		expect(
			parseSettings({
				openAiSecretId: 'objest-openai',
				privacyConsentVersion: 1,
			}),
		).toEqual({
			openAiSecretId: 'objest-openai',
			privacyConsentVersion: 1,
		});
	});

	it('drops unknown and legacy settings', () => {
		const parsed = parseSettings({
			largeRunPageThreshold: 999,
			modelIdOverride: 'other-model',
			ocrLanguages: ['spa'],
			openAiSecretId: 'objest-openai',
			privacyConsentVersion: 2,
			unknown: 'value',
		});

		expect(parsed).toEqual({
			openAiSecretId: 'objest-openai',
			privacyConsentVersion: 2,
		});
		expect(Object.keys(parsed)).toEqual([
			'openAiSecretId',
			'privacyConsentVersion',
		]);
	});

	it.each([
		{ openAiSecretId: 'UPPERCASE', privacyConsentVersion: 0 },
		{ openAiSecretId: 'contains spaces', privacyConsentVersion: 1.5 },
		{ openAiSecretId: 123, privacyConsentVersion: '1' },
	])('falls back for invalid values: %j', (value) => {
		expect(parseSettings(value)).toEqual(DEFAULT_SETTINGS);
	});
});
