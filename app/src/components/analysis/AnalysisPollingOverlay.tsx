import { LoadingState } from "@/components/feedback/LoadingState"
import { cn } from "@/lib/utils"
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react"

export interface AnalysisPollingOverlayProps {
  status: "pending" | "running" | "completed" | "failed"
  progress?: number
  message?: string
  className?: string
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; defaultMessage: string }
> = {
  pending: {
    icon: <Clock className="h-6 w-6 text-[var(--text-muted)]" />,
    defaultMessage: "等待执行",
  },
  running: {
    icon: <Loader2 className="h-6 w-6 animate-spin text-[var(--neon-cyan)]" />,
    defaultMessage: "正在分析",
  },
  completed: {
    icon: <CheckCircle2 className="h-6 w-6 text-emerald-400" />,
    defaultMessage: "分析完成",
  },
  failed: {
    icon: <XCircle className="h-6 w-6 text-red-400" />,
    defaultMessage: "分析失败",
  },
}

export function AnalysisPollingOverlay({
  status,
  progress,
  message,
  className,
}: AnalysisPollingOverlayProps) {
  const config = statusConfig[status]

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-6 text-center",
        className
      )}
    >
      {status === "running" ? (
        <LoadingState message={message ?? config.defaultMessage} />
      ) : (
        <>
          {config.icon}
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {message ?? config.defaultMessage}
          </p>
        </>
      )}
      {typeof progress === "number" && (
        <div className="w-full max-w-xs">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--neon-cyan)] transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {Math.round(progress)}%
          </p>
        </div>
      )}
    </div>
  )
}
