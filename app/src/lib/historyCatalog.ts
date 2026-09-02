import { buildSafeResultSummary } from "@/lib/assistant/safeResultSummary";
import type { Analysis, Dataset } from "@/types/api";
import type {
  AnalysisHistoryCatalogMetadata,
  GroupedAnalysisHistory,
  HistoryAIReadyStatus,
  HistoryCreatedWeekBucket,
  HistoryGroupMode,
} from "@/types/historyCatalog";

export interface HistoryCatalogOptions {
  datasetsById?: Record<string, Pick<Dataset, "id" | "filename"> | undefined>;
}

export const HISTORY_GROUP_MODE_LABELS: Record<HistoryGroupMode, string> = {
  default: "默认排序",
  created_day: "按创建日",
  created_week: "按创建周",
  analysis_type: "按分析类型",
  status: "按状态",
  dataset: "按数据集",
  ai_ready: "按 AI 可解释状态",
};

export const HISTORY_AI_READY_LABELS: Record<HistoryAIReadyStatus, string> = {
  ai_ready: "AI 可解释",
  summary_only: "摘要较少",
  not_ready: "不可解释",
  failed_or_incomplete: "结果未完成",
};

export const HISTORY_WEEK_LABELS: Record<HistoryCreatedWeekBucket, string> = {
  this_week: "本周",
  last_week: "上周",
  two_weeks_ago: "前两周",
  earlier: "更早",
  unknown: "未知创建时间",
};

export function getAnalysisTypeLabel(type: string): string {
  switch (type) {
    case "descriptive":
    case "statistics":
      return "统计分析";
    case "forecast":
    case "time_series":
      return "预测分析";
    case "path_analysis":
    case "path":
    case "funnel":
      return "路径分析";
    case "attribution":
      return "归因分析";
    case "semantic":
      return "文本分析（历史）";
    case "ab_test":
      return "A/B 分析";
    case "regression":
      return "回归分析";
    case "clustering":
      return "聚类分析";
    case "rfm":
      return "RFM 分析";
    case "correlation":
      return "相关分析";
    case "visualization":
      return "可视化分析";
    case "smart_process":
      return "智能处理";
    default:
      return type || "未知分析";
  }
}

export function getAnalysisStatusLabel(status: string): string {
  switch (status) {
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "running":
      return "运行中";
    case "pending":
      return "等待中";
    default:
      return status || "未知状态";
  }
}

export function inferAnalysisHistoryCatalogMetadata(
  analysis: Analysis,
  options: HistoryCatalogOptions = {}
): AnalysisHistoryCatalogMetadata {
  const datasetName = options.datasetsById?.[analysis.dataset_id]?.filename;
  const safeSummary = buildSafeResultSummary(analysis, { dataset_name: datasetName });
  const hasResultData = analysis.result_data !== null && analysis.result_data !== undefined;
  const hasAiInterpretation = Boolean(analysis.ai_interpretation || safeSummary.ai_summary);
  const hasSummarySignals =
    safeSummary.result_keys.length > 0 ||
    safeSummary.metrics.length > 0 ||
    safeSummary.tables.length > 0 ||
    safeSummary.charts.length > 0 ||
    hasAiInterpretation;
  const aiReadyStatus = inferAIReadyStatus(analysis, hasSummarySignals, hasAiInterpretation);
  const createdDay = formatDay(analysis.created_at);
  const labels = [
    getAnalysisTypeLabel(analysis.type),
    getAnalysisStatusLabel(analysis.status),
    HISTORY_AI_READY_LABELS[aiReadyStatus],
    datasetName || analysis.dataset_id,
    createdDay,
    safeSummary.title,
    safeSummary.subtitle,
    safeSummary.ai_summary,
    safeSummary.ai_interpretation,
    ...safeSummary.result_keys,
  ].filter((value): value is string => Boolean(value));

  const reasons: string[] = [];
  if (analysis.status !== "completed") reasons.push("结果尚未完成或失败");
  if (hasAiInterpretation) reasons.push("存在已有 AI 摘要/解读");
  if (safeSummary.metrics.length > 0) reasons.push("安全摘要包含关键指标");
  if (safeSummary.tables.length > 0) reasons.push("安全摘要包含表格预览");
  if (safeSummary.result_keys.length > 0) reasons.push("安全摘要包含结果字段");
  if (reasons.length === 0) reasons.push("当前结果摘要信息较少");

  return {
    analysis_id: analysis.id,
    analysis_type: analysis.type,
    status: analysis.status,
    dataset_id: analysis.dataset_id,
    dataset_name: datasetName,
    created_day: createdDay,
    created_week_bucket: getWeekBucket(analysis.created_at),
    ai_ready_status: aiReadyStatus,
    has_result_data: hasResultData,
    has_safe_summary: hasSummarySignals,
    has_ai_interpretation: hasAiInterpretation,
    result_key_count: safeSummary.result_keys.length,
    labels,
    reasons,
  };
}

