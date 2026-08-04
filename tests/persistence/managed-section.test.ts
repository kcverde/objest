import { describe, expect, it } from 'vitest';
import type { V1AttachmentAnalysis } from '../../src/analysis/attachment-analysis';
import {
	encodePathId,
	MANAGED_END,
	MANAGED_START,
	ManagedSectionError,
	parseManagedSection,
	updateManagedEntry,
} from '../../src/persistence/managed-section';

const analysis: V1AttachmentAnalysis = {
	schemaVersion: 1,
	promptVersion: 1,
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

describe('managed section persistence', () => {
	it('inserts after frontmatter and preserves user content', () => {
		const note = '---\ntitle: User title\n---\nUser body.\n';
		const result = update(note);
		expect(result).toMatch(
			/^---\ntitle: User title\n---\n<!-- objest:managed:start -->/u,
		);
		expect(result).toContain('User body.\n');
		expect(result).toContain(`id="${encodePathId('Files/scan.pdf')}"`);
	});

	it('is idempotent, replaces only the matching entry, and keeps unmatched entries', () => {
		const first = update('User body.\n', 'a.pdf');
		const withSecond = update(first, 'b.pdf');
		const replaced = update(withSecond, 'a.pdf', {
			...analysis,
			summary: 'Replacement.',
		});
		expect(replaced.match(/objest:managed:start/gu)).toHaveLength(1);
		expect(replaced.match(/objest:entry:start/gu)).toHaveLength(2);
		expect(replaced).toContain('Replacement\\.');
		expect(replaced).toContain('### [[b.pdf]]');
		expect(replaced.match(/Grounded summary\\\./gu)).toHaveLength(1);
	});

	it('escapes hostile model-authored Markdown and marker text', () => {
		const result = update('', 'x.pdf', {
			...analysis,
			summary:
				'<!-- objest:managed:end -->\n# heading [link](url) *bold*',
			entities: ['[[injected]]'],
		});
		expect(result).toContain('\\<\\!\\-\\- objest:managed:end \\-\\-\\>');
		expect(result).toContain('\\# heading \\[link\\]\\(url\\) \\*bold\\*');
		expect(() => parseManagedSection(result)).not.toThrow();
	});

	it.each([
		`${MANAGED_START}\nmissing end`,
		`${MANAGED_END}`,
		`${MANAGED_START}\n${MANAGED_START}\n${MANAGED_END}`,
		`${MANAGED_START}\n<!-- objest:entry:start id="YQ" -->\n<!-- objest:entry:start id="Yg" -->\n<!-- objest:entry:end -->\n<!-- objest:entry:end -->\n${MANAGED_END}`,
		`${MANAGED_START}\n<!-- objest:entry:start id="bad!" -->\n<!-- objest:entry:end -->\n${MANAGED_END}`,
		`${MANAGED_START}\n<!-- objest:entry:start id="YQ" -->\n<!-- objest:entry:end -->\n<!-- objest:entry:start id="YQ" -->\n<!-- objest:entry:end -->\n${MANAGED_END}`,
		'User text <!-- objest:managed:start -->',
	])(
		'rejects malformed markers without returning a transformation: %s',
		(note) => {
			expect(() => update(note)).toThrow(ManagedSectionError);
		},
	);

	it('rejects unclosed frontmatter before insertion', () => {
		expect(() => update('---\ntitle: broken\n')).toThrow(
			'The note frontmatter is not closed.',
		);
	});
});
