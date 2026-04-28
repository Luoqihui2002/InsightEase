import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TrendingDown, TrendingUp } from "lucide-react"
import type { ReactNode } from "react"

export interface StatCardProps {
  label: string
  value: string | number
  trend?: { value: number; positive: boolean }
  icon?: ReactNode
  className?: string
}

export function StatCard({ label, value, trend, icon, className }: StatCardProps) {
  return (
    <Card className={cn("bg-[var(--bg-secondary)] border-[var(--border-subtle)]", className)}>
      <CardContent className="flex items-center justify-between p-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-[var(--text-secondary)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs",
                trend.positive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.positive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        {icon && <div className="text-[var(--text-muted)]">{icon}</div>}
      </CardContent>
    </Card>
  )
}
