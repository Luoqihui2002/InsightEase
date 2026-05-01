/**
 * Adapter: converts Forecast backend result into unified AnalysisResult.
 *
 * Supports both single-forecast and batch-forecast result shapes.
 * Chart placeholder is emitted because Forecast.tsx does not render
 * a real ECharts chart outside ResultView.
 */

import type { AnalysisResult, ResultBlock, ResultTableColumn } from "@/types/result";
import type { Dataset } from "@/types/api";

// ── Single forecast types ───────────────────────────────────────────

interface ForecastPointObject {
  date?: string;
  ds?: string;
  value?: number;
  yhat?: number;
  lower?: number;
  yhat_lower?: number;
  upper?: number;
  yhat_upper?: number;
  actual?: number;
  y?: number;
}

interface ForecastArrayShape {
  ds?: string[];
  yhat?: number[];
  yhat_lower?: number[];
  yhat_upper?: number[];
}

interface ForecastStatistics {
  forecast_mean?: number;
  trend_direction?: string;
  historical_mean?: number;
  mae?: number;
  rmse?: number;
  mape?: number;
  r2?: number;
}

interface ForecastDecomposition {
  trend?: number;
  seasonal?: number;
  promotion?: number;
  residual?: number;
}

interface PromotionImpactItem {
  name?: string;
  date?: string;
  type?: string;
  lift?: number;
}

export interface ForecastResultData {
  error?: string;
  solution?: string;
  diagnostic?: unknown;
  sample_data?: unknown[];
  forecast?: ForecastArrayShape | ForecastPointObject[];
  historical_data?: ForecastPointObject[] | number[];
  statistics?: ForecastStatistics;
  trend?: { direction?: string };
  forecast_periods?: number;
  ai_summary?: string;
  decomposition?: ForecastDecomposition;
  promotion_impact?: PromotionImpactItem[];
  what_if?: unknown;
}

// ── Batch forecast types ────────────────────────────────────────────

interface BatchForecastItem {
  column?: string;
  error?: string;
  forecast?: unknown;
  growth_rate?: number;
  statistics?: {
    historical_mean?: number;
    forecast_mean?: number;
  };
}

interface BatchForecastSummary {
  total_sku?: number;
  success_count?: number;
  avg_growth?: number;
  top_growing?: string;
  top_growth_rate?: number;
}

export interface BatchForecastResultData {
  summary?: BatchForecastSummary;
  forecasts?: BatchForecastItem[];
}

// ── Adapter ─────────────────────────────────────────────────────────

function isForecastArrayShape(
  forecast: unknown
): forecast is ForecastArrayShape {
  return (
    typeof forecast === "object" &&
    forecast !== null &&
    !Array.isArray(forecast) &&
    (Array.isArray((forecast as ForecastArrayShape).yhat) ||
      Array.isArray((forecast as ForecastArrayShape).ds))
  );
}

function isForecastPointArray(
  forecast: unknown
): forecast is ForecastPointObject[] {
  return Array.isArray(forecast) && forecast.length > 0;
}

