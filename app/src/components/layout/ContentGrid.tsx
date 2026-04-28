import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

export interface ContentGridProps {
  children: ReactNode
  cols?: 1 | 2 | 3 | 4
  gap?: "sm" | "md" | "lg"
  className?: string
}

export function ContentGrid({ children, cols = 1, gap = "md", className }: ContentGridProps) {
  return (
    <div
      className={cn(
        "grid",
        cols === 1 && "grid-cols-1",
        cols === 2 && "grid-cols-1 md:grid-cols-2",
        cols === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        cols === 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        gap === "sm" && "gap-4",
        gap === "md" && "gap-6",
        gap === "lg" && "gap-8",
        className
      )}
    >
      {children}
    </div>
  )
}
