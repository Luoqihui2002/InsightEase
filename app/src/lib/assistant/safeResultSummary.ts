import type { Analysis } from '@/types/api';
import type {
  SafeChartSummary,
  SafeMetricSummary,
  SafeResultSummary,
  SafeTableSummary,
} from '@/types/resultSummary';

const MAX_RESULT_KEYS = 20;
const MAX_METRICS = 8;
const MAX_TABLES = 3;
const MAX_TABLE_ROWS = 5;
const MAX_TABLE_COLUMNS = 12;
const MAX_WARNINGS = 8;
const MAX_TEXT_LENGTH = 120;

export function buildSafeResultSummary(
  analysis: Analysis,
  options?: { dataset_name?: string }
): SafeResultSummary {
  const summarized = summarizeResultData(analysis.result_data);
  const aiSummary = getOptionalString(analysis, 'ai_summary');

  return {
    analysis_id: analysis.id,
    analysis_type: analysis.type,
    status: analysis.status,
    dataset_id: analysis.dataset_id,
    dataset_name: options?.dataset_name,
    created_at: analysis.created_at,
    completed_at: analysis.completed_at,
    title: getAnalysisTitle(analysis.type),
    subtitle: options?.dataset_name,
    ai_summary: aiSummary,
    ai_interpretation: analysis.ai_interpretation,
    result_keys: summarized.result_keys,
    metrics: summarized.metrics,
    tables: summarized.tables,
    charts: summarized.charts,
    warnings: [
      ...summarized.warnings,
      ...(analysis.error_msg ? [truncateText(analysis.error_msg)] : []),
    ].slice(0, MAX_WARNINGS),
    available_actions: [
      {
        id: 'view_full_history_result',
        label: '去历史页查看完整结果',
        target: `/app/history?analysis_id=${encodeURIComponent(analysis.id)}`,
      },
    ],
  };
}

export function summarizeResultData(resultData: unknown): {
  result_keys: string[];
  metrics: SafeMetricSummary[];
  tables: SafeTableSummary[];
  charts: SafeChartSummary[];
  warnings: string[];
} {
  if (resultData === null || resultData === undefined) {
    return {
      result_keys: [],
      metrics: [],
      tables: [],
      charts: [],
      warnings: ['Result data is empty.'],
    };
  }

  const resultRecord = isRecord(resultData) ? resultData : undefined;

  return {
    result_keys: getResultKeys(resultData),
    metrics: extractMetrics(resultData),
    tables: extractTables(resultData),
    charts: extractCharts(resultData),
    warnings: extractWarnings(resultRecord),
  };
}

function getAnalysisTitle(type: string): string {
  const labels: Record<string, string> = {
    descriptive: '描述统计',
    statistics: '统计分析',
    correlation: '相关分析',
    clustering: '聚类分析',
    forecast: '预测分析',
    attribution: '归因分析',
    time_series: '时间序列',
    funnel: '漏斗分析',
    rfm: 'RFM 分析',
    smart_process: '智能处理',
  };
  return labels[type] || type || '分析结果';
}

function getResultKeys(resultData: unknown): string[] {
  if (isRecord(resultData)) return Object.keys(resultData).slice(0, MAX_RESULT_KEYS);
  if (Array.isArray(resultData)) return ['array_result'];
  return [typeof resultData].filter(Boolean);
}

function extractMetrics(resultData: unknown): SafeMetricSummary[] {
  const resultRecord = isRecord(resultData) ? resultData : undefined;
  const metricCandidates: unknown[] = [];

  if (resultRecord) {
    if (isRecord(resultRecord.metrics)) metricCandidates.push(resultRecord.metrics);
    if (isRecord(resultRecord.summary)) metricCandidates.push(resultRecord.summary);
    metricCandidates.push(resultRecord);
  }

  const metrics: SafeMetricSummary[] = [];
  for (const candidate of metricCandidates) {
    if (!isRecord(candidate)) continue;

    for (const [label, value] of Object.entries(candidate)) {
      if (metrics.length >= MAX_METRICS) return metrics;
      if (!isSafePrimitive(value)) continue;
      metrics.push({ label, value: formatSafeValue(value) });
    }
  }

  return dedupeMetrics(metrics).slice(0, MAX_METRICS);
}

function extractTables(resultData: unknown): SafeTableSummary[] {
  const tables: SafeTableSummary[] = [];

  const directRows = getRecordArray(resultData);
  if (directRows) {
    tables.push(toSafeTable('result', directRows));
  }

  if (isRecord(resultData)) {
    const preferredKeys = [
      'rows',
      'data',
      'items',
      'results',
      'records',
      'forecast',
      'forecasts',
      'steps',
      'touchpoints',
      'model_comparison',
      'nodes',
      'links',
      'rules',
      'patterns',
      'columns',
    ];

    for (const key of preferredKeys) {
      if (tables.length >= MAX_TABLES) break;
      const rows = getRecordArray(resultData[key]);
      if (rows) tables.push(toSafeTable(key, rows));
    }

    for (const [key, value] of Object.entries(resultData)) {
      if (tables.length >= MAX_TABLES) break;
      if (tables.some((table) => table.title === key)) continue;
      const rows = getRecordArray(value);
      if (rows) tables.push(toSafeTable(key, rows));
    }

    const summaryRows = isRecord(resultData.summary) ? findNestedTables(resultData.summary, 'summary') : [];
    for (const table of summaryRows) {
      if (tables.length >= MAX_TABLES) break;
      if (!tables.some((existing) => existing.title === table.title)) tables.push(table);
    }
  }

  return tables.slice(0, MAX_TABLES);
}

