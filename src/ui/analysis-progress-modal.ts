import { App, ButtonComponent, Modal } from 'obsidian';
import type { RunOutcome, RunProgress } from '../commands/run-analysis';

export type AnalysisRun = (
	signal: AbortSignal,
	onProgress: (progress: RunProgress) => void,
) => Promise<RunOutcome[]>;

export class AnalysisProgressModal extends Modal {
	private readonly controller = new AbortController();
	private cancelButton: ButtonComponent | null = null;
	private completion: (() => void) | null = null;
	private finished = false;
	private resultsEl: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;

	constructor(
		app: App,
		private readonly runAnalysis: AnalysisRun,
	) {
		super(app);
	}

	openAndWait(): Promise<void> {
		return new Promise((resolve) => {
			this.completion = resolve;
			this.open();
		});
	}

	override onOpen(): void {
		this.setTitle(['Analyze embedded ', 'PDFs'].join(''));
		this.contentEl.createEl('p', {
			text: 'Objest processes each PDF locally, then sends its bounded normalized text to OpenAI. Reprocessing may incur API costs.',
		});
		this.statusEl = this.contentEl.createEl('p', {
			cls: 'objest-status',
			text: 'Starting…',
		});
		this.resultsEl = this.contentEl.createDiv({ cls: 'objest-results' });
		const actions = this.contentEl.createDiv({ cls: 'objest-actions' });
		this.cancelButton = new ButtonComponent(actions)
			.setButtonText('Cancel')
			.onClick(() => {
				this.controller.abort();
				this.statusEl?.setText('Cancelling…');
			});
		void this.run();
	}

	override onClose(): void {
		if (!this.finished) this.controller.abort();
		this.contentEl.empty();
	}

	private async run(): Promise<void> {
		let outcomes: RunOutcome[] = [];
		try {
			outcomes = await this.runAnalysis(
				this.controller.signal,
				(progress) => this.showProgress(progress),
			);
			this.showOutcomes(outcomes);
		} catch (error) {
			this.statusEl?.setText(
				`Objest could not start: ${error instanceof Error ? error.message : 'unknown error'}`,
			);
		} finally {
			this.finished = true;
			this.replaceActionsWithClose();
			this.completion?.();
			this.completion = null;
		}
	}

	private showProgress(progress: RunProgress): void {
		if (progress.stage === 'writing') {
			this.cancelButton?.setButtonText('Writing…').setDisabled(true);
		} else if (!this.controller.signal.aborted) {
			this.cancelButton?.setButtonText('Cancel').setDisabled(false);
		}
		const labels: Record<RunProgress['stage'], string> = {
			reading: 'Reading',
			extracting: 'Extracting',
			rendering: 'Rendering',
			ocr: 'OCR',
			analyzing: 'Analyzing',
			validating: 'Validating',
			writing: 'Writing',
		};
		this.statusEl?.setText(
			`${labels[progress.stage]} ${progress.attachment.displayName} (${progress.index + 1}/${progress.total})…`,
		);
	}

	private showOutcomes(outcomes: readonly RunOutcome[]): void {
		let written = 0;
		let failed = 0;
		let cancelled = 0;
		for (const outcome of outcomes) {
			if (outcome.status === 'written') written++;
			else if (outcome.status === 'cancelled') cancelled++;
			else failed++;
			const item = this.resultsEl?.createDiv({ cls: 'objest-result' });
			item?.createEl('strong', { text: outcome.attachment.displayName });
			item?.createDiv({
				text:
					outcome.status === 'written'
						? 'Written'
						: outcome.status === 'partial'
							? (outcome.message ??
								'Summary written; tags failed.')
							: outcome.status === 'cancelled'
								? 'Cancelled'
								: (outcome.message ?? 'Failed'),
			});
		}
		this.statusEl?.setText(
			`Completed: ${written} written, ${failed} failed, ${cancelled} cancelled.`,
		);
	}

	private replaceActionsWithClose(): void {
		this.cancelButton = null;
		const actions = this.contentEl.querySelector('.objest-actions');
		if (!(actions instanceof HTMLElement)) return;
		actions.empty();
		new ButtonComponent(actions)
			.setButtonText('Close')
			.setCta()
			.onClick(() => this.close());
	}
}
