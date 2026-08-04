import type { V1AttachmentAnalysis } from '../analysis/attachment-analysis';

export interface AnalysisPageInput {
	pageNumber: number;
	text: string;
}

export interface AnalysisProvider {
	analyze(
		pages: readonly AnalysisPageInput[],
		signal: AbortSignal,
	): Promise<V1AttachmentAnalysis>;
}

export type AnalysisProviderErrorCode =
	| 'authentication'
	| 'cancelled'
	| 'invalid-response'
	| 'network'
	| 'provider'
	| 'rate-limit';

export class AnalysisProviderError extends Error {
	override readonly name = 'AnalysisProviderError';

	constructor(
		readonly code: AnalysisProviderErrorCode,
		message: string,
		readonly retryable: boolean,
	) {
		super(message);
	}
}
