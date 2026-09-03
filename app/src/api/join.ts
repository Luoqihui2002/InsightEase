import { request } from '@/lib/request';
import type { ApiResponse } from '@/types/api';
import type { DerivedDatasetMetadata, JoinPlan, JoinPreview } from '@/types/join';

export const joinApi = {
  preview: (joinPlan: JoinPlan, maxPreviewRows = 20) =>
    request.post<ApiResponse<JoinPreview>>('/assistant/join/preview', {
      join_plan: joinPlan,
      max_preview_rows: maxPreviewRows,
    }, {
      timeout: 65000,
    }),

  createDataset: (
    joinPlan: JoinPlan,
    filename: string,
    confirmHighRisk: boolean,
  ) =>
    request.post<ApiResponse<DerivedDatasetMetadata>>('/assistant/join/create-dataset', {
      join_plan: joinPlan,
      filename,
      confirm_create: true,
      confirm_high_risk: confirmHighRisk,
    }, {
      timeout: 120000,
    }),
};
