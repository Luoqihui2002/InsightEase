import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useMemo } from "react"

export interface DataTablePreviewProps {
  columns: string[]
  data: Record<string, unknown>[]
  maxRows?: number
  maxHeight?: string
  className?: string
  emptyMessage?: string
}

export function DataTablePreview({
  columns,
  data,
  maxRows = 100,
  maxHeight = "400px",
  className,
  emptyMessage = "暂无数据",
}: DataTablePreviewProps) {
  const displayData = useMemo(() => data.slice(0, maxRows), [data, maxRows])

  if (displayData.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-8 text-sm text-[var(--text-secondary)]",
          className
        )}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      className={cn("overflow-auto rounded-lg border border-[var(--border-subtle)]", className)}
      style={{ maxHeight }}
    >
      <table className="w-full caption-bottom text-sm">
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]">
            {columns.map((col) => (
              <TableHead
                key={col}
                className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap"
              >
                {col}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayData.map((row, i) => (
            <TableRow key={i} className="hover:bg-[var(--bg-tertiary)]/50">
              {columns.map((col) => (
                <TableCell
                  key={col}
                  className="text-sm text-[var(--text-primary)] whitespace-nowrap"
                >
                  {String(row[col] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  )
}
