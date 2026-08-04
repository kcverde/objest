import {
	V1AttachmentAnalysisSchema,
	type V1AttachmentAnalysis,
} from '../analysis/attachment-analysis';

const CALLOUT_START = /^> \[!objest\] (.+)$/u;
const SOURCE_LINE = /^> \*\*Source:\*\* \[\[(.+)\]\]$/u;
const LEGACY_MANAGED_START = '<!-- objest:managed:start -->';
const LEGACY_MANAGED_END = '<!-- objest:managed:end -->';
const LEGACY_ENTRY_END = '<!-- objest:entry:end -->';
const LEGACY_ENTRY_START =
	/^<!-- objest:entry:start id="([A-Za-z0-9_-]+)" -->$/u;

export class ManagedSectionError extends Error {
	override readonly name = 'ManagedSectionError';
}

export interface RenderedAttachment {
	analysis: V1AttachmentAnalysis;
	attachmentPath: string;
}

interface ParsedCallout {
	end: number;
	sourceLine: string;
	start: number;
}

interface ParsedCalloutRegion {
	entries: ParsedCallout[];
	insertion: number;
}

interface LegacyEntry {
	end: number;
	id: string;
	start: number;
	text: string;
}

interface LegacySection {
	end: number;
	entries: LegacyEntry[];
	start: number;
}

export function updateManagedEntry(
	note: string,
	attachment: RenderedAttachment,
): string {
	const legacy = parseLegacySection(note);
	const parsed = parseCalloutRegion(note);
	const entry = renderEntry(attachment);
	const sourceLine = renderSourceLine(attachment.attachmentPath);

	if (legacy) {
		if (parsed.entries.length > 0)
			throw new ManagedSectionError(
				'Legacy Objest markers and Objest callouts cannot coexist.',
			);
		if (legacy.start !== parsed.insertion)
			throw new ManagedSectionError(
				'The legacy Objest section is not at the top of the note body.',
			);
		return migrateLegacySection(note, legacy, sourceLine, entry);
	}

	const existing = parsed.entries.find(
		(candidate) => candidate.sourceLine === sourceLine,
	);
	if (existing) {
		return `${note.slice(0, existing.start)}${entry}${note.slice(existing.end)}`;
	}

	const last = parsed.entries.at(-1);
	if (last) {
		return `${note.slice(0, last.end)}\n\n${entry}${note.slice(last.end)}`;
	}

	return insertAtBodyStart(note, parsed.insertion, entry);
}

