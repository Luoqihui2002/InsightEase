/**
 * Rule-based mock analysis planner.
 *
 * Deterministic keyword matching. No LLM calls.
 * Accepts user question + datasets + optional confirmed relationships.
 * Returns a structured AssistantAnalysisPlan.
 */

import type {
  AssistantAnalysisPlan,
  RecommendedAnalysisType,
  AnalysisFieldRequirement,
  AssistantNextAction,
  TableRelationship,
} from '@/types/assistant';

/* ------------------------------------------------------------------ */
/*  Keyword rules                                                     */
/* ------------------------------------------------------------------ */

interface KeywordRule {
  type: RecommendedAnalysisType;
  keywords: string[];
  label: string;
  requiredFieldRoles: Array<{
    role: AnalysisFieldRequirement['role'];
    required: boolean;
    reason: string;
  }>;
  nextActionLabel: string;
  nextActionTarget: string;
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    type: 'forecast',
    keywords: ['预测', '趋势', '未来', 'forecast', 'trend', 'time series', '销售额', '销量', 'sales'],
    label: '时序预测分析',
    requiredFieldRoles: [
      { role: 'time_column', required: true, reason: '需要时间维度进行趋势建模' },
      { role: 'target_metric', required: true, reason: '需要目标指标进行预测' },
    ],
    nextActionLabel: '打开时序预测',
    nextActionTarget: '/app/forecast',
  },
  {
    type: 'path_analysis',
    keywords: ['路径', '漏斗', '转化路径', '流失', 'journey', 'funnel', 'path', 'event', '步骤', '留存'],
    label: '路径/漏斗分析',
    requiredFieldRoles: [
      { role: 'user_id', required: true, reason: '需要用户标识追踪路径' },
      { role: 'event_name', required: true, reason: '需要事件名称构建路径' },
      { role: 'time_column', required: false, reason: '时间列用于排序和会话划分' },
    ],
    nextActionLabel: '打开路径分析',
    nextActionTarget: '/app/path',
  },
  {
    type: 'attribution',
    keywords: ['归因', '渠道贡献', 'touchpoint', 'attribution', 'campaign', 'channel', '渠道', '来源', '投放'],
    label: '归因分析',
    requiredFieldRoles: [
      { role: 'user_id', required: true, reason: '需要用户标识进行归因链路追踪' },
      { role: 'time_column', required: false, reason: '时间列用于触点排序' },
      { role: 'dimension', required: true, reason: '需要维度列表示渠道/触点' },
      { role: 'target_metric', required: false, reason: '需要转化指标评估贡献' },
    ],
    nextActionLabel: '打开归因分析',
    nextActionTarget: '/app/attribution',
  },
  {
    type: 'ab_test',
    keywords: ['AB', 'A/B', '实验', '对照组', 'treatment', 'control', 'variant', '显著性', '分组'],
    label: 'A/B 实验分析',
    requiredFieldRoles: [
      { role: 'group_column', required: true, reason: '需要分组列标识实验组和对照组' },
      { role: 'target_metric', required: true, reason: '需要目标指标衡量实验效果' },
      { role: 'user_id', required: false, reason: '用户标识用于去重和独立样本校验' },
    ],
    nextActionLabel: '打开统计分析',
    nextActionTarget: '/app/statistics',
  },
  {
    type: 'semantic',
    keywords: ['文本', '评论', '语义', '情感', 'review', 'comment', 'sentiment', 'topic', '关键词', '抱怨'],
    label: '语义/文本分析',
    requiredFieldRoles: [
      { role: 'text_column', required: true, reason: '需要文本列进行语义分析' },
    ],
    nextActionLabel: '打开语义分析',
    nextActionTarget: '/app/semantic',
  },
  {
    type: 'smart_process',
    keywords: ['清洗', '缺失', '异常值', '预处理', 'missing', 'null', 'outlier', 'clean', '去重', '格式化'],
    label: '数据预处理',
    requiredFieldRoles: [
      { role: 'target_metric', required: false, reason: '可能需要检查数值列的异常值' },
    ],
    nextActionLabel: '打开数据工坊',
    nextActionTarget: '/app/data-workshop',
  },
  {
    type: 'regression',
    keywords: ['回归', 'LTV', '价值预测', '相关因素', '驱动因素', '影响因素', 'regression', 'drivers'],
    label: '回归/价值预测分析',
    requiredFieldRoles: [
      { role: 'target_metric', required: true, reason: '需要目标变量进行回归建模' },
      { role: 'feature', required: false, reason: '特征列用于解释目标变量' },
      { role: 'user_id', required: false, reason: '用户标识用于个体级建模' },
    ],
    nextActionLabel: '打开统计分析',
    nextActionTarget: '/app/statistics',
  },
];

/* ------------------------------------------------------------------ */
/*  Field detection helpers                                           */
/* ------------------------------------------------------------------ */

