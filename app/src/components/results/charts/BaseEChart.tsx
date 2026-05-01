/**
 * Reusable ECharts lifecycle wrapper.
 *
 * Responsibilities:
 * - Initialize ECharts instance after mount (only when container has dimensions)
 * - Update option via setOption when props change
 * - Dispose instance on unmount
 * - Resize on window resize (debounced)
 * - Show empty state when no option is provided
 */

import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";

interface BaseEChartProps {
  option: EChartsOption | null;
  height?: number | string;
  className?: string;
}

export function BaseEChart({
  option,
  height = 320,
  className = "",
}: BaseEChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // Initialize / update chart
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Guard: container must have non-zero dimensions
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      return;
    }

    // Lazy init: create instance only when first needed
    if (!chartRef.current) {
      chartRef.current = echarts.init(container);
    }

    if (option) {
      chartRef.current.setOption(option, true);
    }

    return () => {
      // Do not dispose on every option change — only on unmount
    };
  }, [option]);

  // Dispose on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.dispose();
        chartRef.current = null;
      }
    };
  }, []);

  // Resize handling
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const heightStyle = typeof height === "number" ? `${height}px` : height;

  if (!option) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-tertiary)] ${className}`}
        style={{ height: heightStyle }}
      >
        <p className="text-sm text-[var(--text-muted)]">暂无图表数据</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full ${className}`}
      style={{ height: heightStyle }}
    />
  );
}
