import type { Analysis } from '@/types/api';
import type {
  SafeChartSummary,
  SafeResultExplanationHints,
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
const MAX_HINT_ITEMS = 8;
const MAX_HINT_TEXT_LENGTH = 160;

export function buildSafeResultSummary(
  analysis: Analysis,
  options?: { dataset_name?: string }
): SafeResultSummary {
  const summarized = summarizeResultData(analysis.result_data);
  const aiSummary = getOptionalString(analysis, 'ai_summary');
  const explanationHints = buildSafeResultExplanationHints(analysis, summarized);

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
    explanation_hints: explanationHints,
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

export function buildSafeResultExplanationHints(
  analysis: Analysis,
  summarized = summarizeResultData(analysis.result_data)
): SafeResultExplanationHints {
  const resultRecord = isRecord(analysis.result_data) ? analysis.result_data : undefined;
  const params = isRecord(analysis.params) ? analysis.params : {};
  const selectedFields = collectSelectedFields(params, resultRecord);
  const primaryMetricNames = summarized.metrics.map((metric) => truncateHint(metric.label)).slice(0, MAX_HINT_ITEMS);
  const hints: SafeResultExplanationHints = {
    analysis_goal: getAnalysisGoal(analysis.type),
    method: inferMethodName(analysis.type, params, resultRecord),
    selected_fields: selectedFields,
    model_name: inferModelName(analysis.type, params, resultRecord),
    primary_metric_names: primaryMetricNames,
    primary_metric_interpretation: summarized.metrics
      .map((metric) => `${truncateHint(metric.label)}: ${truncateHint(String(metric.value))}${metric.unit ? ` ${truncateHint(metric.unit)}` : ''}`)
      .slice(0, MAX_HINT_ITEMS),
    module_specific_findings: buildModuleFindings(analysis.type, params, resultRecord, summarized),
    chart_summaries: summarized.charts.map((chart) => ({
      chart_type: truncateHint(chart.chart_type || 'unknown'),
      title: chart.title ? truncateHint(chart.title) : undefined,
      x_field: chart.x_key ? truncateHint(chart.x_key) : undefined,
      y_field: chart.y_keys?.[0] ? truncateHint(chart.y_keys[0]) : undefined,
      trend: 'unknown' as const,
      notable_points: chart.description ? [truncateHint(chart.description)] : undefined,
    })).slice(0, 3),
    table_summaries: summarized.tables.map((table) => ({
      name: truncateHint(table.title),
      row_count: table.total_rows,
      column_count: table.columns.length,
      key_columns: table.columns.slice(0, 6).map(truncateHint),
      notable_values: summarizeTableValues(table),
    })).slice(0, 3),
    limitations: buildLimitations(analysis, summarized),
    recommended_followups: buildRecommendedFollowups(analysis.type),
  };

  return compactHints(hints);
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

function getAnalysisGoal(type: string): string {
  const goals: Record<string, string> = {
    statistics: 'Explain descriptive statistics, distributions, missing values, and field-level patterns.',
    descriptive: 'Explain descriptive statistics, distributions, missing values, and field-level patterns.',
    forecast: 'Explain forecast direction, horizon, model signal, and uncertainty from bounded forecast output.',
    time_series: 'Explain forecast direction, horizon, model signal, and uncertainty from bounded time-series output.',
    attribution: 'Explain channel or touchpoint contribution using bounded attribution metrics only.',
    funnel: 'Explain path, funnel, conversion, and drop-off behavior from bounded path-analysis summaries.',
    path_analysis: 'Explain path, funnel, conversion, and drop-off behavior from bounded path-analysis summaries.',
    semantic: 'Explain text-analysis sentiment, topics, keywords, and quality warnings from bounded summaries.',
  };
  return goals[type] || 'Explain the bounded analysis result summary without claiming access to raw data.';
}

function inferMethodName(
  type: string,
  params: Record<string, unknown>,
  resultRecord?: Record<string, unknown>
): string | undefined {
  return firstString([
    resultRecord?.method,
    resultRecord?.model,
    resultRecord?.model_name,
    resultRecord?.modelName,
    params.method,
    params.model,
    params.model_name,
    params.modelName,
    type,
  ]);
}

function inferModelName(
  type: string,
  params: Record<string, unknown>,
  resultRecord?: Record<string, unknown>
): string | undefined {
  if (!['forecast', 'time_series', 'attribution'].includes(type)) return undefined;
  return firstString([
    resultRecord?.model_name,
    resultRecord?.modelName,
    resultRecord?.model,
    resultRecord?.best_model,
    resultRecord?.bestModel,
    params.model_name,
    params.modelName,
    params.model,
  ]);
}

function collectSelectedFields(
  params: Record<string, unknown>,
  resultRecord?: Record<string, unknown>
): string[] {
  const fields: string[] = [];
  for (const source of [params, resultRecord]) {
    if (!source) continue;
    for (const key of [
      'field',
      'fields',
      'selected_fields',
      'selectedFields',
      'target_field',
      'targetField',
      'date_field',
      'dateField',
      'time_field',
      'timeField',
      'text_field',
      'textField',
      'dimension_field',
      'dimensionField',
      'metric_field',
      'metricField',
    ]) {
      pushStringValues(fields, source[key]);
    }
  }
  return uniqueStrings(fields).slice(0, MAX_HINT_ITEMS);
}

function buildModuleFindings(
  type: string,
  params: Record<string, unknown>,
  resultRecord: Record<string, unknown> | undefined,
  summarized: ReturnType<typeof summarizeResultData>
): string[] {
  const findings: string[] = [];
  const add = (value?: string) => {
    if (value) findings.push(truncateHint(value));
  };

  if (type === 'forecast' || type === 'time_series') {
    const forecastRows = firstRecordArray([
      resultRecord?.forecast,
      resultRecord?.forecasts,
      resultRecord?.forecast_data,
      resultRecord?.predictions,
      summarized.tables.find((table) => /forecast|prediction|result/i.test(table.title))?.rows,
    ]);
    const horizon = firstNumber([resultRecord?.horizon, resultRecord?.forecast_horizon, params.horizon, params.periods, params.forecast_periods]);
    const target = firstString([params.target_field, params.targetField, resultRecord?.target_field, resultRecord?.targetField]);
    const date = firstString([params.date_field, params.dateField, resultRecord?.date_field, resultRecord?.dateField]);
    const model = inferModelName(type, params, resultRecord);
    const forecastStats = summarizeForecastRows(forecastRows, target);

    add(model ? `Forecast model: ${model}.` : undefined);
    add(horizon !== undefined ? `Forecast horizon: ${horizon} periods.` : undefined);
    add(date ? `Date/time field: ${date}.` : undefined);
    add(target ? `Target field: ${target}.` : undefined);
    add(forecastStats);
  } else if (type === 'attribution') {
    const modelNames = collectAttributionModels(resultRecord, summarized);
    const conversionCount = firstNumber([resultRecord?.conversion_count, resultRecord?.conversions, resultRecord?.total_conversions, resultRecord?.totalConversions]);
    const journeyCount = firstNumber([resultRecord?.journey_count, resultRecord?.journeys, resultRecord?.user_journey_count, resultRecord?.userJourneyCount]);
    const conversionValue = firstNumber([resultRecord?.total_conversion_value, resultRecord?.totalConversionValue, resultRecord?.conversion_value]);
    const topChannels = collectTopChannels(resultRecord, summarized);

    add(modelNames.length ? `Attribution models available: ${modelNames.join(', ')}.` : undefined);
    add(conversionCount !== undefined ? `Conversions counted: ${conversionCount}.` : undefined);
    add(journeyCount !== undefined ? `Journeys analyzed: ${journeyCount}.` : undefined);
    add(conversionValue !== undefined ? `Total conversion value: ${conversionValue}.` : undefined);
    add(topChannels.length ? `Top channel hints: ${topChannels.join(', ')}.` : undefined);
  } else if (['statistics', 'descriptive', 'correlation'].includes(type)) {
    const selected = collectSelectedFields(params, resultRecord);
    const correlationRows = summarized.tables.find((table) => /correlation|corr/i.test(table.title))?.rows;
    add(selected.length ? `Selected variables: ${selected.join(', ')}.` : undefined);
    add(summarized.metrics.length ? `Descriptive metric keys: ${summarized.metrics.map((metric) => metric.label).slice(0, 6).join(', ')}.` : undefined);
    add(correlationRows?.length ? `Correlation summary preview contains ${correlationRows.length} capped rows.` : undefined);
  } else if (['path_analysis', 'path', 'funnel'].includes(type)) {
    const topPaths = collectPathFindings(resultRecord, summarized);
    const conversionRate = firstNumber([resultRecord?.conversion_rate, resultRecord?.conversionRate, resultRecord?.overall_conversion_rate]);
    add(topPaths.length ? `Top path hints: ${topPaths.join(' | ')}.` : undefined);
    add(conversionRate !== undefined ? `Conversion rate hint: ${conversionRate}.` : undefined);
  } else if (type === 'semantic') {
    const sentiment = summarizeRecordKeys(resultRecord?.sentiment_distribution ?? resultRecord?.sentimentDistribution);
    const topics = collectStringList(resultRecord?.topics ?? resultRecord?.top_topics ?? resultRecord?.keywords ?? resultRecord?.top_keywords);
    const textField = firstString([params.text_field, params.textField, resultRecord?.text_field, resultRecord?.textField]);
    add(textField ? `Text field: ${textField}.` : undefined);
    add(sentiment ? `Sentiment distribution keys: ${sentiment}.` : undefined);
    add(topics.length ? `Topic/keyword hints: ${topics.join(', ')}.` : undefined);
  }

  if (findings.length === 0 && summarized.result_keys.length) {
    add(`Available safe result keys: ${summarized.result_keys.slice(0, 8).join(', ')}.`);
  }

  return uniqueStrings(findings).slice(0, MAX_HINT_ITEMS);
}

function buildLimitations(analysis: Analysis, summarized: ReturnType<typeof summarizeResultData>): string[] {
  const limitations: string[] = [
    'Only bounded SafeResultSummary and explanation hints are available; raw result_data and raw dataset rows are not included.',
  ];
  if (!summarized.tables.length) limitations.push('No detailed safe table preview is available.');
  if (!summarized.metrics.length) limitations.push('No numeric metric summary was detected.');
  if (analysis.status !== 'completed') limitations.push(`Analysis status is ${analysis.status}.`);
  return limitations.map(truncateHint).slice(0, MAX_HINT_ITEMS);
}

function buildRecommendedFollowups(type: string): string[] {
  const common = ['Open the full result page for uncapped tables and charts.'];
  const byType: Record<string, string[]> = {
    forecast: ['Compare forecast assumptions with recent actuals.', 'Check uncertainty intervals before making decisions.'],
    time_series: ['Compare forecast assumptions with recent actuals.', 'Check uncertainty intervals before making decisions.'],
    attribution: ['Review model-specific channel rankings.', 'Validate whether attribution windows match the business question.'],
    statistics: ['Inspect missing values and outliers before modeling.'],
    descriptive: ['Inspect missing values and outliers before modeling.'],
    path_analysis: ['Review high drop-off steps and segment paths by user group.'],
    funnel: ['Review high drop-off steps and segment paths by user group.'],
    semantic: ['Inspect topic examples and sentiment-quality warnings.'],
  };
  return [...(byType[type] ?? []), ...common].map(truncateHint).slice(0, MAX_HINT_ITEMS);
}

function summarizeTableValues(table: SafeTableSummary): string[] {
  return table.rows
    .slice(0, 3)
    .flatMap((row) =>
      Object.entries(row)
        .slice(0, 3)
        .map(([key, value]) => `${truncateHint(key)}=${truncateHint(String(formatSafeValue(value)))}`)
    )
    .slice(0, MAX_HINT_ITEMS);
}

function summarizeForecastRows(rows: Record<string, unknown>[] | undefined, targetField?: string): string | undefined {
  if (!rows?.length) return undefined;
  const valueKey = targetField && rows.some((row) => typeof row[targetField] === 'number')
    ? targetField
    : Object.keys(rows[0]).find((key) => rows.some((row) => typeof row[key] === 'number'));
  if (!valueKey) return `Forecast preview contains ${rows.length} capped rows.`;

  const values = rows.map((row) => row[valueKey]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!values.length) return `Forecast preview contains ${rows.length} capped rows.`;

  const first = values[0];
  const last = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const trend = last > first ? 'up' : last < first ? 'down' : 'flat';
  return `Forecast preview for ${valueKey}: first=${first}, last=${last}, min=${min}, max=${max}, trend=${trend}.`;
}

function collectAttributionModels(resultRecord: Record<string, unknown> | undefined, summarized: ReturnType<typeof summarizeResultData>): string[] {
  const models: string[] = [];
  pushStringValues(models, resultRecord?.models);
  pushStringValues(models, resultRecord?.model_names);
  pushStringValues(models, resultRecord?.attribution_models);
  for (const table of summarized.tables) {
    if (!/model|attribution/i.test(table.title)) continue;
    for (const row of table.rows) {
      pushStringValues(models, row.model ?? row.model_name ?? row.attribution_model);
    }
  }
  return uniqueStrings(models).slice(0, 5);
}

function collectTopChannels(resultRecord: Record<string, unknown> | undefined, summarized: ReturnType<typeof summarizeResultData>): string[] {
  const channels: string[] = [];
  pushStringValues(channels, resultRecord?.top_channels);
  for (const table of summarized.tables) {
    if (!/channel|touchpoint|attribution|model/i.test(table.title)) continue;
    for (const row of table.rows) {
      pushStringValues(channels, row.channel ?? row.touchpoint ?? row.name);
    }
  }
  return uniqueStrings(channels).slice(0, 5);
}

function collectPathFindings(resultRecord: Record<string, unknown> | undefined, summarized: ReturnType<typeof summarizeResultData>): string[] {
  const paths: string[] = [];
  pushStringValues(paths, resultRecord?.top_paths);
  pushStringValues(paths, resultRecord?.paths);
  for (const table of summarized.tables) {
    if (!/path|funnel|step/i.test(table.title)) continue;
    for (const row of table.rows) {
      pushStringValues(paths, row.path ?? row.sequence ?? row.step ?? row.event);
    }
  }
  return uniqueStrings(paths).slice(0, 5);
}

function compactHints(hints: SafeResultExplanationHints): SafeResultExplanationHints {
  return Object.fromEntries(
    Object.entries(hints).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== '';
    })
  ) as SafeResultExplanationHints;
}

function firstRecordArray(values: unknown[]): Record<string, unknown>[] | undefined {
  for (const value of values) {
    const rows = getRecordArray(value);
    if (rows?.length) return rows.slice(0, MAX_TABLE_ROWS);
  }
  return undefined;
}

function firstString(values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return truncateHint(value);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function firstNumber(values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

function collectStringList(value: unknown): string[] {
  const items: string[] = [];
  pushStringValues(items, value);
  return uniqueStrings(items).slice(0, MAX_HINT_ITEMS);
}

function summarizeRecordKeys(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return Object.keys(value).slice(0, MAX_HINT_ITEMS).map(truncateHint).join(', ');
}

function pushStringValues(target: string[], value: unknown): void {
  if (typeof value === 'string' && value.trim()) {
    target.push(truncateHint(value));
    return;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    target.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, MAX_HINT_ITEMS)) {
      if (isRecord(item)) {
        pushStringValues(target, item.name ?? item.label ?? item.channel ?? item.path ?? item.value);
      } else {
        pushStringValues(target, item);
      }
    }
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function truncateHint(value: string): string {
  return value.length > MAX_HINT_TEXT_LENGTH ? `${value.slice(0, MAX_HINT_TEXT_LENGTH)}...` : value;
}
