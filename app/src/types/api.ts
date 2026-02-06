// 通用响应
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginationData<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
}

// 数据集
export interface FieldSchema {
  name: string;
  dtype: string;
  semantic_type?: string;
  sample_values?: any[];
}

export interface Dataset {
  id: string;
  filename: string;
  row_count: number;
  col_count: number;
  file_size: number;
  schema: FieldSchema[];
  quality_score?: number;
  ai_summary?: string;
  status: 'uploaded' | 'scanning' | 'ready' | 'error';
  created_at: string;
}

export interface DatasetPreview {
  columns: string[];
  data: Record<string, any>[];
  total_rows: number;
}

// 分析任务
export interface Analysis {
  id: string;
  dataset_id: string;
  type: 'statistics' | 'clustering' | 'rfm' | 'funnel' | 'time_series' | 'attribution';
  status: 'pending' | 'running' | 'completed' | 'failed';
  params: Record<string, any>;
  result_data?: any;
  ai_interpretation?: string;
  ai_recommendations?: string[];
  export_files?: { excel?: string; pdf?: string };
  created_at: string;
  completed_at?: string;
  error_msg?: string;
}

// AI对话
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}