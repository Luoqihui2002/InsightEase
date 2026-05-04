# Phase 4B-8O: HermesAssistantRuntime Dry-run Mode

## Objective

Implement a guarded HermesAssistantRuntime dry-run mode.

This phase allows the frontend assistant runtime layer to call backend Hermes dry-run endpoints only when explicitly enabled in development/config mode.

It does not connect to live Hermes, call LLMs, add provider credentials, auto-run analysis, auto-join datasets, generate SQL, mutate datasets, or modify SmartAnalysis.

## Files Inspected

- `app/src/lib/assistant/getAssistantRuntime.ts`
- `app/src/lib/assistant/hermesAssistantRuntime.ts`
- `app/src/lib/assistant/ruleBasedAssistantRuntime.ts`
- `app/src/lib/assistant/assistantRuntime.ts`
- `app/src/lib/assistant/resultFollowupResponder.ts`
- `app/src/hooks/useHermesStatus.ts`
- `app/src/api/assistant.ts`
- `app/src/types/hermes.ts`
- `app/src/pages/AIWorkspace.tsx`

## Pre-coding Audit

1. Current `AssistantRuntime` interface:
   - required: `generateAnalysisPlan(request)`;
   - optional: `explainError(request)`;
   - optional: `explainResult(request)`.

2. Current `hermesAssistantRuntime` behavior:
   - placeholder runtime;
   - `generateAnalysisPlan()` threw an error if called.

3. Current `ruleBasedAssistantRuntime` methods:
   - implements `generateAnalysisPlan()` via deterministic `generateMockAnalysisPlan()`;
   - no backend call;
   - no LLM call.

4. Methods Hermes dry-run can safely implement now:
   - `generateAnalysisPlan()` only.
   - Result follow-up remains deterministic through `resultFollowupResponder`.

5. Runtime configuration:
   - added `app/src/lib/assistant/assistantRuntimeConfig.ts`;
   - default provider is `rule_based`;
   - opt-in provider is `hermes_dry_run`.

6. Environment variable safety:
   - Vite `import.meta.env` can safely read `VITE_ASSISTANT_RUNTIME_PROVIDER`;
   - unsupported or missing values fall back to `rule_based`;
   - no `hermes_live` provider is accepted.

## Files Created

- `app/src/lib/assistant/assistantRuntimeConfig.ts`
- `docs/phase-logs/PHASE_4B_8O_HERMES_ASSISTANT_RUNTIME_DRY_RUN_MODE.md`

## Files Modified

- `app/src/lib/assistant/getAssistantRuntime.ts`
- `app/src/lib/assistant/hermesAssistantRuntime.ts`
- `app/src/hooks/useHermesStatus.ts`
- `app/src/pages/AIWorkspace.tsx`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Runtime Config

New helper:

```ts
export type AssistantRuntimeProvider = "rule_based" | "hermes_dry_run";

export function getAssistantRuntimeProvider(): AssistantRuntimeProvider {
  const value = import.meta.env.VITE_ASSISTANT_RUNTIME_PROVIDER;
  return value === "hermes_dry_run" ? "hermes_dry_run" : "rule_based";
}
```

Development-only opt-in:

```text
VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run
```

Default remains `rule_based`.

## Hermes Dry-run Runtime

`hermesAssistantRuntime.generateAnalysisPlan()` now:

- calls `assistantApi.planAnalysisWithHermesDryRun()`;
- sends user question, bounded assistant context, active relationship set metadata, selected dataset metadata, optional safe result summary, and explicit safety flags;
- never sends raw dataset rows or full result tables;
- never calls explain-result from AI Workbench;
- never executes analysis;
- never generates SQL;
- never mutates datasets.

Safety flags:

```ts
{
  allow_raw_data: false,
  allow_auto_run: false,
  allow_sql_generation: false,
  allow_dataset_mutation: false,
  require_user_confirmation_for_execution: true
}
```

## Fallback Behavior

Implemented rules:

- default/no env var -> `ruleBasedAssistantRuntime`;
- `hermes_dry_run` env var -> `hermesAssistantRuntime`;
- dry-run endpoint succeeds -> returns backend dry-run plan with `runtime_mode: "hermes"`;
- dry-run endpoint disabled/unavailable/error -> falls back to `ruleBasedAssistantRuntime`;
- invalid dry-run response -> falls back to `ruleBasedAssistantRuntime`;
- fallback response includes warning: `Hermes dry-run unavailable; used local rule-based planner.`

No uncaught runtime errors should reach AI Workbench from Hermes dry-run failure.

## Diagnostics

AI Workbench diagnostic now reflects explicit provider mode:

- rule-based provider -> local rule mode plus status probe text;
- Hermes dry-run provider -> `Hermes dry-run runtime · fallback enabled`.

The existing Hermes status probe remains diagnostic only.

## Validation Results

- `cd app && npx.cmd tsc --noEmit` passed.
- `cd app && npm.cmd run build` passed.
- `git status --short` showed only expected Phase 4B-8O frontend and docs changes before commit.

Build note:

- Vite retained the existing large chunk warning for `vendor-echarts` and the main app bundle.

Backend validation is not required because no backend files changed.

## Manual QA Checklist

Default mode:

- Remove `VITE_ASSISTANT_RUNTIME_PROVIDER`.
- Open AI Workbench.
- Diagnostic shows local rule mode.
- Generate analysis plan.
- Existing rule-based behavior is used.
- No Hermes plan/explain endpoint is called.

Dry-run mode:

- Set `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run`.
- Start frontend.
- If backend Hermes mode is disabled, AI Workbench still works through fallback.
- If backend Hermes mode is dry-run, generating a plan calls `/assistant/hermes/plan-analysis`.
- Dry-run response renders safely.
- If endpoint fails, fallback response renders.
- No uncaught errors.

Safety:

- No real Hermes/LLM call occurs.
- No analysis auto-runs.
- No SQL generation occurs.
- No dataset mutation occurs.
- Result follow-up remains deterministic.

Regression:

- Relationship set planning still works.
- Dataset planning still works.
- Result follow-up still works.
- Prefill navigation still works.
- Context Panel still works.
- Hermes status probe still works.

## Known Limitations

- `hermesAssistantRuntime` implements only `generateAnalysisPlan()`.
- No live Hermes runtime exists.
- Backend dry-run responses are contract validation responses, not useful AI planning.
- The frontend API wrapper typing still reflects Axios generics in places, so runtime helper code tolerates both Axios-shaped and interceptor-unwrapped responses.

## Next Recommended Phase

Add a developer-only runtime diagnostics panel and explicit test recipes for dry-run mode. Live Hermes provider integration should remain a separate approved phase.
