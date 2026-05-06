import type { Analysis } from '@/types/api';
import {
  DEFAULT_RESULT_FOLLOWUP_PROMPTS,
  dispatchAIWorkbenchHandoff,
} from '@/lib/assistant/aiWorkbenchHandoff';
import { buildSafeResultSummary } from '@/lib/assistant/safeResultSummary';

interface HandoffAnalysisResultInput {
  analysis?: Analysis | null;
  analysisId?: string;
  analysisType: string;
  datasetId: string;
  datasetName?: string;
  resultData: unknown;
  params?: Record<string, unknown>;
  suggestedPrompts?: string[];
}

export function handoffAnalysisResultToWorkbench({
  analysis,
  analysisId,
  analysisType,
  datasetId,
  datasetName,
  resultData,
  params,
  suggestedPrompts = DEFAULT_RESULT_FOLLOWUP_PROMPTS,
}: HandoffAnalysisResultInput): void {
  const now = new Date().toISOString();
  const analysisForSummary =
    analysis
      ? ({
          ...analysis,
          result_data: resultData,
        } as Analysis)
      : ({
          id: analysisId ?? `local-${analysisType}-${Date.now()}`,
          dataset_id: datasetId,
          type: analysisType,
          status: 'completed',
          params: params ?? {},
          result_data: resultData,
          created_at: now,
          completed_at: now,
        } as Analysis);

  dispatchAIWorkbenchHandoff({
    source: 'analysis_result',
    analysis_id: analysisId ?? analysis?.id,
    safe_result_summary: buildSafeResultSummary(analysisForSummary, {
      dataset_name: datasetName,
    }),
    suggested_prompts: suggestedPrompts,
    created_at: now,
  });
}
