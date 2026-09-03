import type { RelationshipRiskLevel, RelationshipType } from '@/types/assistant';

export type JoinType = 'left' | 'inner';
export type JoinRiskLevel = RelationshipRiskLevel | 'blocked';

export interface ConfirmedJoinRelationship {
  id: string;
  source_dataset_id: string;
  source_field: string;
  target_dataset_id: string;
  target_field: string;
  status: 'confirmed';
  expected_cardinality: RelationshipType;
  risk_level: RelationshipRiskLevel;
}

export interface JoinStep {
  left_dataset_id: string;
  right_dataset_id: string;
  left_field: string;
  right_field: string;
  join_type: JoinType;
  relationship_id: string;
  relationship_status: 'confirmed';
  expected_cardinality: RelationshipType;
}

export interface JoinPlan {
  id: string;
  source_analysis_plan_id: string;
  relationship_set_id: string;
  base_dataset_id: string;
  included_dataset_ids: string[];
  join_steps: JoinStep[];
  confirmed_relationships: ConfirmedJoinRelationship[];
  selected_fields: Record<string, string[]>;
  output_columns: string[];
  warnings: string[];
  requires_confirmation: true;
}

export interface JoinStepMetrics {
  step_index: number;
  left_dataset_id: string;
  right_dataset_id: string;
  left_row_count: number;
  right_row_count: number;
  output_row_count: number;
  matched_left_rows: number;
  unmatched_left_rows: number;
  unmatched_right_rows: number;
  match_rate: number;
  left_null_key_count: number;
  right_null_key_count: number;
  left_null_key_rate: number;
  right_null_key_rate: number;
  left_duplicate_key_count: number;
  right_duplicate_key_count: number;
  left_duplicate_key_rate: number;
  right_duplicate_key_rate: number;
  left_unique_key_count: number;
  right_unique_key_count: number;
  cardinality: Exclude<RelationshipType, 'unknown'>;
  row_multiplier: number;
  risk_level: JoinRiskLevel;
  warnings: string[];
}

export interface JoinRiskSummary {
  risk_level: JoinRiskLevel;
  row_multiplier: number;
  cardinalities: string[];
  base_grain: string;
  result_grain: string;
  warnings: string[];
  blocked_reasons: string[];
}

export interface JoinPreview {
  input_dataset_ids: string[];
  input_row_counts: Record<string, number>;
  output_row_count: number;
  output_column_count: number;
  output_columns: string[];
  preview_rows: Array<Record<string, unknown>>;
  preview_limit: number;
  step_metrics: JoinStepMetrics[];
  risk_summary: JoinRiskSummary;
}

export interface DerivedDatasetMetadata {
  dataset_id: string;
  filename: string;
  source_dataset_ids: string[];
  source_analysis_plan_id: string;
  derivation_type: 'join';
  row_count: number;
  col_count: number;
  risk_summary: JoinRiskSummary;
  created_at: string;
}
