import { cn } from "@/lib/utils"

export interface ScoreRingProps {
  score: number
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: { outer: "w-16 h-16", text: "text-lg" },
  md: { outer: "w-24 h-24", text: "text-2xl" },
  lg: { outer: "w-32 h-32", text: "text-3xl" },
}

export function ScoreRing({ score, size = "md", className }: ScoreRingProps) {
  const s = sizeMap[size]
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const dashArray = `${(score / 100) * circumference} ${circumference}`

  return (
    <div className={cn("relative flex-shrink-0", s.outer, className)}>
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="var(--bg-tertiary)"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="var(--neon-cyan)"
          strokeWidth="8"
          fill="none"
          strokeDasharray={dashArray}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("font-bold text-[var(--neon-cyan)] mono text-center", s.text)}>
          {score}
        </span>
      </div>
    </div>
  )
}
