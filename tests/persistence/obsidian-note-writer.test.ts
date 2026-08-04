import { describe, expect, it, vi } from 'vitest';
import type { App, TFile } from 'obsidian';
import type { V1AttachmentAnalysis } from '../../src/analysis/attachment-analysis';
import { ObsidianNoteWriter } from '../../src/persistence/obsidian-note-writer';

const analysis: V1AttachmentAnalysis = {
	schemaVersion: 1,
	promptVersion: 1,
	summary: 'Summary',
	tags: ['new-tag'],
	documentType: null,
	documentDate: null,
	entities: [],
	sourceLanguage: null,
	warnings: [],
	model: 'gpt-5.6-luna',
	processedAt: '2026-08-03T00:00:00.000Z',
};

function harness(options: { bodyError?: Error; tagError?: Error } = {}) {
	let noteText = 'User text.\n';
	const frontmatter: Record<string, unknown> = {
		title: 'Keep',
		tags: 'existing',
	};
	const processFrontMatter = vi.fn(
		async (
			_file: TFile,
			transform: (value: Record<string, unknown>) => void,
		) => {
			if (options.tagError) throw options.tagError;
			transform(frontmatter);
		},
	);
	const process = vi.fn(
		async (_file: TFile, transform: (value: string) => string) => {
			if (options.bodyError) throw options.bodyError;
			noteText = transform(noteText);
			return noteText;
		},
	);
	const app = {
		vault: { process },
		fileManager: { processFrontMatter },
	} as unknown as App;
	const note: TFile = {
		basename: 'note',
		extension: 'md',
		name: 'note.md',
		parent: null,
		path: 'note.md',
		stat: { ctime: 0, mtime: 0, size: 0 },
		vault: app.vault,
	};
	return {
		frontmatter,
		noteText: () => noteText,
		process,
		processFrontMatter,
		writer: new ObsidianNoteWriter(app, note),
	};
}

describe('ObsidianNoteWriter', () => {
	it('writes the body first and additively merges scalar tags', async () => {
		const state = harness();
		await expect(
			state.writer.write({ analysis, attachmentPath: 'scan.pdf' }),
		).resolves.toEqual({ bodyWritten: true, tagsWritten: true });
		expect(state.noteText()).toContain('## Objest');
		expect(state.frontmatter).toEqual({
			title: 'Keep',
			tags: ['existing', 'new-tag'],
		});
		expect(state.process.mock.invocationCallOrder[0]).toBeLessThan(
			state.processFrontMatter.mock.invocationCallOrder[0]!,
		);
	});

	it('does not attempt tags when the managed body write fails', async () => {
		const state = harness({ bodyError: new Error('body failed') });
		await expect(
			state.writer.write({ analysis, attachmentPath: 'scan.pdf' }),
		).rejects.toThrow('body failed');
		expect(state.processFrontMatter).not.toHaveBeenCalled();
		expect(state.noteText()).toBe('User text.\n');
	});

	it('reports partial state when tags fail after the body succeeds', async () => {
		const state = harness({ tagError: new Error('invalid YAML tags') });
		await expect(
			state.writer.write({ analysis, attachmentPath: 'scan.pdf' }),
		).resolves.toMatchObject({
			bodyWritten: true,
			tagsWritten: false,
			tagError: 'The note frontmatter tags could not be updated.',
		});
		expect(state.noteText()).toContain('## Objest');
	});
});