function safeNumber(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Convert single forecast result into AnalysisResult.
 */
function convertSingleForecast(
  data: ForecastResultData,
  datasetInfo: Dataset | null,
  forecastDays: number
): AnalysisResult | null {
  const blocks: ResultBlock[] = [];
  const stats = data.statistics;
  const forecast = data.forecast;
  const trendDir =
    safeString(data.trend?.direction) ?? safeString(stats?.trend_direction) ?? null;
  const forecastMean = safeNumber(stats?.forecast_mean);
  const histMean = safeNumber(stats?.historical_mean);
  const periods =
    safeNumber(data.forecast_periods) ?? forecastDays;

  // ── Summary block ──
  let summaryContent = "时间序列预测分析已完成。";
  if (periods !== null) {
    summaryContent += `预测未来 ${periods} 天的趋势。`;
  }
  if (trendDir) {
    summaryContent += ` 整体趋势为「${trendDir}」。`;
  }
  if (forecastMean !== null && histMean !== null && histMean !== 0) {
    const change = ((forecastMean - histMean) / histMean) * 100;
    const dir = change >= 0 ? "上升" : "下降";
    summaryContent += ` 预测均值较历史均值${dir} ${Math.abs(change).toFixed(1)}%。`;
  }

  blocks.push({
    type: "summary",
    content: summaryContent,
    tone: trendDir === "下降" ? "negative" : "neutral",
  });

  // ── Metric block ──
  const metricItems: AnalysisResult["blocks"][number] & { type: "metric" } = {
    type: "metric",
    metrics: [],
  };

  if (forecastMean !== null) {
    metricItems.metrics.push({
      key: "forecast_mean",
      label: "预测均值",
      value: forecastMean,
      formattedValue: forecastMean.toFixed(2),
    });
  }
  if (histMean !== null) {
    metricItems.metrics.push({
      key: "historical_mean",
      label: "历史均值",
      value: histMean,
      formattedValue: histMean.toFixed(2),
    });
  }
  if (trendDir) {
    metricItems.metrics.push({
      key: "trend_direction",
      label: "趋势方向",
      value: undefined,
      formattedValue: trendDir,
      tone: trendDir === "下降" ? "negative" : trendDir === "上升" ? "positive" : "neutral",
    });
  }
  metricItems.metrics.push({
    key: "forecast_periods",
    label: "预测天数",
    value: periods,
    formattedValue: `${periods} 天`,
  });

  // Model accuracy metrics
  const mae = safeNumber(stats?.mae);
  const rmse = safeNumber(stats?.rmse);
  const mape = safeNumber(stats?.mape);
  const r2 = safeNumber(stats?.r2);

  if (mae !== null) {
    metricItems.metrics.push({
      key: "mae",
      label: "MAE",
      value: mae,
      formattedValue: mae.toFixed(2),
    });
  }
  if (rmse !== null) {
    metricItems.metrics.push({
      key: "rmse",
      label: "RMSE",
      value: rmse,
      formattedValue: rmse.toFixed(2),
    });
  }
  if (mape !== null) {
    metricItems.metrics.push({
      key: "mape",
      label: "MAPE",
      value: mape,
      formattedValue: `${mape.toFixed(1)}%`,
      unit: "%",
      tone: mape > 20 ? "caution" : "neutral",
    });
  }
  if (r2 !== null) {
    metricItems.metrics.push({
      key: "r2",
      label: "R²",
      value: r2,
      formattedValue: r2.toFixed(3),
      tone: r2 < 0.3 ? "caution" : "neutral",
    });
  }

  if (metricItems.metrics.length > 0) {
    blocks.push(metricItems);
  }

  // ── Forecast table ──
  const forecastRows = buildForecastTableRows(forecast, data.historical_data);
  if (forecastRows.length > 0) {
    const columns: ResultTableColumn[] = [
      {
        key: "date",
        label: "日期",
        dataType: "date",
        semanticRole: "dimension",
      },
      {
        key: "actual",
        label: "实际值",
        dataType: "number",
        precision: 2,
        align: "right",
        semanticRole: "metric",
      },
      {
        key: "forecast",
        label: "预测值",
        dataType: "number",
        precision: 2,
        align: "right",
        semanticRole: "metric",
      },
      {
        key: "lower",
        label: "下限",
        dataType: "number",
        precision: 2,
        align: "right",
        semanticRole: "confidence_interval",
      },
      {
        key: "upper",
        label: "上限",
        dataType: "number",
        precision: 2,
        align: "right",
        semanticRole: "confidence_interval",
      },
    ];

    blocks.push({
      type: "table",
      title: "预测结果明细",
      columns,
      rows: forecastRows,
      sortable: true,
      emptyMessage: "无预测数据",
    });
  }

  // ── Decomposition table ──
  const decomp = data.decomposition;
  if (decomp && typeof decomp === "object") {
    const decompRows: Record<string, unknown>[] = [];
    const comps = [
      { key: "trend", label: "趋势成分" },
      { key: "seasonal", label: "季节性" },
      { key: "promotion", label: "促销效应" },
      { key: "residual", label: "异常波动" },
    ];
    for (const comp of comps) {
      const val = safeNumber((decomp as Record<string, unknown>)[comp.key]);
      if (val !== null) {
        decompRows.push({
          component: comp.label,
          contribution: val / 100,
        });
      }
    }
    if (decompRows.length > 0) {
      blocks.push({
        type: "table",
        title: "预测分解",
        columns: [
          {
            key: "component",
            label: "成分",
            dataType: "string",
            semanticRole: "dimension",
          },
          {
            key: "contribution",
            label: "贡献占比",
            dataType: "percent",
            precision: 1,
            align: "right",
          },
        ],
        rows: decompRows,
        sortable: false,
        emptyMessage: "无分解数据",
      });
    }
  }

  // ── Promotion impact table ──
  const promoImpacts = data.promotion_impact;
  if (Array.isArray(promoImpacts) && promoImpacts.length > 0) {
    const promoRows = promoImpacts
      .map((p) => ({
        name: safeString(p.name) ?? "—",
        date: safeString(p.date) ?? "—",
        type: safeString(p.type) ?? "—",
        lift: safeNumber(p.lift),
      }))
      .filter((p) => p.name !== "—");

    if (promoRows.length > 0) {
      blocks.push({
        type: "table",
        title: "大促影响分析",
        columns: [
          {
            key: "name",
            label: "活动名称",
            dataType: "string",
            semanticRole: "dimension",
          },
          {
            key: "date",
            label: "日期",
            dataType: "date",
          },
          {
            key: "type",
            label: "类型",
            dataType: "string",
            semanticRole: "category",
          },
          {
            key: "lift",
            label: "销量提升",
            dataType: "percent",
            precision: 1,
            align: "right",
          },
        ],
        rows: promoRows,
        sortable: true,
        emptyMessage: "无促销数据",
      });
    }
  }

  // ── AI Summary text block ──
  if (data.ai_summary) {
    blocks.push({
      type: "text",
      title: "AI 智能解读",
      content: data.ai_summary,
    });
  }

  // ── Chart placeholder ──
  // Forecast.tsx does not render a real ECharts chart outside ResultView,
  // so a placeholder is appropriate here.
  if (forecastRows.length > 0) {
    blocks.push({
      type: "chart",
      title: "预测趋势图",
      chartType: "line",
      data: forecastRows.slice(0, 50), // preview subset
      xKey: "date",
      yKeys: ["actual", "forecast"],
      seriesNames: ["实际值", "预测值"],
    });
  }

  // ── Warning blocks ──
  if (data.error) {
    blocks.push({
      type: "warning",
      severity: "critical",
      message: data.error,
      suggestion: data.solution ?? "请检查数据格式或调整预测参数后重试。",
    });
  }

  if (mape !== null && mape > 20) {
    blocks.push({
      type: "warning",
      severity: "caution",
      message: `预测误差较高（MAPE = ${mape.toFixed(1)}%）。`,
      suggestion: "建议增加历史数据量或检查是否存在异常值。",
    });
  }

  if (forecastRows.length > 0 && forecastRows.length < 30) {
    blocks.push({
      type: "warning",
      severity: "info",
      message: `历史数据量较少（仅 ${forecastRows.length} 个数据点）。`,
      suggestion: "建议至少提供 30 个以上的历史观测值以获得更稳定的预测结果。",
    });
  }

  let status: AnalysisResult["status"] = "success";
  if (data.error) {
    status = "error";
  } else if ((mape !== null && mape > 20) || (r2 !== null && r2 < 0.3)) {
    status = "warning";
  }

  return {
    id: `forecast-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "time_series_forecast",
    title: "趋势预测结果",
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
    diagnostics: data.diagnostic
      ? {
          modelName: "Prophet / LightGBM / SARIMA",
          sampleSize: forecastRows.length,
        }
      : undefined,
    blocks,
  };
}

/**
 * Convert batch forecast result into AnalysisResult.
 */
function convertBatchForecast(
  data: BatchForecastResultData,
  datasetInfo: Dataset | null,
  forecastDays: number
): AnalysisResult | null {
  const blocks: ResultBlock[] = [];
  const summary = data.summary;
  const forecasts = data.forecasts;

  if (!summary && (!Array.isArray(forecasts) || forecasts.length === 0)) {
    return null;
  }

  const totalSku = safeNumber(summary?.total_sku) ?? 0;
  const successCount = safeNumber(summary?.success_count) ?? 0;
  const avgGrowth = safeNumber(summary?.avg_growth);

  // ── Summary block ──
  let summaryContent = "批量预测分析已完成。";
  if (totalSku > 0) {
    summaryContent += `共预测 ${totalSku} 个 SKU/品类，成功 ${successCount} 个。`;
  }
  if (avgGrowth !== null) {
    const dir = avgGrowth >= 0 ? "增长" : "下降";
    summaryContent += ` 平均${dir} ${Math.abs(avgGrowth).toFixed(1)}%。`;
  }
  if (summary?.top_growing) {
    summaryContent += ` 增长最快: ${summary.top_growing}。`;
  }

  blocks.push({
    type: "summary",
    content: summaryContent,
    tone: avgGrowth !== null && avgGrowth < 0 ? "negative" : "neutral",
  });

  // ── Metric block ──
  const metricItems: AnalysisResult["blocks"][number] & { type: "metric" } = {
    type: "metric",
    metrics: [
      {
        key: "total_sku",
        label: "总SKU数",
        value: totalSku,
        formattedValue: String(totalSku),
      },
      {
        key: "success_count",
        label: "成功预测",
        value: successCount,
        formattedValue: String(successCount),
        tone: successCount < totalSku ? "caution" : "positive",
      },
      {
        key: "forecast_periods",
        label: "预测周期",
        value: forecastDays,
        formattedValue: `${forecastDays} 天`,
      },
    ],
  };

  if (avgGrowth !== null) {
    metricItems.metrics.push({
      key: "avg_growth",
      label: "平均增长",
      value: avgGrowth,
      formattedValue: `${avgGrowth >= 0 ? "+" : ""}${avgGrowth.toFixed(1)}%`,
      unit: "%",
      tone: avgGrowth < 0 ? "negative" : "positive",
    });
  }

  blocks.push(metricItems);

  // ── SKU forecast table ──
  if (Array.isArray(forecasts) && forecasts.length > 0) {
    const rows = forecasts.map((item) => {
      const histMean = safeNumber(item.statistics?.historical_mean);
      const forecastMean = safeNumber(item.statistics?.forecast_mean);
      const growth = safeNumber(item.growth_rate);
      return {
        sku: item.column ?? "—",
        status: item.error ? "失败" : "成功",
        historical_mean: histMean,
        forecast_mean: forecastMean,
        growth_rate: growth !== null ? growth / 100 : null,
        error: item.error ?? null,
      };
    });

    blocks.push({
      type: "table",
      title: "各SKU预测详情",
      columns: [
        {
          key: "sku",
          label: "SKU/品类",
          dataType: "string",
          semanticRole: "identifier",
        },
        {
          key: "status",
          label: "状态",
          dataType: "string",
          semanticRole: "category",
        },
        {
          key: "historical_mean",
          label: "历史均值",
          dataType: "number",
          precision: 0,
          align: "right",
        },
        {
          key: "forecast_mean",
          label: "预测均值",
          dataType: "number",
          precision: 0,
          align: "right",
        },
        {
          key: "growth_rate",
          label: "增长率",
          dataType: "percent",
          precision: 1,
          align: "right",
        },
      ],
      rows,
      sortable: true,
      emptyMessage: "无SKU预测数据",
    });

    // Warning for failed items
    const failedItems = forecasts.filter((f) => f.error);
    if (failedItems.length > 0) {
      blocks.push({
        type: "warning",
        severity: "caution",
        message: `${failedItems.length} 个 SKU/品类 预测失败。`,
        suggestion: "请检查对应列的数据格式或空值情况。",
      });
    }
  }

  let status: AnalysisResult["status"] = "success";
  const failedCount =
    Array.isArray(forecasts) ? forecasts.filter((f) => f.error).length : 0;
  if (failedCount > 0 && failedCount >= (totalSku || 0) / 2) {
    status = "warning";
  }

  return {
    id: `batch-forecast-${datasetInfo?.id ?? "unknown"}`,
    analysisType: "batch_forecast",
    title: "批量预测结果",
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

// ── Helper: build forecast table rows ───────────────────────────────

function buildForecastTableRows(
  forecast: ForecastArrayShape | ForecastPointObject[] | undefined,
  historicalData: unknown
): Record<string, unknown>[] {
  if (!forecast) return [];

  // Shape 1: object with parallel arrays { ds: [...], yhat: [...], ... }
  if (isForecastArrayShape(forecast)) {
    const ds = forecast.ds ?? [];
    const yhat = forecast.yhat ?? [];
    const lower = forecast.yhat_lower ?? [];
    const upper = forecast.yhat_upper ?? [];
    const len = Math.max(ds.length, yhat.length);
    if (len === 0) return [];

    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, unknown> = {
        date: ds[i] ?? `T+${i + 1}`,
        forecast: safeNumber(yhat[i]),
        lower: safeNumber(lower[i]),
        upper: safeNumber(upper[i]),
      };
      // Try to match historical actual values
      const actual = findHistoricalActual(historicalData, ds[i]);
      if (actual !== null) {
        row.actual = actual;
      }
      rows.push(row);
    }
    return rows;
  }

  // Shape 2: array of point objects
  if (isForecastPointArray(forecast)) {
    return forecast.map((pt) => {
      const row: Record<string, unknown> = {
        date: pt.date ?? pt.ds ?? "—",
        forecast: safeNumber(pt.yhat ?? pt.value),
        lower: safeNumber(pt.yhat_lower ?? pt.lower),
        upper: safeNumber(pt.yhat_upper ?? pt.upper),
      };
      if (pt.actual !== undefined || pt.y !== undefined) {
        row.actual = safeNumber(pt.actual ?? pt.y);
      }
      return row;
    });
  }

  return [];
}

function findHistoricalActual(
  historicalData: unknown,
  dateStr: string | undefined
): number | null {
  if (!dateStr || !Array.isArray(historicalData)) return null;
  const match = historicalData.find((h: unknown) => {
    if (typeof h !== "object" || h === null) return false;
    const hd = h as Record<string, unknown>;
    return (hd.date ?? hd.ds) === dateStr;
  });
  if (match && typeof match === "object" && match !== null) {
    const val =
      (match as Record<string, unknown>).actual ??
      (match as Record<string, unknown>).y ??
      (match as Record<string, unknown>).value;
    return safeNumber(val);
  }
  return null;
}

// ── Public API ──────────────────────────────────────────────────────

export function toForecastAnalysisResult(
  data: ForecastResultData | BatchForecastResultData | null | undefined,
  datasetInfo: Dataset | null,
  forecastDays: number
): AnalysisResult | null {
  if (!data || typeof data !== "object") return null;

  // Detect batch vs single by presence of `forecasts` array (batch-specific)
  if ("forecasts" in data && Array.isArray((data as BatchForecastResultData).forecasts)) {
    return convertBatchForecast(data as BatchForecastResultData, datasetInfo, forecastDays);
  }

  // Otherwise treat as single forecast
  return convertSingleForecast(data as ForecastResultData, datasetInfo, forecastDays);
}
