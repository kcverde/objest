import { describe, expect, it, vi } from 'vitest';
import { OpenAIAnalysisProvider } from '../../src/providers/openai/openai-analysis-provider';
import { AnalysisProviderError } from '../../src/providers/analysis-provider';

const modelOutput = {
	title: 'Synthetic research report',
	summary: 'Synthetic grounded summary.',
	tags: ['#Research Notes'],
	documentType: 'Report',
	documentDate: '2026-08-03',
	entities: ['Objest'],
	sourceLanguage: 'English',
	warnings: [],
};

function responseBody(
	output: unknown = modelOutput,
	options: { model?: string; status?: 'completed' | 'incomplete' } = {},
): Record<string, unknown> {
	const status = options.status ?? 'completed';
	return {
		id: 'resp_test',
		object: 'response',
		created_at: 0,
		status,
		incomplete_details:
			status === 'incomplete' ? { reason: 'max_output_tokens' } : null,
		model: options.model ?? 'gpt-5.6-luna-2026-08-01',
		output:
			status === 'completed'
				? [
						{
							id: 'msg_test',
							type: 'message',
							role: 'assistant',
							status: 'completed',
							content: [
								{
									type: 'output_text',
									text: JSON.stringify(output),
									annotations: [],
									logprobs: [],
								},
							],
						},
					]
				: [],
	};
}

function jsonResponse(
	body: unknown,
	status = 200,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json', ...headers },
	});
}