function extractCharts(resultData: unknown): SafeChartSummary[] {
  if (!isRecord(resultData)) return [];

  const charts: SafeChartSummary[] = [];
  for (const key of ['chart', 'chart_config', 'visualization', 'plot', 'graph']) {
    const value = resultData[key];
    if (!value) continue;
    charts.push(toSafeChart(key, value));
  }

  return charts.slice(0, 3);
}

function extractWarnings(resultData?: Record<string, unknown>): string[] {
  if (!resultData) return [];
  const warnings: string[] = [];

  for (const key of ['warnings', 'warning', 'errors', 'error']) {
    const value = resultData[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (warnings.length >= MAX_WARNINGS) return warnings;
        warnings.push(truncateText(String(formatSafeValue(item))));
      }
    } else if (value) {
      warnings.push(truncateText(String(formatSafeValue(value))));
    }
  }

  return warnings.slice(0, MAX_WARNINGS);
}

function findNestedTables(record: Record<string, unknown>, prefix: string): SafeTableSummary[] {
  const tables: SafeTableSummary[] = [];
  for (const [key, value] of Object.entries(record)) {
    const rows = getRecordArray(value);
    if (rows) tables.push(toSafeTable(`${prefix}.${key}`, rows));
  }
  return tables;
}

function toSafeTable(title: string, rows: Record<string, unknown>[]): SafeTableSummary {
  const previewRows = rows.slice(0, MAX_TABLE_ROWS).map((row) => {
    const safeRow: Record<string, unknown> = {};
    const columns = Object.keys(row).slice(0, MAX_TABLE_COLUMNS);
    for (const column of columns) {
      safeRow[column] = toSafeCell(row[column]);
    }
    return safeRow;
  });
  const columns = Array.from(new Set(previewRows.flatMap((row) => Object.keys(row)))).slice(
    0,
    MAX_TABLE_COLUMNS
  );

  return {
    title,
    columns,
    rows: previewRows,
    total_rows: rows.length,
    truncated: rows.length > MAX_TABLE_ROWS || columns.length > MAX_TABLE_COLUMNS,
  };
}

function toSafeChart(title: string, value: unknown): SafeChartSummary {
  if (!isRecord(value)) {
    return {
      title,
      description: String(formatSafeValue(value)),
    };
  }

  const yKeys = value.y_keys ?? value.yKeys ?? value.series;
  return {
    title,
    chart_type: getOptionalString(value, 'chart_type') || getOptionalString(value, 'chartType') || getOptionalString(value, 'type'),
    x_key: getOptionalString(value, 'x_key') || getOptionalString(value, 'xKey'),
    y_keys: Array.isArray(yKeys) ? yKeys.map((item) => String(formatSafeValue(item))).slice(0, 8) : undefined,
    description: Object.keys(value).slice(0, 8).join(', '),
  };
}

function getRecordArray(value: unknown): Record<string, unknown>[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value.filter(isRecord);
  return rows.length > 0 ? rows : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSafePrimitive(value: unknown): value is string | number | boolean {
  return ['string', 'number', 'boolean'].includes(typeof value);
}

function formatSafeValue(value: unknown): string | number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return truncateText(value);
  if (value === null || value === undefined) return '-';
  if (Array.isArray(value)) return `${value.length} items`;
  if (isRecord(value)) return `${Object.keys(value).length} keys`;
  return truncateText(String(value));
}

function toSafeCell(value: unknown): unknown {
  if (isSafePrimitive(value) || value === null || value === undefined) return formatSafeValue(value);
  if (Array.isArray(value)) return `${value.length} items`;
  if (isRecord(value)) return `${Object.keys(value).length} keys`;
  return truncateText(String(value));
}

function truncateText(value: string): string {
  return value.length > MAX_TEXT_LENGTH ? `${value.slice(0, MAX_TEXT_LENGTH)}...` : value;
}

function getOptionalString(record: unknown, key: string): string | undefined {
  if (!isRecord(record)) return undefined;
  const value = record[key];
  return typeof value === 'string' && value.trim() ? truncateText(value) : undefined;
}

function dedupeMetrics(metrics: SafeMetricSummary[]): SafeMetricSummary[] {
  const seen = new Set<string>();
  return metrics.filter((metric) => {
    if (seen.has(metric.label)) return false;
    seen.add(metric.label);
    return true;
  });
}
