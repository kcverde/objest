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

	it('replaces a top-of-body callout after a frontmatter blank separator', () => {
		const existing = update('User body.\n');
		const note = `---\ntags:\n  - research\n---\n\n${existing}`;
		const result = update(note, 'Files/scan.pdf', {
			...analysis,
			title: 'Replacement title',
		});

		expect(result.match(/> \[!objest\]/gu)).toHaveLength(1);
		expect(result).toContain('---\n\n> [!objest] Replacement title');
		expect(result).toContain('User body.\n');
	});

	it('reruns after frontmatter is added following a no-frontmatter body write', () => {
		const firstWrite = update('User body.\n');
		const afterTagWrite = `---\ntags:\n  - research\n---\n\n${firstWrite}`;
		const secondWrite = update(afterTagWrite);

		expect(secondWrite).toBe(afterTagWrite);
		expect(secondWrite.match(/> \[!objest\]/gu)).toHaveLength(1);
		expect(secondWrite).toContain('User body.\n');
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

	it('ignores callout examples inside fenced code blocks', () => {
		const note = [
			'User body.',
			'',
			'```markdown',
			'> [!objest] Example only',
			'> **Source:** [[example.pdf]]',
			'>',
			'> Not managed output.',
			'```',
			'',
		].join('\n');
		const result = update(note);

		expect(result).toContain('> [!objest] Research report');
		expect(result).toContain('```markdown\n> [!objest] Example only');
		expect(result).toContain('User body.');
	});

	it('still rejects an actual callout after a fenced example', () => {
		const note = [
			'User body.',
			'',
			'~~~markdown',
			'> [!objest] Example only',
			'~~~',
			'',
			'> [!objest] Misplaced',
			'> **Source:** [[late.pdf]]',
			'>',
			'> Managed-looking output.',
		].join('\n');

		expect(() => update(note)).toThrow(ManagedSectionError);
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

	it.each([
		['LF', 'First paragraph.\n\nSecond paragraph.'],
		['CRLF', 'First paragraph.\r\n\r\nSecond paragraph.'],
		['lone CR', 'First paragraph.\r\rSecond paragraph.'],
	])('keeps every %s summary line inside the callout', (_name, summary) => {
		const result = update('', 'x.pdf', { ...analysis, summary });
		expect(result).toContain(
			'> First paragraph\\.\n>\n> Second paragraph\\.',
		);
		expect(
			result
				.trimEnd()
				.split('\n')
				.every((line) => line.startsWith('>')),
		).toBe(true);
	});

	it('rejects hostile multiline metadata before replacing an existing entry', () => {
		const existing = update('User body.\n', 'x.pdf');
		expect(() =>
			update(existing, 'x.pdf', {
				...analysis,
				documentType: 'Report\nEscaped user-owned text',
			}),
		).toThrow(ManagedSectionError);

		const retried = update(existing, 'x.pdf', {
			...analysis,
			summary: 'Safe replacement.',
		});
		expect(retried).not.toContain('Escaped user-owned text');
		expect(retried).toContain('User body.\n');
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
