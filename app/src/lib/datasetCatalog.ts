import type {
  DatasetAnalysisTag,
  DatasetBusinessCategory,
  DatasetCatalogMetadata,
  DatasetDataType,
  DatasetUploadWeekBucket,
  GroupedDatasets,
} from "@/types/datasetCatalog";

interface DatasetFieldLike {
  name?: string;
  dtype?: string;
  semantic_type?: string;
  role?: string;
}

export interface DatasetLike {
  id: string;
  filename?: string;
  name?: string;
  row_count?: number;
  col_count?: number;
  schema?: DatasetFieldLike[];
  uploaded_at?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  classification?: {
    table_type?: string;
    tableType?: string;
    recommended_analyses?: string[];
    recommendedAnalyses?: string[];
  };
}

type KeywordMap<T extends string> = Record<T, string[]>;

export const BUSINESS_CATEGORY_LABELS: Record<DatasetBusinessCategory, string> = {
  user: "用户相关",
  product: "商品相关",
  order: "订单交易",
  traffic: "流量行为相关",
  marketing: "营销归因相关",
  experiment: "实验分组",
  forecast: "预测指标相关",
  review_text: "评论文本相关",
  quality: "数据质量",
  unknown: "未识别主题",
};

export const DATA_TYPE_LABELS: Record<DatasetDataType, string> = {
  dimension_table: "维表",
  fact_table: "事实表",
  event_log: "事件日志表",
  time_series: "时间序列表",
  experiment_table: "实验表",
  text_table: "文本表",
  metrics_table: "指标汇总表",
  unknown: "未识别类型",
};

export const ANALYSIS_TAG_LABELS: Record<DatasetAnalysisTag, string> = {
  descriptive: "统计分析",
  path_analysis: "路径分析",
  forecast: "预测分析",
  attribution: "归因分析",
  ab_test: "A/B 检验",
  regression: "回归分析",
  semantic: "语义分析",
  data_quality: "数据质量",
};

export const UPLOAD_WEEK_LABELS: Record<DatasetUploadWeekBucket, string> = {
  this_week: "本周",
  last_week: "上周",
  two_weeks_ago: "前两周",
  earlier: "更早",
  unknown: "未知上传时间",
};

const BUSINESS_KEYWORDS: KeywordMap<DatasetBusinessCategory> = {
  user: ["user", "customer", "member", "uid", "user_id", "customer_id"],
  product: ["product", "sku", "spu", "item", "commodity", "product_id"],
  order: ["order", "payment", "gmv", "sales", "transaction", "order_id"],
  traffic: ["event", "log", "path", "behavior", "click", "exposure", "pageview", "session"],
  marketing: ["marketing", "touchpoint", "attribution", "channel", "campaign", "coupon"],
  experiment: ["ab", "a_b", "experiment", "treatment", "control", "group_id", "variant"],
  forecast: ["daily", "forecast", "trend", "time_series", "sales_forecast"],
  review_text: ["review", "comment", "semantic", "text", "sentiment", "feedback"],
  quality: ["missing", "null", "anomaly", "quality", "edge_case", "outlier"],
  unknown: [],
};

const DATA_TYPE_KEYWORDS: KeywordMap<DatasetDataType> = {
  dimension_table: ["name", "category", "brand", "attribute", "profile", "dimension"],
  fact_table: ["order", "payment", "transaction", "amount", "gmv", "sales", "revenue"],
  event_log: ["event", "event_name", "event_time", "session", "click", "exposure", "pageview"],
  time_series: ["date", "dt", "day", "month", "time", "metric", "forecast", "trend"],
  experiment_table: ["experiment", "group", "variant", "treatment", "control", "metric"],
  text_table: ["text", "comment", "review", "content", "feedback", "sentiment"],
  metrics_table: ["metric", "metrics", "kpi", "summary", "aggregate", "daily"],
  unknown: [],
};

const BUSINESS_PROFILE_MAP: Record<string, DatasetBusinessCategory> = {
  user: "user",
  product: "product",
  order: "order",
  transaction: "order",
  event_log: "traffic",
  campaign: "marketing",
  experiment: "experiment",
  metric_summary: "forecast",
  review_text: "review_text",
  dimension: "unknown",
};

const DATA_TYPE_PROFILE_MAP: Record<string, DatasetDataType> = {
  user: "dimension_table",
  product: "dimension_table",
  dimension: "dimension_table",
  order: "fact_table",
  transaction: "fact_table",
  event_log: "event_log",
  campaign: "event_log",
  experiment: "experiment_table",
  metric_summary: "metrics_table",
  review_text: "text_table",
};

