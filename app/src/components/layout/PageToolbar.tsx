import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface PageToolbarProps {
  children: ReactNode
  sticky?: boolean
  className?: string
}

export function PageToolbar({ children, sticky, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
        sticky && "sticky top-0 z-10",
        className
      )}
    >
      {children}
    </div>
  )
}
