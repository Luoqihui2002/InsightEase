export interface SafeResultSummary {
  analysis_id: string;
  analysis_type: string;
  status: string;
  dataset_id?: string;
  dataset_name?: string;
  created_at?: string;
  completed_at?: string;
  title: string;
  subtitle?: string;
  ai_summary?: string;
  ai_interpretation?: string;
  result_keys: string[];
  metrics: SafeMetricSummary[];
  tables: SafeTableSummary[];
  charts: SafeChartSummary[];
  warnings: string[];
  available_actions: SafeResultAction[];
}

export interface SafeMetricSummary {
  label: string;
  value: string | number;
  unit?: string;
  description?: string;
}

export interface SafeTableSummary {
  title: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total_rows?: number;
  truncated: boolean;
}

export interface SafeChartSummary {
  title: string;
  chart_type?: string;
  x_key?: string;
  y_keys?: string[];
  description?: string;
}

export interface SafeResultAction {
  id: string;
  label: string;
  target?: string;
}
