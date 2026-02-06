import { request } from '@/lib/request';
import type { ApiResponse, PaginationData, Dataset, DatasetPreview } from '@/types/api';

export const datasetApi = {
  // 上传文件（带进度回调）
  upload: (file: File, onProgress?: (percent: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return request.post<ApiResponse<Dataset>>('/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percent);
        }
      },
    });
  },

  // 获取列表
  list: (page = 1, pageSize = 10) => 
    request.get<ApiResponse<PaginationData<Dataset>>>('/datasets', {
      params: { page, page_size: pageSize }
    }),

  // 获取详情
  getDetail: (id: string) => 
    request.get<ApiResponse<Dataset>>(`/datasets/${id}`),

  // 预览数据
  preview: (id: string, rows = 20) => 
    request.get<ApiResponse<DatasetPreview>>(`/datasets/${id}/preview`, {
      params: { rows }
    }),

  // 删除
  delete: (id: string) => 
    request.delete<ApiResponse<null>>(`/datasets/${id}`),

  // 重命名
  rename: (id: string, newName: string) => 
    request.patch<ApiResponse<Dataset>>(`/datasets/${id}`, {
      filename: newName
    }),
};