describe('OpenAIAnalysisProvider', () => {
	it('uses the official SDK to send the fixed privacy-bounded request', async () => {
		let capturedUrl = '';
		const capturedBodies: Record<string, unknown>[] = [];
		const fakeFetch = vi.fn(
			async (input: RequestInfo | URL, init?: RequestInit) => {
				capturedUrl =
					typeof input === 'string'
						? input
						: input instanceof URL
							? input.href
							: input.url;
				if (typeof init?.body !== 'string') {
					throw new Error(
						'Expected the SDK to send a JSON string body.',
					);
				}
				capturedBodies.push(
					JSON.parse(init.body) as Record<string, unknown>,
				);
				return jsonResponse(responseBody());
			},
		);
		const provider = new OpenAIAnalysisProvider({
			apiKey: 'test-key-not-real',
			fetch: fakeFetch,
			now: () => new Date('2026-08-03T12:00:00.000Z'),
		});

		const result = await provider.analyze(
			[
				{ pageNumber: 1, text: 'Synthetic page one.' },
				{ pageNumber: 2, text: 'Synthetic page two.' },
			],
			new AbortController().signal,
		);

		expect(fakeFetch).toHaveBeenCalledTimes(1);
		expect(capturedUrl).toBe('https://api.openai.com/v1/responses');
		const requestBody = capturedBodies[0];
		if (!requestBody)
			throw new Error('The SDK did not send a request body.');
		expect(requestBody).toMatchObject({
			model: 'gpt-5.6-luna',
			store: false,
		});
		expect(requestBody).not.toHaveProperty('metadata');
		expect(requestBody).not.toHaveProperty('user');
		expect(requestBody).not.toHaveProperty('previous_response_id');
		const serialized = JSON.stringify(requestBody);
		expect(serialized).not.toContain('private.pdf');
		expect(serialized).not.toContain('/vault/');
		expect(serialized).not.toContain('noteName');
		expect(requestBody.text).toMatchObject({
			format: {
				type: 'json_schema',
				name: 'objest_v1_analysis_v2',
				strict: true,
				schema: {
					additionalProperties: false,
					required: [
						'title',
						'summary',
						'tags',
						'documentType',
						'documentDate',
						'entities',
						'sourceLanguage',
						'warnings',
					],
				},
			},
		});
		expect(requestBody.input).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ role: 'developer' }),
				expect.objectContaining({ role: 'user' }),
			]),
		);
		expect(result).toMatchObject({
			schemaVersion: 2,
			promptVersion: 2,
			title: 'Synthetic research report',
			tags: ['research-notes'],
			model: 'gpt-5.6-luna-2026-08-01',
			processedAt: '2026-08-03T12:00:00.000Z',
		});
	});

	it('rejects oversized input before fetch', async () => {
		const fakeFetch = vi.fn();
		const provider = new OpenAIAnalysisProvider({
			apiKey: 'test-key-not-real',
			fetch: fakeFetch,
		});
		await expect(
			provider.analyze(
				[{ pageNumber: 1, text: 'x'.repeat(150_001) }],
				new AbortController().signal,
			),
		).rejects.toThrow(RangeError);
		expect(fakeFetch).not.toHaveBeenCalled();
	});

	it('honors a pre-aborted signal without calling fetch', async () => {
		const fakeFetch = vi.fn();
		const provider = new OpenAIAnalysisProvider({
			apiKey: 'test-key-not-real',
			fetch: fakeFetch,
		});
		const controller = new AbortController();
		controller.abort();
		await expect(
			provider.analyze(
				[{ pageNumber: 1, text: 'Synthetic text.' }],
				controller.signal,
			),
		).rejects.toMatchObject({ code: 'cancelled' });
		expect(fakeFetch).not.toHaveBeenCalled();
	});

	it.each([
		['malformed structured output', responseBody({ summary: 3 })],
		[
			'incomplete response',
			responseBody(modelOutput, { status: 'incomplete' }),
		],
		[
			'refusal response',
			{
				...responseBody(),
				output: [
					{
						id: 'msg_test',
						type: 'message',
						role: 'assistant',
						status: 'completed',
						content: [
							{
								type: 'refusal',
								refusal: 'Cannot comply.',
							},
						],
					},
				],
			},
		],
	])('maps %s to a redacted invalid-response error', async (_name, body) => {
		const provider = new OpenAIAnalysisProvider({
			apiKey: 'test-key-not-real',
			fetch: async () => jsonResponse(body),
		});
		const error = await provider
			.analyze(
				[{ pageNumber: 1, text: 'Synthetic text.' }],
				new AbortController().signal,
			)
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(AnalysisProviderError);
		expect(error).toMatchObject({
			code: 'invalid-response',
			retryable: false,
		});
		expect(String(error)).not.toContain('Cannot comply');
	});

	it('maps authentication failures without leaking provider content', async () => {
		const provider = new OpenAIAnalysisProvider({
			apiKey: 'test-key-not-real',
			fetch: async () =>
				jsonResponse(
					{
						error: {
							message: 'provider body contains sensitive detail',
							type: 'invalid_request_error',
							code: 'invalid_api_key',
						},
					},
					401,
				),
		});
		const error = await provider
			.analyze(
				[{ pageNumber: 1, text: 'Synthetic text.' }],
				new AbortController().signal,
			)
			.catch((caught: unknown) => caught);
		expect(error).toMatchObject({
			code: 'authentication',
			retryable: false,
		});
		expect(String(error)).not.toContain('sensitive detail');
	});

	it('allows exactly one SDK retry for transient failures', async () => {
		const fakeFetch = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse(
					{ error: { message: 'temporary', type: 'server_error' } },
					500,
					{ 'retry-after-ms': '0' },
				),
			)
			.mockResolvedValueOnce(jsonResponse(responseBody()));
		const provider = new OpenAIAnalysisProvider({
			apiKey: 'test-key-not-real',
			fetch: fakeFetch,
		});
		await expect(
			provider.analyze(
				[{ pageNumber: 1, text: 'Synthetic text.' }],
				new AbortController().signal,
			),
		).resolves.toMatchObject({ summary: 'Synthetic grounded summary.' });
		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});

	it('never attempts a second retry', async () => {
		const fakeFetch = vi.fn(async () =>
			jsonResponse(
				{ error: { message: 'temporary', type: 'server_error' } },
				500,
				{ 'retry-after-ms': '0' },
			),
		);
		const provider = new OpenAIAnalysisProvider({
			apiKey: 'test-key-not-real',
			fetch: fakeFetch,
		});
		await expect(
			provider.analyze(
				[{ pageNumber: 1, text: 'Synthetic text.' }],
				new AbortController().signal,
			),
		).rejects.toMatchObject({ code: 'provider' });
		expect(fakeFetch).toHaveBeenCalledTimes(2);
	});
});
