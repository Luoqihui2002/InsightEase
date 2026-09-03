import type {
  AssistantAnalysisPlan,
  RecommendedAnalysisType,
  RelationshipSet,
  TableRelationship,
} from '@/types/assistant';
import type { Dataset } from '@/types/api';
import type {
  ConfirmedJoinRelationship,
  JoinPlan,
  JoinStep,
  JoinType,
} from '@/types/join';

export interface JoinPlanBuildResult {
  joinPlan?: JoinPlan;
  error?: string;
}

const RISK_RANK = { low: 0, medium: 1, high: 2 } as const;

export const ANALYSIS_ROUTES: Record<RecommendedAnalysisType, string> = {
  descriptive: '/app/statistics',
  data_overview: '/app/data-overview',
  attribution: '/app/attribution',
  forecast: '/app/forecast',
  path_analysis: '/app/path',
  ab_test: '/app/statistics',
  regression: '/app/statistics',
  smart_process: '/app/data-workshop',
  visualization: '/app/visualization',
};

function isSameEdge(
  requirement: AssistantAnalysisPlan['required_relationships'][number],
  relationship: TableRelationship,
): boolean {
  if (requirement.relationship_id && requirement.relationship_id !== relationship.id) return false;
  const direct =
    requirement.source_dataset_id === relationship.source_dataset_id &&
    requirement.source_column === relationship.source_column &&
    requirement.target_dataset_id === relationship.target_dataset_id &&
    requirement.target_column === relationship.target_column;
  const reverse =
    requirement.source_dataset_id === relationship.target_dataset_id &&
    requirement.source_column === relationship.target_column &&
    requirement.target_dataset_id === relationship.source_dataset_id &&
    requirement.target_column === relationship.source_column;
  return direct || reverse;
}

function confirmedSnapshot(relationship: TableRelationship): ConfirmedJoinRelationship {
  return {
    id: relationship.id,
    source_dataset_id: relationship.source_dataset_id,
    source_field: relationship.source_column,
    target_dataset_id: relationship.target_dataset_id,
    target_field: relationship.target_column,
    status: 'confirmed',
    expected_cardinality: relationship.relationship_type,
    risk_level: relationship.risk_level ?? 'low',
  };
}

function selectedFieldsForPlan(
  plan: AssistantAnalysisPlan,
  datasets: Dataset[],
  relationships: TableRelationship[],
): Record<string, string[]> {
  const availableColumns = new Map(
    datasets.map((dataset) => [dataset.id, new Set(dataset.schema.map((field) => field.name))]),
  );
  const selected = Object.fromEntries(
    plan.required_dataset_ids.map((datasetId) => [datasetId, [] as string[]]),
  );
  const add = (datasetId: string, column?: string) => {
    if (!column || !selected[datasetId] || !availableColumns.get(datasetId)?.has(column)) return;
    if (!selected[datasetId].includes(column)) selected[datasetId].push(column);
  };

  for (const field of plan.required_fields) {
    add(field.dataset_id, field.candidate_columns.find((column) =>
      availableColumns.get(field.dataset_id)?.has(column),
    ));
  }
  for (const metric of plan.metrics) add(metric.dataset_id, metric.field);
  for (const relationship of relationships) {
    add(relationship.source_dataset_id, relationship.source_column);
    add(relationship.target_dataset_id, relationship.target_column);
  }
  return selected;
}

function orientStep(
  relationship: TableRelationship,
  joined: Set<string>,
  joinType: JoinType,
): JoinStep | null {
  if (joined.has(relationship.source_dataset_id) && !joined.has(relationship.target_dataset_id)) {
    return {
      left_dataset_id: relationship.source_dataset_id,
      right_dataset_id: relationship.target_dataset_id,
      left_field: relationship.source_column,
      right_field: relationship.target_column,
      join_type: joinType,
      relationship_id: relationship.id,
      relationship_status: 'confirmed',
      expected_cardinality: relationship.relationship_type,
    };
  }
  if (joined.has(relationship.target_dataset_id) && !joined.has(relationship.source_dataset_id)) {
    return {
      left_dataset_id: relationship.target_dataset_id,
      right_dataset_id: relationship.source_dataset_id,
      left_field: relationship.target_column,
      right_field: relationship.source_column,
      join_type: joinType,
      relationship_id: relationship.id,
      relationship_status: 'confirmed',
      expected_cardinality:
        relationship.relationship_type === 'one_to_many'
          ? 'many_to_one'
          : relationship.relationship_type === 'many_to_one'
            ? 'one_to_many'
            : relationship.relationship_type,
    };
  }
  return null;
}

