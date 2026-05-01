/**
 * Adapter: converts Statistics backend result into unified AnalysisResult.
 */

import type { AnalysisResult, ResultBlock } from "@/types/result";
import type { Dataset } from "@/types/api";

interface StatisticsColumnStats {
  name: string;
  dtype: string;
  type: "numeric" | "categorical" | "datetime" | "other";
  non_null_count: number;
  null_count: number;
  null_percentage: number;
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  q1?: number;
  q3?: number;
  unique_count?: number;
  most_common?: string;
}

interface StatisticsResultData {
  column_stats?: StatisticsColumnStats[];
  ai_summary?: string;
}

export function toStatisticsAnalysisResult(
  data: StatisticsResultData | null | undefined,
  datasetInfo: Dataset | null,
  selectedColumn: string
): AnalysisResult | null {
  const columnStats = data?.column_stats;
  if (!columnStats || !Array.isArray(columnStats) || columnStats.length === 0) {
    return null;
  }

  const targetColumns =
    selectedColumn === "all"
      ? columnStats
      : columnStats.filter((c) => c?.name === selectedColumn);

  const blocks: ResultBlock[] = [];

  // === Summary block ===
  const numericCount = targetColumns.filter((c) => c.type === "numeric").length;
  const categoricalCount = targetColumns.filter(
    (c) => c.type === "categorical"
  ).length;
  const highNullColumns = targetColumns.filter(
    (c) => typeof c.null_percentage === "number" && c.null_percentage > 10
  );

  let summaryContent = `已对 ${targetColumns.length} 个字段进行描述性统计分析。`;
  if (numericCount > 0) {
    summaryContent += `其中数值型字段 ${numericCount} 个，`;
  }
  if (categoricalCount > 0) {
    summaryContent += `分类型字段 ${categoricalCount} 个。`;
  }
  if (highNullColumns.length > 0) {
    summaryContent += `注意：${highNullColumns.length} 个字段空值率超过 10%。`;
  }

  blocks.push({
    type: "summary",
    content: summaryContent,
    tone: highNullColumns.length > 0 ? "caution" : "neutral",
    bulletPoints:
      highNullColumns.length > 0
        ? highNullColumns.map(
            (c) => `${c.name}: 空值率 ${c.null_percentage.toFixed(1)}%`
          )
        : undefined,
  });

  // === Metric block ===
  const totalRows = datasetInfo?.row_count ?? 0;
  const totalNulls = targetColumns.reduce(
    (sum, c) => sum + (typeof c.null_count === "number" ? c.null_count : 0),
    0
  );

  blocks.push({
    type: "metric",
    metrics: [
      {
        key: "total_columns",
        label: "分析字段数",
        value: targetColumns.length,
        formattedValue: String(targetColumns.length),
      },
      {
        key: "total_rows",
        label: "数据行数",
        value: totalRows,
        formattedValue: totalRows.toLocaleString("zh-CN"),
      },
      {
        key: "numeric_columns",
        label: "数值型字段",
        value: numericCount,
        formattedValue: String(numericCount),
      },
      {
        key: "total_nulls",
        label: "总空值数",
        value: totalNulls,
        formattedValue: totalNulls.toLocaleString("zh-CN"),
        tone: totalNulls > 0 ? "caution" : "neutral",
      },
    ],
  });

  // === Table block ===
  const tableColumns = [
    { key: "name", label: "字段名", dataType: "string" as const, semanticRole: "identifier" as const },
    { key: "type", label: "类型", dataType: "string" as const, semanticRole: "category" as const },
    { key: "non_null_count", label: "非空值", dataType: "integer" as const, align: "right" as const },
    { key: "null_count", label: "空值", dataType: "integer" as const, align: "right" as const },
    { key: "null_percentage", label: "空值占比", dataType: "percent" as const, precision: 1, align: "right" as const },
    { key: "mean", label: "平均值", dataType: "number" as const, precision: 2, align: "right" as const },
    { key: "median", label: "中位数", dataType: "number" as const, precision: 2, align: "right" as const },
    { key: "std", label: "标准差", dataType: "number" as const, precision: 2, align: "right" as const },
    { key: "min", label: "最小值", dataType: "number" as const, precision: 2, align: "right" as const },
    { key: "max", label: "最大值", dataType: "number" as const, precision: 2, align: "right" as const },
    { key: "unique_count", label: "唯一值", dataType: "integer" as const, align: "right" as const },
    { key: "most_common", label: "最常见", dataType: "string" as const },
  ];

  const tableRows = targetColumns.map((col) => ({
    name: col.name ?? "—",
    type:
      col.type === "numeric"
        ? "数值型"
        : col.type === "categorical"
        ? "分类型"
        : col.type === "datetime"
        ? "日期型"
        : "其他",
    non_null_count: typeof col.non_null_count === "number" ? col.non_null_count : null,
    null_count: typeof col.null_count === "number" ? col.null_count : null,
    null_percentage:
      typeof col.null_percentage === "number" ? col.null_percentage / 100 : null,
    mean: typeof col.mean === "number" ? col.mean : null,
    median: typeof col.median === "number" ? col.median : null,
    std: typeof col.std === "number" ? col.std : null,
    min: typeof col.min === "number" ? col.min : null,
    max: typeof col.max === "number" ? col.max : null,
    unique_count: typeof col.unique_count === "number" ? col.unique_count : null,
    most_common: col.most_common ?? null,
  }));

  blocks.push({
    type: "table",
    title: "字段统计详情",
    columns: tableColumns,
    rows: tableRows,
    sortable: true,
    emptyMessage: "无字段统计数据",
  });

  // === AI Summary block ===
  if (data?.ai_summary) {
    blocks.push({
      type: "text",
      title: "AI 智能解读",
      content: data.ai_summary,
    });
  }

  // === Warning blocks ===
  for (const col of highNullColumns) {
    const np = col.null_percentage ?? 0;
    blocks.push({
      type: "warning",
      severity: np > 50 ? "critical" : "caution",
      message: `字段 "${col.name}" 的空值率为 ${np.toFixed(1)}%，可能影响分析准确性。`,
      suggestion:
        np > 50
          ? "建议检查数据源或考虑删除该字段。"
          : "建议对空值进行填充或剔除处理。",
      relatedField: col.name,
    });
  }

  // Determine overall status
  let status: AnalysisResult["status"] = "success";
  if (highNullColumns.some((c) => c.null_percentage > 50)) {
    status = "warning";
  }

  return {
    id: `stats-${datasetInfo?.id ?? "unknown"}-${selectedColumn}`,
    analysisType: "descriptive_statistics",
    title: selectedColumn === "all" ? "描述性统计分析" : `"${selectedColumn}" 描述性统计`,
    description: datasetInfo?.filename
      ? `数据集: ${datasetInfo.filename}`
      : undefined,
    status,
    generatedAt: new Date().toISOString(),
    dataset: datasetInfo
      ? {
          id: String(datasetInfo.id),
          name: datasetInfo.filename || String(datasetInfo.id),
          rowCount: datasetInfo.row_count || 0,
          columnCount: datasetInfo.col_count || 0,
        }
      : undefined,
    blocks,
  };
}
