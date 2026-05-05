export type DatasetBusinessCategory =
  | "user"
  | "product"
  | "order"
  | "traffic"
  | "marketing"
  | "experiment"
  | "forecast"
  | "review_text"
  | "quality"
  | "unknown";

export type DatasetDataType =
  | "dimension_table"
  | "fact_table"
  | "event_log"
  | "time_series"
  | "experiment_table"
  | "text_table"
  | "metrics_table"
  | "unknown";

export type DatasetAnalysisTag =
  | "descriptive"
  | "path_analysis"
  | "forecast"
  | "attribution"
  | "ab_test"
  | "regression"
  | "semantic"
  | "data_quality";

export type DatasetUploadWeekBucket =
  | "this_week"
  | "last_week"
  | "two_weeks_ago"
  | "earlier"
  | "unknown";

export interface DatasetCatalogMetadata {
  dataset_id: string;
  business_category: DatasetBusinessCategory;
  data_type: DatasetDataType;
  analysis_tags: DatasetAnalysisTag[];
  upload_day?: string;
  upload_week_bucket?: DatasetUploadWeekBucket;
  confidence: "low" | "medium" | "high";
  reasons: string[];
}

export interface GroupedDatasets<TDataset = unknown> {
  key: string;
  label: string;
  datasets: TDataset[];
  sort_order?: number;
}
