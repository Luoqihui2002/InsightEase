/**
 * Chart type registry and builder types for ResultChartRenderer.
 */

import type { ResultChartBlock } from "@/types/result";
import type { EChartsOption } from "echarts";

/** P0 chart types supported by this phase */
export const SUPPORTED_CHART_TYPES = ["line", "bar", "area"] as const;

export type SupportedChartType = (typeof SUPPORTED_CHART_TYPES)[number];

/** Check if a chart type is supported for real rendering */
export function isSupportedChartType(
  type: string
): type is SupportedChartType {
  return SUPPORTED_CHART_TYPES.includes(type as SupportedChartType);
}

/** Builder function signature */
export type ChartOptionBuilder = (
  block: ResultChartBlock
) => EChartsOption | null;