const FIELD_PATTERNS: Record<string, string[]> = {
  time_column: ['date', 'dt', 'time', 'timestamp', 'event_time', 'created_at', 'updated_at', 'order_date', 'touch_time', 'day', 'month'],
  user_id: ['user_id', 'uid', 'customer_id', 'buyer_id', 'member_id', 'buyer_user_id'],
  event_name: ['event', 'event_name', 'action', 'page', 'page_name', 'screen', 'block_type'],
  group_column: ['group', 'variant', 'treatment', 'control', 'arm', 'bucket', '实验组', '对照组'],
  target_metric: ['revenue', 'gmv', 'sales', 'amount', 'converted', 'conversion', 'orders', 'ltv', 'value', 'price', 'quantity', 'score', 'rate'],
  text_column: ['review', 'comment', 'text', 'content', 'description', 'feedback', 'note', '备注'],
  dimension: ['category', 'brand', 'channel', 'region', 'city', 'platform', 'source', 'campaign', 'status', 'type', '标签'],
  feature: ['age', 'gender', 'region', 'city', 'channel', 'platform', 'device', 'os', 'version', '等级', 'score'],
  join_key: ['_id', 'id', 'key'],
};

function detectCandidateColumns(
  schema: Array<{ name: string; role?: string; semantic_type?: string }>,
  role: string
): string[] {
  const patterns = FIELD_PATTERNS[role] || [];
  const candidates: string[] = [];

  for (const col of schema) {
    const name = col.name.toLowerCase();
    // Name pattern match
    if (patterns.some((p) => name === p || name.endsWith('_' + p))) {
      candidates.push(col.name);
      continue;
    }
    // Role match
    if (col.role && patterns.some((p) => col.role === p || col.role?.endsWith('_' + p))) {
      candidates.push(col.name);
      continue;
    }
    // Generic _id match for join_key
    if (role === 'join_key' && name.endsWith('_id')) {
      candidates.push(col.name);
    }
  }

  return candidates;
}

/* ------------------------------------------------------------------ */
/*  Main planner                                                      */
/* ------------------------------------------------------------------ */

export interface PlannerInput {
  question: string;
  datasets: Array<{
    id: string;
    filename?: string;
    name?: string;
    schema?: Array<{ name: string; role?: string; semantic_type?: string }>;
  }>;
  confirmedRelationships?: TableRelationship[];
}

export function generateMockAnalysisPlan(input: PlannerInput): AssistantAnalysisPlan {
  const { question, datasets, confirmedRelationships } = input;
  const q = question.toLowerCase();

  // 1. Match keyword rule
  let matchedRule = KEYWORD_RULES.find((rule) =>
    rule.keywords.some((kw) => q.includes(kw.toLowerCase()))
  );

  // Default fallback
  if (!matchedRule) {
    matchedRule = {
      type: 'descriptive',
      keywords: [],
      label: '描述统计分析',
      requiredFieldRoles: [
        { role: 'target_metric', required: false, reason: '数值列可用于统计描述' },
        { role: 'dimension', required: false, reason: '维度列可用于分组统计' },
      ],
      nextActionLabel: '打开统计分析',
      nextActionTarget: '/app/statistics',
    };
  }

  // 2. Build required fields
  const requiredFields: AnalysisFieldRequirement[] = matchedRule.requiredFieldRoles.map(
    (req) => {
      const allCandidates = new Set<string>();
      for (const ds of datasets) {
        const schema = ds.schema || [];
        const cols = detectCandidateColumns(schema, req.role);
        cols.forEach((c) => allCandidates.add(c));
      }
      return {
        role: req.role,
        required: req.required,
        candidate_columns: Array.from(allCandidates),
        reason: req.reason,
      };
    }
  );

  // 3. Build assumptions
  const assumptions: string[] = [
    `根据关键词匹配，将问题识别为「${matchedRule.label}」`,
    `建议分析类型：${matchedRule.type}`,
  ];

  if (datasets.length > 0) {
    assumptions.push(`已选定 ${datasets.length} 个数据集作为分析输入`);
  }

  // 4. Build warnings
  const warnings: string[] = [];

  for (const field of requiredFields) {
    if (field.required && field.candidate_columns.length === 0) {
      warnings.push(`未在选定数据集中找到必需的「${field.role}」字段，可能导致分析无法运行`);
    }
  }

  if (datasets.length === 0) {
    warnings.push('未选择任何数据集，请在生成计划前先选择数据集');
  }

  // 5. Relationship awareness
  if (confirmedRelationships && confirmedRelationships.length > 0) {
    assumptions.push(`已使用 ${confirmedRelationships.length} 条你确认过的表关系作为分析规划依据`);
  } else if (datasets.length > 1) {
    warnings.push(
      '检测到可能需要跨表分析，但当前没有已确认的表关系。建议先使用「理清表关系」确认 join key'
    );
  }

  // 6. Next actions
  const nextActions: AssistantNextAction[] = [
    {
      type: 'navigate',
      label: matchedRule.nextActionLabel,
      target: matchedRule.nextActionTarget,
    },
    {
      type: 'explain',
      label: '查看字段详情',
    },
  ];

  if (warnings.length > 0) {
    nextActions.push({
      type: 'warning',
      label: '检查警告事项',
    });
  }

  return {
    id: `plan_${Date.now()}`,
    user_question: question,
    interpreted_goal: matchedRule.label,
    recommended_analysis_type: matchedRule.type,
    required_datasets: datasets.map((d) => d.filename || d.name || d.id),
    required_fields: requiredFields,
    required_relationships: confirmedRelationships,
    assumptions,
    warnings,
    next_actions: nextActions,
  };
}
