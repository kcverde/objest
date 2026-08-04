import type { V1AttachmentAnalysis } from '../analysis/attachment-analysis';

export const MANAGED_START = '<!-- objest:managed:start -->';
export const MANAGED_END = '<!-- objest:managed:end -->';
const ENTRY_END = '<!-- objest:entry:end -->';
const ENTRY_START = /^<!-- objest:entry:start id="([A-Za-z0-9_-]+)" -->$/u;

export class ManagedSectionError extends Error {
	override readonly name = 'ManagedSectionError';
}

export interface RenderedAttachment {
	analysis: V1AttachmentAnalysis;
	attachmentPath: string;
}

export function updateManagedEntry(
	note: string,
	attachment: RenderedAttachment,
): string {
	const parsed = parseManagedSection(note);
	const entry = renderEntry(attachment);

	if (!parsed) {
		const section = `${MANAGED_START}\n## Objest\n\n${entry}\n${MANAGED_END}`;
		const insertion = frontmatterInsertionOffset(note);
		const before = note.slice(0, insertion);
		const after = note.slice(insertion);
		return `${before}${before.length > 0 && !before.endsWith('\n') ? '\n' : ''}${section}\n\n${after}`;
	}

	const id = encodePathId(attachment.attachmentPath);
	const existing = parsed.entries.find((candidate) => candidate.id === id);
	let section: string;
	if (existing) {
		section = `${parsed.text.slice(0, existing.start)}${entry}${parsed.text.slice(existing.end)}`;
	} else {
		const endOffset = parsed.text.lastIndexOf(MANAGED_END);
		const prefix = parsed.text.slice(0, endOffset).replace(/\s*$/u, '');
		section = `${prefix}\n\n${entry}\n${MANAGED_END}`;
	}
	return `${note.slice(0, parsed.start)}${section}${note.slice(parsed.end)}`;
}

export function renderEntry({
	analysis,
	attachmentPath,
}: RenderedAttachment): string {
	const id = encodePathId(attachmentPath);
	const lines = [
		`<!-- objest:entry:start id="${id}" -->`,
		`### [[${escapeWikilink(attachmentPath)}]]`,
		'',
		...escapeParagraphs(analysis.summary),
		'',
	];

	if (analysis.documentType)
		lines.push(
			`- **Document type:** ${escapeMarkdown(analysis.documentType)}`,
		);
	if (analysis.documentDate)
		lines.push(
			`- **Document date:** ${escapeMarkdown(analysis.documentDate)}`,
		);
	if (analysis.entities.length > 0)
		lines.push(
			`- **Entities:** ${analysis.entities.map(escapeMarkdown).join(', ')}`,
		);
	if (analysis.sourceLanguage)
		lines.push(
			`- **Language:** ${escapeMarkdown(analysis.sourceLanguage)}`,
		);
	if (analysis.warnings.length > 0)
		lines.push(
			`- **Warnings:** ${analysis.warnings.map(escapeMarkdown).join('; ')}`,
		);
	lines.push(
		`- **Processed:** ${escapeMarkdown(analysis.processedAt)}`,
		`- **Model:** \`${escapeCode(analysis.model)}\``,
		ENTRY_END,
	);
	return lines.join('\n');
}

