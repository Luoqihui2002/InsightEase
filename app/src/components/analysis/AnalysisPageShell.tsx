import { PageHeader } from "@/components/layout/PageHeader"
import { PageShell } from "@/components/layout/PageShell"
import type { ReactNode } from "react"

export interface AnalysisPageShellProps {
  title: string
  description: string
  rightAction?: ReactNode
  children: ReactNode
  className?: string
}

export function AnalysisPageShell({
  title,
  description,
  rightAction,
  children,
  className,
}: AnalysisPageShellProps) {
  return (
    <PageShell className={className}>
      <PageHeader title={title} subtitle={description} actions={rightAction} />
      {children}
    </PageShell>
  )
}
