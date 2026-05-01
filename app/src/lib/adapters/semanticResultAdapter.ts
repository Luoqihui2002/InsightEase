/**
 * Adapter: converts Semantic (comprehensive) backend result into unified AnalysisResult.
 */

import type { AnalysisResult, ResultBlock } from "@/types/result";
import type { Dataset } from "@/types/api";

interface SemanticColumnStats {
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
  unique_count?: number;
  top_values?: string[];
}

interface SemanticResultData {
  total_rows?: number;
  total_columns?: number;
  column_stats?: SemanticColumnStats[];
  ai_summary?: string;
}

export function toSemanticAnalysisResult(
  data: SemanticResultData | null | undefined,
  datasetInfo: Dataset | null
): AnalysisResult | null {
  const columnStats = data?.column_stats;
  if (!columnStats || !Array.isArray(columnStats) || columnStats.length === 0) {
    return null;
  }

  const blocks: ResultBlock[] = [];

  const totalRows =
    typeof data?.total_rows === "number"
      ? data.total_rows
      : datasetInfo?.row_count ?? 0;
  const totalColumns =
    typeof data?.total_columns === "number"
      ? data.total_columns
      : columnStats.length;
  const numericCount = columnStats.filter((c) => c.type === "numeric").length;
  const categoricalCount = columnStats.filter(
    (c) => c.type === "categorical"
  ).length;
  const highNullColumns = columnStats.filter(
    (c) => typeof c.null_percentage === "number" && c.null_percentage > 10
  );

  // === Summary block ===
  let summaryContent = `已识别 ${totalColumns} 个字段的语义类型。`;
  if (numericCount > 0) {
    summaryContent += `数值型字段 ${numericCount} 个，`;
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
            (c) => `${c.name}: 空值率 ${(c.null_percentage ?? 0).toFixed(1)}%`
          )
        : undefined,
  });

  // === Metric block ===
  blocks.push({
    type: "metric",
    metrics: [
      {
        key: "total_rows",
        label: "数据行数",
        value: totalRows,
        formattedValue: totalRows.toLocaleString("zh-CN"),
      },
      {
        key: "total_columns",
        label: "字段数",
        value: totalColumns,
        formattedValue: String(totalColumns),
      },
      {
        key: "numeric_columns",
        label: "数值型字段",
        value: numericCount,
        formattedValue: String(numericCount),
      },
      {
        key: "categorical_columns",
        label: "分类型字段",
        value: categoricalCount,
        formattedValue: String(categoricalCount),
      },
    ],
  });

  // === Table block ===
  const tableColumns = [
    {
      key: "name",
      label: "字段名",
      dataType: "string" as const,
      semanticRole: "identifier" as const,
    },
    {
      key: "type",
      label: "类型",
      dataType: "string" as const,
      semanticRole: "category" as const,
    },
    {
      key: "dtype",
      label: "数据类型",
      dataType: "string" as const,
    },
    {
      key: "non_null_count",
      label: "非空值",
      dataType: "integer" as const,
      align: "right" as const,
    },
    {
      key: "null_count",
      label: "空值",
      dataType: "integer" as const,
      align: "right" as const,
    },
    {
      key: "null_percentage",
      label: "空值占比",
      dataType: "percent" as const,
      precision: 1,
      align: "right" as const,
    },
    {
      key: "mean",
      label: "平均值",
      dataType: "number" as const,
      precision: 2,
      align: "right" as const,
    },
    {
      key: "median",
      label: "中位数",
      dataType: "number" as const,
      precision: 2,
      align: "right" as const,
    },
    {
      key: "std",
      label: "标准差",
      dataType: "number" as const,
      precision: 2,
      align: "right" as const,
    },
    {
      key: "min",
      label: "最小值",
      dataType: "number" as const,
      precision: 2,
      align: "right" as const,
    },
    {
      key: "max",
      label: "最大值",
      dataType: "number" as const,
      precision: 2,
      align: "right" as const,
    },
    {
      key: "unique_count",
      label: "唯一值",
      dataType: "integer" as const,
      align: "right" as const,
    },
    {
      key: "top_values",
      label: "常见值",
      dataType: "string" as const,
    },
  ];

  const tableRows = columnStats.map((col) => ({
    name: col.name ?? "—",
    dtype: col.dtype ?? "—",
    type:
      col.type === "numeric"
        ? "数值型"
        : col.type === "categorical"
        ? "分类型"
        : col.type === "datetime"
        ? "日期型"
        : "其他",
    non_null_count:
      typeof col.non_null_count === "number" ? col.non_null_count : null,
    null_count: typeof col.null_count === "number" ? col.null_count : null,
    null_percentage:
      typeof col.null_percentage === "number" ? col.null_percentage / 100 : null,
    mean: typeof col.mean === "number" ? col.mean : null,
    median: typeof col.median === "number" ? col.median : null,
    std: typeof col.std === "number" ? col.std : null,
    min: typeof col.min === "number" ? col.min : null,
    max: typeof col.max === "number" ? col.max : null,
    unique_count:
      typeof col.unique_count === "number" ? col.unique_count : null,
    top_values:
      Array.isArray(col.top_values) && col.top_values.length > 0
        ? col.top_values.slice(0, 3).join(", ")
        : null,
  }));

  blocks.push({
    type: "table",
    title: "字段语义识别详情",
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
    id: `semantic-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "semantic_analysis",
    title: "语义分析结果",
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
