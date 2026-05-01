import { request } from '@/lib/request';
import type { DatasetProfile } from '@/types/assistant';
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
};
