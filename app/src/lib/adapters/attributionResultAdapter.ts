/**
 * Adapter: converts Attribution backend result into unified AnalysisResult.
 */

import type { AnalysisResult, ResultBlock } from "@/types/result";
import type { Dataset } from "@/types/api";

interface AttributionTouchpointData {
  percentage: number;
  // May contain additional fields like contribution, count, etc.
  [key: string]: unknown;
}

interface AttributionModelComparisonItem {
  model: string;
  model_name: string;
  top3: {
    touchpoint: string;
    percentage: number;
  }[];
}

interface AttributionSummary {
  conversion_rate?: number;
  avg_touchpoints_per_journey?: number;
  model_comparison?: AttributionModelComparisonItem[];
}

interface AttributionResultData {
  user_journey_count?: number;
  total_conversions?: number;
  total_conversion_value?: number;
  summary?: AttributionSummary;
  models?: Record<string, Record<string, AttributionTouchpointData>>;
}

export function toAttributionAnalysisResult(
  data: AttributionResultData | null | undefined,
  datasetInfo: Dataset | null
): AnalysisResult | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const hasModels =
    data.models &&
    typeof data.models === "object" &&
    Object.keys(data.models).length > 0;

  if (!hasModels) {
    return null;
  }

  const blocks: ResultBlock[] = [];
  const models = data.models!;
  const summary = data.summary;

  const userJourneyCount =
    typeof data.user_journey_count === "number" ? data.user_journey_count : 0;
  const totalConversions =
    typeof data.total_conversions === "number" ? data.total_conversions : 0;
  const conversionRate =
    typeof summary?.conversion_rate === "number" ? summary.conversion_rate : 0;
  const avgTouchpoints =
    typeof summary?.avg_touchpoints_per_journey === "number"
      ? summary.avg_touchpoints_per_journey
      : 0;

  // === Summary block ===
  let summaryContent = "归因分析已完成。";
  if (userJourneyCount > 0) {
    summaryContent += `共分析 ${userJourneyCount.toLocaleString("zh-CN")} 条用户旅程，`;
  }
  if (totalConversions > 0) {
    summaryContent += `产生 ${totalConversions.toLocaleString("zh-CN")} 次转化。`;
  }
  if (conversionRate > 0) {
    summaryContent += `整体转化率为 ${conversionRate.toFixed(2)}%。`;
  }
  if (avgTouchpoints > 0) {
    summaryContent += `平均每个旅程包含 ${avgTouchpoints.toFixed(1)} 个触点。`;
  }

  blocks.push({
    type: "summary",
    content: summaryContent,
    tone: conversionRate < 1 ? "caution" : "neutral",
  });

  // === Metric block ===
  blocks.push({
    type: "metric",
    metrics: [
      {
        key: "user_journey_count",
        label: "用户旅程数",
        value: userJourneyCount,
        formattedValue: userJourneyCount.toLocaleString("zh-CN"),
      },
      {
        key: "total_conversions",
        label: "总转化数",
        value: totalConversions,
        formattedValue: totalConversions.toLocaleString("zh-CN"),
      },
      {
        key: "conversion_rate",
        label: "转化率",
        value: conversionRate,
        formattedValue: `${conversionRate.toFixed(2)}%`,
        unit: "%",
        tone: conversionRate < 1 ? "caution" : "neutral",
      },
      {
        key: "avg_touchpoints",
        label: "平均触点数",
        value: avgTouchpoints,
        formattedValue: avgTouchpoints.toFixed(1),
      },
    ],
  });

  // === Table block: per-model attribution ===
  // Flatten nested models data into rows
  const attributionRows: Record<string, unknown>[] = [];
  for (const [modelKey, modelData] of Object.entries(models)) {
    if (!modelData || typeof modelData !== "object") continue;
    for (const [touchpoint, tpData] of Object.entries(modelData)) {
      const pct =
        tpData && typeof tpData === "object" && typeof tpData.percentage === "number"
          ? tpData.percentage
          : null;
      attributionRows.push({
        model: modelKey,
        touchpoint,
        percentage: pct !== null ? pct / 100 : null,
      });
    }
  }

  if (attributionRows.length > 0) {
    blocks.push({
      type: "table",
      title: "各模型触点归因",
      columns: [
        {
          key: "model",
          label: "模型",
          dataType: "string" as const,
          semanticRole: "category" as const,
        },
        {
          key: "touchpoint",
          label: "触点",
          dataType: "string" as const,
          semanticRole: "dimension" as const,
        },
        {
          key: "percentage",
          label: "归因占比",
          dataType: "percent" as const,
          precision: 2,
          align: "right" as const,
        },
      ],
      rows: attributionRows,
      sortable: true,
      emptyMessage: "无归因数据",
    });
  }

  // === Table block: model comparison top3 ===
  const modelComparison = summary?.model_comparison;
  if (Array.isArray(modelComparison) && modelComparison.length > 0) {
    const comparisonRows = modelComparison.map((item) => {
      const row: Record<string, unknown> = {
        model_name: item.model_name ?? item.model ?? "—",
      };
      if (Array.isArray(item.top3)) {
        item.top3.forEach((tp, i) => {
          row[`top${i + 1}`] = tp.touchpoint ?? "—";
          row[`top${i + 1}_pct`] =
            typeof tp.percentage === "number" ? tp.percentage / 100 : null;
        });
      }
      return row;
    });

    const comparisonColumns = [
      {
        key: "model_name",
        label: "模型",
        dataType: "string" as const,
        semanticRole: "category" as const,
      },
      {
        key: "top1",
        label: "Top1 触点",
        dataType: "string" as const,
      },
      {
        key: "top1_pct",
        label: "Top1 占比",
        dataType: "percent" as const,
        precision: 1,
        align: "right" as const,
      },
      {
        key: "top2",
        label: "Top2 触点",
        dataType: "string" as const,
      },
      {
        key: "top2_pct",
        label: "Top2 占比",
        dataType: "percent" as const,
        precision: 1,
        align: "right" as const,
      },
      {
        key: "top3",
        label: "Top3 触点",
        dataType: "string" as const,
      },
      {
        key: "top3_pct",
        label: "Top3 占比",
        dataType: "percent" as const,
        precision: 1,
        align: "right" as const,
      },
    ];

    blocks.push({
      type: "table",
      title: "各模型 Top3 触点对比",
      columns: comparisonColumns,
      rows: comparisonRows,
      sortable: true,
      emptyMessage: "无模型对比数据",
    });
  }

  // === Chart block: model comparison bar chart ===
  const modelKeys = Object.keys(models);
  const firstModelKey = modelKeys[0];
  const touchpoints = firstModelKey ? Object.keys(models[firstModelKey] || {}) : [];

  if (touchpoints.length > 0 && modelKeys.length > 0) {
    const chartRows = touchpoints.map((tp) => {
      const row: Record<string, unknown> = { touchpoint: tp };
      for (const mk of modelKeys) {
        const pct = models[mk]?.[tp]?.percentage;
        row[mk] = typeof pct === "number" ? pct : 0;
      }
      return row;
    });

    const MODEL_NAME_MAP: Record<string, string> = {
      first_touch: "首次触点",
      last_touch: "末次触点",
      linear: "线性归因",
      time_decay: "时间衰减",
      position_based: "位置归因",
      shapley: "Shapley值",
    };

    blocks.push({
      type: "chart",
      title: "各模型归因对比",
      chartType: "bar",
      data: chartRows,
      xKey: "touchpoint",
      yKeys: modelKeys,
      seriesNames: modelKeys.map((mk) => MODEL_NAME_MAP[mk] || mk),
    });
  }

  // === Warning blocks ===
  if (conversionRate < 1) {
    blocks.push({
      type: "warning",
      severity: "caution",
      message: `整体转化率仅为 ${conversionRate.toFixed(2)}%，低于 1%。`,
      suggestion: "建议检查用户旅程设计或触点质量。",
    });
  }

  if (avgTouchpoints > 10) {
    blocks.push({
      type: "warning",
      severity: "info",
      message: `平均触点数为 ${avgTouchpoints.toFixed(1)}，用户旅程较长。`,
      suggestion: "建议优化转化路径，减少不必要的中间触点。",
    });
  }

  // Determine overall status
  let status: AnalysisResult["status"] = "success";
  if (conversionRate < 1) {
    status = "warning";
  }

  return {
    id: `attribution-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "attribution_analysis",
    title: "归因分析结果",
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
