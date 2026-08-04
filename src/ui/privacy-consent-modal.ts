import { App, ButtonComponent, Modal } from 'obsidian';

const LOCAL_PROCESSING_DISCLOSURE =
	'Objest extracts PDF text and performs English OCR locally. It sends bounded normalized document text and numeric page-order labels to OpenAI using your API key. OpenAI usage may cost money.';
const SECRET_DISCLOSURE =
	'Your key remains in Obsidian SecretStorage, but it is used from this local desktop renderer and could be inspected by another process or plugin with access to the same runtime. Results are written automatically after validation.';

export class PrivacyConsentModal extends Modal {
	private settled = false;
	private resolveResult: ((accepted: boolean) => void) | null = null;

	constructor(app: App) {
		super(app);
	}

	request(): Promise<boolean> {
		this.open();
		return new Promise((resolve) => {
			this.resolveResult = resolve;
		});
	}

	override onOpen(): void {
		this.setTitle('Allow OpenAI analysis?');
		this.contentEl.createEl('p', {
			text: LOCAL_PROCESSING_DISCLOSURE,
		});
		this.contentEl.createEl('p', {
			text: 'Objest does not send the source PDF, page images, filename, vault path, note name, or unrelated vault content. Requests use store: false, although OpenAI may retain data in abuse-monitoring logs under its current policies.',
		});
		this.contentEl.createEl('p', {
			text: SECRET_DISCLOSURE,
		});
		const actions = this.contentEl.createDiv({ cls: 'objest-actions' });
		new ButtonComponent(actions)
			.setButtonText('Cancel')
			.onClick(() => this.finish(false));
		new ButtonComponent(actions)
			.setButtonText('Allow and continue')
			.setCta()
			.onClick(() => this.finish(true));
	}

	override onClose(): void {
		this.contentEl.empty();
		if (!this.settled) this.finish(false, false);
	}

	private finish(accepted: boolean, close = true): void {
		if (this.settled) return;
		this.settled = true;
		this.resolveResult?.(accepted);
		if (close) this.close();
	}
}
