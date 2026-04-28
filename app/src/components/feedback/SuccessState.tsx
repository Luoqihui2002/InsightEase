import { cn } from "@/lib/utils"
import { CheckCircle } from "lucide-react"
import type { ReactNode } from "react"

export interface SuccessStateProps {
  title?: string
  message?: string
  actions?: ReactNode
  className?: string
}

export function SuccessState({ title, message, actions, className }: SuccessStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center",
        className
      )}
    >
      <CheckCircle className="h-8 w-8 text-emerald-400" />
      {title && <h3 className="text-base font-medium text-emerald-300">{title}</h3>}
      {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