export function encodePathId(path: string): string {
	const bytes = new TextEncoder().encode(path);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replace(/\+/gu, '-')
		.replace(/\//gu, '_')
		.replace(/=+$/gu, '');
}

interface ParsedManagedSection {
	end: number;
	entries: { end: number; id: string; start: number }[];
	start: number;
	text: string;
}

export function parseManagedSection(note: string): ParsedManagedSection | null {
	const lines = linesWithOffsets(note);
	for (const line of lines) {
		if (line.text.includes('<!-- objest:') && !isExactMarker(line.text)) {
			throw new ManagedSectionError('Objest markers are malformed.');
		}
	}

	const starts = lines.filter((line) => line.text === MANAGED_START);
	const ends = lines.filter((line) => line.text === MANAGED_END);
	if (starts.length === 0 && ends.length === 0) {
		if (
			lines.some(
				(line) =>
					ENTRY_START.test(line.text) || line.text === ENTRY_END,
			)
		)
			throw new ManagedSectionError(
				'Objest entry markers are outside a managed section.',
			);
		return null;
	}
	if (
		starts.length !== 1 ||
		ends.length !== 1 ||
		starts[0]!.start >= ends[0]!.start
	)
		throw new ManagedSectionError(
			'Objest managed markers are missing, duplicated, or out of order.',
		);

	const managedStart = starts[0]!;
	const managedEnd = ends[0]!;
	const inside = lines.filter(
		(line) =>
			line.start > managedStart.start && line.start < managedEnd.start,
	);
	if (
		lines.some(
			(line) =>
				(line.start < managedStart.start ||
					line.start > managedEnd.start) &&
				(ENTRY_START.test(line.text) || line.text === ENTRY_END),
		)
	)
		throw new ManagedSectionError(
			'Objest entry markers are outside a managed section.',
		);

	const ids = new Set<string>();
	const entries: { end: number; id: string; start: number }[] = [];
	let open: { id: string; start: number } | null = null;
	for (const line of inside) {
		const startMatch = ENTRY_START.exec(line.text);
		if (startMatch) {
			if (open)
				throw new ManagedSectionError(
					'Objest entries may not be nested.',
				);
			const id = startMatch[1]!;
			if (ids.has(id))
				throw new ManagedSectionError(
					'Objest entry IDs must be unique.',
				);
			ids.add(id);
			open = { id, start: line.start - managedStart.start };
		} else if (line.text === ENTRY_END) {
			if (!open)
				throw new ManagedSectionError(
					'Objest entry end marker is orphaned.',
				);
			entries.push({
				...open,
				end: line.contentEnd - managedStart.start,
			});
			open = null;
		}
	}
	if (open)
		throw new ManagedSectionError('Objest entry start marker is orphaned.');

	return {
		start: managedStart.start,
		end: managedEnd.contentEnd,
		text: note.slice(managedStart.start, managedEnd.contentEnd),
		entries,
	};
}

function isExactMarker(line: string): boolean {
	return (
		line === MANAGED_START ||
		line === MANAGED_END ||
		line === ENTRY_END ||
		ENTRY_START.test(line)
	);
}

function frontmatterInsertionOffset(note: string): number {
	const lines = linesWithOffsets(note);
	if (lines[0]?.text !== '---') return 0;
	const closing = lines.slice(1).find((line) => line.text === '---');
	if (!closing)
		throw new ManagedSectionError('The note frontmatter is not closed.');
	return closing.end;
}

function linesWithOffsets(value: string): {
	contentEnd: number;
	end: number;
	start: number;
	text: string;
}[] {
	const lines: {
		contentEnd: number;
		end: number;
		start: number;
		text: string;
	}[] = [];
	const pattern = /.*(?:\r\n|\n|$)/gu;
	for (const match of value.matchAll(pattern)) {
		if (match[0] === '') continue;
		const start = match.index;
		const text = match[0].replace(/(?:\r\n|\n)$/u, '');
		lines.push({
			start,
			contentEnd: start + text.length,
			end: start + match[0].length,
			text,
		});
	}
	return lines;
}

function escapeParagraphs(value: string): string[] {
	return value.split('\n').map(escapeMarkdown);
}

function escapeMarkdown(value: string): string {
	return value.replace(/([\\`*_[\]{}<>()#+.!|>-])/gu, '\\$1');
}

function escapeCode(value: string): string {
	return value.replace(/[`\\]/gu, '\\$&');
}

function escapeWikilink(value: string): string {
	return value.replace(/([\\|\]])/gu, '\\$1');
}
