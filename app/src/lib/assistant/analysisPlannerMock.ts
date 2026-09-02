/**
 * Rule-based analysis planner.
 *
 * Deterministic keyword matching only. No LLM calls.
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
import type {
  DatasetAnalysisTag,
  DatasetBusinessCategory,
  DatasetCatalogMetadata,
  DatasetDataType,
} from '@/types/datasetCatalog';
import { inferDatasetCatalogMetadata } from '@/lib/datasetCatalog';

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

export interface AnalysisIntent {
  analysis_type: RecommendedAnalysisType;
  preferred_business_categories: DatasetBusinessCategory[];
  preferred_data_types: DatasetDataType[];
  preferred_analysis_tags: DatasetAnalysisTag[];
  descriptive_like: boolean;
  dataset_tokens: string[];
}

export interface RankedDatasetCandidate {
  dataset_id: string;
  score: number;
  reasons: string[];
  confidence: 'low' | 'medium' | 'high';
}

const DESCRIPTIVE_RULE: KeywordRule = {
  type: 'descriptive',
  keywords: [],
  label: '描述性统计分析',
  requiredFieldRoles: [
    { role: 'target_metric', required: false, reason: '可选择一个数值指标做汇总、分布或对比。' },
    { role: 'dimension', required: false, reason: '可选择分类维度做分组统计。' },
  ],
  nextActionLabel: '进入统计分析',
  nextActionTarget: '/app/statistics',
};

const KEYWORD_RULES: KeywordRule[] = [
  {
    type: 'data_overview',
    keywords: ['数据概览', '字段概览', '字段类型', '数据结构', 'schema', 'column profile', 'data overview'],
    label: '数据概览与字段统计',
    requiredFieldRoles: [],
    nextActionLabel: '进入数据概览',
    nextActionTarget: '/app/data-overview',
  },
  {
    type: 'forecast',
    keywords: ['预测', '趋势', '未来', 'forecast', 'trend', 'time series', 'sales'],
    label: '预测趋势分析',
    requiredFieldRoles: [
      { role: 'time_column', required: true, reason: '预测分析需要时间列。' },
      { role: 'target_metric', required: true, reason: '预测分析需要目标指标。' },
    ],
    nextActionLabel: '进入预测分析',
    nextActionTarget: '/app/forecast',
  },
  {
    type: 'path_analysis',
    keywords: ['路径', '漏斗', '行为', '点击', '曝光', '访问', '转化路径', 'journey', 'funnel', 'path', 'event'],
    label: '用户行为路径分析',
    requiredFieldRoles: [
      { role: 'user_id', required: true, reason: '路径分析需要用户或访客标识。' },
      { role: 'event_name', required: true, reason: '路径分析需要事件名称。' },
      { role: 'time_column', required: false, reason: '时间列可用于排序用户事件序列。' },
    ],
    nextActionLabel: '进入路径分析',
    nextActionTarget: '/app/path',
  },
  {
    type: 'attribution',
    keywords: ['归因', '渠道', '触点', '转化率', 'contribution', 'attribution', 'channel', 'conversion', 'campaign'],
    label: '渠道转化归因分析',
    requiredFieldRoles: [
      { role: 'user_id', required: true, reason: '归因分析通常需要用户或访客标识。' },
      { role: 'dimension', required: true, reason: '归因分析需要渠道、活动或来源维度。' },
      { role: 'target_metric', required: false, reason: '可选择转化、订单或收入指标作为目标。' },
      { role: 'time_column', required: false, reason: '时间列可用于构建触点顺序。' },
    ],
    nextActionLabel: '进入归因分析',
    nextActionTarget: '/app/attribution',
  },
  {
    type: 'ab_test',
    keywords: ['ab', 'a/b', '实验', 'treatment', 'control', 'variant', 'lift'],
    label: 'A/B 实验分析',
    requiredFieldRoles: [
      { role: 'group_column', required: true, reason: 'A/B 分析需要实验组或变体列。' },
      { role: 'target_metric', required: true, reason: 'A/B 分析需要评估指标。' },
      { role: 'user_id', required: false, reason: '用户标识可用于去重和样本检查。' },
    ],
    nextActionLabel: '进入统计分析',
    nextActionTarget: '/app/statistics',
  },
  {
    type: 'smart_process',
    keywords: ['缺失', '异常', '分布', 'quality', 'missing', 'null', 'outlier', 'clean'],
    label: '数据质量检查',
    requiredFieldRoles: [
      { role: 'target_metric', required: false, reason: '可选择重点指标做缺失、异常或分布检查。' },
    ],
    nextActionLabel: '进入数据处理',
    nextActionTarget: '/app/data-workshop',
  },
  {
    type: 'regression',
    keywords: ['回归', '影响因素', '驱动因素', 'ltv', 'regression', 'drivers', 'retention'],
    label: '回归/驱动因素分析',
    requiredFieldRoles: [
      { role: 'target_metric', required: true, reason: '回归分析需要目标指标。' },
      { role: 'feature', required: false, reason: '可选择用户、渠道、商品或行为特征作为解释变量。' },
      { role: 'user_id', required: false, reason: '用户标识可用于样本级建模。' },
    ],
    nextActionLabel: '进入统计分析',
    nextActionTarget: '/app/statistics',
  },
];

const FIELD_PATTERNS: Record<string, string[]> = {
  time_column: ['date', 'dt', 'time', 'timestamp', 'event_time', 'created_at', 'updated_at', 'order_date', 'touch_time', 'day', 'month'],
  user_id: ['user_id', 'uid', 'customer_id', 'buyer_id', 'member_id', 'visitor_id', 'distinct_id'],
  event_name: ['event', 'event_name', 'action', 'page', 'page_name', 'screen', 'block_type'],
  group_column: ['group', 'variant', 'treatment', 'control', 'arm', 'bucket'],
  target_metric: ['revenue', 'gmv', 'sales', 'amount', 'converted', 'conversion', 'orders', 'ltv', 'value', 'price', 'quantity', 'score', 'rate', 'metric'],
  dimension: ['category', 'brand', 'channel', 'region', 'city', 'platform', 'source', 'campaign', 'status', 'type'],
  feature: ['age', 'gender', 'region', 'city', 'channel', 'platform', 'device', 'os', 'version', 'score'],
  join_key: ['_id', 'id', 'key'],
};

const INTENT_CATALOG_MAP: Record<RecommendedAnalysisType, Omit<AnalysisIntent, 'analysis_type' | 'descriptive_like' | 'dataset_tokens'>> = {
  path_analysis: {
    preferred_business_categories: ['traffic', 'marketing'],
    preferred_data_types: ['event_log'],
    preferred_analysis_tags: ['path_analysis'],
  },
  forecast: {
    preferred_business_categories: ['forecast', 'order'],
    preferred_data_types: ['time_series', 'metrics_table'],
    preferred_analysis_tags: ['forecast'],
  },
  attribution: {
    preferred_business_categories: ['marketing', 'order', 'traffic'],
    preferred_data_types: ['fact_table', 'event_log', 'metrics_table'],
    preferred_analysis_tags: ['attribution'],
  },
  ab_test: {
    preferred_business_categories: ['experiment'],
    preferred_data_types: ['experiment_table'],
    preferred_analysis_tags: ['ab_test'],
  },
  data_overview: {
    preferred_business_categories: [],
    preferred_data_types: [],
    preferred_analysis_tags: ['descriptive', 'data_quality'],
  },
  regression: {
    preferred_business_categories: ['user', 'order', 'forecast'],
    preferred_data_types: ['fact_table', 'metrics_table', 'dimension_table'],
    preferred_analysis_tags: ['regression'],
  },
  smart_process: {
    preferred_business_categories: ['quality'],
    preferred_data_types: [],
    preferred_analysis_tags: ['data_quality'],
  },
  descriptive: {
    preferred_business_categories: [],
    preferred_data_types: [],
    preferred_analysis_tags: ['descriptive', 'data_quality'],
  },
  custom_query: {
    preferred_business_categories: [],
    preferred_data_types: [],
    preferred_analysis_tags: [],
  },
};

const INTENT_DATASET_TOKENS: Record<RecommendedAnalysisType, string[]> = {
  path_analysis: ['event', 'path', 'log', 'traffic', 'click', 'exposure', 'session', 'behavior'],
  forecast: ['daily', 'sales', 'forecast', 'time', 'trend', 'metric'],
  attribution: ['marketing', 'touchpoint', 'attribution', 'channel', 'campaign', 'order', 'conversion'],
  ab_test: ['experiment', 'ab', 'variant', 'treatment', 'control', 'group'],
  data_overview: ['overview', 'schema', 'column', 'field', 'quality'],
  regression: ['user', 'customer', 'ltv', 'order', 'metric', 'feature'],
  smart_process: ['quality', 'missing', 'null', 'anomaly', 'outlier'],
  descriptive: [],
  custom_query: [],
};

function detectCandidateColumns(
  schema: Array<{ name: string; role?: string; semantic_type?: string }>,
  role: string
): string[] {
  const patterns = FIELD_PATTERNS[role] || [];
  const candidates: string[] = [];

  for (const col of schema) {
    const name = col.name.toLowerCase();
    if (patterns.some((p) => name === p || name.includes(p) || name.endsWith('_' + p))) {
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

function findMatchedRule(question: string): KeywordRule {
  const q = question.toLowerCase();
  return (
    KEYWORD_RULES.find((rule) => rule.keywords.some((kw) => q.includes(kw.toLowerCase()))) ??
    DESCRIPTIVE_RULE
  );
}

export function inferAnalysisIntentFromQuestion(question: string): AnalysisIntent {
  const rule = findMatchedRule(question);
  const base = INTENT_CATALOG_MAP[rule.type] ?? INTENT_CATALOG_MAP.custom_query;
  return {
    analysis_type: rule.type,
    preferred_business_categories: base.preferred_business_categories,
    preferred_data_types: base.preferred_data_types,
    preferred_analysis_tags: base.preferred_analysis_tags,
    descriptive_like: rule.type === 'descriptive' || rule.type === 'data_overview',
    dataset_tokens: INTENT_DATASET_TOKENS[rule.type] ?? [],
  };
}

function datasetDisplayName(dataset?: PlannerDataset, datasetId?: string): string {
  return dataset?.filename || dataset?.name || datasetId || '';
}

function datasetSearchText(
  dataset: Pick<PlannerDataset, 'id' | 'filename' | 'name' | 'schema'> | RelationshipSetDatasetNode,
  fallback?: PlannerDataset
): string {
  if ('dataset_id' in dataset) {
    return [
      dataset.dataset_id,
      dataset.dataset_name,
      dataset.filename,
      fallback?.filename,
      fallback?.name,
      ...(fallback?.schema ?? []).map((field) => field.name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }
  return [
    dataset.id,
    dataset.filename,
    dataset.name,
    ...(dataset.schema ?? []).map((field) => field.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function nameKeywordScore(
  question: string,
  dataset: PlannerDataset,
  intent: AnalysisIntent
): { score: number; reasons: string[] } {
  const q = question.toLowerCase();
  const text = datasetSearchText(dataset);
  const reasons: string[] = [];
  let score = 0;

  const tokenMatches = intent.dataset_tokens.filter((token) => text.includes(token));
  if (tokenMatches.length > 0) {
    score += Math.min(24, tokenMatches.length * 8);
    reasons.push(`名称/字段命中: ${tokenMatches.slice(0, 4).join(', ')}`);
  }

  const labelParts = [dataset.filename, dataset.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .split(/[\s._-]+/)
    .filter((part) => part.length >= 3);
  const directMatches = labelParts.filter((part) => q.includes(part));
  if (directMatches.length > 0) {
    score += Math.min(18, directMatches.length * 6);
    reasons.push(`问题直接提到: ${directMatches.slice(0, 3).join(', ')}`);
  }

  return { score, reasons };
}

function getCatalogForDataset(
  dataset: PlannerDataset,
  catalogById: Map<string, DatasetCatalogMetadata>
): DatasetCatalogMetadata {
  return catalogById.get(dataset.id) ?? inferDatasetCatalogMetadata(dataset);
}

export function rankDatasetsForQuestion(
  question: string,
  datasets: PlannerDataset[],
  catalog: DatasetCatalogMetadata[] = [],
  options: {
    selectedDatasetId?: string;
    activeRelationshipSetDatasetIds?: string[];
  } = {}
): RankedDatasetCandidate[] {
  const intent = inferAnalysisIntentFromQuestion(question);
  const catalogById = new Map(catalog.map((item) => [item.dataset_id, item]));
  const activeIds = new Set(options.activeRelationshipSetDatasetIds ?? []);

  return datasets
    .map((dataset) => {
      const metadata = getCatalogForDataset(dataset, catalogById);
      const reasons: string[] = [];
      let score = 0;
      let querySpecificSignal = false;

      if (options.selectedDatasetId && dataset.id === options.selectedDatasetId) {
        score += 140;
        querySpecificSignal = true;
        reasons.push('当前选中的数据集');
      }

      if (activeIds.has(dataset.id)) {
        score += 24;
        reasons.push('位于当前关系组允许图中');
      }

      if (!intent.descriptive_like) {
        const tagMatches = metadata.analysis_tags.filter((tag) =>
          intent.preferred_analysis_tags.includes(tag)
        );
        if (tagMatches.length > 0) {
          score += tagMatches.length * 35;
          querySpecificSignal = true;
          reasons.push(`分析用途匹配: ${tagMatches.join(', ')}`);
        }
      }

      if (
        intent.preferred_business_categories.length > 0 &&
        intent.preferred_business_categories.includes(metadata.business_category)
      ) {
        score += 20;
        querySpecificSignal = true;
        reasons.push(`业务主题匹配: ${metadata.business_category}`);
      }

      if (
        intent.preferred_data_types.length > 0 &&
        intent.preferred_data_types.includes(metadata.data_type)
      ) {
        score += 22;
        querySpecificSignal = true;
        reasons.push(`数据类型匹配: ${metadata.data_type}`);
      }

      const keywordMatch = nameKeywordScore(question, dataset, intent);
      if (keywordMatch.score > 0) {
        score += keywordMatch.score;
        querySpecificSignal = true;
        reasons.push(...keywordMatch.reasons);
      }

      if (metadata.confidence === 'high') score += 8;
      if (metadata.confidence === 'medium') score += 4;
      if (metadata.business_category === 'unknown' && metadata.data_type === 'unknown') {
        reasons.push('目录分类信号较少');
      }

      const confidence: RankedDatasetCandidate['confidence'] =
        options.selectedDatasetId && dataset.id === options.selectedDatasetId
          ? 'high'
          : score >= 55 && querySpecificSignal
          ? 'high'
          : score >= 25
          ? 'medium'
          : 'low';

      return {
        dataset_id: dataset.id,
        score,
        reasons: reasons.length > 0 ? reasons : ['低置信度目录候选'],
        confidence,
      };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.dataset_id.localeCompare(b.dataset_id));
}

function activeRelationshipSetDatasetIds(nodes: RelationshipSetDatasetNode[]): string[] {
  return nodes
    .filter((node) => node.included_in_context)
    .map((node) => node.dataset_id);
}

export function inferRelevantDatasetNodesForQuestion(
  question: string,
  nodes: RelationshipSetDatasetNode[],
  datasets: PlannerDataset[]
): RelationshipSetDatasetNode[] {
  const activeIds = activeRelationshipSetDatasetIds(nodes);
  const ranked = rankDatasetsForQuestion(question, datasets, [], {
    activeRelationshipSetDatasetIds: activeIds,
  });
  const highIds = new Set(
    ranked
      .filter((candidate) => candidate.confidence === 'high')
      .map((candidate) => candidate.dataset_id)
  );
  return nodes.filter((node) => node.included_in_context && highIds.has(node.dataset_id));
}

export interface PlannerInput {
  question: string;
  datasets: PlannerDataset[];
  selectedDatasetId?: string;
  relationshipSet?: RelationshipSet;
  availableDatasetNodes?: RelationshipSetDatasetNode[];
  confirmedRelationships?: TableRelationship[];
  datasetCatalog?: DatasetCatalogMetadata[];
}

function buildCandidatePlanItems(
  ranked: RankedDatasetCandidate[],
  datasets: PlannerDataset[],
  requiredIds: Set<string>
): AssistantAnalysisPlan['candidate_datasets'] {
  const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  return ranked
    .filter((candidate) => !requiredIds.has(candidate.dataset_id))
    .slice(0, 3)
    .map((candidate) => ({
      dataset_id: candidate.dataset_id,
      dataset_name: datasetDisplayName(datasetById.get(candidate.dataset_id), candidate.dataset_id),
      reasons: candidate.reasons,
      confidence: candidate.confidence,
    }));
}

function formatCandidateNames(
  ranked: RankedDatasetCandidate[],
  datasets: PlannerDataset[],
  limit = 3
): string {
  const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  return ranked
    .slice(0, limit)
    .map((candidate) => datasetDisplayName(datasetById.get(candidate.dataset_id), candidate.dataset_id))
    .filter(Boolean)
    .join('、');
}

function hasQuerySpecificCandidateReason(candidate?: RankedDatasetCandidate): boolean {
  if (!candidate) return false;
  return candidate.reasons.some((reason) =>
    [
      '分析用途匹配',
      '业务主题匹配',
      '数据类型匹配',
      '名称/字段命中',
      '问题直接提到',
    ].some((signal) => reason.includes(signal))
  );
}

export function generateMockAnalysisPlan(input: PlannerInput): AssistantAnalysisPlan {
  const {
    question,
    datasets,
    selectedDatasetId,
    relationshipSet,
    confirmedRelationships,
    datasetCatalog = [],
  } = input;

  const matchedRule = findMatchedRule(question);
  const intent = inferAnalysisIntentFromQuestion(question);
  const activeNodes = input.availableDatasetNodes ?? relationshipSet?.dataset_nodes ?? [];
  const activeDatasetIds = activeRelationshipSetDatasetIds(activeNodes);
  const activeDatasetIdSet = new Set(activeDatasetIds);
  const selectedDataset = selectedDatasetId
    ? datasets.find((dataset) => dataset.id === selectedDatasetId)
    : undefined;

  const rankedAll = rankDatasetsForQuestion(question, datasets, datasetCatalog, {
    selectedDatasetId,
    activeRelationshipSetDatasetIds: activeDatasetIds,
  });

  let rankedForScope = rankedAll;
  if (relationshipSet && !selectedDataset) {
    rankedForScope = rankedAll.filter((candidate) => activeDatasetIdSet.has(candidate.dataset_id));
  }

  let planningDatasets: PlannerDataset[] = [];
  if (selectedDataset) {
    planningDatasets = [selectedDataset];
  } else if (relationshipSet) {
    const requiredIds = new Set(
      rankedForScope
        .filter((candidate) => candidate.confidence === 'high')
        .slice(0, 3)
        .map((candidate) => candidate.dataset_id)
    );
    planningDatasets = datasets.filter((dataset) => requiredIds.has(dataset.id));
  } else if (!intent.descriptive_like) {
    const requiredIds = new Set(
      rankedForScope
        .filter((candidate) => candidate.confidence === 'high')
        .slice(0, 3)
        .map((candidate) => candidate.dataset_id)
    );
    planningDatasets = datasets.filter((dataset) => requiredIds.has(dataset.id));
  }

  const planningDatasetIds = new Set(planningDatasets.map((dataset) => dataset.id));
  const scopedRelationships = (confirmedRelationships ?? []).filter((rel) => {
    if (planningDatasetIds.size === 0) return false;
    return (
      planningDatasetIds.has(rel.source_dataset_id) ||
      planningDatasetIds.has(rel.target_dataset_id)
    );
  });

  const referenceNodes = activeNodes.filter(
    (node) =>
      node.included_in_context &&
      planningDatasetIds.has(node.dataset_id) &&
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
    `按问题意图识别为：${matchedRule.label}`,
    `推荐分析类型：${matchedRule.type}`,
  ];

  if (selectedDataset) {
    assumptions.push('已优先使用当前选中的数据集。');
  } else if (relationshipSet) {
    assumptions.push(`当前关系组「${relationshipSet.name}」作为允许图使用，必需数据集只取问题相关子集。`);
  } else {
    assumptions.push('已使用前端 Dataset Catalog 的确定性元数据做候选 narrowing。');
  }

  if (planningDatasets.length > 0) {
    assumptions.push(`本计划仅把 ${planningDatasets.length} 个高置信数据集列为必需输入。`);
  }
  if (scopedRelationships.length > 0) {
    assumptions.push(`检测到 ${scopedRelationships.length} 条已确认关系可作为上下文参考，仍需用户确认后执行。`);
  }

  const warnings: string[] = [];
  for (const field of requiredFields) {
    if (field.required && field.candidate_columns.length === 0) {
      warnings.push(`必需字段 ${field.role} 未在候选数据集中明显命中，请进入分析页后手动确认字段。`);
    }
  }

  if (selectedDataset && !intent.descriptive_like) {
    const selectedCandidate = rankedAll.find((candidate) => candidate.dataset_id === selectedDataset.id);
    if (!hasQuerySpecificCandidateReason(selectedCandidate)) {
      warnings.push(
        '当前选中的数据集已按优先级作为本次计划输入，但目录信号与问题意图不强；请确认是否需要切换到候选数据集。'
      );
    }
  }

  if (relationshipSet && !selectedDataset && planningDatasets.length === 0) {
    warnings.push('当前关系组中没有明显匹配该问题的数据集，请手动选择数据集或更换关系组。');
  }

  if (!relationshipSet && !selectedDataset && intent.descriptive_like) {
    const candidateNames = formatCandidateNames(rankedForScope, datasets);
    warnings.push(
      candidateNames
        ? `描述性统计需要先确认单个数据集；目录候选包括：${candidateNames}。`
        : '描述性统计需要先选择一个数据集，不能把全部数据集都作为必需输入。'
    );
  }

  if (!relationshipSet && !selectedDataset && !intent.descriptive_like && planningDatasets.length === 0) {
    const candidateNames = formatCandidateNames(rankedForScope, datasets);
    warnings.push(
      candidateNames
        ? `基于数据集目录，可能相关的数据集包括：${candidateNames}。请确认后再进入分析。`
        : '未找到高置信目录候选，请先选择一个数据集或补充问题中的业务主题。'
    );
  }

  if (planningDatasets.length > 1 && scopedRelationships.length === 0) {
    warnings.push('多个数据集被列为候选输入，但当前没有可用的已确认关系；执行前请确认是否需要关联。');
  }

  const candidateDatasets = buildCandidatePlanItems(
    rankedForScope,
    datasets,
    planningDatasetIds
  );

  const nextActions: AssistantNextAction[] = [];

  if (planningDatasets.length > 0) {
    nextActions.push({
      type: 'navigate',
      label: matchedRule.nextActionLabel,
      target: matchedRule.nextActionTarget,
    });
  } else {
    nextActions.push({
      type: 'warning',
      label: '先确认所需数据集',
    });
  }

  nextActions.push({
    type: 'explain',
    label: '解释字段选择',
  });

  if (warnings.length > 0 && planningDatasets.length > 0) {
    nextActions.push({
      type: 'warning',
      label: '先确认数据集和字段',
    });
  }

  return {
    id: `plan_${Date.now()}`,
    user_question: question,
    interpreted_goal: matchedRule.label,
    recommended_analysis_type: matchedRule.type,
    required_datasets: planningDatasets.map((d) => datasetDisplayName(d, d.id)),
    required_dataset_ids: planningDatasets.map((d) => d.id),
    candidate_datasets: candidateDatasets,
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
