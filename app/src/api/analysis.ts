import { request } from '@/lib/request';
import type { ApiResponse, Analysis } from '@/types/api';

export interface CreateAnalysisParams {
  dataset_id: string;
  analysis_type: string;
  params?: Record<string, any>;
}

export const analysisApi = {
  // 创建分析任务
  create: (data: CreateAnalysisParams) => 
    request.post<ApiResponse<Analysis>>('/analyses/', data),

  // 获取分析任务详情
  get: (id: string) => 
    request.get<ApiResponse<Analysis>>(`/analyses/${id}`),

  // 获取分析结果（包含 result_data）
  getResult: (id: string) =>
    request.get<ApiResponse<Analysis>>(`/analyses/${id}/result`),

  // 获取分析列表
  list: (page = 1, pageSize = 10) =>
    request.get<ApiResponse<{total: number, items: Analysis[]}>>(`/analyses`, {
      params: { page, page_size: pageSize }
    }),

  // 获取数据集的所有分析
  listByDataset: (datasetId: string) => 
    request.get<ApiResponse<Analysis[]>>(`/analyses/dataset/${datasetId}`),

  // 删除分析
  delete: (id: string) => 
    request.delete<ApiResponse<null>>(`/analyses/${id}`),

  // ========== 路径分析 API ==========
  
  // 快速路径分析（同步执行）
  quickPathAnalysis: (datasetId: string, pathType: string, params: any) =>
    request.post<ApiResponse<any>>(`/analyses/path/quick`, {
      dataset_id: datasetId,
      path_type: pathType,
      ...params
    }),

  // 获取路径分析建议的列
  getPathColumns: (datasetId: string) =>
    request.get<ApiResponse<{
      columns: any[];
      suggested_user_id?: string;
      suggested_event?: string;
      suggested_timestamp?: string;
    }>>(`/analyses/path/columns/${datasetId}`),

  // ========== 聚类分析 API ==========
  
  // 运行聚类分析
  runClustering: (params: {
    dataset_id: string;
    columns: string[];
    n_clusters: number;
    data?: number[][];
  }) =>
    request.post<ApiResponse<{
      n_clusters: number;
      labels: number[];
      centers: number[][];
      silhouette_score?: number;
      cluster_sizes: number[];
    }>>('/analyses/clustering', params),

  // 保存聚类结果为新数据集
  saveClusterResult: (params: {
    source_dataset_id: string;
    user_cluster_mapping: { user_id: string; cluster: number }[];
    user_id_col: string;
    cluster_descriptions?: string[];
  }) =>
    request.post<ApiResponse<{
      dataset_id: string;
      filename: string;
      row_count: number;
      col_count: number;
      new_column: string;
      cluster_count: number;
    }>>('/analyses/clustering/save', params),

  // ========== 序列模式挖掘 API ==========
  
  // 快速序列模式挖掘（同步执行）
  quickSequenceMining: (params: {
    dataset_id: string;
    user_id_col: string;
    event_col: string;
    timestamp_col: string;
    conversion_col?: string;
    additional_event_col?: string;
    min_support?: number;
    max_pattern_length?: number;
    min_confidence?: number;
  }) =>
    request.post<ApiResponse<{
      frequent_patterns: any[];
      association_rules: any[];
      high_conversion_patterns: any[];
      sequence_stats: any;
      total_sequences: number;
      avg_sequence_length: number;
    }>>('/analyses/sequence/quick', params),
};
