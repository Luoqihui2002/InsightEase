import type { ResultWarningBlock as ResultWarningBlockType } from "@/types/result";
import { AlertTriangle, AlertCircle, Info } from "lucide-react";

interface Props {
  block: ResultWarningBlockType;
}

export function ResultWarningBlock({ block }: Props) {
  const severityConfig = {
    info: {
      icon: Info,
      border: "border-[var(--neon-cyan)]/30",
      bg: "bg-[var(--neon-cyan)]/5",
      text: "text-[var(--neon-cyan)]",
    },
    caution: {
      icon: AlertCircle,
      border: "border-[var(--neon-orange)]/30",
      bg: "bg-[var(--neon-orange)]/5",
      text: "text-[var(--neon-orange)]",
    },
    critical: {
      icon: AlertTriangle,
      border: "border-[var(--neon-pink)]/30",
      bg: "bg-[var(--neon-pink)]/5",
      text: "text-[var(--neon-pink)]",
    },
  };

  const config = severityConfig[block.severity];
  const Icon = config.icon;

  return (
    <div
      className={`rounded-lg border ${config.border} ${config.bg} p-3 space-y-1`}
    >
      <div className="flex items-start gap-2">
        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.text}`} />
        <div className="flex-1 min-w-0">
          {block.title && (
            <p className={`text-sm font-medium ${config.text}`}>
              {block.title}
            </p>
          )}
          <p className="text-sm text-[var(--text-primary)]">{block.message}</p>
        </div>
      </div>
      {block.detail && (
        <p className="text-xs text-[var(--text-secondary)] pl-6">
          {block.detail}
        </p>
      )}
      {block.suggestion && (
        <p className="text-xs text-[var(--text-secondary)] pl-6">
          建议: {block.suggestion}
        </p>
      )}
      {block.relatedField && (
        <p className="text-[10px] text-[var(--text-muted)] pl-6">
          相关字段: {block.relatedField}
        </p>
      )}
    </div>
  );
}
