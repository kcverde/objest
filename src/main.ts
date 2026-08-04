import { Plugin } from 'obsidian';
import { registerCommands } from './commands/register';
import {
	DEFAULT_SETTINGS,
	parseSettings,
	type ObjestSettings,
} from './settings/model';
import { ObjestSettingTab } from './settings/tab';

export default class ObjestPlugin extends Plugin {
	override settings: ObjestSettings = { ...DEFAULT_SETTINGS };

	override async onload(): Promise<void> {
		await this.loadSettings();
		registerCommands(this);
		this.addSettingTab(new ObjestSettingTab(this.app, this));
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async loadSettings(): Promise<void> {
		this.settings = parseSettings(await this.loadData());
	}
}
