import { ContentGrid } from "@/components/layout/ContentGrid"
import { StatCard } from "@/components/data-display/StatCard"
import type { ReactNode } from "react"

export interface AnalysisResultSummaryItem {
  label: string
  value: string | number
  icon?: ReactNode
  trend?: {
    value: number
    positive: boolean
  }
  valueClassName?: string
}

export interface AnalysisResultSummaryProps {
  stats: AnalysisResultSummaryItem[]
  columns?: 2 | 3 | 4
  className?: string
}

export function AnalysisResultSummary({
  stats,
  columns = 4,
  className,
}: AnalysisResultSummaryProps) {
  return (
    <ContentGrid cols={columns} gap="sm" className={className}>
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          label={stat.label}
          value={stat.value}
          icon={stat.icon}
          trend={stat.trend}
          valueClassName={stat.valueClassName}
        />
      ))}
    </ContentGrid>
  )
}
