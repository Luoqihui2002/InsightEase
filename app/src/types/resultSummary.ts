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
  explanation_hints?: SafeResultExplanationHints;
  available_actions: SafeResultAction[];
}

export interface SafeResultExplanationHints {
  analysis_goal?: string;
  method?: string;
  selected_fields?: string[];
  model_name?: string;
  primary_metric_names?: string[];
  primary_metric_interpretation?: string[];
  module_specific_findings?: string[];
  chart_summaries?: SafeChartExplanationSummary[];
  table_summaries?: SafeTableExplanationSummary[];
  limitations?: string[];
  recommended_followups?: string[];
}

export interface SafeChartExplanationSummary {
  chart_type: string;
  title?: string;
  x_field?: string;
  y_field?: string;
  trend?: 'up' | 'down' | 'flat' | 'mixed' | 'unknown';
  notable_points?: string[];
}

export interface SafeTableExplanationSummary {
  name: string;
  row_count?: number;
  column_count?: number;
  key_columns?: string[];
  notable_values?: string[];
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
