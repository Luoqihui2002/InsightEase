/**
 * AI Data Assistant type contracts.
 *
 * These types define the metadata schema used by the assistant to understand
 * datasets without accessing full raw data.
 */

export type ColumnRole =
  | "user_id"
  | "device_id"
  | "session_id"
  | "order_id"
  | "product_id"
  | "event_name"
  | "timestamp"
  | "date"
  | "metric"
  | "dimension"
  | "category"
  | "treatment_group"
  | "label_target"
  | "amount_revenue"
  | "status"
  | "text_field"
  | "unknown";

export type SemanticType =
  | "numeric"
  | "categorical"
  | "datetime"
  | "boolean"
  | "text"
  | "identifier"
  | "unknown";

export type TableType =
  | "user"
  | "order"
  | "event_log"
  | "product"
  | "campaign"
  | "experiment"
  | "transaction"
  | "dimension"
  | "metric_summary"
  | "review_text"
  | "unknown";

export interface ColumnProfile {
  name: string;
  dtype: string;
  semanticType: SemanticType;
  role: ColumnRole;
  nullCount: number;
  nullRate: number;
  uniqueCount: number;
  uniqueRate: number;
  examples: unknown[];
  min?: number | string | null;
  max?: number | string | null;
  mean?: number | null;
  std?: number | null;
  warnings?: string[];
}

export interface TableClassification {
  tableType: TableType;
  confidence: number;
  evidence: string[];
  recommendedAnalyses: string[];
  warnings?: string[];
}

export interface DatasetProfile {
  datasetId: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  classification: TableClassification;
  qualityWarnings: string[];
  generatedAt: string;
}

export interface ProfileDatasetRequest {
  datasetId: string;
  includeExamples?: boolean;
}
