/**
 * RuleBasedAssistantRuntime
 *
 * Wraps the existing deterministic keyword-based planner
 * (generateMockAnalysisPlan) behind the AssistantRuntime interface.
 *
 * No LLM calls. No backend analysis execution.
 * Safe, predictable, and fully local.
 */

import { generateMockAnalysisPlan } from './analysisPlannerMock';
import type {
  AssistantRuntime,
  AssistantPlanRequest,
  AssistantPlanResponse,
} from './assistantRuntime';

export const ruleBasedAssistantRuntime: AssistantRuntime = {
  mode: 'rule_based',

  async generateAnalysisPlan(
    request: AssistantPlanRequest
  ): Promise<AssistantPlanResponse> {
    const plan = generateMockAnalysisPlan({
      question: request.question,
      datasets: request.context.datasets ?? [],
      confirmedRelationships: request.context.confirmed_relationships,
    });

    return {
      plan,
      runtime_mode: 'rule_based',
      warnings: [],
    };
  },
};
