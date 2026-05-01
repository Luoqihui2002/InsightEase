import type { AnalysisResult } from "@/types/result";
import { ResultSummaryBlock } from "./ResultSummaryBlock";
import { ResultMetricBlock } from "./ResultMetricBlock";
import { ResultTableRenderer } from "./ResultTableRenderer";
import { ResultWarningBlock } from "./ResultWarningBlock";
import { ResultTextBlock } from "./ResultTextBlock";
import { ResultChartRenderer } from "./ResultChartRenderer";
import { Database, Clock } from "lucide-react";

interface ResultViewProps {
  result: AnalysisResult;
}

export function ResultView({ result }: ResultViewProps) {
  const statusConfig = {
    success: {
      badge: "bg-[var(--neon-green)]/10 text-[var(--neon-green)]",
      label: "成功",
    },
    empty: {
      badge: "bg-[var(--text-muted)]/10 text-[var(--text-muted)]",
      label: "无数据",
    },
    warning: {
      badge: "bg-[var(--neon-orange)]/10 text-[var(--neon-orange)]",
      label: "警告",
    },
    error: {
      badge: "bg-[var(--neon-pink)]/10 text-[var(--neon-pink)]",
      label: "错误",
    },
  };

  const status = statusConfig[result.status];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {result.title}
          </h2>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${status.badge}`}
          >
            {status.label}
          </span>
        </div>

        {result.description && (
          <p className="text-sm text-[var(--text-secondary)]">
            {result.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)]">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(result.generatedAt).toLocaleString("zh-CN")}
          </span>
          {result.dataset && (
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              {result.dataset.name} ({result.dataset.rowCount.toLocaleString()} 行)
            </span>
          )}
        </div>
      </div>

      {/* Warning banner for warning status */}
      {result.status === "warning" && (
        <div className="rounded-lg border border-[var(--neon-orange)]/30 bg-[var(--neon-orange)]/5 px-3 py-2">
          <p className="text-sm text-[var(--neon-orange)]">
            分析完成，但存在需要注意的问题。请查看下方警告详情。
          </p>
        </div>
      )}

      {/* Error state */}
      {result.status === "error" && (
        <div className="rounded-lg border border-[var(--neon-pink)]/30 bg-[var(--neon-pink)]/5 px-3 py-2">
          <p className="text-sm text-[var(--neon-pink)]">
            {result.description ?? "分析执行失败，请检查配置或数据。"}
          </p>
        </div>
      )}

      {/* Empty state */}
      {result.status === "empty" && (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <p className="text-sm">分析完成，但没有返回任何数据。</p>
        </div>
      )}

      {/* Blocks */}
      {result.status !== "empty" && result.status !== "error" && (
        <div className="space-y-6">
          {result.blocks.map((block, index) => (
            <div key={`${block.type}-${index}`}>
              <BlockDispatcher block={block} />
            </div>
          ))}
        </div>
      )}

      {/* Diagnostics footer */}
      {result.diagnostics && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3 space-y-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            诊断信息
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--text-secondary)]">
            {result.diagnostics.modelName && (
              <span>模型: {result.diagnostics.modelName}</span>
            )}
            {result.diagnostics.sampleSize !== undefined && (
              <span>样本量: {result.diagnostics.sampleSize.toLocaleString()}</span>
            )}
            {result.diagnostics.executionTimeMs !== undefined && (
              <span>执行时间: {result.diagnostics.executionTimeMs}ms</span>
            )}
          </div>
          {result.diagnostics.assumptions &&
            result.diagnostics.assumptions.length > 0 && (
              <div className="space-y-1 mt-2">
                {result.diagnostics.assumptions.map((assumption, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[10px]"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        assumption.passed
                          ? "bg-[var(--neon-green)]"
                          : "bg-[var(--neon-pink)]"
                      }`}
                    />
                    <span className="text-[var(--text-secondary)]">
                      {assumption.name}
                    </span>
                    {!assumption.passed && assumption.message && (
                      <span className="text-[var(--neon-pink)]">
                        — {assumption.message}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

/**
 * Dispatch each block to its type-specific renderer.
 */
function BlockDispatcher({
  block,
}: {
  block: AnalysisResult["blocks"][number];
}) {
  switch (block.type) {
    case "summary":
      return <ResultSummaryBlock block={block} />;
    case "metric":
      return <ResultMetricBlock block={block} />;
    case "table":
      return <ResultTableRenderer block={block} />;
    case "warning":
      return <ResultWarningBlock block={block} />;
    case "text":
      return <ResultTextBlock block={block} />;
    case "chart":
      return <ResultChartRenderer block={block} />;
    default: {
      // Safe fallback for unknown block types
      const unknownType = (block as Record<string, unknown>).type;
      return (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-3">
          <p className="text-xs text-[var(--text-muted)]">
            不支持的结果块类型: {String(unknownType)}
          </p>
        </div>
      );
    }
  }
}
