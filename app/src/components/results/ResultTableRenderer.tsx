import type { ResultTableBlock } from "@/types/result";
import {
  formatResultValue,
  getColumnAlign,
  getAlignClass,
} from "@/lib/resultFormatters";

interface Props {
  block: ResultTableBlock;
}

export function ResultTableRenderer({ block }: Props) {
  const hasRows = block.rows.length > 0;

  return (
    <div className="space-y-2">
      {block.title && (
        <h4 className="text-sm font-medium text-[var(--text-muted)]">
          {block.title}
        </h4>
      )}

      {!hasRows ? (
        <div className="text-center py-8 text-[var(--text-muted)]">
          <p className="text-sm">
            {block.emptyMessage ?? "暂无数据"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-tertiary)]">
                {block.columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 text-xs font-medium text-[var(--text-muted)] ${getAlignClass(
                      getColumnAlign(col)
                    )}`}
                    title={col.description}
                  >
                    {col.label}
                    {col.unit && (
                      <span className="text-[10px] text-[var(--text-muted)] ml-0.5">
                        ({col.unit})
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-tertiary)]/50 transition-colors"
                >
                  {block.columns.map((col) => {
                    const rawValue = row[col.key];
                    const formatted = formatResultValue(rawValue, col);
                    const isPValue = col.semanticRole === "p_value";
                    const pValueNum =
                      isPValue && typeof rawValue === "number"
                        ? rawValue
                        : null;

                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2 text-[var(--text-primary)] ${getAlignClass(
                          getColumnAlign(col)
                        )} ${
                          pValueNum !== null && pValueNum < 0.05
                            ? "font-semibold text-[var(--neon-green)]"
                            : ""
                        }`}
                      >
                        {formatted}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {block.footnotes && block.footnotes.length > 0 && (
        <div className="space-y-1">
          {block.footnotes.map((note, i) => (
            <p key={i} className="text-[10px] text-[var(--text-muted)]">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
