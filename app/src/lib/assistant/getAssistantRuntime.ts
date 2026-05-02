/**
 * Assistant Runtime Factory
 *
 * Returns the active assistant runtime.
 *
 * Current: ruleBasedAssistantRuntime
 * Future:  hermesAssistantRuntime (when backend Hermes adapter is ready)
 */

import type { AssistantRuntime } from './assistantRuntime';
import { ruleBasedAssistantRuntime } from './ruleBasedAssistantRuntime';

export function getAssistantRuntime(): AssistantRuntime {
  // Future: check backend config / feature flag and return
  // hermesAssistantRuntime when Hermes integration is implemented.
  return ruleBasedAssistantRuntime;
}