const ANALYSIS_PROFILE_MAP: Record<string, DatasetAnalysisTag> = {
  statistics: "descriptive",
  pathanalysis: "path_analysis",
  "funnel analysis": "path_analysis",
  "sequence mining": "path_analysis",
  forecast: "forecast",
  attribution: "attribution",
  "group comparison": "ab_test",
  regression: "regression",
  semantic: "semantic",
};

function normalizeToken(value: unknown): string {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9_\u4e00-\u9fa5]+/g, "_");
}

function getColumns(dataset: DatasetLike): DatasetFieldLike[] {
  return Array.isArray(dataset.schema) ? dataset.schema : [];
}

function getSearchParts(dataset: DatasetLike): string[] {
  const fields = getColumns(dataset);
  return [
    dataset.id,
    dataset.filename,
    dataset.name,
    ...fields.flatMap((field) => [field.name, field.dtype, field.semantic_type, field.role]),
  ].filter(Boolean).map(String);
}

function getProfileTableType(dataset: DatasetLike): string | undefined {
  return dataset.classification?.table_type || dataset.classification?.tableType;
}

function getRecommendedAnalyses(dataset: DatasetLike): string[] {
  const rec =
    dataset.classification?.recommended_analyses ||
    dataset.classification?.recommendedAnalyses ||
    [];
  return Array.isArray(rec) ? rec : [];
}

function scoreKeywords<T extends string>(
  text: string,
  keywordMap: KeywordMap<T>,
  unknownValue: T
): { value: T; score: number; matches: string[] } {
  let bestValue = unknownValue;
  let bestScore = 0;
  let bestMatches: string[] = [];

  for (const [value, keywords] of Object.entries(keywordMap) as Array<[T, string[]]>) {
    if (value === unknownValue) continue;
    const matches = keywords.filter((keyword) => text.includes(normalizeToken(keyword)));
    if (matches.length > bestScore) {
      bestValue = value;
      bestScore = matches.length;
      bestMatches = matches;
    }
  }

  return { value: bestValue, score: bestScore, matches: bestMatches };
}

function hasColumn(dataset: DatasetLike, patterns: string[]): boolean {
  const columns = getColumns(dataset).map((field) => normalizeToken(field.name));
  return columns.some((column) => patterns.some((pattern) => column.includes(normalizeToken(pattern))));
}

function inferBusinessCategory(dataset: DatasetLike): {
  value: DatasetBusinessCategory;
  score: number;
  reasons: string[];
} {
  const profileType = getProfileTableType(dataset);
  if (profileType && BUSINESS_PROFILE_MAP[profileType]) {
    return {
      value: BUSINESS_PROFILE_MAP[profileType],
      score: 3,
      reasons: [`profile table_type=${profileType}`],
    };
  }

  const text = getSearchParts(dataset).map(normalizeToken).join(" ");
  const scored = scoreKeywords(text, BUSINESS_KEYWORDS, "unknown");
  return {
    value: scored.value,
    score: scored.score,
    reasons: scored.matches.map((match) => `matched keyword: ${match}`),
  };
}

function inferDataType(dataset: DatasetLike, businessCategory: DatasetBusinessCategory): {
  value: DatasetDataType;
  score: number;
  reasons: string[];
} {
  const profileType = getProfileTableType(dataset);
  if (profileType && DATA_TYPE_PROFILE_MAP[profileType]) {
    return {
      value: DATA_TYPE_PROFILE_MAP[profileType],
      score: 3,
      reasons: [`profile table_type=${profileType}`],
    };
  }

  const hasUserOrSession = hasColumn(dataset, ["user_id", "uid", "customer_id", "session_id"]);
  const hasEvent = hasColumn(dataset, ["event", "event_name", "action", "click", "exposure", "pageview"]);
  const hasTime = hasColumn(dataset, ["date", "dt", "time", "timestamp", "created_at", "event_time"]);
  const hasMetric = hasColumn(dataset, ["metric", "revenue", "gmv", "sales", "amount", "orders", "rate", "score"]);
  const hasText = hasColumn(dataset, ["text", "comment", "review", "content", "feedback", "sentiment"]);
  const hasExperiment = hasColumn(dataset, ["experiment", "group", "variant", "treatment", "control"]);
  const hasOrder = hasColumn(dataset, ["order_id", "transaction_id", "payment", "amount", "gmv"]);
  const hasProductOrUser = businessCategory === "user" || businessCategory === "product";

  if (hasUserOrSession && hasEvent && hasTime) {
    return { value: "event_log", score: 3, reasons: ["user/session + event + time columns"] };
  }
  if (hasExperiment) {
    return { value: "experiment_table", score: 3, reasons: ["experiment/group columns"] };
  }
  if (hasText) {
    return { value: "text_table", score: 3, reasons: ["text/comment/review columns"] };
  }
  if (hasOrder || businessCategory === "order") {
    return { value: "fact_table", score: 3, reasons: ["order/payment/metric columns"] };
  }
  if (hasTime && hasMetric) {
    const rowCount = dataset.row_count ?? 0;
    if (businessCategory === "forecast" || rowCount <= 20000) {
      return { value: "time_series", score: 3, reasons: ["time + metric columns"] };
    }
    return { value: "metrics_table", score: 2, reasons: ["time + metric columns"] };
  }
  if (hasProductOrUser || hasColumn(dataset, ["name", "category", "brand"])) {
    return { value: "dimension_table", score: 2, reasons: ["id/name/category attributes"] };
  }

  const text = getSearchParts(dataset).map(normalizeToken).join(" ");
  const scored = scoreKeywords(text, DATA_TYPE_KEYWORDS, "unknown");
  return {
    value: scored.value,
    score: scored.score,
    reasons: scored.matches.map((match) => `matched keyword: ${match}`),
  };
}