export function buildJoinPlan(
  analysisPlan: AssistantAnalysisPlan,
  relationshipSet: RelationshipSet | undefined,
  datasets: Dataset[],
  joinTypes: Record<string, JoinType> = {},
): JoinPlanBuildResult {
  if (analysisPlan.execution_readiness !== 'needs_join') {
    return { error: '当前分析计划不需要创建多表数据集。' };
  }
  if (analysisPlan.required_dataset_ids.length < 2 || analysisPlan.required_dataset_ids.length > 3) {
    return { error: 'V1 仅支持由 2–3 个源数据集创建分析数据集。' };
  }
  if (!relationshipSet || relationshipSet.id !== analysisPlan.relationship_set_id) {
    return { error: '请切换回生成该计划时使用的 Relationship Set。' };
  }
  const requiredIds = new Set(analysisPlan.required_dataset_ids);
  if (datasets.filter((dataset) => requiredIds.has(dataset.id)).length !== requiredIds.size) {
    return { error: '计划中的一个或多个源数据集当前不可用。' };
  }
  if (analysisPlan.required_relationships.some((relationship) => relationship.status !== 'confirmed')) {
    return { error: '计划仍包含未确认关系，请先完成关系确认。' };
  }

  const relationships: TableRelationship[] = [];
  for (const requirement of analysisPlan.required_relationships) {
    const matches = relationshipSet.relationships.filter((relationship) =>
      relationship.status === 'confirmed' && isSameEdge(requirement, relationship),
    );
    if (matches.length !== 1) {
      return { error: '计划关系与当前已确认关系快照不一致，请重新生成分析计划。' };
    }
    const relationship = matches[0];
    if (!requiredIds.has(relationship.source_dataset_id) || !requiredIds.has(relationship.target_dataset_id)) {
      continue;
    }
    relationships.push(relationship);
  }

  const baseDatasetId = analysisPlan.required_dataset_ids[0];
  const joined = new Set([baseDatasetId]);
  const remaining = [...relationships];
  const joinSteps: JoinStep[] = [];
  while (joined.size < requiredIds.size) {
    const candidates = remaining
      .map((relationship) => ({
        relationship,
        step: orientStep(relationship, joined, joinTypes[relationship.id] ?? 'left'),
      }))
      .filter((candidate): candidate is { relationship: TableRelationship; step: JoinStep } =>
        candidate.step !== null,
      )
      .sort((a, b) =>
        RISK_RANK[a.relationship.risk_level ?? 'low'] - RISK_RANK[b.relationship.risk_level ?? 'low'] ||
        a.relationship.id.localeCompare(b.relationship.id),
      );
    if (candidates.length === 0) {
      return { error: '已确认关系无法连接计划中的全部数据集。' };
    }
    if (
      candidates.length > 1 &&
      (candidates[0].relationship.risk_level ?? 'low') ===
        (candidates[1].relationship.risk_level ?? 'low')
    ) {
      return { error: '存在多个同风险 Join 顺序，无法安全唯一确定，请缩小计划或调整关系。' };
    }
    const chosen = candidates[0];
    joinSteps.push(chosen.step);
    joined.add(chosen.step.right_dataset_id);
    remaining.splice(remaining.findIndex((relationship) => relationship.id === chosen.relationship.id), 1);
  }

  const usedRelationshipIds = new Set(joinSteps.map((step) => step.relationship_id));
  const usedRelationships = relationships.filter((relationship) => usedRelationshipIds.has(relationship.id));
  return {
    joinPlan: {
      id: `join_${analysisPlan.id}`,
      source_analysis_plan_id: analysisPlan.id,
      relationship_set_id: relationshipSet.id,
      base_dataset_id: baseDatasetId,
      included_dataset_ids: [...analysisPlan.required_dataset_ids],
      join_steps: joinSteps,
      confirmed_relationships: usedRelationships.map(confirmedSnapshot),
      selected_fields: selectedFieldsForPlan(analysisPlan, datasets, usedRelationships),
      output_columns: [],
      warnings: [...analysisPlan.warnings],
      requires_confirmation: true,
    },
  };
}
