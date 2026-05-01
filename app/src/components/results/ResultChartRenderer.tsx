/**
 * ResultChartRenderer — renders chart blocks inside ResultView.
 *
 * Supports P0 chart types: line, bar, area.
 * Unsupported types render a safe placeholder.
 */

import type { ResultChartBlock } from "@/types/result";
import { BaseEChart } from "./charts/BaseEChart";
import { buildChartOption } from "./charts/buildChartOption";
import { isSupportedChartType } from "./charts/chartTypes";

interface ResultChartRendererProps {
  block: ResultChartBlock;
}

export function ResultChartRenderer({ block }: ResultChartRendererProps) {
  const option = buildChartOption(block);
  const isSupported = isSupportedChartType(block.chartType);

  return (
    <div className="space-y-3">
      {block.title && (
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          {block.title}
        </h3>
      )}

      {isSupported && option ? (
        <BaseEChart option={option} height={320} />
      ) : isSupported && !option ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-tertiary)] h-80">
          <p className="text-sm text-[var(--text-muted)]">暂无图表数据</p>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-6 text-center">
          <p className="text-sm text-[var(--text-muted)]">
            图表类型暂未支持：{block.chartType}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            当前支持：line、bar、area
          </p>
        </div>
      )}
    </div>
  );
}