export function renderEntry(attachment: RenderedAttachment): string {
	const validated = V1AttachmentAnalysisSchema.safeParse(attachment.analysis);
	if (!validated.success)
		throw new ManagedSectionError('The attachment analysis is invalid.');

	const analysis = validated.data;
	const sourceLine = renderSourceLine(attachment.attachmentPath);
	const lines = [
		`> [!objest] ${escapeMarkdown(analysis.title)}`,
		sourceLine,
		'>',
		...quoteLines(escapeParagraphs(analysis.summary)),
		'>',
	];

	if (analysis.documentType)
		lines.push(
			`> - **Document type:** ${escapeMarkdown(analysis.documentType)}`,
		);
	if (analysis.documentDate)
		lines.push(
			`> - **Document date:** ${escapeMarkdown(analysis.documentDate)}`,
		);
	if (analysis.entities.length > 0)
		lines.push(
			`> - **Entities:** ${analysis.entities.map(escapeMarkdown).join(', ')}`,
		);
	if (analysis.sourceLanguage)
		lines.push(
			`> - **Language:** ${escapeMarkdown(analysis.sourceLanguage)}`,
		);
	if (analysis.warnings.length > 0)
		lines.push(
			`> - **Warnings:** ${analysis.warnings.map(escapeMarkdown).join('; ')}`,
		);
	lines.push(
		`> - **Processed:** ${escapeMarkdown(analysis.processedAt)}`,
		`> - **Model:** \`${escapeCode(analysis.model)}\``,
	);

	const entry = lines.join('\n');
	const parsed = parseCalloutRegion(entry);
	const parsedEntry = parsed.entries[0];
	if (
		parsed.entries.length !== 1 ||
		parsedEntry?.start !== 0 ||
		parsedEntry?.end !== entry.length ||
		parsedEntry?.sourceLine !== sourceLine
	)
		throw new ManagedSectionError(
			'The rendered Objest callout does not match the owned-entry format.',
		);
	return entry;
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

function parseCalloutRegion(note: string): ParsedCalloutRegion {
	const insertion = frontmatterInsertionOffset(note);
	const lines = linesWithOffsets(note);
	let index = lines.findIndex((line) => line.start === insertion);
	if (index < 0) index = lines.length;

	const entries: ParsedCallout[] = [];
	const sources = new Set<string>();
	while (index < lines.length && CALLOUT_START.test(lines[index]!.text)) {
		const startIndex = index;
		let endIndex = index;
		while (
			endIndex + 1 < lines.length &&
			lines[endIndex + 1]!.text.startsWith('>')
		) {
			endIndex++;
		}
		const entryLines = lines.slice(startIndex, endIndex + 1);
		if (entryLines.length < 4 || !SOURCE_LINE.test(entryLines[1]!.text))
			throw new ManagedSectionError(
				'An Objest callout has an invalid source line or body.',
			);
		const sourceLine = entryLines[1]!.text;
		if (sources.has(sourceLine))
			throw new ManagedSectionError(
				'Objest callout sources must be unique.',
			);
		sources.add(sourceLine);
		entries.push({
			start: entryLines[0]!.start,
			end: entryLines.at(-1)!.contentEnd,
			sourceLine,
		});

		index = endIndex + 1;
		if (
			lines[index]?.text === '' &&
			CALLOUT_START.test(lines[index + 1]?.text ?? '')
		) {
			index += 1;
			continue;
		}
		break;
	}

	const recognizedStarts = new Set(entries.map(({ start }) => start));
	for (const line of lines) {
		if (
			line.text.startsWith('> [!objest') &&
			!recognizedStarts.has(line.start)
		) {
			throw new ManagedSectionError(
				'Objest callouts must use the exact format at the top of the note body.',
			);
		}
	}

	return { entries, insertion };
}

function parseLegacySection(note: string): LegacySection | null {
	const lines = linesWithOffsets(note);
	for (const line of lines) {
		if (
			line.text.includes('<!-- objest:') &&
			!isExactLegacyMarker(line.text)
		) {
			throw new ManagedSectionError(
				'Legacy Objest markers are malformed.',
			);
		}
	}

	const starts = lines.filter((line) => line.text === LEGACY_MANAGED_START);
	const ends = lines.filter((line) => line.text === LEGACY_MANAGED_END);
	if (starts.length === 0 && ends.length === 0) {
		if (
			lines.some(
				(line) =>
					LEGACY_ENTRY_START.test(line.text) ||
					line.text === LEGACY_ENTRY_END,
			)
		)
			throw new ManagedSectionError(
				'Legacy Objest entry markers are outside a managed section.',
			);
		return null;
	}
	if (
		starts.length !== 1 ||
		ends.length !== 1 ||
		starts[0]!.start >= ends[0]!.start
	)
		throw new ManagedSectionError(
			'Legacy Objest markers are missing, duplicated, or out of order.',
		);

	const managedStart = starts[0]!;
	const managedEnd = ends[0]!;
	const inside = lines.filter(
		(line) =>
			line.start > managedStart.start && line.start < managedEnd.start,
	);
	const ids = new Set<string>();
	const entries: LegacyEntry[] = [];
	let open: { id: string; start: number } | null = null;
	for (const line of inside) {
		const startMatch = LEGACY_ENTRY_START.exec(line.text);
		if (startMatch) {
			if (open)
				throw new ManagedSectionError(
					'Legacy Objest entries may not be nested.',
				);
			const id = startMatch[1]!;
			if (ids.has(id))
				throw new ManagedSectionError(
					'Legacy Objest entry IDs must be unique.',
				);
			ids.add(id);
			open = { id, start: line.start };
		} else if (line.text === LEGACY_ENTRY_END) {
			if (!open)
				throw new ManagedSectionError(
					'Legacy Objest entry end marker is orphaned.',
				);
			entries.push({
				...open,
				end: line.contentEnd,
				text: note.slice(open.start, line.contentEnd),
			});
			open = null;
		}
	}
	if (open)
		throw new ManagedSectionError(
			'Legacy Objest entry start marker is orphaned.',
		);

	if (
		lines.some(
			(line) =>
				(line.start < managedStart.start ||
					line.start > managedEnd.start) &&
				(LEGACY_ENTRY_START.test(line.text) ||
					line.text === LEGACY_ENTRY_END),
		)
	)
		throw new ManagedSectionError(
			'Legacy Objest entry markers are outside a managed section.',
		);

	const section = note.slice(managedStart.start, managedEnd.contentEnd);
	let residual = section;
	for (const entry of [...entries].reverse()) {
		const start = entry.start - managedStart.start;
		const end = entry.end - managedStart.start;
		residual = `${residual.slice(0, start)}${residual.slice(end)}`;
	}
	const residualContent = normalizeNewlines(residual)
		.split('\n')
		.filter((line) => line.trim().length > 0)
		.join('\n');
	const expectedResidual = `${LEGACY_MANAGED_START}\n## Objest\n${LEGACY_MANAGED_END}`;
	if (residualContent !== expectedResidual)
		throw new ManagedSectionError(
			'The legacy Objest section contains unrecognized content.',
		);

	return {
		start: managedStart.start,
		end: managedEnd.contentEnd,
		entries,
	};
}

function migrateLegacySection(
	note: string,
	legacy: LegacySection,
	currentSourceLine: string,
	currentEntry: string,
): string {
	const entries = legacy.entries.map(migrateLegacyEntry);
	const duplicateSources = new Set<string>();
	for (const entry of entries) {
		if (duplicateSources.has(entry.sourceLine))
			throw new ManagedSectionError(
				'Legacy Objest entries resolve to duplicate sources.',
			);
		duplicateSources.add(entry.sourceLine);
	}

	const existing = entries.findIndex(
		(entry) => entry.sourceLine === currentSourceLine,
	);
	if (existing >= 0)
		entries[existing] = {
			sourceLine: currentSourceLine,
			text: currentEntry,
		};
	else entries.push({ sourceLine: currentSourceLine, text: currentEntry });

	const rendered = entries.map(({ text }) => text).join('\n\n');
	const after = note.slice(legacy.end);
	return `${note.slice(0, legacy.start)}${rendered}${after || '\n'}`;
}

function migrateLegacyEntry(entry: LegacyEntry): {
	sourceLine: string;
	text: string;
} {
	const path = decodePathId(entry.id);
	const lines = entry.text.split(/\r?\n/u);
	if (
		lines[0] !== `<!-- objest:entry:start id="${entry.id}" -->` ||
		lines.at(-1) !== LEGACY_ENTRY_END ||
		!/^### \[\[.*\]\]$/u.test(lines[1] ?? '')
	)
		throw new ManagedSectionError(
			'A legacy Objest entry does not match the supported format.',
		);

	const body = lines.slice(2, -1);
	while (body[0] === '') body.shift();
	const sourceLine = renderSourceLine(path);
	const rendered = [
		`> [!objest] ${escapeMarkdown(titleFromPath(path))}`,
		sourceLine,
		'>',
		...quoteLines(body),
	].join('\n');
	return { sourceLine, text: rendered };
}

function decodePathId(id: string): string {
	try {
		const base64 = id.replace(/-/gu, '+').replace(/_/gu, '/');
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (character) =>
			character.charCodeAt(0),
		);
		const path = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		if (
			path.length === 0 ||
			/[\r\n\0]/u.test(path) ||
			encodePathId(path) !== id
		)
			throw new Error('Invalid path identity.');
		return path;
	} catch {
		throw new ManagedSectionError(
			'A legacy Objest entry has an invalid path identity.',
		);
	}
}

