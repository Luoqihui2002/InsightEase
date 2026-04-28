import { request } from '@/lib/request';
import type { ApiResponse } from '@/types/api';
import type {
  WorkshopOperation,
  TransformOptions,
  TransformPreview,
  TransformResult,
} from '@/types/workshop';

export const workshopApi = {
  /**
   * 预览操作链执行结果（不保存）
   * POST /datasets/{dataset_id}/transform/preview
   */
  preview: (datasetId: string, operations: WorkshopOperation[]) =>
    request.post<ApiResponse<TransformPreview>>(
      `/datasets/${datasetId}/transform/preview`,
      { operations }
    ),

  /**
   * 执行操作链并保存为新数据集
   * POST /datasets/{dataset_id}/transform
   */
  transform: (
    datasetId: string,
    operations: WorkshopOperation[],
    options?: TransformOptions
  ) =>
    request.post<ApiResponse<TransformResult>>(
      `/datasets/${datasetId}/transform`,
      { operations, options }
    ),
};
