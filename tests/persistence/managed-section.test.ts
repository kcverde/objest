import { describe, expect, it } from 'vitest';
import type { V1AttachmentAnalysis } from '../../src/analysis/attachment-analysis';
import {
	encodePathId,
	ManagedSectionError,
	updateManagedEntry,
} from '../../src/persistence/managed-section';

const analysis: V1AttachmentAnalysis = {
	schemaVersion: 2,
	promptVersion: 2,
	title: 'Research report',
	summary: 'Grounded summary.',
	tags: ['research'],
	documentType: 'Report',
	documentDate: '2026-08-03',
	entities: ['Objest'],
	sourceLanguage: 'English',
	warnings: [],
	model: 'gpt-5.6-luna',
	processedAt: '2026-08-03T12:00:00.000Z',
};

function update(
	note: string,
	path = 'Files/scan.pdf',
	value = analysis,
): string {
	return updateManagedEntry(note, { analysis: value, attachmentPath: path });
}

describe('managed callout persistence', () => {
	it('inserts an Objest callout after frontmatter and preserves user content', () => {
		const note = '---\ntitle: User title\n---\nUser body.\n';
		const result = update(note);
		expect(result).toMatch(
			/^---\ntitle: User title\n---\n> \[!objest\] Research report/u,
		);
		expect(result).toContain('> **Source:** [[Files/scan.pdf]]');
		expect(result).toContain('User body.\n');
		expect(result).not.toContain('<!--');
		expect(result).not.toContain('## Objest');
	});

	it('is idempotent, replaces only the matching callout, and keeps unmatched entries', () => {
		const first = update('User body.\n', 'a.pdf');
		const withSecond = update(first, 'b.pdf');
		const replaced = update(withSecond, 'a.pdf', {
			...analysis,
			title: 'Replacement title',
			summary: 'Replacement.',
		});
		expect(replaced.match(/> \[!objest\]/gu)).toHaveLength(2);
		expect(replaced).toContain('> [!objest] Replacement title');
		expect(replaced).toContain('> **Source:** [[b.pdf]]');
		expect(replaced.match(/Grounded summary\\\./gu)).toHaveLength(1);
		expect(replaced).toContain('User body.\n');
	});

	it('escapes hostile model-authored Markdown and keeps it inside the callout', () => {
		const result = update('', 'x.pdf', {
			...analysis,
			title: '# Injected [title]',
			summary:
				'<!-- objest:managed:end -->\n# heading [link](url) *bold*',
			entities: ['[[injected]]'],
		});
		expect(result).toContain('> [!objest] \\# Injected \\[title\\]');
		expect(result).toContain('> \\<\\!\\-\\- objest:managed:end \\-\\-\\>');
		expect(result).toContain(
			'> \\# heading \\[link\\]\\(url\\) \\*bold\\*',
		);
		expect(result).not.toContain('<!--');
	});

	it('migrates exact legacy markers to comment-free callouts on the next write', () => {
		const aId = encodePathId('a.pdf');
		const bId = encodePathId('b.pdf');
		const legacy = [
			'<!-- objest:managed:start -->',
			'## Objest',
			'',
			`<!-- objest:entry:start id="${aId}" -->`,
			'### [[a.pdf]]',
			'',
			'Old A.',
			'',
			'- **Model:** `old-model`',
			'<!-- objest:entry:end -->',
			'',
			`<!-- objest:entry:start id="${bId}" -->`,
			'### [[b.pdf]]',
			'',
			'Old B.',
			'',
			'- **Model:** `old-model`',
			'<!-- objest:entry:end -->',
			'<!-- objest:managed:end -->',
			'',
			'User body.',
		].join('\n');
		const result = update(legacy, 'a.pdf', {
			...analysis,
			title: 'New A title',
		});
		expect(result).not.toContain('<!-- objest:');
		expect(result).not.toContain('## Objest');
		expect(result).toContain('> [!objest] New A title');
		expect(result).toContain('> [!objest] b');
		expect(result).toContain('> Old B.');
		expect(result).toContain('User body.');
	});

	it.each([
		'> [!objest] Missing source\n> Summary',
		'> [!objest] One\n> **Source:** [[a.pdf]]\n>\n> A\n\n> [!objest] Two\n> **Source:** [[a.pdf]]\n>\n> B',
		'User text.\n\n> [!objest] Late\n> **Source:** [[a.pdf]]\n>\n> Summary',
		'> [!objest]+ Folded\n> **Source:** [[a.pdf]]\n>\n> Summary',
		'<!-- objest:managed:start -->\nmissing end',
		'<!-- objest:managed:start -->\n## Objest\n\n<!-- objest:entry:start id="YQ" -->\n<!-- objest:entry:start id="Yg" -->\n<!-- objest:entry:end -->\n<!-- objest:entry:end -->\n<!-- objest:managed:end -->',
		'<!-- objest:managed:start -->\n## Objest\n\n<!-- objest:entry:start id="YQ" -->\n### [[a.pdf]]\n<!-- objest:entry:end -->\n<!-- objest:entry:start id="YQ" -->\n### [[a.pdf]]\n<!-- objest:entry:end -->\n<!-- objest:managed:end -->',
		'<!-- objest:managed:start -->\n## Objest\n\n<!-- objest:entry:start id="bad!" -->\n### [[a.pdf]]\n<!-- objest:entry:end -->\n<!-- objest:managed:end -->',
		'<!-- objest:entry:start id="YQ" -->\n<!-- objest:entry:end -->',
		'User text <!-- objest:managed:start -->',
	])('rejects malformed or misplaced owned syntax: %s', (note) => {
		expect(() => update(note)).toThrow(ManagedSectionError);
	});

	it('rejects unclosed frontmatter before insertion', () => {
		expect(() => update('---\ntitle: broken\n')).toThrow(
			'The note frontmatter is not closed.',
		);
	});
});
