export type AssistantRuntimeProvider = 'rule_based' | 'hermes_dry_run';

export function getAssistantRuntimeProvider(): AssistantRuntimeProvider {
  const value = import.meta.env.VITE_ASSISTANT_RUNTIME_PROVIDER;

  if (value === 'hermes_dry_run') {
    return 'hermes_dry_run';
  }

  return 'rule_based';
}
