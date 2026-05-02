/**
 * HermesAssistantRuntime — Placeholder
 *
 * Scaffold for future Hermes Agent integration.
 *
 * Do NOT import or use this runtime until:
 *   1. Backend Hermes adapter API contract is implemented
 *   2. Frontend environment/config can select the runtime mode
 *   3. Safe tool registry is wired to Hermes tool-call format
 *
 * When ready, update getAssistantRuntime.ts to return this instance.
 */

import type {
  AssistantRuntime,
  AssistantPlanRequest,
  AssistantPlanResponse,
} from './assistantRuntime';

export const hermesAssistantRuntime: AssistantRuntime = {
  mode: 'hermes',

  async generateAnalysisPlan(
    _request: AssistantPlanRequest
  ): Promise<AssistantPlanResponse> {
    throw new Error(
      'HermesAssistantRuntime is not implemented yet. ' +
        'Use ruleBasedAssistantRuntime for now.'
    );
  },
};
