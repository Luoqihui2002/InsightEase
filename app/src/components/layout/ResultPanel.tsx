import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface ResultPanelProps {
  children: ReactNode
  className?: string
}

export function ResultPanel({ children, className }: ResultPanelProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-4 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
        className
      )}
    >
      {children}
    </div>
  )
}
