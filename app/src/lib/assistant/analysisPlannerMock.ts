/**
 * Rule-based mock analysis planner.
 *
 * Deterministic keyword matching. No LLM calls.
 * Relationship sets are treated as allowed context graphs; the user question
 * still decides the query-specific required dataset subset.
 */

import type {
  AssistantAnalysisPlan,
  RecommendedAnalysisType,
  AnalysisFieldRequirement,
  AssistantNextAction,
  RelationshipSet,
  RelationshipSetDatasetNode,
  TableRelationship,
} from '@/types/assistant';

type PlannerDataset = {
  id: string;
  filename?: string;
  name?: string;
  schema?: Array<{ name: string; role?: string; semantic_type?: string }>;
};

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
    keywords: ['预测', '趋势', '未来', 'forecast', 'trend', 'time series', 'sales'],
    label: '趋势预测分析',
    requiredFieldRoles: [
      { role: 'time_column', required: true, reason: '趋势预测需要时间字段' },
      { role: 'target_metric', required: true, reason: '趋势预测需要目标指标字段' },
    ],
    nextActionLabel: '打开预测分析',
    nextActionTarget: '/app/forecast',
  },
  {
    type: 'path_analysis',
    keywords: ['路径', '漏斗', '行为', 'journey', 'funnel', 'path', 'event'],
    label: '用户行为路径分析',
    requiredFieldRoles: [
      { role: 'user_id', required: true, reason: '路径分析需要用户标识字段' },
      { role: 'event_name', required: true, reason: '路径分析需要事件名称字段' },
      { role: 'time_column', required: false, reason: '时间字段有助于排序用户行为' },
    ],
    nextActionLabel: '打开路径分析',
    nextActionTarget: '/app/path',
  },
  {
    type: 'attribution',
    keywords: ['渠道', '转化', '归因', 'touchpoint', 'attribution', 'campaign', 'channel', 'conversion'],
    label: '渠道转化归因分析',
    requiredFieldRoles: [
      { role: 'user_id', required: true, reason: '归因分析需要用户标识字段' },
      { role: 'dimension', required: true, reason: '归因分析需要渠道或活动维度' },
      { role: 'target_metric', required: false, reason: '转化或订单指标可作为分析目标' },
      { role: 'time_column', required: false, reason: '时间字段有助于识别触点顺序' },
    ],
    nextActionLabel: '打开归因分析',
    nextActionTarget: '/app/attribution',
  },
  {
    type: 'ab_test',
    keywords: ['ab', 'a/b', '实验', '对照', 'treatment', 'control', 'variant'],
    label: 'A/B 实验分析',
    requiredFieldRoles: [
      { role: 'group_column', required: true, reason: '实验分析需要分组字段' },
      { role: 'target_metric', required: true, reason: '实验分析需要结果指标字段' },
      { role: 'user_id', required: false, reason: '用户标识可用于去重或分层' },
    ],
    nextActionLabel: '打开统计分析',
    nextActionTarget: '/app/statistics',
  },
  {
    type: 'semantic',
    keywords: ['评论', '语义', '文本', 'review', 'comment', 'sentiment', 'topic', 'semantic', 'text'],
    label: '评论文本语义分析',
    requiredFieldRoles: [
      { role: 'text_column', required: true, reason: '语义分析需要文本字段' },
    ],
    nextActionLabel: '打开语义分析',
    nextActionTarget: '/app/semantic',
  },
  {
    type: 'smart_process',
    keywords: ['清洗', '缺失', '异常', 'missing', 'null', 'outlier', 'clean'],
    label: '数据质量与清洗建议',
    requiredFieldRoles: [
      { role: 'target_metric', required: false, reason: '可结合指标字段检查异常或缺失' },
    ],
    nextActionLabel: '打开数据工作坊',
    nextActionTarget: '/app/data-workshop',
  },
  {
    type: 'regression',
    keywords: ['回归', 'ltv', '驱动因素', '影响因素', 'regression', 'drivers', 'retention', '留存'],
    label: '驱动因素 / 回归分析',
    requiredFieldRoles: [
      { role: 'target_metric', required: true, reason: '回归分析需要目标指标字段' },
      { role: 'feature', required: false, reason: '特征字段可作为解释变量' },
      { role: 'user_id', required: false, reason: '用户标识可用于用户级建模' },
    ],
    nextActionLabel: '打开统计分析',
    nextActionTarget: '/app/statistics',
  },
];

