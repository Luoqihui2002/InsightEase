import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { BarChart3, Database, Settings } from "lucide-react"
import type { ReactNode } from "react"

export interface AnalysisEmptyStateProps {
  type?: "no-dataset" | "no-result" | "no-config" | "custom"
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

const defaultConfig: Record<
  string,
  { title: string; description: string; icon: ReactNode }
> = {
  "no-dataset": {
    title: "未选择数据集",
    description: "请先选择一个数据集以开始分析。",
    icon: <Database className="h-6 w-6 text-[var(--text-muted)]" />,
  },
  "no-result": {
    title: "暂无分析结果",
    description: "配置分析参数并点击“开始分析”以查看结果。",
    icon: <BarChart3 className="h-6 w-6 text-[var(--text-muted)]" />,
  },
  "no-config": {
    title: "未配置分析参数",
    description: "请在左侧配置面板中设置分析参数。",
    icon: <Settings className="h-6 w-6 text-[var(--text-muted)]" />,
  },
  custom: {
    title: "",
    description: "",
    icon: <BarChart3 className="h-6 w-6 text-[var(--text-muted)]" />,
  },
}

export function AnalysisEmptyState({
  type = "no-result",
  title,
  description,
  action,
  className,
}: AnalysisEmptyStateProps) {
  const config = defaultConfig[type] ?? defaultConfig["no-result"]

  return (
    <Empty className={cn("bg-transparent border-0", className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">{config.icon}</EmptyMedia>
        <EmptyTitle className="text-[var(--text-primary)]">
          {title ?? config.title}
        </EmptyTitle>
        <EmptyDescription className="text-[var(--text-secondary)]">
          {description ?? config.description}
        </EmptyDescription>
      </EmptyHeader>
      {action && <div className="mt-2">{action}</div>}
    </Empty>
  )
}
