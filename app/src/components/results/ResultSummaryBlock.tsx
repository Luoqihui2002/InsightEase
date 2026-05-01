import type { ResultSummaryBlock as ResultSummaryBlockType } from "@/types/result";

interface Props {
  block: ResultSummaryBlockType;
}

export function ResultSummaryBlock({ block }: Props) {
  const toneClass = {
    neutral: "text-[var(--text-primary)]",
    positive: "text-[var(--neon-green)]",
    negative: "text-[var(--neon-pink)]",
    caution: "text-[var(--neon-orange)]",
  }[block.tone ?? "neutral"];

  return (
    <div className="space-y-2">
      {block.title && (
        <h4 className="text-sm font-medium text-[var(--text-muted)]">
          {block.title}
        </h4>
      )}
      <p className={`text-sm leading-relaxed ${toneClass}`}>{block.content}</p>
      {block.bulletPoints && block.bulletPoints.length > 0 && (
        <ul className="list-disc list-inside space-y-1 mt-2">
          {block.bulletPoints.map((point, i) => (
            <li key={i} className="text-xs text-[var(--text-secondary)]">
              {point}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
