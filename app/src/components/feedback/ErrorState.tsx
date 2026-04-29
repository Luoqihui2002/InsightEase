import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AlertTriangle } from "lucide-react"
import type { ReactNode } from "react"

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  actions?: ReactNode
  className?: string
}

export function ErrorState({ title, message, onRetry, actions, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--status-error-border)] bg-[var(--status-error-bg)] p-8 text-center",
        className
      )}
    >
      <AlertTriangle className="h-8 w-8 text-[var(--status-error)]" />
      {title && <h3 className="text-base font-medium text-[var(--status-error)]">{title}</h3>}
      <p className="text-sm text-[var(--text-secondary)]">{message}</p>
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            重试
          </Button>
        )}
        {actions}
      </div>
    </div>
  )
}