function renderSourceLine(path: string): string {
	if (path.length === 0 || /[\r\n\0]/u.test(path))
		throw new ManagedSectionError('The attachment path is invalid.');
	return `> **Source:** [[${escapeWikilink(path)}]]`;
}

function insertAtBodyStart(
	note: string,
	insertion: number,
	entry: string,
): string {
	const before = note.slice(0, insertion);
	const after = note.slice(insertion);
	const beforeSeparator =
		before.length > 0 && !before.endsWith('\n') ? '\n' : '';
	const afterSeparator = after.length > 0 ? '\n\n' : '\n';
	return `${before}${beforeSeparator}${entry}${afterSeparator}${after}`;
}

function isExactLegacyMarker(line: string): boolean {
	return (
		line === LEGACY_MANAGED_START ||
		line === LEGACY_MANAGED_END ||
		line === LEGACY_ENTRY_END ||
		LEGACY_ENTRY_START.test(line)
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

function quoteLines(lines: readonly string[]): string[] {
	return lines.map((line) => (line.length > 0 ? `> ${line}` : '>'));
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

function titleFromPath(path: string): string {
	const basename = path.split('/').at(-1) ?? path;
	const title = basename
		.replace(/\.pdf$/iu, '')
		.replace(/[_-]+/gu, ' ')
		.replace(/\s+/gu, ' ')
		.trim();
	return title || 'PDF document';
}

function normalizeNewlines(value: string): string {
	return value.replace(/\r\n/gu, '\n');
}
