import { request } from '@/lib/request';
import type { DatasetProfile, InferRelationshipsRequest, InferRelationshipsResponse } from '@/types/assistant';
import type { ApiResponse } from '@/types/api';

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
};
