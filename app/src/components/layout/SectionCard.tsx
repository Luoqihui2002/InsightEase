import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface SectionCardProps {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  className?: string
}

export function SectionCard({ title, description, children, className }: SectionCardProps) {
  return (
    <Card className={cn("bg-[var(--bg-secondary)] border-[var(--border-subtle)]", className)}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </Card>
  )
}
