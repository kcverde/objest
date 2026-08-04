import {
	App,
	ButtonComponent,
	PluginSettingTab,
	SecretComponent,
	Setting,
	type SettingDefinitionItem,
} from 'obsidian';
import type ObjestPlugin from '../main';
import { V1_CONSENT_VERSION } from '../domain/v1-constants';

const OPENAI_SECRET_DESCRIPTION =
	'Select an Obsidian secret containing your OpenAI API key. The key is not stored in Objest settings.';

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
				desc: OPENAI_SECRET_DESCRIPTION,
				render: (setting) => {
					this.addSecretComponent(setting.controlEl);
				},
			},
			{
				name: 'OpenAI data consent',
				desc: this.consentDescription(),
				render: (setting) => this.addConsentReset(setting.controlEl),
			},
		];
	}

	override display(): void {
		this.containerEl.empty();
		const secretSetting = new Setting(this.containerEl)
			.setName('OpenAI API key')
			.setDesc(OPENAI_SECRET_DESCRIPTION);
		this.addSecretComponent(secretSetting.controlEl);

		const consentSetting = new Setting(this.containerEl)
			.setName('OpenAI data consent')
			.setDesc(this.consentDescription());
		this.addConsentReset(consentSetting.controlEl);
	}

	private addConsentReset(containerEl: HTMLElement): void {
		const button = new ButtonComponent(containerEl)
			.setButtonText('Reset consent')
			.setDisabled(
				this.objest.settings.privacyConsentVersion !==
					V1_CONSENT_VERSION,
			);
		button.onClick(async () => {
			this.objest.settings.privacyConsentVersion = null;
			await this.objest.saveSettings();
			button.setDisabled(true);
		});
	}

	private consentDescription(): string {
		const status =
			this.objest.settings.privacyConsentVersion === V1_CONSENT_VERSION
				? 'Accepted.'
				: 'Not accepted.';
		return `${status} Objest sends bounded normalized PDF text and page-order labels to OpenAI using your key; it does not send PDF bytes, images, filenames, paths, note names, or unrelated vault content. Requests may cost money and use store: false, subject to OpenAI abuse-monitoring retention.`;
	}

	private addSecretComponent(containerEl: HTMLElement): void {
		new SecretComponent(this.app, containerEl)
			.setValue(this.objest.settings.openAiSecretId)
			.onChange(async (value) => {
				this.objest.settings.openAiSecretId = value;
				await this.objest.saveSettings();
			});
	}
}
