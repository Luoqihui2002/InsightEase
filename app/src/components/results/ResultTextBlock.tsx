import { useState } from "react";
import type { ResultTextBlock as ResultTextBlockType } from "@/types/result";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  block: ResultTextBlockType;
}

export function ResultTextBlock({ block }: Props) {
  const [expanded, setExpanded] = useState(!block.defaultCollapsed);

  const content = (
    <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">
      {block.content}
    </p>
  );

  return (
    <div className="space-y-2">
      {block.title && (
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-[var(--text-muted)]">
            {block.title}
          </h4>
          {block.collapsible && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      )}
      {(!block.collapsible || expanded) && content}
    </div>
  );
}
