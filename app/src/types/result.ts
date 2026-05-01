/**
 * Unified AnalysisResult schema for InsightEase.
 * Based on docs/design/RESULT_TABLE_DESIGN.md (Phase 4A-6-7).
 */

export type AnalysisResultStatus = "success" | "empty" | "warning" | "error";

export interface AnalysisResult {
  /** Unique result identifier */
  id: string;

  /** Analysis type discriminator (e.g., "descriptive", "regression", "ab_test") */
  analysisType: string;

  /** Human-readable result title */
  title: string;

  /** Optional longer description */
  description?: string;

  /** Result status */
  status: AnalysisResultStatus;

  /** ISO 8601 timestamp when the result was generated */
  generatedAt: string;

  /** Optional dataset metadata */
  dataset?: ResultDatasetMeta;

  /** Ordered list of result content blocks */
  blocks: ResultBlock[];

  /** Optional diagnostics (runtime info, model stats, assumptions) */
  diagnostics?: ResultDiagnostics;
}

export interface ResultDatasetMeta {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
}

export interface ResultDiagnostics {
  /** Duration of the analysis in milliseconds */
  executionTimeMs?: number;

  /** Software/library versions used */
  engineVersion?: string;

  /** Model or algorithm name */
  modelName?: string;

  /** Sample size actually used */
  sampleSize?: number;

  /** Number of observations excluded */
  excludedCount?: number;

  /** List of assumptions checked and whether they passed */
  assumptions?: {
    name: string;
    passed: boolean;
    message?: string;
  }[];
}

/** Discriminated union of all result block types */
export type ResultBlock =
  | ResultSummaryBlock
  | ResultMetricBlock
  | ResultTableBlock
  | ResultChartBlock
  | ResultTextBlock
  | ResultWarningBlock;

export type ResultBlockType =
  | "summary"
  | "metric"
  | "table"
  | "chart"
  | "text"
  | "warning";

// === Block Types ===

export interface ResultSummaryBlock {
  type: "summary";
  title?: string;
  content: string;
  tone?: "neutral" | "positive" | "negative" | "caution";
  bulletPoints?: string[];
}

export interface ResultMetricBlock {
  type: "metric";
  title?: string;
  metrics: ResultMetricItem[];
}

export interface ResultMetricItem {
  key: string;
  label: string;
  value?: number;
  formattedValue?: string;
  delta?: {
    value: number;
    formattedValue?: string;
    direction: "up" | "down" | "flat";
  };
  unit?: string;
  interpretation?: string;
  isSignificant?: boolean;
  tone?: "neutral" | "positive" | "negative" | "caution";
}

export interface ResultTableBlock {
  type: "table";
  title?: string;
  columns: ResultTableColumn[];
  rows: Record<string, unknown>[];
  sortable?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  footnotes?: string[];
}

export type ResultColumnType =
  | "string"
  | "number"
  | "integer"
  | "percent"
  | "currency"
  | "date"
  | "datetime"
  | "boolean";

export type ResultColumnSemanticRole =
  | "dimension"
  | "metric"
  | "statistic"
  | "p_value"
  | "confidence_interval"
  | "identifier"
  | "category";

export interface ResultTableColumn {
  key: string;
  label: string;
  dataType: ResultColumnType;
  description?: string;
  unit?: string;
  precision?: number;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  semanticRole?: ResultColumnSemanticRole;
  hiddenByDefault?: boolean;
}

export interface ResultChartBlock {
  type: "chart";
  title?: string;
  chartType:
    | "bar"
    | "line"
    | "area"
    | "scatter"
    | "pie"
    | "histogram"
    | "box"
    | "heatmap"
    | "funnel"
    | "sankey"
    | "custom";
  data: Record<string, unknown>[];
  xKey?: string;
  yKeys?: string[];
  seriesNames?: string[];
  colorKey?: string;
  groupKey?: string;
  linkedTableBlockId?: string;
  echartsOptions?: Record<string, unknown>;
}

export interface ResultWarningBlock {
  type: "warning";
  title?: string;
  severity: "info" | "caution" | "critical";
  message: string;
  detail?: string;
  suggestion?: string;
  relatedField?: string;
}

export interface ResultTextBlock {
  type: "text";
  title?: string;
  content: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}
