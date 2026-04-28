import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export interface LoadingStateProps {
  message?: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
}

export function LoadingState({ message, size = "md", className }: LoadingStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <Spinner className={cn(sizeMap[size])} />
      {message && <p className="text-sm text-[var(--text-secondary)]">{message}</p>}
    </div>
  )
}
