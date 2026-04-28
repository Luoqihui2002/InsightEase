/**
 * Workshop Transform API 类型定义 (Backend V1)
 * 对应后端 schemas/transform.py 结构
 */

// ===== 操作配置 =====

export interface FilterCondition {
  column: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startswith' | 'endswith' | 'isNull' | 'isNotNull';
  value?: string;
}

export interface FilterConfig {
  conditions: FilterCondition[];
  logic: 'and' | 'or';
}

export interface SelectConfig {
  columns: string[];
}

export interface RenameMapping {
  old: string;
  new: string;
}

export interface RenameConfig {
  mappings: RenameMapping[];
}

export interface SortConfig {
  by: string[];
  ascending?: boolean[];
  na_position?: 'first' | 'last';
}

export interface DedupConfig {
  columns: string[];
  keep?: 'first' | 'last';
  case_sensitive?: boolean;
}

export interface DeriveConfig {
  newColumn: string;
  formula: string;
}

export interface SampleConfig {
  method: 'count' | 'percentage';
  count?: number;
  percentage?: number;
  seed?: number;
}

// ===== Operation Union =====

export type WorkshopOperation =
  | { type: 'filter'; config: FilterConfig }
  | { type: 'select'; config: SelectConfig }
  | { type: 'rename'; config: RenameConfig }
  | { type: 'sort'; config: SortConfig }
  | { type: 'dedup'; config: DedupConfig }
  | { type: 'derive'; config: DeriveConfig }
  | { type: 'sample'; config: SampleConfig };

// ===== Request / Response =====

export interface TransformOptions {
  filename?: string;
  save_mode?: 'new_dataset' | 'version';
}

export interface ColumnStat {
  name: string;
  dtype: string;
  non_null_count: number;
  null_count: number;
  min?: number;
  max?: number;
  mean?: number;
}

export interface ExecutionSummary {
  steps_executed: number;
  duration_ms: number;
  warnings: string[];
}

export interface TransformPreview {
  columns: string[];
  data: Record<string, any>[];
  total_rows: number;
  preview_limit: number;
  column_stats: ColumnStat[];
  execution_summary: ExecutionSummary;
}

export interface TransformResult {
  new_dataset_id: string;
  filename: string;
  row_count: number;
  col_count: number;
  parent_dataset_id: string;
  transform_chain: WorkshopOperation[];
  execution_summary: ExecutionSummary & {
    input_rows?: number;
    output_rows?: number;
  };
}
