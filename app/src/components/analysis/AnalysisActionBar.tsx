import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Download, FileSpreadsheet, FileText } from "lucide-react"

export interface AnalysisActionBarProps {
  onExportCSV?: () => void
  onExportJSON?: () => void
  onExportExcel?: () => void
  onDownload?: () => void
  disabled?: boolean
  className?: string
}

export function AnalysisActionBar({
  onExportCSV,
  onExportJSON,
  onExportExcel,
  onDownload,
  disabled = false,
  className,
}: AnalysisActionBarProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {onExportCSV && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onExportCSV}
        >
          <FileText className="h-4 w-4" />
          导出 CSV
        </Button>
      )}
      {onExportJSON && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onExportJSON}
        >
          <FileText className="h-4 w-4" />
          导出 JSON
        </Button>
      )}
      {onExportExcel && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onExportExcel}
        >
          <FileSpreadsheet className="h-4 w-4" />
          导出 Excel
        </Button>
      )}
      {onDownload && (
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onDownload}
        >
          <Download className="h-4 w-4" />
          下载
        </Button>
      )}
    </div>
  )
}
