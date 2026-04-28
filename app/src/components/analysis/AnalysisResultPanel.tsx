import { LoadingState } from "@/components/feedback/LoadingState"
import { ResultPanel } from "@/components/layout/ResultPanel"
import type { ReactNode } from "react"
import { AnalysisEmptyState } from "./AnalysisEmptyState"

export interface AnalysisResultPanelProps {
  title?: string
  icon?: ReactNode
  actions?: ReactNode
  loading?: boolean
  loadingMessage?: string
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  polling?: ReactNode
  children?: ReactNode
  className?: string
}

export function AnalysisResultPanel({
  title = "分析结果",
  icon,
  actions,
  loading = false,
  loadingMessage = "正在加载分析结果...",
  empty = false,
  emptyTitle,
  emptyDescription,
  polling,
  children,
  className,
}: AnalysisResultPanelProps) {
  return (
    <ResultPanel className={className}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          {icon}
          {title}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <LoadingState message={loadingMessage} />
        </div>
      )}

      {!loading && empty && (
        <div className="flex flex-1 items-center justify-center">
          <AnalysisEmptyState
            type="no-result"
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      )}

      {!loading && !empty && polling && (
        <div className="flex flex-col gap-4">
          {polling}
          {children}
        </div>
      )}

      {!loading && !empty && !polling && children}
    </ResultPanel>
  )
}
