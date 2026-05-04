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
   * Validate and dry-run future Hermes result explanation payloads.
   * Does not call Hermes/LLM and does not generate a live explanation.
   */
  explainResultWithHermesDryRun: (payload: HermesExplainResultRequest) =>
    request.post<ApiResponse<HermesExplainResultResponse>>('/assistant/hermes/explain-result', payload),

  /**
   * Validate and dry-run future Hermes planning payloads.
   * Does not execute analysis, generate SQL, or switch the active runtime.
   */
  planAnalysisWithHermesDryRun: (payload: HermesPlanAnalysisRequest) =>
    request.post<ApiResponse<HermesPlanAnalysisResponse>>('/assistant/hermes/plan-analysis', payload),
};
