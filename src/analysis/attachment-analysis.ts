import { z } from 'zod';
import {
	V1_LIMITS,
	V1_PROMPT_VERSION,
	V1_SCHEMA_VERSION,
} from '../domain/v1-constants';
import { characterLength, normalizeTag, normalizeTags } from './tags';

const boundedTrimmedString = (maximum: number) =>
	z
		.string()
		.min(1)
		.max(maximum)
		.refine((value) => value === value.trim(), {
			message: 'Value must not have surrounding whitespace.',
		});

const boundedTrimmedSingleLineString = (maximum: number) =>
	boundedTrimmedString(maximum).refine((value) => !/[\r\n]/u.test(value), {
		message: 'Value must be a single line.',
	});

const normalizedTagSchema = z
	.string()
	.min(1)
	.refine((value) => characterLength(value) <= V1_LIMITS.tagCharacters, {
		message: 'Tag is too long.',
	})
	.refine((value) => normalizeTag(value) === value, {
		message: 'Tag is not normalized.',
	});

const documentDateSchema = z
	.string()
	.refine(isRealCalendarDate, { message: 'Invalid calendar date.' });

const singleLineString = (maximum: number) =>
	z
		.string()
		.min(1)
		.max(maximum)
		.refine((value) => !/[\r\n]/u.test(value), {
			message: 'Value must be a single line.',
		});

export const ModelGeneratedAnalysisSchema = z.strictObject({
	title: singleLineString(V1_LIMITS.titleCharacters),
	summary: z.string().min(1).max(V1_LIMITS.summaryCharacters),
	tags: z
		.array(z.string().min(1).max(V1_LIMITS.tagCharacters))
		.max(V1_LIMITS.tags),
	documentType: singleLineString(V1_LIMITS.documentTypeCharacters).nullable(),
	documentDate: z.string().max(10).nullable(),
	entities: z
		.array(singleLineString(V1_LIMITS.entityCharacters))
		.max(V1_LIMITS.entities),
	sourceLanguage: singleLineString(
		V1_LIMITS.sourceLanguageCharacters,
	).nullable(),
	warnings: z
		.array(singleLineString(V1_LIMITS.warningCharacters))
		.max(V1_LIMITS.warnings),
});

export type ModelGeneratedAnalysis = z.infer<
	typeof ModelGeneratedAnalysisSchema
>;

export const V1AttachmentAnalysisSchema = z.strictObject({
	schemaVersion: z.literal(V1_SCHEMA_VERSION),
	promptVersion: z.literal(V1_PROMPT_VERSION),
	title: boundedTrimmedSingleLineString(V1_LIMITS.titleCharacters),
	summary: boundedTrimmedString(V1_LIMITS.summaryCharacters).transform(
		(value) => value.replace(/\r\n?/gu, '\n'),
	),
	tags: z
		.array(normalizedTagSchema)
		.max(V1_LIMITS.tags)
		.refine((values) => new Set(values).size === values.length, {
			message: 'Tags must be unique.',
		}),
	documentType: boundedTrimmedSingleLineString(
		V1_LIMITS.documentTypeCharacters,
	).nullable(),
	documentDate: documentDateSchema.nullable(),
	entities: z
		.array(boundedTrimmedSingleLineString(V1_LIMITS.entityCharacters))
		.max(V1_LIMITS.entities)
		.refine((values) => new Set(values).size === values.length, {
			message: 'Entities must be unique.',
		}),
	sourceLanguage: boundedTrimmedSingleLineString(
		V1_LIMITS.sourceLanguageCharacters,
	).nullable(),
	warnings: z
		.array(boundedTrimmedSingleLineString(V1_LIMITS.warningCharacters))
		.max(V1_LIMITS.warnings),
	model: boundedTrimmedSingleLineString(V1_LIMITS.modelCharacters),
	processedAt: z.iso.datetime({ offset: false }),
});

export type V1AttachmentAnalysis = z.infer<typeof V1AttachmentAnalysisSchema>;

export function createAttachmentAnalysis(
	modelOutput: unknown,
	model: string,
	processedAt: string,
): V1AttachmentAnalysis {
	const generated = ModelGeneratedAnalysisSchema.parse(modelOutput);
	const entities = unique(generated.entities.map((value) => value.trim()));

	return V1AttachmentAnalysisSchema.parse({
		schemaVersion: V1_SCHEMA_VERSION,
		promptVersion: V1_PROMPT_VERSION,
		title: generated.title.trim(),
		summary: generated.summary.trim(),
		tags: normalizeTags(generated.tags),
		documentType: generated.documentType?.trim() ?? null,
		documentDate: generated.documentDate,
		entities,
		sourceLanguage: generated.sourceLanguage?.trim() ?? null,
		warnings: generated.warnings.map((warning) => warning.trim()),
		model,
		processedAt,
	});
}

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function isRealCalendarDate(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(Date.UTC(2000, month - 1, day));
	date.setUTCFullYear(year);
	return (
		date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
	);
}
