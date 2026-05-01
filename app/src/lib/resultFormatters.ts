/**
 * Formatting utilities for AnalysisResult table values.
 * Based on docs/design/RESULT_TABLE_DESIGN.md §7.
 */

import type { ResultTableColumn, ResultColumnType } from "@/types/result";

const DEFAULT_PRECISION: Record<ResultColumnType, number> = {
  string: 0,
  number: 2,
  integer: 0,
  percent: 1,
  currency: 2,
  date: 0,
  datetime: 0,
  boolean: 0,
};

/**
 * Format a raw value according to its column definition.
 */
export function formatResultValue(
  value: unknown,
  column: ResultTableColumn
): string {
  if (value === null || value === undefined) {
    return "—";
  }

  const { dataType, precision, semanticRole } = column;

  switch (dataType) {
    case "integer":
      return formatInteger(value);
    case "number":
      return formatNumber(value, precision ?? DEFAULT_PRECISION.number);
    case "percent":
      return formatPercent(value, precision ?? DEFAULT_PRECISION.percent);
    case "currency":
      return formatCurrency(value, precision ?? DEFAULT_PRECISION.currency);
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDateTime(value);
    case "boolean":
      return formatBoolean(value);
    case "string":
    default:
      // Handle p-value semantic role with special formatting
      if (semanticRole === "p_value" && typeof value === "number") {
        return formatPValue(value);
      }
      return String(value);
  }
}

export function formatInteger(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return Math.round(num).toLocaleString("en-US");
}

export function formatNumber(value: unknown, precision = 2): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";

  // Very large numbers: compact notation
  if (Math.abs(num) >= 1_000_000) {
    return compactNumber(num, precision);
  }

  // Very small numbers: scientific notation
  if (Math.abs(num) > 0 && Math.abs(num) < 0.001 && precision < 3) {
    return num.toExponential(2);
  }

  return num.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function formatPercent(value: unknown, precision = 1): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  const pct = num * 100;
  return `${pct.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}%`;
}

export function formatPValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  if (num < 0.001) return "< 0.001";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export function formatCurrency(
  value: unknown,
  precision = 2,
  symbol = "¥"
): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${symbol}${num.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;
}

export function formatDate(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const str = String(value);
  // Try to parse ISO string
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return str;
}

export function formatDateTime(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  const str = String(value);
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 19).replace("T", " ");
  }
  return str;
}

export function formatBoolean(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === 1 || value === "true" || value === "1") return "Yes";
  if (value === 0 || value === "false" || value === "0") return "No";
  return String(value);
}

/**
 * Compact notation for large numbers (1.2M, 3.4B, etc.)
 */
function compactNumber(num: number, precision = 2): string {
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(precision)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(precision)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(precision)}K`;
  }

  return num.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/**
 * Get CSS alignment class based on column type and semantic role.
 */
export function getColumnAlign(column: ResultTableColumn): string {
  if (column.align) {
    return column.align;
  }
  switch (column.dataType) {
    case "number":
    case "integer":
    case "percent":
    case "currency":
      return "right";
    case "boolean":
    case "date":
    case "datetime":
      return "center";
    case "string":
    default:
      return "left";
  }
}

/**
 * Get Tailwind text-align class from align value.
 */
export function getAlignClass(align: string): string {
  switch (align) {
    case "right":
      return "text-right";
    case "center":
      return "text-center";
    case "left":
    default:
      return "text-left";
  }
}
