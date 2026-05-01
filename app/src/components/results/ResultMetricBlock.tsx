import type { ResultMetricBlock as ResultMetricBlockType } from "@/types/result";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface Props {
  block: ResultMetricBlockType;
}

export function ResultMetricBlock({ block }: Props) {
  return (
    <div className="space-y-3">
      {block.title && (
        <h4 className="text-sm font-medium text-[var(--text-muted)]">
          {block.title}
        </h4>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {block.metrics.map((metric) => {
          const toneClass = {
            neutral: "text-[var(--text-primary)]",
            positive: "text-[var(--neon-green)]",
            negative: "text-[var(--neon-pink)]",
            caution: "text-[var(--neon-orange)]",
          }[metric.tone ?? "neutral"];

          return (
            <div
              key={metric.key}
              className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3"
            >
              <p className="text-xs text-[var(--text-muted)]">{metric.label}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-lg font-bold ${toneClass}`}>
                  {metric.formattedValue ??
                    (metric.value !== undefined ? String(metric.value) : "—")}
                </span>
                {metric.delta && (
                  <span className="flex items-center text-xs">
                    {metric.delta.direction === "up" && (
                      <TrendingUp className="w-3 h-3 text-[var(--neon-green)]" />
                    )}
                    {metric.delta.direction === "down" && (
                      <TrendingDown className="w-3 h-3 text-[var(--neon-pink)]" />
                    )}
                    {metric.delta.direction === "flat" && (
                      <Minus className="w-3 h-3 text-[var(--text-muted)]" />
                    )}
                  </span>
                )}
              </div>
              {metric.interpretation && (
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  {metric.interpretation}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