function inferAnalysisTags(
  dataset: DatasetLike,
  businessCategory: DatasetBusinessCategory,
  dataType: DatasetDataType
): DatasetAnalysisTag[] {
  const tags = new Set<DatasetAnalysisTag>(["descriptive", "data_quality"]);

  for (const analysis of getRecommendedAnalyses(dataset)) {
    const normalized = analysis.toLowerCase().replace(/\s+/g, " ");
    const mapped = ANALYSIS_PROFILE_MAP[normalized] || ANALYSIS_PROFILE_MAP[normalized.replace(/\s+/g, "")];
    if (mapped) tags.add(mapped);
  }

  if (dataType === "event_log" || businessCategory === "traffic") tags.add("path_analysis");
  if (dataType === "time_series" || dataType === "metrics_table" || businessCategory === "forecast") {
    tags.add("forecast");
  }
  if (businessCategory === "marketing" || businessCategory === "order") tags.add("attribution");
  if (dataType === "experiment_table" || businessCategory === "experiment") tags.add("ab_test");
  if (dataType === "text_table" || businessCategory === "review_text") tags.add("semantic");
  if (
    ["user", "order"].includes(businessCategory) ||
    dataType === "metrics_table" ||
    hasColumn(dataset, ["ltv", "retention", "target", "score", "revenue"])
  ) {
    tags.add("regression");
  }

  return Array.from(tags);
}

function getUploadTimestamp(dataset: DatasetLike): string | undefined {
  return dataset.uploaded_at || dataset.created_at || dataset.createdAt || dataset.updated_at;
}

function toDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfLocalWeek(date: Date): Date {
  const day = date.getDay() || 7;
  const start = startOfLocalDay(date);
  start.setDate(start.getDate() - day + 1);
  return start;
}

function formatUploadDay(date?: Date): string | undefined {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function inferUploadWeekBucket(date?: Date): DatasetUploadWeekBucket {
  if (!date) return "unknown";
  const currentWeekStart = startOfLocalWeek(new Date());
  const uploadWeekStart = startOfLocalWeek(date);
  const diffDays = Math.round((currentWeekStart.getTime() - uploadWeekStart.getTime()) / 86400000);
  if (diffDays <= 0) return "this_week";
  if (diffDays === 7) return "last_week";
  if (diffDays === 14) return "two_weeks_ago";
  return "earlier";
}

function sortByUploadTimeDesc<T extends DatasetLike>(a: T, b: T): number {
  const aTime = toDate(getUploadTimestamp(a))?.getTime() ?? 0;
  const bTime = toDate(getUploadTimestamp(b))?.getTime() ?? 0;
  return bTime - aTime;
}

function groupBy<T extends DatasetLike>(
  datasets: T[],
  getGroup: (dataset: T) => { key: string; label: string; sort_order?: number }
): GroupedDatasets<T>[] {
  const groups = new Map<string, GroupedDatasets<T>>();
  datasets.forEach((dataset) => {
    const group = getGroup(dataset);
    const existing = groups.get(group.key);
    if (existing) {
      existing.datasets.push(dataset);
    } else {
      groups.set(group.key, { ...group, datasets: [dataset] });
    }
  });

  return Array.from(groups.values())
    .map((group) => ({ ...group, datasets: [...group.datasets].sort(sortByUploadTimeDesc) }))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999) || a.label.localeCompare(b.label));
}

