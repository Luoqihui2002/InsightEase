/**
 * HermesAssistantRuntime dry-run mode.
 *
 * This runtime is opt-in only via:
 *   VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run
 *
 * It calls backend dry-run endpoints only. It does not call live Hermes,
 * LLMs, SQL generation, analysis execution, joins, or dataset mutation.
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
import { ruleBasedAssistantRuntime } from './ruleBasedAssistantRuntime';

const HERMES_FALLBACK_WARNING = 'Hermes dry-run unavailable; used local rule-based planner.';

export const hermesAssistantRuntime: AssistantRuntime = {
  mode: 'hermes',

  async generateAnalysisPlan(request: AssistantPlanRequest): Promise<AssistantPlanResponse> {
    try {
      const response = await assistantApi.planAnalysisWithHermesDryRun({
        user_question: request.question,
        assistant_context: {
          selected_dataset_ids: request.context.selected_dataset_ids,
          selected_dataset_id: request.context.selected_dataset_id,
          datasets: request.context.datasets,
          dataset_catalog: request.context.dataset_catalog,
          relationship_set: request.context.relationship_set
            ? {
                id: request.context.relationship_set.id,
                name: request.context.relationship_set.name,
                dataset_nodes: request.context.relationship_set.dataset_nodes.map((node) => ({
                  dataset_id: node.dataset_id,
                  dataset_name: node.dataset_name ?? node.filename,
                  role: node.role === 'excluded' ? 'reference_only' : node.role,
                  joinable: node.joinable,
                })),
                relationships: request.context.relationship_set.relationships.map((rel) => ({
                  source_dataset_id: rel.source_dataset_id,
                  source_column: rel.source_column,
                  target_dataset_id: rel.target_dataset_id,
                  target_column: rel.target_column,
                  relationship_type: rel.relationship_type,
                  risk_level: rel.risk_level,
                })),
              }
            : undefined,
          analysis_history_summary: request.context.analysis_history_summary,
        },
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
        return fallbackToRuleBased(request, ['Hermes dry-run returned an invalid plan; used local rule-based planner.']);
      }

      return {
        plan: payload.plan,
        runtime_mode: 'hermes',
        warnings: [
          ...(payload.warnings ?? []),
          ...(payload.fallback_used ? ['Hermes dry-run response only; no live Hermes/LLM call was made.'] : []),
        ],
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
    typeof candidate.recommended_analysis_type === 'string' &&
    Array.isArray(candidate.required_datasets) &&
    Array.isArray(candidate.required_fields) &&
    Array.isArray(candidate.assumptions) &&
    Array.isArray(candidate.warnings) &&
    Array.isArray(candidate.next_actions)
  );
}
