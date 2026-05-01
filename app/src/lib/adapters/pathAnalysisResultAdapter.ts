/**
 * Adapter: converts PathAnalysis backend result into unified AnalysisResult.
 *
 * Supports 5 analysis types: funnel, path, clustering, key_path, sequence_mining.
 * Chart placeholders are NOT emitted because PathAnalysis.tsx renders real
 * ECharts charts (funnel, sankey, graph, association rule graph) outside ResultView.
 */

import type { AnalysisResult, ResultBlock } from "@/types/result";
import type { Dataset } from "@/types/api";

// ── Type definitions based on current PathAnalysis.tsx rendering code ──

interface FunnelStep {
  step?: number;
  name?: string;
  users?: number;
  conversion_rate?: number;
  drop_off_rate?: number;
  avg_time_from_prev?: number;
}

interface TopPath {
  path?: string[];
  user_count?: number;
  percentage?: number;
  count?: number;
}

interface PathNode {
  name?: string;
  in_degree?: number;
  out_degree?: number;
  unique_users?: number;
}

interface CycleDetail {
  path?: string[];
  user_count?: number;
}

interface Cluster {
  cluster_id?: number;
  user_count?: number;
  percentage?: number;
  description?: string;
  feature_stats?: Record<string, { mean?: number }>;
  most_common_path?: string;
  top_paths?: Array<{ path?: string; count?: number }>;
  characteristics?: string[];
  avg_path_length?: number;
}

interface OptimalPath {
  path?: string[];
  steps?: number;
  duration_seconds?: number;
}

interface OptimalPaths {
  min_steps?: OptimalPath;
  min_duration?: OptimalPath;
}

interface FrequentPattern {
  pattern?: string[];
  support?: number;
  support_count?: number;
  confidence?: number;
  conversion_rate?: number;
}

interface AssociationRule {
  antecedent?: string[] | string;
  consequent?: string;
  support?: number;
  confidence?: number;
  lift?: number;
  rule_type?: string;
  antecedent_str?: string;
}

interface HighConversionPattern {
  pattern?: string[];
  conversion_rate?: number;
  support?: number;
  count?: number;
}

export interface PathAnalysisResultData {
  // Common
  total_users?: number;
  ai_summary?: string;
  // Funnel
  funnel_steps?: FunnelStep[];
  overall_conversion_rate?: number;
  avg_conversion_time?: number;
  // Path
  top_paths?: TopPath[];
  total_paths?: number;
  max_path_length?: number;
  sankey_data?: { nodes?: unknown[]; links?: unknown[] };
  graph_data?: { nodes?: unknown[]; links?: unknown[] };
  has_cycle_in_data?: boolean;
  cycle_details?: CycleDetail[];
  node_details?: PathNode[];
  // Clustering
  clusters?: Cluster[];
  n_clusters?: number;
  user_cluster_mapping?: Record<string, number>;
  // Key path
  complete_path_count?: number;
  avg_steps?: number;
  avg_duration_seconds?: number;
  optimal_paths?: OptimalPaths;
  start_event?: string;
  end_event?: string;
  // Sequence mining
  total_sequences?: number;
  avg_sequence_length?: number;
  frequent_patterns?: FrequentPattern[];
  association_rules?: AssociationRule[];
  high_conversion_patterns?: HighConversionPattern[];
  sequence_stats?: { conversion_rate?: number };
}

export type PathType = "funnel" | "path" | "clustering" | "key_path" | "sequence_mining";

// ── Utilities ───────────────────────────────────────────────────────

