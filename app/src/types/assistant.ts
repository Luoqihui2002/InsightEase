/**
 * AI Data Assistant type contracts.
 *
 * These types define the metadata schema used by the assistant to understand
 * datasets without accessing full raw data.
 *
 * NOTE: This project uses snake_case in frontend types to match backend
 * JSON serialization conventions (consistent with Dataset, Analysis, etc.).
 */

import type { SafeResultSummary } from './resultSummary';

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

export type RelationshipRiskLevel = "low" | "medium" | "high";

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
  risk_level?: RelationshipRiskLevel;
  risk_reasons?: string[];
  is_custom?: boolean;
  source?: "inferred" | "manual" | "mixed";
}

export type RelationshipSetNodeRole =
  | "connected"
  | "isolated"
  | "excluded"
  | "reference_only";

export interface RelationshipSetDatasetNode {
  dataset_id: string;
  dataset_name?: string;
  filename?: string;
  role: RelationshipSetNodeRole;
  reason?: string;
  selected_by_user: boolean;
  joinable: boolean;
  included_in_context: boolean;
}

export interface RelationshipSet {
  id: string;
  name: string;
  description?: string;
  /**
   * Dataset nodes selected or retained for this analysis topic.
   * This includes connected nodes and isolated/reference-only nodes.
   */
  dataset_nodes: RelationshipSetDatasetNode[];
  /**
   * Backward-compatible dataset IDs derived from dataset_nodes.
   */
  dataset_ids: string[];
  /**
   * User-confirmed relationship edges.
   */
  relationships: TableRelationship[];
  created_at: string;
  updated_at: string;
  is_default?: boolean;
  source: "inferred" | "manual" | "mixed";
}

export interface RelationshipSetSummary {
  id: string;
  name: string;
  relationship_count: number;
  dataset_count: number;
  updated_at: string;
  is_default?: boolean;
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

export interface PlanningColumnMetadata {
  name: string;
  dtype?: string;
  semantic_type?: string;
  role?: string;
  null_rate?: number;
  unique_rate?: number;
}

export interface PlanningDatasetMetadata {
  id: string;
  name?: string;
  filename?: string;
  schema: PlanningColumnMetadata[];
  table_type?: string;
  business_category?: string;
  data_type?: string;
  analysis_tags: string[];
  recommended_analyses: string[];
  quality_warnings: string[];
}

export interface PlanningRelationshipMetadata {
  id?: string;
  source_dataset_id: string;
  source_column: string;
  target_dataset_id: string;
  target_column: string;
  relationship_type?: RelationshipType;
  risk_level?: RelationshipRiskLevel;
  status: 'confirmed';
}

export interface BoundedPlanningContext {
  selected_dataset_ids: string[];
  selected_dataset_id?: string;
  datasets: PlanningDatasetMetadata[];
  relationship_set?: {
    id: string;
    name: string;
    dataset_nodes: Array<{
      dataset_id: string;
      dataset_name?: string;
      role: 'connected' | 'isolated' | 'reference_only';
      joinable: boolean;
    }>;
    relationships: PlanningRelationshipMetadata[];
  };
  analysis_history_summary?: SafeResultSummary;
}

// ---------------------------------------------------------------------------
// Analysis Plan Types
// ---------------------------------------------------------------------------

export type RecommendedAnalysisType =
  | "descriptive"
  | "data_overview"
  | "attribution"
  | "forecast"
  | "path_analysis"
  | "ab_test"
  | "regression"
  | "smart_process"
  | "visualization";

export type AnalysisPlanSource = "hermes_live" | "deterministic_fallback";

export type AnalysisPlanConfidence = "low" | "medium" | "high";

export type AnalysisExecutionReadiness =
  | "ready_single_table"
  | "needs_join"
  | "needs_clarification"
  | "unsupported";

export type AnalysisPlanNextAction =
  | "review_plan"
  | "navigate_analysis"
  | "create_analysis_dataset"
  | "clarify";

export interface AnalysisFieldRequirement {
  dataset_id: string;
  role:
    | "target_metric"
    | "time_column"
    | "user_id"
    | "group_column"
    | "event_name"
    | "dimension"
    | "feature"
    | "join_key";
  required: boolean;
  candidate_columns: string[];
  reason: string;
}

export interface AssistantNextAction {
  type: "navigate" | "confirm" | "explain" | "warning";
  label: string;
  target?: string;
  payload?: Record<string, unknown>;
}

export interface AssistantCandidateDataset {
  dataset_id: string;
  dataset_name?: string;
  reasons: string[];
  confidence: "low" | "medium" | "high";
}

export interface AnalysisRelationshipRequirement {
  relationship_id?: string;
  source_dataset_id: string;
  source_column: string;
  target_dataset_id: string;
  target_column: string;
  status: "confirmed" | "requires_confirmation";
  relationship_type?: RelationshipType;
  risk_level?: RelationshipRiskLevel;
  reason: string;
}

export interface AnalysisMetricTarget {
  name: string;
  dataset_id: string;
  field?: string;
  aggregation?: "count" | "count_distinct" | "sum" | "average" | "min" | "max" | "rate";
  description: string;
}

export interface AssistantAnalysisPlan {
  id: string;
  user_question: string;
  interpreted_goal: string;
  recommended_analysis_type: RecommendedAnalysisType;
  required_datasets: string[];
  required_dataset_ids: string[];
  candidate_dataset_ids: string[];
  candidate_datasets: AssistantCandidateDataset[];
  required_fields: AnalysisFieldRequirement[];
  required_relationships: AnalysisRelationshipRequirement[];
  metrics: AnalysisMetricTarget[];
  relationship_set_id?: string;
  relationship_set_name?: string;
  reference_dataset_ids: string[];
  assumptions: string[];
  warnings: string[];
  clarifying_questions: string[];
  execution_readiness: AnalysisExecutionReadiness;
  next_action: AnalysisPlanNextAction;
  next_actions: AssistantNextAction[];
  source: AnalysisPlanSource;
  confidence: AnalysisPlanConfidence;
  fallback_used: boolean;
}

export interface AnalysisPrefillPayload {
  source: "ai_workbench";
  plan_id: string;
  analysis_type: RecommendedAnalysisType;
  dataset_ids: string[];
  primary_dataset_id?: string;
  relationship_set_id?: string;
  relationship_set_name?: string;
  suggested_fields?: AnalysisFieldRequirement[];
  user_question?: string;
  created_at: string;
}
