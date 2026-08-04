import {
	App,
	PluginSettingTab,
	SecretComponent,
	Setting,
	type SettingDefinitionItem,
} from 'obsidian';
import type ObjestPlugin from '../main';
import { normalizeOcrLanguages } from './model';

const OCR_LANGUAGES_KEY = 'ocrLanguagesText';
const OCR_LANGUAGE_PLACEHOLDER = 'eng';

export class ObjestSettingTab extends PluginSettingTab {
	constructor(
		app: App,
		private readonly objest: ObjestPlugin,
	) {
		super(app, objest);
	}

	override getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: 'OpenAI API key',
				desc: 'Select an Obsidian secret containing your OpenAI API key. The key is not stored in Objest settings.',
				render: (setting) => {
					new SecretComponent(this.app, setting.controlEl)
						.setValue(this.objest.settings.openAiSecretId)
						.onChange(async (value) => {
							this.objest.settings.openAiSecretId = value;
							await this.objest.saveSettings();
						});
				},
			},
			{
				name: 'OCR languages',
				desc: 'Comma-separated Tesseract language codes. English (eng) is used when the value is empty.',
				control: {
					type: 'text',
					key: OCR_LANGUAGES_KEY,
					defaultValue: 'eng',
					placeholder: 'eng',
				},
			},
			{
				name: 'OpenAI model override',
				desc: 'Optional advanced model ID. Leave empty to use Objest’s tested default once AI analysis is implemented.',
				control: {
					type: 'text',
					key: 'modelIdOverride',
					defaultValue: '',
					placeholder: 'Use Objest default',
				},
			},
			{
				name: 'Large-run page threshold',
				desc: 'Objest will require confirmation before AI processing when a run exceeds this approximate page count.',
				control: {
					type: 'number',
					key: 'largeRunPageThreshold',
					defaultValue: 50,
					min: 1,
					max: 10_000,
					step: 1,
				},
			},
		];
	}

	override display(): void {
		this.containerEl.empty();

		const secretSetting = new Setting(this.containerEl)
			.setName('OpenAI API key')
			.setDesc(
				'Select an Obsidian secret containing your OpenAI API key. The key is not stored in Objest settings.',
			);
		new SecretComponent(this.app, secretSetting.controlEl)
			.setValue(this.objest.settings.openAiSecretId)
			.onChange(async (value) => {
				this.objest.settings.openAiSecretId = value;
				await this.objest.saveSettings();
			});

		new Setting(this.containerEl)
			.setName('OCR languages')
			.setDesc(
				'Comma-separated Tesseract language codes. English (eng) is used when the value is empty.',
			)
			.addText((text) =>
				text
					.setPlaceholder(OCR_LANGUAGE_PLACEHOLDER)
					.setValue(this.objest.settings.ocrLanguages.join(', '))
					.onChange(async (value) => {
						await this.setControlValue(OCR_LANGUAGES_KEY, value);
					}),
			);

		new Setting(this.containerEl)
			.setName('OpenAI model override')
			.setDesc(
				'Optional advanced model ID. Leave empty to use Objest’s tested default once AI analysis is implemented.',
			)
			.addText((text) =>
				text
					.setPlaceholder('Use Objest default')
					.setValue(this.objest.settings.modelIdOverride)
					.onChange(async (value) => {
						await this.setControlValue('modelIdOverride', value);
					}),
			);

		new Setting(this.containerEl)
			.setName('Large-run page threshold')
			.setDesc(
				'Objest will require confirmation before AI processing when a run exceeds this approximate page count.',
			)
			.addText((text) =>
				text
					.setPlaceholder('50')
					.setValue(
						String(this.objest.settings.largeRunPageThreshold),
					)
					.onChange(async (value) => {
						const parsed = Number.parseInt(value, 10);
						if (Number.isFinite(parsed)) {
							await this.setControlValue(
								'largeRunPageThreshold',
								parsed,
							);
						}
					}),
			);
	}

	override getControlValue(key: string): unknown {
		switch (key) {
			case OCR_LANGUAGES_KEY:
				return this.objest.settings.ocrLanguages.join(', ');
			case 'modelIdOverride':
				return this.objest.settings.modelIdOverride;
			case 'largeRunPageThreshold':
				return this.objest.settings.largeRunPageThreshold;
			default:
				return undefined;
		}
	}

	override async setControlValue(key: string, value: unknown): Promise<void> {
		switch (key) {
			case OCR_LANGUAGES_KEY:
				if (typeof value === 'string') {
					this.objest.settings.ocrLanguages =
						normalizeOcrLanguages(value);
				}
				break;
			case 'modelIdOverride':
				if (typeof value === 'string') {
					this.objest.settings.modelIdOverride = value.trim();
				}
				break;
			case 'largeRunPageThreshold':
				if (
					typeof value === 'number' &&
					value >= 1 &&
					value <= 10_000
				) {
					this.objest.settings.largeRunPageThreshold =
						Math.floor(value);
				}
				break;
			default:
				return;
		}
		await this.objest.saveSettings();
	}
}