const FIELD_PATTERNS: Record<string, string[]> = {
  time_column: ['date', 'dt', 'time', 'timestamp', 'event_time', 'created_at', 'updated_at', 'order_date', 'touch_time', 'day', 'month'],
  user_id: ['user_id', 'uid', 'customer_id', 'buyer_id', 'member_id', 'buyer_user_id'],
  event_name: ['event', 'event_name', 'action', 'page', 'page_name', 'screen', 'block_type'],
  group_column: ['group', 'variant', 'treatment', 'control', 'arm', 'bucket'],
  target_metric: ['revenue', 'gmv', 'sales', 'amount', 'converted', 'conversion', 'orders', 'ltv', 'value', 'price', 'quantity', 'score', 'rate'],
  text_column: ['review', 'comment', 'text', 'content', 'description', 'feedback', 'note'],
  dimension: ['category', 'brand', 'channel', 'region', 'city', 'platform', 'source', 'campaign', 'status', 'type'],
  feature: ['age', 'gender', 'region', 'city', 'channel', 'platform', 'device', 'os', 'version', 'score'],
  join_key: ['_id', 'id', 'key'],
};

const QUESTION_DATASET_KEYWORDS: Array<{
  triggers: string[];
  datasetTokens: string[];
}> = [
  {
    triggers: ['路径', '漏斗', '行为', 'journey', 'funnel', 'path', 'event'],
    datasetTokens: ['event', 'path', 'log', 'traffic', 'touchpoint', 'user'],
  },
  {
    triggers: ['渠道', '转化', '归因', 'channel', 'conversion', 'attribution'],
    datasetTokens: ['marketing', 'touchpoint', 'attribution', 'order', 'conversion', 'user'],
  },
  {
    triggers: ['预测', '趋势', '未来', 'forecast', 'trend'],
    datasetTokens: ['daily', 'sales', 'forecast', 'time'],
  },
  {
    triggers: ['评论', '语义', '文本', 'review', 'semantic', 'text', 'sentiment'],
    datasetTokens: ['review', 'semantic', 'text', 'product'],
  },
  {
    triggers: ['用户', '画像', '留存', 'ltv', 'customer', 'retention'],
    datasetTokens: ['user', 'customer', 'ltv', 'order'],
  },
];

function detectCandidateColumns(
  schema: Array<{ name: string; role?: string; semantic_type?: string }>,
  role: string
): string[] {
  const patterns = FIELD_PATTERNS[role] || [];
  const candidates: string[] = [];

  for (const col of schema) {
    const name = col.name.toLowerCase();
    if (patterns.some((p) => name === p || name.endsWith('_' + p))) {
      candidates.push(col.name);
      continue;
    }
    if (col.role && patterns.some((p) => col.role === p || col.role?.endsWith('_' + p))) {
      candidates.push(col.name);
      continue;
    }
    if (role === 'join_key' && name.endsWith('_id')) {
      candidates.push(col.name);
    }
  }

  return candidates;
}

function getQuestionDatasetTokens(question: string): string[] {
  const q = question.toLowerCase();
  const tokens = new Set<string>();
  for (const rule of QUESTION_DATASET_KEYWORDS) {
    if (rule.triggers.some((trigger) => q.includes(trigger.toLowerCase()))) {
      rule.datasetTokens.forEach((token) => tokens.add(token));
    }
  }
  return Array.from(tokens);
}

