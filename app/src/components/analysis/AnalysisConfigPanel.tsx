import { SidePanel } from "@/components/layout/SidePanel"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface AnalysisConfigPanelProps {
  title?: string
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function AnalysisConfigPanel({
  title = "分析配置",
  icon,
  children,
  footer,
  className,
}: AnalysisConfigPanelProps) {
  return (
    <SidePanel className={cn("justify-between", className)}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-base font-semibold text-[var(--text-primary)]">
          {icon}
          {title}
        </div>
        <div className="flex flex-col gap-4">{children}</div>
      </div>
      {footer && (
        <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] pt-4">
          {footer}
        </div>
      )}
    </SidePanel>
  )
}
