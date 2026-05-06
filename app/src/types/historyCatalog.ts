import type { Analysis } from "@/types/api";

export type HistoryGroupMode =
  | "default"
  | "created_day"
  | "created_week"
  | "analysis_type"
  | "status"
  | "dataset"
  | "ai_ready";

export type HistoryAIReadyStatus =
  | "ai_ready"
  | "summary_only"
  | "not_ready"
  | "failed_or_incomplete";

export type HistoryCreatedWeekBucket =
  | "this_week"
  | "last_week"
  | "two_weeks_ago"
  | "earlier"
  | "unknown";

export interface AnalysisHistoryCatalogMetadata {
  analysis_id: string;
  analysis_type: string;
  status: string;
  dataset_id?: string;
  dataset_name?: string;
  created_day?: string;
  created_week_bucket: HistoryCreatedWeekBucket;
  ai_ready_status: HistoryAIReadyStatus;
  has_result_data: boolean;
  has_safe_summary: boolean;
  has_ai_interpretation: boolean;
  result_key_count: number;
  labels: string[];
  reasons: string[];
}

export interface GroupedAnalysisHistory {
  key: string;
  label: string;
  items: Analysis[];
  count: number;
}