function safeNumber(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function formatPath(path: string[] | undefined): string {
  if (!Array.isArray(path)) return "—";
  return path.join(" → ");
}

function buildDatasetMeta(
  datasetInfo: Dataset | null
): AnalysisResult["dataset"] {
  if (!datasetInfo) return undefined;
  return {
    id: String(datasetInfo.id),
    name: datasetInfo.filename || String(datasetInfo.id),
    rowCount: datasetInfo.row_count || 0,
    columnCount: datasetInfo.col_count || 0,
  };
}

// ── Main dispatcher ─────────────────────────────────────────────────

export function toPathAnalysisResult(
  data: PathAnalysisResultData | null | undefined,
  datasetInfo: Dataset | null,
  pathType: PathType
): AnalysisResult | null {
  if (!data || typeof data !== "object") return null;

  switch (pathType) {
    case "funnel":
      return convertFunnel(data, datasetInfo);
    case "path":
      return convertPath(data, datasetInfo);
    case "clustering":
      return convertClustering(data, datasetInfo);
    case "key_path":
      return convertKeyPath(data, datasetInfo);
    case "sequence_mining":
      return convertSequenceMining(data, datasetInfo);
    default:
      return null;
  }
}

// ── Funnel ──────────────────────────────────────────────────────────

function convertFunnel(
  data: PathAnalysisResultData,
  datasetInfo: Dataset | null
): AnalysisResult | null {
  const steps = safeArray<FunnelStep>(data.funnel_steps);
  if (steps.length === 0) return null;

  const blocks: ResultBlock[] = [];
  const totalUsers = safeNumber(data.total_users) ?? 0;
  const overallConv = safeNumber(data.overall_conversion_rate);
  const avgTime = safeNumber(data.avg_conversion_time);

  // Summary
  let summary = `漏斗分析已完成，共 ${steps.length} 个步骤。`;
  if (totalUsers > 0) {
    summary += ` 总用户数 ${totalUsers.toLocaleString("zh-CN")}。`;
  }
  if (overallConv !== null) {
    summary += ` 总体转化率 ${overallConv.toFixed(1)}%。`;
  }
  blocks.push({
    type: "summary",
    content: summary,
    tone: overallConv !== null && overallConv < 10 ? "negative" : "neutral",
  });

  // Metrics
  const metrics: AnalysisResult["blocks"][number] & { type: "metric" } = {
    type: "metric",
    metrics: [
      {
        key: "total_users",
        label: "总用户数",
        value: totalUsers,
        formattedValue: totalUsers.toLocaleString("zh-CN"),
      },
      {
        key: "step_count",
        label: "步骤数",
        value: steps.length,
        formattedValue: String(steps.length),
      },
    ],
  };
  if (overallConv !== null) {
    metrics.metrics.push({
      key: "overall_conversion_rate",
      label: "总体转化率",
      value: overallConv,
      formattedValue: `${overallConv.toFixed(1)}%`,
      unit: "%",
      tone: overallConv < 10 ? "negative" : "neutral",
    });
  }
  if (avgTime !== null) {
    metrics.metrics.push({
      key: "avg_conversion_time",
      label: "平均转化时长",
      value: avgTime,
      formattedValue: `${avgTime.toFixed(1)}h`,
    });
  }
  blocks.push(metrics);

  // Funnel steps table
  const stepRows = steps.map((step) => ({
    step: safeNumber(step.step) ?? "—",
    name: safeString(step.name) ?? "—",
    users: safeNumber(step.users),
    conversion_rate:
      safeNumber(step.conversion_rate) !== null
        ? (step.conversion_rate! / 100)
        : null,
    drop_off_rate:
      safeNumber(step.drop_off_rate) !== null
        ? (step.drop_off_rate! / 100)
        : null,
    avg_time:
      safeNumber(step.avg_time_from_prev) !== null
        ? step.avg_time_from_prev! > 0
          ? step.avg_time_from_prev
          : null
        : null,
  }));

  blocks.push({
    type: "table",
    title: "漏斗步骤详情",
    columns: [
      { key: "step", label: "步骤", dataType: "integer", align: "right" },
      { key: "name", label: "名称", dataType: "string" },
      {
        key: "users",
        label: "用户数",
        dataType: "integer",
        align: "right",
      },
      {
        key: "conversion_rate",
        label: "转化率",
        dataType: "percent",
        precision: 1,
        align: "right",
      },
      {
        key: "drop_off_rate",
        label: "流失率",
        dataType: "percent",
        precision: 1,
        align: "right",
      },
      {
        key: "avg_time",
        label: "平均耗时(h)",
        dataType: "number",
        precision: 1,
        align: "right",
      },
    ],
    rows: stepRows,
    sortable: true,
    emptyMessage: "无漏斗步骤数据",
  });

  // Warnings
  const maxDropOff = steps.reduce(
    (max, s) =>
      safeNumber(s.drop_off_rate) !== null &&
      (s.drop_off_rate ?? 0) > (max?.drop_off_rate ?? -1)
        ? s
        : max,
    steps[0]
  );
  if (maxDropOff && safeNumber(maxDropOff.drop_off_rate)! > 50) {
    blocks.push({
      type: "warning",
      severity: "caution",
      message: `"${maxDropOff.name}" 步骤流失率高达 ${maxDropOff.drop_off_rate!.toFixed(1)}%。`,
      suggestion: "建议优化该步骤的用户体验或简化操作流程。",
    });
  }

  if (overallConv !== null && overallConv < 5) {
    blocks.push({
      type: "warning",
      severity: "caution",
      message: `整体转化率仅为 ${overallConv.toFixed(1)}%，漏斗效率较低。`,
      suggestion: "建议检查漏斗入口流量质量或中间步骤的转化瓶颈。",
    });
  }

  if (data.ai_summary) {
    blocks.push({
      type: "text",
      title: "AI 智能解读",
      content: data.ai_summary,
    });
  }

  return {
    id: `funnel-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "funnel_analysis",
    title: "漏斗分析结果",
    description: datasetInfo?.filename
      ? `数据集: ${datasetInfo.filename}`
      : undefined,
    status:
      overallConv !== null && overallConv < 5 ? "warning" : "success",
    generatedAt: new Date().toISOString(),
    dataset: buildDatasetMeta(datasetInfo),
    blocks,
  };
}

// ── Path ────────────────────────────────────────────────────────────

function convertPath(
  data: PathAnalysisResultData,
  datasetInfo: Dataset | null
): AnalysisResult | null {
  const topPaths = safeArray<TopPath>(data.top_paths);
  const nodes = safeArray<PathNode>(data.node_details);

  if (topPaths.length === 0 && nodes.length === 0) return null;

  const blocks: ResultBlock[] = [];
  const totalUsers = safeNumber(data.total_users) ?? 0;
  const totalPaths = safeNumber(data.total_paths);
  const maxPathLen = safeNumber(data.max_path_length);

  // Summary
  let summary = "路径分析已完成。";
  if (totalUsers > 0) {
    summary += ` 共分析 ${totalUsers.toLocaleString("zh-CN")} 位用户的行为路径。`;
  }
  if (totalPaths !== null) {
    summary += ` 发现 ${totalPaths.toLocaleString("zh-CN")} 条不同路径。`;
  }
  if (data.has_cycle_in_data) {
    summary += " 检测到路径中存在循环行为。";
  }
  blocks.push({
    type: "summary",
    content: summary,
    tone: data.has_cycle_in_data ? "caution" : "neutral",
  });

  // Metrics
  const metrics: AnalysisResult["blocks"][number] & { type: "metric" } = {
    type: "metric",
    metrics: [
      {
        key: "total_users",
        label: "总用户数",
        value: totalUsers,
        formattedValue: totalUsers.toLocaleString("zh-CN"),
      },
    ],
  };
  if (totalPaths !== null) {
    metrics.metrics.push({
      key: "total_paths",
      label: "不同路径数",
      value: totalPaths,
      formattedValue: totalPaths.toLocaleString("zh-CN"),
    });
  }
  if (maxPathLen !== null) {
    metrics.metrics.push({
      key: "max_path_length",
      label: "最大路径长度",
      value: maxPathLen,
      formattedValue: String(maxPathLen),
    });
  }
  blocks.push(metrics);

  // Top paths table
  if (topPaths.length > 0) {
    blocks.push({
      type: "table",
      title: "热门路径 TOP 10",
      columns: [
        {
          key: "rank",
          label: "排名",
          dataType: "integer",
          align: "right",
        },
        { key: "path", label: "路径", dataType: "string" },
        {
          key: "user_count",
          label: "用户数",
          dataType: "integer",
          align: "right",
        },
        {
          key: "percentage",
          label: "占比",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
      ],
      rows: topPaths.slice(0, 10).map((p, i) => ({
        rank: i + 1,
        path: formatPath(p.path),
        user_count: safeNumber(p.user_count),
        percentage:
          safeNumber(p.percentage) !== null
            ? p.percentage! / 100
            : null,
      })),
      sortable: false,
      emptyMessage: "无路径数据",
    });
  }

  // Node details table
  if (nodes.length > 0) {
    blocks.push({
      type: "table",
      title: "节点访问统计",
      columns: [
        {
          key: "name",
          label: "节点名称",
          dataType: "string",
          semanticRole: "dimension",
        },
        {
          key: "unique_users",
          label: "访问用户数",
          dataType: "integer",
          align: "right",
        },
        {
          key: "in_degree",
          label: "入度",
          dataType: "integer",
          align: "right",
        },
        {
          key: "out_degree",
          label: "出度",
          dataType: "integer",
          align: "right",
        },
      ],
      rows: nodes.map((n) => ({
        name: safeString(n.name) ?? "—",
        unique_users: safeNumber(n.unique_users),
        in_degree: safeNumber(n.in_degree),
        out_degree: safeNumber(n.out_degree),
      })),
      sortable: true,
      emptyMessage: "无节点数据",
    });
  }

  // Warnings
  if (data.has_cycle_in_data) {
    blocks.push({
      type: "warning",
      severity: "info",
      message: "检测到用户路径中存在循环行为（如 A→B→A）。",
      suggestion: "建议使用网络图查看完整路径。",
    });
  }

  if (totalPaths !== null && totalUsers > 0 && totalPaths / totalUsers > 0.8) {
    blocks.push({
      type: "warning",
      severity: "info",
      message: "路径碎片化程度较高，不同路径数接近用户数。",
      suggestion: "建议增加最小用户数阈值或合并相似事件。",
    });
  }

  if (data.ai_summary) {
    blocks.push({
      type: "text",
      title: "AI 智能解读",
      content: data.ai_summary,
    });
  }

  return {
    id: `path-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "path_analysis",
    title: "路径分析结果",
    description: datasetInfo?.filename
      ? `数据集: ${datasetInfo.filename}`
      : undefined,
    status: data.has_cycle_in_data ? "warning" : "success",
    generatedAt: new Date().toISOString(),
    dataset: buildDatasetMeta(datasetInfo),
    blocks,
  };
}

// ── Clustering ──────────────────────────────────────────────────────

function convertClustering(
  data: PathAnalysisResultData,
  datasetInfo: Dataset | null
): AnalysisResult | null {
  const clusters = safeArray<Cluster>(data.clusters);
  if (clusters.length === 0) return null;

  const blocks: ResultBlock[] = [];
  const totalUsers = safeNumber(data.total_users) ?? 0;
  const nClusters = safeNumber(data.n_clusters) ?? clusters.length;

  // Summary
  let summary = `路径聚类分析已完成，将用户分为 ${nClusters} 个群体。`;
  if (totalUsers > 0) {
    summary += ` 总用户数 ${totalUsers.toLocaleString("zh-CN")}。`;
  }
  blocks.push({
    type: "summary",
    content: summary,
    tone: "neutral",
  });

  // Metrics
  blocks.push({
    type: "metric",
    metrics: [
      {
        key: "total_users",
        label: "总用户数",
        value: totalUsers,
        formattedValue: totalUsers.toLocaleString("zh-CN"),
      },
      {
        key: "n_clusters",
        label: "聚类数",
        value: nClusters,
        formattedValue: String(nClusters),
      },
    ],
  });

  // Cluster table
  blocks.push({
    type: "table",
    title: "用户群体分析",
    columns: [
      {
        key: "cluster_id",
        label: "群体编号",
        dataType: "integer",
        align: "right",
      },
      {
        key: "user_count",
        label: "用户数",
        dataType: "integer",
        align: "right",
      },
      {
        key: "percentage",
        label: "占比",
        dataType: "percent",
        precision: 1,
        align: "right",
      },
      {
        key: "description",
        label: "描述",
        dataType: "string",
      },
      {
        key: "avg_path_length",
        label: "平均路径长度",
        dataType: "number",
        precision: 1,
        align: "right",
      },
      {
        key: "characteristics",
        label: "特征",
        dataType: "string",
      },
    ],
    rows: clusters.map((c) => {
      const featureKeys = c.feature_stats
        ? Object.keys(c.feature_stats).slice(0, 3)
        : [];
      const featureSummary =
        featureKeys.length > 0
          ? featureKeys
              .map(
                (k) =>
                  `${k}: ${c.feature_stats![k]?.mean?.toFixed?.(1) ?? "—"}`
              )
              .join(", ")
          : null;

      return {
        cluster_id: (safeNumber(c.cluster_id) ?? 0) + 1,
        user_count: safeNumber(c.user_count),
        percentage:
          safeNumber(c.percentage) !== null ? c.percentage! / 100 : null,
        description: safeString(c.description) ?? "—",
        avg_path_length: safeNumber(c.avg_path_length),
        characteristics:
          safeString(c.characteristics?.join("; ")) ??
          featureSummary ??
          safeString(c.most_common_path) ??
          "—",
      };
    }),
    sortable: true,
    emptyMessage: "无聚类数据",
  });

  // Warnings
  const largestCluster = clusters.reduce(
    (max, c) =>
      (safeNumber(c.percentage) ?? 0) > (safeNumber(max.percentage) ?? 0)
        ? c
        : max,
    clusters[0]
  );
  const largestPct = safeNumber(largestCluster?.percentage) ?? 0;
  if (largestPct > 70) {
    blocks.push({
      type: "warning",
      severity: "info",
      message: `群体 ${(largestCluster.cluster_id ?? 0) + 1} 占比高达 ${largestPct.toFixed(1)}%，分布不均匀。`,
      suggestion: "建议调整聚类数量或特征选择。",
    });
  }

  if (data.ai_summary) {
    blocks.push({
      type: "text",
      title: "AI 智能解读",
      content: data.ai_summary,
    });
  }

  return {
    id: `clustering-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "path_clustering",
    title: "路径聚类结果",
    description: datasetInfo?.filename
      ? `数据集: ${datasetInfo.filename}`
      : undefined,
    status: largestPct > 70 ? "warning" : "success",
    generatedAt: new Date().toISOString(),
    dataset: buildDatasetMeta(datasetInfo),
    blocks,
  };
}

// ── Key Path ────────────────────────────────────────────────────────

function convertKeyPath(
  data: PathAnalysisResultData,
  datasetInfo: Dataset | null
): AnalysisResult | null {
  const completeCount = safeNumber(data.complete_path_count);
  const topPaths = safeArray<TopPath>(data.top_paths);

  if (completeCount === null && topPaths.length === 0) return null;

  const blocks: ResultBlock[] = [];
  const avgSteps = safeNumber(data.avg_steps);
  const avgDuration = safeNumber(data.avg_duration_seconds);
  const startEvent = safeString(data.start_event);
  const endEvent = safeString(data.end_event);

  // Summary
  let summary = "关键路径分析已完成。";
  if (startEvent && endEvent) {
    summary += ` 分析从「${startEvent}」到「${endEvent}」的转化路径。`;
  }
  if (completeCount !== null) {
    summary += ` 发现 ${completeCount.toLocaleString("zh-CN")} 条完整路径。`;
  }
  if (avgSteps !== null) {
    summary += ` 平均 ${avgSteps.toFixed(1)} 步。`;
  }
  blocks.push({
    type: "summary",
    content: summary,
    tone: "neutral",
  });

  // Metrics
  const metrics: AnalysisResult["blocks"][number] & { type: "metric" } = {
    type: "metric",
    metrics: [],
  };
  if (completeCount !== null) {
    metrics.metrics.push({
      key: "complete_path_count",
      label: "完整路径数",
      value: completeCount,
      formattedValue: completeCount.toLocaleString("zh-CN"),
    });
  }
  if (avgSteps !== null) {
    metrics.metrics.push({
      key: "avg_steps",
      label: "平均步数",
      value: avgSteps,
      formattedValue: avgSteps.toFixed(1),
    });
  }
  if (avgDuration !== null) {
    metrics.metrics.push({
      key: "avg_duration_hours",
      label: "平均耗时",
      value: avgDuration / 3600,
      formattedValue: `${(avgDuration / 3600).toFixed(1)}h`,
    });
  }
  if (metrics.metrics.length > 0) blocks.push(metrics);

  // Top paths table
  if (topPaths.length > 0) {
    blocks.push({
      type: "table",
      title: "常见路径 TOP 10",
      columns: [
        {
          key: "rank",
          label: "排名",
          dataType: "integer",
          align: "right",
        },
        { key: "path", label: "路径", dataType: "string" },
        {
          key: "count",
          label: "用户数",
          dataType: "integer",
          align: "right",
        },
        {
          key: "percentage",
          label: "占比",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
      ],
      rows: topPaths.map((p, i) => ({
        rank: i + 1,
        path: formatPath(p.path),
        count: safeNumber(p.count),
        percentage:
          safeNumber(p.percentage) !== null
            ? p.percentage! / 100
            : null,
      })),
      sortable: false,
      emptyMessage: "无路径数据",
    });
  }

  // Optimal paths table
  const optimal = data.optimal_paths;
  if (optimal) {
    const optRows: Record<string, unknown>[] = [];
    if (optimal.min_steps?.path) {
      optRows.push({
        type: "步数最少",
        path: formatPath(optimal.min_steps.path),
        steps: safeNumber(optimal.min_steps.steps),
        duration_hours:
          safeNumber(optimal.min_steps.duration_seconds) !== null
            ? optimal.min_steps.duration_seconds! / 3600
            : null,
      });
    }
    if (optimal.min_duration?.path) {
      optRows.push({
        type: "耗时最短",
        path: formatPath(optimal.min_duration.path),
        steps: safeNumber(optimal.min_duration.steps),
        duration_hours:
          safeNumber(optimal.min_duration.duration_seconds) !== null
            ? optimal.min_duration.duration_seconds! / 3600
            : null,
      });
    }
    if (optRows.length > 0) {
      blocks.push({
        type: "table",
        title: "最优路径",
        columns: [
          {
            key: "type",
            label: "类型",
            dataType: "string",
            semanticRole: "category",
          },
          { key: "path", label: "路径", dataType: "string" },
          {
            key: "steps",
            label: "步数",
            dataType: "integer",
            align: "right",
          },
          {
            key: "duration_hours",
            label: "耗时(h)",
            dataType: "number",
            precision: 1,
            align: "right",
          },
        ],
        rows: optRows,
        sortable: false,
        emptyMessage: "无最优路径数据",
      });
    }
  }

  if (data.ai_summary) {
    blocks.push({
      type: "text",
      title: "AI 智能解读",
      content: data.ai_summary,
    });
  }

  return {
    id: `key-path-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "key_path_analysis",
    title: "关键路径分析结果",
    description: datasetInfo?.filename
      ? `数据集: ${datasetInfo.filename}`
      : undefined,
    status: "success",
    generatedAt: new Date().toISOString(),
    dataset: buildDatasetMeta(datasetInfo),
    blocks,
  };
}

// ── Sequence Mining ─────────────────────────────────────────────────

function convertSequenceMining(
  data: PathAnalysisResultData,
  datasetInfo: Dataset | null
): AnalysisResult | null {
  const patterns = safeArray<FrequentPattern>(data.frequent_patterns);
  const rules = safeArray<AssociationRule>(data.association_rules);
  const highConv = safeArray<HighConversionPattern>(
    data.high_conversion_patterns
  );

  if (
    patterns.length === 0 &&
    rules.length === 0 &&
    highConv.length === 0
  )
    return null;

  const blocks: ResultBlock[] = [];
  const totalSeq = safeNumber(data.total_sequences) ?? 0;
  const avgLen = safeNumber(data.avg_sequence_length);
  const seqConv = safeNumber(data.sequence_stats?.conversion_rate);

  // Summary
  let summary = "序列模式挖掘已完成。";
  if (totalSeq > 0) {
    summary += ` 共分析 ${totalSeq.toLocaleString("zh-CN")} 条用户旅程。`;
  }
  if (avgLen !== null) {
    summary += ` 平均序列长度 ${avgLen.toFixed(1)}。`;
  }
  if (patterns.length > 0) {
    summary += ` 发现 ${patterns.length} 个频繁模式。`;
  }
  blocks.push({
    type: "summary",
    content: summary,
    tone: "neutral",
  });

  // Metrics
  const metrics: AnalysisResult["blocks"][number] & { type: "metric" } = {
    type: "metric",
    metrics: [
      {
        key: "total_sequences",
        label: "用户旅程数",
        value: totalSeq,
        formattedValue: totalSeq.toLocaleString("zh-CN"),
      },
      {
        key: "pattern_count",
        label: "频繁模式数",
        value: patterns.length,
        formattedValue: String(patterns.length),
      },
    ],
  };
  if (avgLen !== null) {
    metrics.metrics.push({
      key: "avg_sequence_length",
      label: "平均序列长度",
      value: avgLen,
      formattedValue: avgLen.toFixed(1),
    });
  }
  if (seqConv !== null) {
    metrics.metrics.push({
      key: "conversion_rate",
      label: "转化率",
      value: seqConv,
      formattedValue: `${seqConv.toFixed(1)}%`,
      unit: "%",
    });
  }
  blocks.push(metrics);

  // Frequent patterns table
  if (patterns.length > 0) {
    blocks.push({
      type: "table",
      title: "频繁序列模式 TOP 20",
      columns: [
        {
          key: "rank",
          label: "排名",
          dataType: "integer",
          align: "right",
        },
        { key: "pattern", label: "模式", dataType: "string" },
        {
          key: "support",
          label: "支持度",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
        {
          key: "count",
          label: "出现次数",
          dataType: "integer",
          align: "right",
        },
        {
          key: "confidence",
          label: "置信度",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
      ],
      rows: patterns.slice(0, 20).map((p, i) => ({
        rank: i + 1,
        pattern: formatPath(p.pattern),
        support:
          safeNumber(p.support) !== null ? p.support! * 100 : null,
        count: safeNumber(p.support_count),
        confidence:
          safeNumber(p.confidence) !== null
            ? p.confidence! * 100
            : null,
      })),
      sortable: false,
      emptyMessage: "无频繁模式",
    });
  }

  // Association rules table
  if (rules.length > 0) {
    blocks.push({
      type: "table",
      title: "关联规则 TOP 15",
      columns: [
        {
          key: "rank",
          label: "排名",
          dataType: "integer",
          align: "right",
        },
        {
          key: "antecedent",
          label: "前件",
          dataType: "string",
        },
        {
          key: "consequent",
          label: "后件",
          dataType: "string",
        },
        {
          key: "support",
          label: "支持度",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
        {
          key: "confidence",
          label: "置信度",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
        {
          key: "lift",
          label: "提升度",
          dataType: "number",
          precision: 2,
          align: "right",
        },
      ],
      rows: rules.slice(0, 15).map((r, i) => ({
        rank: i + 1,
        antecedent:
          safeString(r.antecedent_str) ??
          (Array.isArray(r.antecedent)
            ? r.antecedent.join(", ")
            : String(r.antecedent ?? "—")),
        consequent: safeString(r.consequent) ?? "—",
        support:
          safeNumber(r.support) !== null ? r.support! * 100 : null,
        confidence:
          safeNumber(r.confidence) !== null
            ? r.confidence! * 100
            : null,
        lift: safeNumber(r.lift),
      })),
      sortable: false,
      emptyMessage: "无关联规则",
    });
  }

  // High conversion patterns table
  if (highConv.length > 0) {
    blocks.push({
      type: "table",
      title: "高转化序列模式",
      columns: [
        {
          key: "rank",
          label: "排名",
          dataType: "integer",
          align: "right",
        },
        { key: "pattern", label: "模式", dataType: "string" },
        {
          key: "conversion_rate",
          label: "转化率",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
        {
          key: "support",
          label: "支持度",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
        {
          key: "count",
          label: "出现次数",
          dataType: "integer",
          align: "right",
        },
      ],
      rows: highConv.map((p, i) => ({
        rank: i + 1,
        pattern: formatPath(p.pattern),
        conversion_rate:
          safeNumber(p.conversion_rate) !== null
            ? p.conversion_rate! * 100
            : null,
        support:
          safeNumber(p.support) !== null ? p.support! * 100 : null,
        count: safeNumber(p.count),
      })),
      sortable: false,
      emptyMessage: "无高转化模式",
    });
  }

  // Warnings
  if (totalSeq > 0 && totalSeq < 100) {
    blocks.push({
      type: "warning",
      severity: "info",
      message: `用户旅程数较少（${totalSeq} 条），模式挖掘结果可能不稳定。`,
      suggestion: "建议增加数据量以获得更可靠的频繁模式。",
    });
  }

  if (patterns.length === 0 && totalSeq > 0) {
    blocks.push({
      type: "warning",
      severity: "caution",
      message: "未找到任何频繁序列模式。",
      suggestion:
        "建议降低最小支持度阈值或检查事件数据的一致性。",
    });
  }

  if (data.ai_summary) {
    blocks.push({
      type: "text",
      title: "AI 智能解读",
      content: data.ai_summary,
    });
  }

  return {
    id: `sequence-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "sequence_mining",
    title: "序列模式挖掘结果",
    description: datasetInfo?.filename
      ? `数据集: ${datasetInfo.filename}`
      : undefined,
    status:
      patterns.length === 0 && totalSeq > 0 ? "warning" : "success",
    generatedAt: new Date().toISOString(),
    dataset: buildDatasetMeta(datasetInfo),
    blocks,
  };
}
