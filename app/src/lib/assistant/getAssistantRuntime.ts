/**
 * Assistant Runtime Factory
 *
 * Returns the active assistant runtime.
 *
 * Current: ruleBasedAssistantRuntime
 * Future:  hermesAssistantRuntime (when backend Hermes adapter is ready)
 */

import type { AssistantRuntime } from './assistantRuntime';
import { getAssistantRuntimeProvider } from './assistantRuntimeConfig';
import { hermesAssistantRuntime } from './hermesAssistantRuntime';
import { ruleBasedAssistantRuntime } from './ruleBasedAssistantRuntime';

export function getAssistantRuntime(): AssistantRuntime {
  const provider = getAssistantRuntimeProvider();

  if (provider === 'hermes_dry_run') {
    return hermesAssistantRuntime;
  }

  return ruleBasedAssistantRuntime;
}
