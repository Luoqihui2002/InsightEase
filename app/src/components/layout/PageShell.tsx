import { cn } from "@/lib/utils"
import { forwardRef, type ReactNode } from "react"

export interface PageShellProps {
  children: ReactNode
  className?: string
  maxWidth?: "default" | "full" | "narrow"
}

export const PageShell = forwardRef<HTMLDivElement, PageShellProps>(
  ({ children, className, maxWidth = "default" }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-6 p-6",
          maxWidth === "default" && "mx-auto max-w-7xl",
          maxWidth === "narrow" && "mx-auto max-w-4xl",
          className
        )}
      >
        {children}
      </div>
    )
  }
)
PageShell.displayName = "PageShell"
