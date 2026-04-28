import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface SidePanelProps {
  children: ReactNode
  width?: "narrow" | "default" | "wide"
  className?: string
}

export function SidePanel({ children, width = "default", className }: SidePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4",
        width === "narrow" && "w-80 min-w-[320px]",
        width === "default" && "w-96 min-w-[384px]",
        width === "wide" && "w-[480px] min-w-[480px]",
        className
      )}
    >
      {children}
    </div>
  )
}
