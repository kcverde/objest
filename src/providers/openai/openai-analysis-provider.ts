import OpenAI, {
	APIConnectionError,
	APIError,
	APIUserAbortError,
	AuthenticationError,
	RateLimitError,
} from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { ZodError } from 'zod';
import {
	createAttachmentAnalysis,
	ModelGeneratedAnalysisSchema,
	type V1AttachmentAnalysis,
} from '../../analysis/attachment-analysis';
import { buildAnalysisPrompt } from '../../analysis/prompt';
import { V1_LIMITS, V1_MODEL_ID } from '../../domain/v1-constants';
import {
	AnalysisProviderError,
	type AnalysisPageInput,
	type AnalysisProvider,
} from '../analysis-provider';

interface OpenAIAnalysisProviderOptions {
	apiKey: string;
	fetch?: typeof window.fetch;
	now?: () => Date;
}

export class OpenAIAnalysisProvider implements AnalysisProvider {
	private readonly client: OpenAI;
	private readonly now: () => Date;

	constructor(options: OpenAIAnalysisProviderOptions) {
		this.client = new OpenAI({
			apiKey: options.apiKey,
			dangerouslyAllowBrowser: true,
			fetch: options.fetch,
			maxRetries: V1_LIMITS.openAiRetries,
		});
		this.now = options.now ?? (() => new Date());
	}

	async analyze(
		pages: readonly AnalysisPageInput[],
		signal: AbortSignal,
	): Promise<V1AttachmentAnalysis> {
		const input = buildAnalysisPrompt(pages);

		try {
			const response = await this.client.responses.parse(
				{
					input,
					model: V1_MODEL_ID,
					store: false,
					text: {
						format: zodTextFormat(
							ModelGeneratedAnalysisSchema,
							'objest_v1_analysis',
						),
					},
				},
				{ signal },
			);

			if (
				response.status !== 'completed' ||
				response.output_parsed === null
			) {
				throw invalidResponseError();
			}

			return createAttachmentAnalysis(
				response.output_parsed,
				response.model,
				this.now().toISOString(),
			);
		} catch (error) {
			throw mapProviderError(error, signal);
		}
	}
}

function mapProviderError(
	error: unknown,
	signal: AbortSignal,
): AnalysisProviderError {
	if (error instanceof AnalysisProviderError) return error;
	if (
		signal.aborted ||
		error instanceof APIUserAbortError ||
		(error instanceof DOMException && error.name === 'AbortError')
	) {
		return new AnalysisProviderError(
			'cancelled',
			'OpenAI analysis was cancelled.',
			false,
		);
	}
	if (error instanceof AuthenticationError) {
		return new AnalysisProviderError(
			'authentication',
			'OpenAI rejected the configured API key.',
			false,
		);
	}
	if (error instanceof RateLimitError) {
		return new AnalysisProviderError(
			'rate-limit',
			'OpenAI rate-limited the analysis request.',
			true,
		);
	}
	if (error instanceof APIConnectionError) {
		return new AnalysisProviderError(
			'network',
			'Objest could not reach OpenAI.',
			true,
		);
	}
	if (error instanceof ZodError || error instanceof SyntaxError) {
		return invalidResponseError();
	}
	if (error instanceof APIError) {
		return new AnalysisProviderError(
			'provider',
			'OpenAI could not complete the analysis request.',
			typeof error.status === 'number' && error.status >= 500,
		);
	}
	return new AnalysisProviderError(
		'provider',
		'OpenAI analysis failed unexpectedly.',
		false,
	);
}

function invalidResponseError(): AnalysisProviderError {
	return new AnalysisProviderError(
		'invalid-response',
		'OpenAI returned an invalid structured analysis.',
		false,
	);
}
