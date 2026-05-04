import type { SafeMetricSummary, SafeResultSummary } from '@/types/resultSummary';

export type ResultFollowupIntent =
  | 'explain_result'
  | 'risks_and_anomalies'
  | 'next_steps'
  | 'report_summary'
  | 'unknown';

export function detectResultFollowupIntent(message: string): ResultFollowupIntent {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return 'unknown';

  if (
    includesAny(normalized, [
      '解释',
      '解读',
      '说明什么',
      '什么意思',
      '这个结果',
      'explain',
      'interpret',
    ])
  ) {
    return 'explain_result';
  }

  if (
    includesAny(normalized, [
      '异常',
      '风险',
      '问题',
      '告警',
      'warning',
      'risk',
      'anomal',
      'problem',
    ])
  ) {
    return 'risks_and_anomalies';
  }

  if (
    includesAny(normalized, [
      '下一步',
      '建议',
      '怎么分析',
      '继续',
      'next',
      'recommend',
      'suggest',
    ])
  ) {
    return 'next_steps';
  }

  if (
    includesAny(normalized, [
      '报告',
      '总结成',
      '整理成',
      '汇报',
      'report',
      'summary',
      'summarize',
    ])
  ) {
    return 'report_summary';
  }

  return 'unknown';
}

export function buildResultFollowupResponse(
  summary: SafeResultSummary,
  intent: ResultFollowupIntent
): string {
  const caveat = '以下内容基于安全结果摘要生成，不会重新运行分析。';

  switch (intent) {
    case 'explain_result':
      return [caveat, buildExplanation(summary)].join('\n\n');
    case 'risks_and_anomalies':
      return [caveat, buildRiskReview(summary)].join('\n\n');
    case 'next_steps':
      return [caveat, buildNextSteps(summary)].join('\n\n');
    case 'report_summary':
      return [caveat, buildReportSummary(summary)].join('\n\n');
    default:
      return [
        caveat,
        '当前仅基于结果摘要进行解释；更深入的自动分析需要后续接入 Hermes。你可以问我“帮我解释这个结果”“有哪些异常或风险”“下一步建议做什么”或“整理成报告文字”。',
      ].join('\n\n');
  }
}

function buildExplanation(summary: SafeResultSummary): string {
  const parts = [
    `这是一次${summary.title || summary.analysis_type}结果。`,
    summary.dataset_name ? `数据集：${summary.dataset_name}。` : undefined,
    `状态：${summary.status}。`,
    summary.ai_summary || summary.ai_interpretation
      ? `已有摘要：${summary.ai_summary || summary.ai_interpretation}`
      : undefined,
    summary.metrics.length > 0 ? `关键指标：${formatMetrics(summary.metrics)}。` : undefined,
    summary.result_keys.length > 0 ? `结果包含这些主要字段：${summary.result_keys.slice(0, 8).join('、')}。` : undefined,
    summary.tables.length > 0
      ? `摘要中包含 ${summary.tables.length} 个表格预览，首个表格为「${summary.tables[0].title}」，共 ${summary.tables[0].total_rows ?? summary.tables[0].rows.length} 行，当前只展示前 ${summary.tables[0].rows.length} 行。`
      : undefined,
    summary.charts.length > 0
      ? `还包含图表/配置摘要：${summary.charts.map((chart) => chart.title).join('、')}。`
      : undefined,
  ].filter(Boolean);

  if (parts.length <= 3) {
    parts.push('当前安全摘要信息较少，不能可靠推断更深层结论。');
  }

  return parts.join('\n');
}

function buildRiskReview(summary: SafeResultSummary): string {
  const risks: string[] = [];

  if (summary.status === 'failed' || summary.status === 'error') {
    risks.push(`结果状态为 ${summary.status}，需要先确认分析是否成功完成。`);
  }
  if (summary.warnings.length > 0) {
    risks.push(...summary.warnings.map((warning) => `摘要警告：${warning}`));
  }
  if (!summary.ai_summary && !summary.ai_interpretation) {
    risks.push('安全摘要中没有现成 AI 摘要/解读，当前解释只能基于指标、字段和预览结构。');
  }
  if (summary.metrics.length === 0) {
    risks.push('安全摘要中没有关键指标，建议回到原结果确认核心口径。');
  }
  if (summary.tables.length === 0) {
    risks.push('安全摘要中没有表格预览，无法检查样例行层面的异常。');
  }
  if (summary.result_keys.some((key) => /error|warning|异常|风险|outlier|missing/i.test(key))) {
    risks.push('结果字段名中出现异常/风险相关信号，建议优先查看对应字段。');
  }

  if (risks.length === 0) {
    risks.push('当前安全摘要中没有明确风险提示，但仍建议结合字段口径和业务背景复核。');
  }

  return ['我能从安全摘要里看到这些风险/注意点：', ...risks.map((item) => `- ${item}`)].join('\n');
}

function buildNextSteps(summary: SafeResultSummary): string {
  const steps = getNextStepsForType(summary.analysis_type);
  return [
    `基于「${summary.title || summary.analysis_type}」的安全摘要，建议下一步：`,
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    '如果要更深入地自动解释结果，需要后续接入 Hermes；当前不会重新运行分析。',
  ].join('\n');
}

function buildReportSummary(summary: SafeResultSummary): string {
  const metricText = summary.metrics.length > 0 ? `关键指标包括 ${formatMetrics(summary.metrics.slice(0, 4))}。` : '';
  const warningText =
    summary.warnings.length > 0
      ? `需要注意：${summary.warnings.slice(0, 2).join('；')}。`
      : '当前安全摘要中没有明确风险提示。';
  const nextStep = getNextStepsForType(summary.analysis_type)[0];

  return [
    `报告草稿：本次${summary.title || summary.analysis_type}基于${summary.dataset_name || '当前数据集'}生成，结果状态为${summary.status}。`,
    summary.ai_summary || summary.ai_interpretation || metricText || '安全摘要信息有限，暂不能形成强结论。',
    warningText,
    `建议下一步${nextStep}。`,
  ]
    .filter(Boolean)
    .join('');
}

function getNextStepsForType(type: string): string[] {
  const normalized = type.toLowerCase();
  if (/(descriptive|statistics|semantic)/.test(normalized)) {
    return ['复核缺失值和异常值字段。', '按关键维度分组比较统计指标。', '可视化核心字段分布。', '确认指标口径是否符合业务定义。'];
  }
  if (/(forecast|time_series)/.test(normalized)) {
    return ['检查预测残差和近期实际值对比。', '确认季节性和节假日影响。', '验证目标指标口径。', '按关键品类或渠道拆分趋势。'];
  }
  if (/(path|funnel|sequence)/.test(normalized)) {
    return ['定位转化流失最大的步骤。', '按渠道或用户群体分段比较路径。', '对比高转化和低转化路径。', '复核事件时间顺序和去重规则。'];
  }
  if (/(attribution)/.test(normalized)) {
    return ['比较不同归因模型假设。', '复核触点窗口和转化定义。', '检查渠道贡献是否受样本偏差影响。', '按渠道层级查看贡献变化。'];
  }
  return ['复核关键指标和警告。', '查看原结果中的字段口径。', '选择相关维度做分组对比。', '补充业务背景后再制定下一步分析。'];
}

function formatMetrics(metrics: SafeMetricSummary[]): string {
  return metrics
    .slice(0, 6)
    .map((metric) => `${metric.label}=${metric.value}${metric.unit ? metric.unit : ''}`)
    .join('，');
}

function includesAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}
