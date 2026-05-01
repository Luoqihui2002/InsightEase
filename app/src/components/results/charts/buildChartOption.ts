/**
 * Build ECharts options from ResultChartBlock for supported chart types.
 *
 * Supports: line, bar, area (P0)
 * Falls back to null for unsupported types.
 */

import type { ResultChartBlock } from "@/types/result";
import type { EChartsOption } from "echarts";
import { getChartColors, withAlpha } from "@/hooks/useChartColors";
import { isSupportedChartType } from "./chartTypes";

export function buildChartOption(block: ResultChartBlock): EChartsOption | null {
  if (!isSupportedChartType(block.chartType)) {
    return null;
  }

  const data = Array.isArray(block.data) ? block.data : [];
  if (data.length === 0) {
    return null;
  }

  const xKey = block.xKey ?? "x";
  const yKeys = Array.isArray(block.yKeys) && block.yKeys.length > 0
    ? block.yKeys
    : ["y"];

  const colors = getChartColors();

  // Extract x-axis categories
  const categories = data.map((row) => {
    const raw = (row as Record<string, unknown>)[xKey];
    return raw !== undefined && raw !== null ? String(raw) : "—";
  });

  // Build series
  const series = yKeys.map((yKey, index) => {
    const seriesData = data.map((row) => {
      const raw = (row as Record<string, unknown>)[yKey];
      return typeof raw === "number" ? raw : null;
    });

    const color = colors.categorical[index % colors.categorical.length];

    const baseSeries: Record<string, unknown> = {
      name: block.seriesNames?.[index] ?? yKey,
      type: block.chartType === "area" ? "line" : block.chartType,
      data: seriesData,
      itemStyle: { color },
      emphasis: {
        focus: "series",
      },
    };

    if (block.chartType === "area") {
      baseSeries.areaStyle = {
        color: {
          type: "linear",
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorStops: [
            { offset: 0, color: withAlpha(color, 0.4) },
            { offset: 1, color: withAlpha(color, 0.05) },
          ],
        },
      };
    }

    return baseSeries;
  });

  const hasMultiSeries = yKeys.length > 1;

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: withAlpha(colors.bgSecondary, 0.95),
      borderColor: withAlpha(colors.primary, 0.3),
      textStyle: { color: colors.textPrimary },
    },
    legend: hasMultiSeries
      ? {
          data: yKeys.map(
            (yKey, i) => block.seriesNames?.[i] ?? yKey
          ),
          textStyle: { color: colors.textSecondary },
          bottom: 0,
        }
      : undefined,
    grid: {
      left: "3%",
      right: "4%",
      bottom: hasMultiSeries ? "12%" : "3%",
      top: "10%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: {
        color: colors.textSecondary,
        rotate: categories.length > 12 ? 30 : 0,
      },
      axisLine: { lineStyle: { color: colors.borderSubtle } },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: colors.textSecondary },
      splitLine: { lineStyle: { color: colors.borderSubtle } },
    },
    series,
  };

  // Allow adapter-level echarts option overrides
  if (block.echartsOptions && typeof block.echartsOptions === "object") {
    return mergeOptions(option, block.echartsOptions as EChartsOption);
  }

  return option;
}

/** Shallow-merge adapter echartsOptions into built option */
function mergeOptions(
  base: EChartsOption,
  overrides: EChartsOption
): EChartsOption {
  return { ...base, ...overrides };
}
