import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  icon?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, icon, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-3">
          {icon}
          {title}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {subtitle && <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>}
    </div>
  )
}