export function groupAnalysisHistory(
  analyses: Analysis[],
  mode: HistoryGroupMode,
  options: HistoryCatalogOptions = {}
): GroupedAnalysisHistory[] {
  if (mode === "default") {
    return [{ key: "default", label: "默认排序", items: analyses, count: analyses.length }];
  }

  const groups = new Map<string, GroupedAnalysisHistory>();

  analyses.forEach((analysis) => {
    const metadata = inferAnalysisHistoryCatalogMetadata(analysis, options);
    const { key, label } = getGroupKeyAndLabel(analysis, metadata, mode);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(analysis);
      existing.count += 1;
    } else {
      groups.set(key, { key, label, items: [analysis], count: 1 });
    }
  });

  return Array.from(groups.values()).sort((a, b) => getGroupSort(a.key, mode) - getGroupSort(b.key, mode));
}

export function filterAnalysisHistoryBySearch(
  analyses: Analysis[],
  query: string,
  options: HistoryCatalogOptions = {}
): Analysis[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return analyses;

  return analyses.filter((analysis) => {
    const metadata = inferAnalysisHistoryCatalogMetadata(analysis, options);
    return [
      analysis.id,
      analysis.type,
      analysis.status,
      analysis.dataset_id,
      analysis.created_at,
      analysis.completed_at,
      analysis.ai_interpretation,
      ...(analysis.ai_recommendations ?? []),
      ...metadata.labels,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized));
  });
}

function inferAIReadyStatus(
  analysis: Analysis,
  hasSummarySignals: boolean,
  hasAiInterpretation: boolean
): HistoryAIReadyStatus {
  if (analysis.status === "failed" || analysis.status === "running" || analysis.status === "pending") {
    return "failed_or_incomplete";
  }
  if (analysis.status === "completed" && (hasAiInterpretation || hasSummarySignals)) {
    return hasSummarySignals ? "ai_ready" : "summary_only";
  }
  if (analysis.status === "completed") return "summary_only";
  return "not_ready";
}

function getGroupKeyAndLabel(
  analysis: Analysis,
  metadata: AnalysisHistoryCatalogMetadata,
  mode: HistoryGroupMode
): { key: string; label: string } {
  if (mode === "created_day") {
    const key = metadata.created_day || "unknown";
    return { key, label: metadata.created_day || "未知创建时间" };
  }
  if (mode === "created_week") {
    return { key: metadata.created_week_bucket, label: HISTORY_WEEK_LABELS[metadata.created_week_bucket] };
  }
  if (mode === "analysis_type") {
    return { key: analysis.type || "unknown", label: getAnalysisTypeLabel(analysis.type) };
  }
  if (mode === "status") {
    return { key: analysis.status || "unknown", label: getAnalysisStatusLabel(analysis.status) };
  }
  if (mode === "dataset") {
    const key = analysis.dataset_id || "unknown";
    return { key, label: metadata.dataset_name || analysis.dataset_id || "未知数据集" };
  }
  if (mode === "ai_ready") {
    return { key: metadata.ai_ready_status, label: HISTORY_AI_READY_LABELS[metadata.ai_ready_status] };
  }
  return { key: "default", label: "默认排序" };
}

function getGroupSort(key: string, mode: HistoryGroupMode): number {
  if (mode === "created_week") {
    return ["this_week", "last_week", "two_weeks_ago", "earlier", "unknown"].indexOf(key);
  }
  if (mode === "ai_ready") {
    return ["ai_ready", "summary_only", "failed_or_incomplete", "not_ready"].indexOf(key);
  }
  if (mode === "status") {
    return ["completed", "running", "pending", "failed", "unknown"].indexOf(key);
  }
  return 0;
}

function formatDay(value?: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function getWeekBucket(value?: string): HistoryCreatedWeekBucket {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";

  const startOfThisWeek = getStartOfWeek(new Date());
  const startOfTargetWeek = getStartOfWeek(date);
  const diffDays = Math.floor((startOfThisWeek.getTime() - startOfTargetWeek.getTime()) / 86_400_000);

  if (diffDays < 0) return "this_week";
  if (diffDays < 7) return "this_week";
  if (diffDays < 14) return "last_week";
  if (diffDays < 21) return "two_weeks_ago";
  return "earlier";
}

function getStartOfWeek(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}
