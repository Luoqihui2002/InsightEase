/**
 * Assistant Runtime Factory
 *
 * Returns the active assistant runtime.
 *
 * Default: ruleBasedAssistantRuntime
 * Opt-in:  hermesAssistantRuntime (dry-run or live backend mode)
 */

import type { AssistantRuntime } from './assistantRuntime';
import { getAssistantRuntimeProvider } from './assistantRuntimeConfig';
import { hermesAssistantRuntime } from './hermesAssistantRuntime';
import { ruleBasedAssistantRuntime } from './ruleBasedAssistantRuntime';

export function getAssistantRuntime(): AssistantRuntime {
  const provider = getAssistantRuntimeProvider();

  if (provider === 'hermes_dry_run' || provider === 'hermes_live') {
    return hermesAssistantRuntime;
  }

  return ruleBasedAssistantRuntime;
}
