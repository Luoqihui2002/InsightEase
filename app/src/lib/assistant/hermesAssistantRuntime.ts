/**
 * Hermes planning runtime.
 *
 * The browser calls only the InsightEase backend. The backend owns provider
 * access, schema/context validation, and deterministic fallback.
 */

import { assistantApi } from '@/api/assistant';
import type { ApiResponse } from '@/types/api';
import type { AssistantAnalysisPlan } from '@/types/assistant';
import type { HermesPlanAnalysisResponse } from '@/types/hermes';
import type {
  AssistantRuntime,
  AssistantPlanRequest,
  AssistantPlanResponse,
} from './assistantRuntime';
import { buildBoundedPlanningContext } from './boundedPlanningContext';
import { ruleBasedAssistantRuntime } from './ruleBasedAssistantRuntime';

const HERMES_FALLBACK_WARNING = 'Hermes planning unavailable; used local deterministic planning.';

export const hermesAssistantRuntime: AssistantRuntime = {
  mode: 'hermes',

  async generateAnalysisPlan(request: AssistantPlanRequest): Promise<AssistantPlanResponse> {
    try {
      const response = await assistantApi.planAnalysisWithHermes({
        user_question: request.question,
        assistant_context: buildBoundedPlanningContext(request.context),
        safety: {
          allow_raw_data: false,
          allow_auto_run: false,
          allow_sql_generation: false,
          allow_dataset_mutation: false,
          require_user_confirmation_for_execution: true,
        },
      });

      const payload = unwrapApiData<HermesPlanAnalysisResponse>(response);
      if (!payload || !isAssistantAnalysisPlan(payload.plan)) {
        return fallbackToRuleBased(request, ['Hermes backend returned an invalid plan; used local deterministic planning.']);
      }

      const mergedWarnings = Array.from(
        new Set([...payload.plan.warnings, ...(payload.warnings ?? [])])
      );

      return {
        plan: { ...payload.plan, warnings: mergedWarnings },
        runtime_mode: 'hermes',
        warnings: payload.warnings ?? [],
      };
    } catch {
      return fallbackToRuleBased(request, [HERMES_FALLBACK_WARNING]);
    }
  },
};

async function fallbackToRuleBased(
  request: AssistantPlanRequest,
  warnings: string[]
): Promise<AssistantPlanResponse> {
  const fallback = await ruleBasedAssistantRuntime.generateAnalysisPlan(request);
  return {
    ...fallback,
    plan: {
      ...fallback.plan,
      warnings: Array.from(new Set([...warnings, ...fallback.plan.warnings])),
    },
    warnings: [...warnings, ...fallback.warnings],
  };
}

function unwrapApiData<T>(response: unknown): T | undefined {
  const maybeResponse = response as { data?: unknown };

  if (isApiResponse<T>(maybeResponse?.data)) {
    return maybeResponse.data.data;
  }

  if (isApiResponse<T>(response)) {
    return response.data;
  }

  return undefined;
}

function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'code' in value &&
      'message' in value &&
      'data' in value
  );
}

function isAssistantAnalysisPlan(value: unknown): value is AssistantAnalysisPlan {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AssistantAnalysisPlan>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.user_question === 'string' &&
    typeof candidate.interpreted_goal === 'string' &&
    isSupportedAnalysisType(candidate.recommended_analysis_type) &&
    Array.isArray(candidate.required_datasets) &&
    Array.isArray(candidate.required_dataset_ids) &&
    Array.isArray(candidate.candidate_dataset_ids) &&
    Array.isArray(candidate.candidate_datasets) &&
    Array.isArray(candidate.required_fields) &&
    Array.isArray(candidate.required_relationships) &&
    Array.isArray(candidate.metrics) &&
    Array.isArray(candidate.reference_dataset_ids) &&
    Array.isArray(candidate.assumptions) &&
    Array.isArray(candidate.warnings) &&
    Array.isArray(candidate.clarifying_questions) &&
    Array.isArray(candidate.next_actions) &&
    candidate.required_fields.every(isRequiredField) &&
    candidate.candidate_datasets.every(isCandidateDataset) &&
    candidate.required_relationships.every(isRelationshipRequirement) &&
    candidate.metrics.every(isMetricTarget) &&
    candidate.next_actions.every(isNextAction) &&
    (candidate.source === 'hermes_live' || candidate.source === 'deterministic_fallback') &&
    (candidate.confidence === 'low' || candidate.confidence === 'medium' || candidate.confidence === 'high') &&
    typeof candidate.fallback_used === 'boolean' &&
    (
      candidate.execution_readiness === 'ready_single_table' ||
      candidate.execution_readiness === 'needs_join' ||
      candidate.execution_readiness === 'needs_clarification' ||
      candidate.execution_readiness === 'unsupported'
    ) &&
    (
      candidate.next_action === 'review_plan' ||
      candidate.next_action === 'navigate_analysis' ||
      candidate.next_action === 'create_analysis_dataset' ||
      candidate.next_action === 'clarify'
    )
  );
}

function isRequiredField(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const field = value as Record<string, unknown>;
  return (
    typeof field.dataset_id === 'string' &&
    typeof field.role === 'string' &&
    typeof field.required === 'boolean' &&
    Array.isArray(field.candidate_columns) &&
    typeof field.reason === 'string'
  );
}

function isCandidateDataset(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const dataset = value as Record<string, unknown>;
  return (
    typeof dataset.dataset_id === 'string' &&
    Array.isArray(dataset.reasons) &&
    (dataset.confidence === 'low' || dataset.confidence === 'medium' || dataset.confidence === 'high')
  );
}

function isRelationshipRequirement(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const relationship = value as Record<string, unknown>;
  return (
    typeof relationship.source_dataset_id === 'string' &&
    typeof relationship.source_column === 'string' &&
    typeof relationship.target_dataset_id === 'string' &&
    typeof relationship.target_column === 'string' &&
    (relationship.status === 'confirmed' || relationship.status === 'requires_confirmation') &&
    typeof relationship.reason === 'string'
  );
}

function isMetricTarget(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const metric = value as Record<string, unknown>;
  return (
    typeof metric.name === 'string' &&
    typeof metric.dataset_id === 'string' &&
    typeof metric.description === 'string'
  );
}

function isNextAction(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const action = value as Record<string, unknown>;
  return (
    (action.type === 'navigate' ||
      action.type === 'confirm' ||
      action.type === 'explain' ||
      action.type === 'warning') &&
    typeof action.label === 'string'
  );
}

function isSupportedAnalysisType(value: unknown): value is AssistantAnalysisPlan['recommended_analysis_type'] {
  return [
    'descriptive',
    'data_overview',
    'attribution',
    'forecast',
    'path_analysis',
    'ab_test',
    'regression',
    'smart_process',
    'visualization',
  ].includes(value as AssistantAnalysisPlan['recommended_analysis_type']);
}
