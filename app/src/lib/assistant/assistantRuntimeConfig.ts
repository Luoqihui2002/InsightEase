export type AssistantRuntimeProvider = 'rule_based' | 'hermes_dry_run' | 'hermes_live';

export function getAssistantRuntimeProvider(): AssistantRuntimeProvider {
  const value = import.meta.env.VITE_ASSISTANT_RUNTIME_PROVIDER;

  if (value === 'hermes_dry_run') {
    return 'hermes_dry_run';
  }
  if (value === 'hermes_live') {
    return 'hermes_live';
  }

  return 'rule_based';
}
