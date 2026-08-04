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
	documentType: z
		.string()
		.min(1)
		.max(V1_LIMITS.documentTypeCharacters)
		.nullable(),
	documentDate: z.string().max(10).nullable(),
	entities: z
		.array(z.string().min(1).max(V1_LIMITS.entityCharacters))
		.max(V1_LIMITS.entities),
	sourceLanguage: z
		.string()
		.min(1)
		.max(V1_LIMITS.sourceLanguageCharacters)
		.nullable(),
	warnings: z
		.array(z.string().min(1).max(V1_LIMITS.warningCharacters))
		.max(V1_LIMITS.warnings),
});

export type ModelGeneratedAnalysis = z.infer<
	typeof ModelGeneratedAnalysisSchema
>;

export const V1AttachmentAnalysisSchema = z.strictObject({
	schemaVersion: z.literal(V1_SCHEMA_VERSION),
	promptVersion: z.literal(V1_PROMPT_VERSION),
	title: boundedTrimmedString(V1_LIMITS.titleCharacters).refine(
		(value) => !/[\r\n]/u.test(value),
		{ message: 'Title must be a single line.' },
	),
	summary: boundedTrimmedString(V1_LIMITS.summaryCharacters),
	tags: z
		.array(normalizedTagSchema)
		.max(V1_LIMITS.tags)
		.refine((values) => new Set(values).size === values.length, {
			message: 'Tags must be unique.',
		}),
	documentType: boundedTrimmedString(
		V1_LIMITS.documentTypeCharacters,
	).nullable(),
	documentDate: documentDateSchema.nullable(),
	entities: z
		.array(boundedTrimmedString(V1_LIMITS.entityCharacters))
		.max(V1_LIMITS.entities)
		.refine((values) => new Set(values).size === values.length, {
			message: 'Entities must be unique.',
		}),
	sourceLanguage: boundedTrimmedString(
		V1_LIMITS.sourceLanguageCharacters,
	).nullable(),
	warnings: z
		.array(boundedTrimmedString(V1_LIMITS.warningCharacters))
		.max(V1_LIMITS.warnings),
	model: boundedTrimmedString(V1_LIMITS.modelCharacters),
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
