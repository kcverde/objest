import type { V1AttachmentAnalysis } from '../../src/analysis/attachment-analysis';
import type {
	AnalysisPageInput,
	AnalysisProvider,
} from '../../src/providers/analysis-provider';

export type FakeAnalysisOutcome = V1AttachmentAnalysis | Error;

export class FakeAnalysisProvider implements AnalysisProvider {
	readonly calls: AnalysisPageInput[][] = [];

	constructor(private readonly outcomes: FakeAnalysisOutcome[]) {}

	async analyze(
		pages: readonly AnalysisPageInput[],
		signal: AbortSignal,
	): Promise<V1AttachmentAnalysis> {
		if (signal.aborted) {
			throw new DOMException('Analysis cancelled.', 'AbortError');
		}
		this.calls.push(pages.map((page) => ({ ...page })));
		const outcome = this.outcomes.shift();
		if (!outcome) throw new Error('No fake analysis outcome is queued.');
		if (outcome instanceof Error) throw outcome;
		return outcome;
	}
}
