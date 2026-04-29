import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export type SectionCardDensity = "compact" | "default" | "spacious"

export interface SectionCardProps {
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  density?: SectionCardDensity
  className?: string
}

const densityConfig: Record<SectionCardDensity, { card: string; header: string; content: string }> = {
  compact: {
    card: "py-3 gap-3",
    header: "px-3",
    content: "px-3",
  },
  default: {
    card: "",
    header: "",
    content: "",
  },
  spacious: {
    card: "py-8 gap-8",
    header: "px-8",
    content: "px-8",
  },
}

export function SectionCard({ title, description, children, density = "default", className }: SectionCardProps) {
  const d = densityConfig[density]
  return (
    <Card className={cn("bg-[var(--bg-secondary)] border-[var(--border-subtle)]", d.card, className)}>
      {(title || description) && (
        <CardHeader className={cn(d.header)}>
          {title && <CardTitle className="text-lg">{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn(d.content)}>{children}</CardContent>
    </Card>
  )
}
