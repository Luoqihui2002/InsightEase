import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface ChartCardProps {
  title?: string
  description?: string
  actions?: ReactNode
  height?: string
  children: ReactNode
  className?: string
}

export function ChartCard({
  title,
  description,
  actions,
  height = "h-96",
  children,
  className,
}: ChartCardProps) {
  return (
    <Card className={cn("bg-[var(--bg-secondary)] border-[var(--border-subtle)] overflow-hidden", className)}>
      {(title || actions) && (
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn("p-0", height)}>{children}</CardContent>
    </Card>
  )
}
