/**
 * AI Data Assistant type contracts.
 *
 * These types define the metadata schema used by the assistant to understand
 * datasets without accessing full raw data.
 *
 * NOTE: This project uses snake_case in frontend types to match backend
 * JSON serialization conventions (consistent with Dataset, Analysis, etc.).
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
  semantic_type: SemanticType;
  role: ColumnRole;
  null_count: number;
  null_rate: number;
  unique_count: number;
  unique_rate: number;
  examples: unknown[];
  min?: number | string | null;
  max?: number | string | null;
  mean?: number | null;
  std?: number | null;
  warnings?: string[];
}

export interface TableClassification {
  table_type: TableType;
  confidence: number;
  evidence: string[];
  recommended_analyses: string[];
  warnings?: string[];
}

export interface DatasetProfile {
  dataset_id: string;
  name: string;
  row_count: number;
  column_count: number;
  columns: ColumnProfile[];
  classification: TableClassification;
  quality_warnings: string[];
  generated_at: string;
}

export interface ProfileDatasetRequest {
  dataset_id: string;
  include_examples?: boolean;
}

// ---------------------------------------------------------------------------
// Relationship Inference Types
// ---------------------------------------------------------------------------

export type RelationshipType =
  | "one_to_one"
  | "one_to_many"
  | "many_to_one"
  | "many_to_many"
  | "unknown";

export type RelationshipStatus = "suggested" | "confirmed" | "rejected";

export type RelationshipEvidenceType =
  | "column_name_match"
  | "role_match"
  | "type_compatibility"
  | "uniqueness_signal"
  | "table_type_signal"
  | "value_overlap"
  | "null_rate_check"
  | "manual_confirmation";

export interface RelationshipEvidence {
  type: RelationshipEvidenceType;
  score: number;
  message: string;
}

export interface TableRelationship {
  id: string;
  source_dataset_id: string;
  target_dataset_id: string;
  source_dataset_name: string;
  target_dataset_name: string;
  source_column: string;
  target_column: string;
  relationship_type: RelationshipType;
  confidence: number;
  status: RelationshipStatus;
  evidence: RelationshipEvidence[];
  warnings: string[];
  created_at?: string;
  confirmed_at?: string;
}

export interface InferRelationshipsRequest {
  dataset_ids: string[];
  include_value_overlap?: boolean;
  max_candidates?: number;
}

export interface InferRelationshipsResponse {
  relationships: TableRelationship[];
  generated_at: string;
  warnings: string[];
}