export function inferDatasetCatalogMetadata(dataset: DatasetLike): DatasetCatalogMetadata {
  const business = inferBusinessCategory(dataset);
  const dataType = inferDataType(dataset, business.value);
  const uploadDate = toDate(getUploadTimestamp(dataset));
  const analysisTags = inferAnalysisTags(dataset, business.value, dataType.value);
  const evidenceScore = business.score + dataType.score;
  const confidence = evidenceScore >= 5 ? "high" : evidenceScore >= 2 ? "medium" : "low";
  const reasons = [
    ...business.reasons.map((reason) => `business: ${reason}`),
    ...dataType.reasons.map((reason) => `data_type: ${reason}`),
  ];

  return {
    dataset_id: dataset.id,
    business_category: business.value,
    data_type: dataType.value,
    analysis_tags: analysisTags,
    upload_day: formatUploadDay(uploadDate),
    upload_week_bucket: inferUploadWeekBucket(uploadDate),
    confidence,
    reasons: reasons.length > 0 ? reasons.slice(0, 5) : ["No strong deterministic signal found."],
  };
}

export function groupDatasetsByUploadDay<T extends DatasetLike>(datasets: T[]): GroupedDatasets<T>[] {
  return groupBy(datasets, (dataset) => {
    const uploadDay = inferDatasetCatalogMetadata(dataset).upload_day;
    return {
      key: uploadDay ?? "unknown",
      label: uploadDay ?? "未知上传时间",
      sort_order: uploadDay ? -Date.parse(uploadDay.replace(/\//g, "-")) : 999999999,
    };
  });
}

export function groupDatasetsByUploadWeek<T extends DatasetLike>(datasets: T[]): GroupedDatasets<T>[] {
  const order: Record<DatasetUploadWeekBucket, number> = {
    this_week: 0,
    last_week: 1,
    two_weeks_ago: 2,
    earlier: 3,
    unknown: 4,
  };
  return groupBy(datasets, (dataset) => {
    const bucket = inferDatasetCatalogMetadata(dataset).upload_week_bucket ?? "unknown";
    return { key: bucket, label: UPLOAD_WEEK_LABELS[bucket], sort_order: order[bucket] };
  });
}

export function groupDatasetsByBusinessCategory<T extends DatasetLike>(datasets: T[]): GroupedDatasets<T>[] {
  const order: DatasetBusinessCategory[] = [
    "user",
    "product",
    "order",
    "traffic",
    "marketing",
    "experiment",
    "forecast",
    "review_text",
    "quality",
    "unknown",
  ];
  return groupBy(datasets, (dataset) => {
    const category = inferDatasetCatalogMetadata(dataset).business_category;
    return { key: category, label: BUSINESS_CATEGORY_LABELS[category], sort_order: order.indexOf(category) };
  });
}

export function groupDatasetsByDataType<T extends DatasetLike>(datasets: T[]): GroupedDatasets<T>[] {
  const order: DatasetDataType[] = [
    "dimension_table",
    "fact_table",
    "event_log",
    "time_series",
    "experiment_table",
    "text_table",
    "metrics_table",
    "unknown",
  ];
  return groupBy(datasets, (dataset) => {
    const dataType = inferDatasetCatalogMetadata(dataset).data_type;
    return { key: dataType, label: DATA_TYPE_LABELS[dataType], sort_order: order.indexOf(dataType) };
  });
}

export function groupDatasetsByAnalysisTag<T extends DatasetLike>(datasets: T[]): GroupedDatasets<T>[] {
  const order: DatasetAnalysisTag[] = [
    "descriptive",
    "path_analysis",
    "forecast",
    "attribution",
    "ab_test",
    "regression",
    "semantic",
    "data_quality",
  ];
  const groups = new Map<DatasetAnalysisTag, T[]>();
  datasets.forEach((dataset) => {
    inferDatasetCatalogMetadata(dataset).analysis_tags.forEach((tag) => {
      const existing = groups.get(tag) ?? [];
      existing.push(dataset);
      groups.set(tag, existing);
    });
  });

  return order
    .filter((tag) => groups.has(tag))
    .map((tag) => ({
      key: tag,
      label: ANALYSIS_TAG_LABELS[tag],
      sort_order: order.indexOf(tag),
      datasets: [...(groups.get(tag) ?? [])].sort(sortByUploadTimeDesc),
    }));
}

export function filterDatasetsBySearch<T extends DatasetLike>(datasets: T[], query: string): T[] {
  const normalizedQuery = normalizeToken(query.trim());
  if (!normalizedQuery) return [...datasets].sort(sortByUploadTimeDesc);

  return datasets
    .filter((dataset) => {
      const catalog = inferDatasetCatalogMetadata(dataset);
      const labels = [
        BUSINESS_CATEGORY_LABELS[catalog.business_category],
        DATA_TYPE_LABELS[catalog.data_type],
        ...catalog.analysis_tags.map((tag) => ANALYSIS_TAG_LABELS[tag]),
        catalog.upload_day,
      ];
      const searchable = [...getSearchParts(dataset), ...labels].map(normalizeToken).join(" ");
      return searchable.includes(normalizedQuery);
    })
    .sort(sortByUploadTimeDesc);
}
