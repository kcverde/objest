import type { App, TFile } from 'obsidian';
import type { V1AttachmentAnalysis } from '../analysis/attachment-analysis';
import { updateManagedEntry } from './managed-section';
import { FrontmatterTagsError, mergeGeneratedTags } from './tags';

export interface NoteWriteInput {
	analysis: V1AttachmentAnalysis;
	attachmentPath: string;
}

export interface NoteWriteResult {
	bodyWritten: true;
	tagsWritten: boolean;
	tagError?: string;
}

export class ObsidianNoteWriter {
	constructor(
		private readonly app: App,
		private readonly note: TFile,
	) {}

	async write(input: NoteWriteInput): Promise<NoteWriteResult> {
		await this.app.vault.process(this.note, (current) =>
			updateManagedEntry(current, input),
		);

		if (input.analysis.tags.length === 0)
			return { bodyWritten: true, tagsWritten: true };

		try {
			await this.app.fileManager.processFrontMatter(
				this.note,
				(frontmatter: Record<string, unknown>) => {
					frontmatter.tags = mergeGeneratedTags(
						frontmatter.tags,
						input.analysis.tags,
					);
				},
			);
			return { bodyWritten: true, tagsWritten: true };
		} catch (error) {
			return {
				bodyWritten: true,
				tagsWritten: false,
				tagError:
					error instanceof FrontmatterTagsError
						? error.message
						: 'The note frontmatter tags could not be updated.',
			};
		}
	}
}
