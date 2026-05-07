import { request } from '@/lib/request';
import type { DatasetProfile, InferRelationshipsRequest, InferRelationshipsResponse } from '@/types/assistant';
import type { ApiResponse } from '@/types/api';
import type {
  HermesExplainResultRequest,
  HermesExplainResultResponse,
  HermesPlanAnalysisRequest,
  HermesPlanAnalysisResponse,
  HermesStatusResponse,
} from '@/types/hermes';

export const assistantApi = {
  /**
   * Generate a structured DatasetProfile for a given dataset.
   * Read-only: never modifies the source dataset.
   */
  profileDataset: (datasetId: string, includeExamples = true) =>
    request.post<ApiResponse<DatasetProfile>>('/assistant/profile-dataset', null, {
      params: { dataset_id: datasetId, include_examples: includeExamples },
    }),

  /**
   * Infer relationships between multiple datasets using metadata only.
   * Read-only: never modifies datasets. No LLM calls.
   */
  inferRelationships: (payload: InferRelationshipsRequest) =>
    request.post<ApiResponse<InferRelationshipsResponse>>('/assistant/infer-relationships', payload),

  /**
   * Check future Hermes assistant backend availability.
   * Dry-run scaffold only; callers must keep deterministic fallback behavior.
   */
  getHermesStatus: () =>
    request.get<ApiResponse<HermesStatusResponse>>('/assistant/hermes/status'),

  /**
   * Explain a SafeResultSummary through the InsightEase backend Hermes boundary.
   * The backend may use disabled/dry-run/live mode based on server config and
   * must return a fallback-shaped response when live Hermes is unavailable.
   */
  explainResultWithHermes: (payload: HermesExplainResultRequest) =>
    request.post<ApiResponse<HermesExplainResultResponse>>('/assistant/hermes/explain-result', payload, {
      timeout: 65000,
    }),

  /**
   * Backward-compatible alias for dry-run contract checks.
   */
  explainResultWithHermesDryRun: (payload: HermesExplainResultRequest) =>
    request.post<ApiResponse<HermesExplainResultResponse>>('/assistant/hermes/explain-result', payload, {
      timeout: 65000,
    }),

  /**
   * Validate and dry-run future Hermes planning payloads.
   * Does not execute analysis, generate SQL, or switch the active runtime.
   */
  planAnalysisWithHermesDryRun: (payload: HermesPlanAnalysisRequest) =>
    request.post<ApiResponse<HermesPlanAnalysisResponse>>('/assistant/hermes/plan-analysis', payload),
};
