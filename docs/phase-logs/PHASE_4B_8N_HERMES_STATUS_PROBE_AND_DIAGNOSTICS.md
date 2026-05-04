# Phase 4B-8N: Hermes Runtime Status Probe and Developer Diagnostics

## Objective

Add a non-invasive Hermes runtime status probe and optional developer diagnostics.

This phase lets the frontend safely detect whether the Hermes assistant backend is disabled, dry-run, live-configured, or unavailable without changing AI Workbench runtime behavior.

## Product Contract

Hermes status is diagnostic metadata only.

The probe must not:

- block AI Workbench loading;
- switch to Hermes runtime;
- call `explain-result`;
- call `plan-analysis`;
- call LLMs;
- auto-run analysis;
- auto-join datasets;
- generate SQL;
- modify SmartAnalysis.

## Files Inspected

- `app/src/api/assistant.ts`
- `app/src/types/hermes.ts`
- `app/src/lib/assistant/getAssistantRuntime.ts`
- `app/src/lib/assistant/hermesAssistantRuntime.ts`
- `app/src/lib/assistant/assistantRuntime.ts`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`

## Pre-coding Audit

1. Current Hermes frontend API wrapper methods:
   - `assistantApi.getHermesStatus()`
   - `assistantApi.explainResultWithHermesDryRun(request)`
   - `assistantApi.planAnalysisWithHermesDryRun(request)`

2. Current runtime factory behavior:
   - `getAssistantRuntime()` still returns `ruleBasedAssistantRuntime`.
   - `hermesAssistantRuntime` remains a placeholder that throws if used.

3. Best place to store status probe state:
   - A small React hook with `sessionStorage` cache.
   - Cache key: `insightease_hermes_status_cache`.
   - TTL: 5 minutes.

4. Best UI location for optional diagnostics:
   - AI Workbench header metadata line.
   - This keeps the indicator subtle and avoids adding a warning/error surface.

## Files Created

- `app/src/hooks/useHermesStatus.ts`
- `docs/phase-logs/PHASE_4B_8N_HERMES_STATUS_PROBE_AND_DIAGNOSTICS.md`

## Files Modified

- `app/src/pages/AIWorkspace.tsx`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Implementation Summary

Added `useHermesStatus(shouldProbe)`:

- starts as `unknown`;
- reads cached status from `sessionStorage`;
- probes `assistantApi.getHermesStatus()` only when AI Workbench is open;
- caches the result for 5 minutes;
- converts request failures to `status: "unavailable"`;
- does not throw;
- does not call explain/plan endpoints.

Added a subtle AI Workbench header diagnostic:

- `本地规则模式`
- `Hermes dry-run 可用 · 当前仍使用规则模式`
- `本地规则模式 · Hermes disabled`
- `本地规则模式 · Hermes 状态不可用`

## Runtime Behavior

Unchanged:

- `getAssistantRuntime()` still returns `ruleBasedAssistantRuntime`.
- Chat planning remains rule-based.
- Result follow-up remains deterministic from `SafeResultSummary`.
- No Hermes explain/plan endpoint is called by AI Workbench.

## Validation Results

- `cd app && npx.cmd tsc --noEmit` passed.
- `cd app && npm.cmd run build` passed.
- `git status --short` showed only expected Phase 4B-8N frontend and docs changes before commit.

Build note:

- Vite retained the existing large chunk warning for `vendor-echarts` and the main app bundle.

Backend validation is not required because no backend files changed.

## Manual QA Checklist

- AI Workbench opens normally when Hermes status is disabled.
- AI Workbench opens normally if Hermes status endpoint fails.
- Status probe does not block UI.
- Status probe does not call explain-result or plan-analysis.
- If backend is dry-run, diagnostic indicator shows dry-run availability.
- Chat planning still uses rule-based runtime.
- Result follow-up still uses deterministic responder.
- No Hermes/LLM call occurs.
- No console error spam beyond existing request infrastructure behavior.
- Existing prefill navigation still works.
- Existing relationship set and context panel still work.

## Known Limitations

- The status diagnostic is intentionally subtle and not a full developer console.
- The shared request interceptor may still log failed network requests according to existing app behavior.
- No runtime selection or Hermes request execution is implemented.

## Next Recommended Phase

Add a guarded developer-only diagnostics panel if needed, still without switching runtime. Live Hermes runtime selection should remain a separate explicit phase.