function datasetSearchText(
  dataset: Pick<PlannerDataset, 'id' | 'filename' | 'name'> | RelationshipSetDatasetNode,
  fallback?: PlannerDataset
): string {
  if ('dataset_id' in dataset) {
    return [
      dataset.dataset_id,
      dataset.dataset_name,
      dataset.filename,
      fallback?.filename,
      fallback?.name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  return [dataset.id, dataset.filename, dataset.name].filter(Boolean).join(' ').toLowerCase();
}

function inferRelevantDatasetsForQuestion(
  question: string,
  datasets: PlannerDataset[]
): PlannerDataset[] {
  const q = question.toLowerCase();
  const tokens = getQuestionDatasetTokens(question);
  if (tokens.length > 0) {
    const matched = datasets.filter((dataset) => {
      const text = datasetSearchText(dataset);
      return tokens.some((token) => text.includes(token));
    });
    if (matched.length > 0) return matched;
  }

  return datasets.filter((dataset) => {
    const label = datasetSearchText(dataset);
    return label
      .split(/[\s._-]+/)
      .filter((part) => part.length >= 3)
      .some((part) => q.includes(part));
  });
}

export function inferRelevantDatasetNodesForQuestion(
  question: string,
  nodes: RelationshipSetDatasetNode[],
  datasets: PlannerDataset[]
): RelationshipSetDatasetNode[] {
  const includedNodes = nodes.filter((node) => node.included_in_context);
  const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  const q = question.toLowerCase();
  const tokens = getQuestionDatasetTokens(question);

  if (tokens.length > 0) {
    const matched = includedNodes.filter((node) => {
      const text = datasetSearchText(node, datasetById.get(node.dataset_id));
      return tokens.some((token) => text.includes(token));
    });
    if (matched.length > 0) return matched;
  }

  return includedNodes.filter((node) => {
    const text = datasetSearchText(node, datasetById.get(node.dataset_id));
    return text
      .split(/[\s._-]+/)
      .filter((part) => part.length >= 3)
      .some((part) => q.includes(part));
  });
}

export interface PlannerInput {
  question: string;
  datasets: PlannerDataset[];
  selectedDatasetId?: string;
  relationshipSet?: RelationshipSet;
  availableDatasetNodes?: RelationshipSetDatasetNode[];
  confirmedRelationships?: TableRelationship[];
}

export function generateMockAnalysisPlan(input: PlannerInput): AssistantAnalysisPlan {
  const {
    question,
    datasets,
    selectedDatasetId,
    relationshipSet,
    confirmedRelationships,
  } = input;
  const q = question.toLowerCase();

  const matchedRule =
    KEYWORD_RULES.find((rule) => rule.keywords.some((kw) => q.includes(kw.toLowerCase()))) ??
    ({
      type: 'descriptive',
      keywords: [],
      label: '描述统计分析',
      requiredFieldRoles: [
        { role: 'target_metric', required: false, reason: '数值列可用于统计描述' },
        { role: 'dimension', required: false, reason: '维度列可用于分组统计' },
      ],
      nextActionLabel: '打开统计分析',
      nextActionTarget: '/app/statistics',
    } satisfies KeywordRule);

  const activeNodes = input.availableDatasetNodes ?? relationshipSet?.dataset_nodes ?? [];
  const selectedDataset = selectedDatasetId
    ? datasets.find((dataset) => dataset.id === selectedDatasetId)
    : undefined;
  const relevantNodes =
    selectedDataset || !relationshipSet
      ? []
      : inferRelevantDatasetNodesForQuestion(question, activeNodes, datasets);
  const relevantNodeIds = new Set(relevantNodes.map((node) => node.dataset_id));

  let planningDatasets: PlannerDataset[] = [];
  if (selectedDataset) {
    planningDatasets = [selectedDataset];
  } else if (relationshipSet) {
    planningDatasets = datasets.filter((dataset) => relevantNodeIds.has(dataset.id));
  } else {
    planningDatasets = inferRelevantDatasetsForQuestion(question, datasets);
  }

  const planningDatasetIds = new Set(planningDatasets.map((dataset) => dataset.id));
  const scopedRelationships = (confirmedRelationships ?? []).filter((rel) => {
    if (planningDatasetIds.size === 0) return false;
    return (
      planningDatasetIds.has(rel.source_dataset_id) ||
      planningDatasetIds.has(rel.target_dataset_id)
    );
  });
  const referenceNodes = (
    selectedDataset
      ? activeNodes.filter((node) => node.dataset_id === selectedDataset.id)
      : relevantNodes
  ).filter(
    (node) =>
      node.included_in_context &&
      (node.role === 'isolated' || node.role === 'reference_only')
  );

  const requiredFields: AnalysisFieldRequirement[] = matchedRule.requiredFieldRoles.map((req) => {
    const allCandidates = new Set<string>();
    for (const ds of planningDatasets) {
      const schema = ds.schema || [];
      detectCandidateColumns(schema, req.role).forEach((col) => allCandidates.add(col));
    }
    return {
      role: req.role,
      required: req.required,
      candidate_columns: Array.from(allCandidates),
      reason: req.reason,
    };
  });

  const assumptions: string[] = [
    `根据关键词匹配，将问题识别为「${matchedRule.label}」`,
    `建议分析类型：${matchedRule.type}`,
  ];

  if (planningDatasets.length > 0) {
    assumptions.push(`本次计划将使用 ${planningDatasets.length} 个与问题相关的数据集`);
  }
  if (relationshipSet) {
    assumptions.push(
      `当前关系组「${relationshipSet.name}」仅作为允许的上下文图，不会自动 join 或强制使用全部表`
    );
  }
  if (scopedRelationships.length > 0) {
    assumptions.push(`已使用 ${scopedRelationships.length} 条当前关系组内的相关关系作为规划参考`);
  }

  const warnings: string[] = [];
  for (const field of requiredFields) {
    if (field.required && field.candidate_columns.length === 0) {
      warnings.push(`未在本次计划所需数据集中找到必需字段「${field.role}」，可能需要手动选择数据集或调整关系组`);
    }
  }
  if (relationshipSet && !selectedDataset && relevantNodes.length === 0) {
    warnings.push('当前关系组中没有明显匹配该问题的数据集，请选择更合适的关系组或手动选择数据集。');
  }
  if (!relationshipSet && !selectedDataset && planningDatasets.length === 0) {
    warnings.push('未能从问题中明确匹配数据集，请先选择一个数据集或关系组。');
  }
  if (planningDatasets.length > 1 && scopedRelationships.length === 0) {
    warnings.push('本次问题可能涉及多表分析，但当前没有匹配到可参考的已确认关系；不会自动 join。');
  }

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
    required_datasets: planningDatasets.map((d) => d.filename || d.name || d.id),
    required_fields: requiredFields,
    required_relationships: scopedRelationships,
    relationship_set_id: relationshipSet?.id,
    relationship_set_name: relationshipSet?.name,
    reference_dataset_nodes: referenceNodes,
    assumptions,
    warnings,
    next_actions: nextActions,
  };
}
