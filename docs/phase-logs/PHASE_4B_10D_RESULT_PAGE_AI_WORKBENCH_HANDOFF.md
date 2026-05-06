# Phase 4B-10D: Result Page AI Workbench Handoff

## Objective

Add direct result-to-AI-Workbench handoff actions to Forecast, PathAnalysis, and Attribution result pages.

This completes the major analysis-page loop:

```text
analysis result page
-> SafeResultSummary
-> AI Workbench handoff payload
-> AI Workbench Context Panel
-> deterministic result follow-up on user request
```

## Scope

Included:

- Forecast result page handoff.
- PathAnalysis result page handoff.
- Attribution result page handoff.
- Shared page-local handoff helper.
- QA and design documentation updates.

Excluded:

- No Hermes/LLM call.
- No automatic explanation generation.
- No analysis rerun.
- No SQL generation.
- No auto-join.
- No dataset mutation.
- No backend change.
- No SmartAnalysis change.
- No package/dependency change.

## Files Inspected

- `app/src/lib/assistant/aiWorkbenchHandoff.ts`
- `app/src/lib/assistant/safeResultSummary.ts`
- `app/src/types/resultSummary.ts`
- `app/src/types/api.ts`
- `app/src/pages/Forecast.tsx`
- `app/src/pages/PathAnalysis.tsx`
- `app/src/pages/Attribution.tsx`
- `app/src/pages/Statistics.tsx`
- `app/src/pages/History.tsx`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/qa/AI_WORKBENCH_QA_RECIPES.md`
- `docs/qa/AI_WORKBENCH_DEMO_SCENARIOS.md`

`docs/phase-logs/PHASE_4B_9E_RESULT_FOLLOWUP_ROUTING_HOTFIX.md` was not present, so the result follow-up routing hotfix was verified from `AIWorkspace.tsx` and `resultFollowupResponder.ts`.

## Pre-coding Findings

Statistics already performs direct handoff by:

- preserving the completed backend `Analysis`;
- falling back to a minimal Analysis-like object when needed;
- calling `buildSafeResultSummary`;
- dispatching `dispatchAIWorkbenchHandoff`;
- showing the action only when a result exists.

Forecast:

- receives backend analysis ids for single forecast and batch forecast;
- previously discarded the completed backend `Analysis`;
- stores page-local `analysisResult` or `batchResult`.

PathAnalysis:

- uses quick analysis endpoints for path/funnel/clustering/key-path/sequence-mining flows;
- does not currently expose a backend history analysis id in the page result flow;
- stores page-local `result`.

Attribution:

- receives backend analysis ids through `analysisApi.create`;
- previously discarded the completed backend `Analysis`;
- stores page-local `analysisResult`.

## Files Modified

- `app/src/lib/assistant/resultHandoffActions.ts`
- `app/src/pages/Forecast.tsx`
- `app/src/pages/PathAnalysis.tsx`
- `app/src/pages/Attribution.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/qa/AI_WORKBENCH_QA_RECIPES.md`
- `docs/qa/AI_WORKBENCH_DEMO_SCENARIOS.md`
- `docs/phase-logs/PHASE_4B_10D_RESULT_PAGE_AI_WORKBENCH_HANDOFF.md`

## Implementation Notes

Added `handoffAnalysisResultToWorkbench` as a small shared helper for result pages.

The helper:

- accepts a completed `Analysis` when available;
- accepts page-local result data and metadata as fallback;
- builds a bounded `SafeResultSummary`;
- dispatches the existing AI Workbench handoff payload;
- stores no raw result data in sessionStorage.

Forecast:

- preserves completed backend analysis metadata for single and batch forecast results.
- adds `带到 AI 工作台` above displayed forecast results.
- hides the action for missing or error result payloads.

PathAnalysis:

- adds `带到 AI 工作台` beside the CSV export action.
- creates a local Analysis-like summary source with `analysisType: "path_analysis"`.
- includes selected dataset id/name and path configuration metadata.

Attribution:

- preserves completed backend analysis metadata after polling.
- adds `带到 AI 工作台` beside the existing export action.
- includes selected dataset id/name and attribution configuration metadata.

## Safety Behavior

- Handoff stores only `SafeResultSummary`.
- No raw large `result_data` is stored in sessionStorage.
- No explanation is generated automatically.
- No analysis is rerun.
- No Hermes/LLM endpoint is called.
- Existing deterministic result follow-up routing remains responsible for user follow-up prompts.

## Manual QA Checklist

Existing handoff:

- [ ] History result dialog -> AI Workbench still works.
- [ ] Statistics result page -> AI Workbench still works.

Forecast:

- [ ] Forecast result page shows the handoff action when a result exists.
- [ ] Click handoff action.
- [ ] AI Workbench opens.
- [ ] Context Panel shows forecast result context.
- [ ] Result follow-up works.
- [ ] No forecast rerun occurs.

PathAnalysis:

- [ ] Path result page shows the handoff action when a result exists.
- [ ] Click handoff action.
- [ ] AI Workbench opens.
- [ ] Context Panel shows path result context.
- [ ] Result follow-up works.
- [ ] No path rerun occurs.

Attribution:

- [ ] Attribution result page shows the handoff action when a result exists.
- [ ] Click handoff action.
- [ ] AI Workbench opens.
- [ ] Context Panel shows attribution result context.
- [ ] Result follow-up works.
- [ ] No attribution rerun occurs.

Safety:

- [ ] No Hermes/LLM call.
- [ ] No analysis auto-run.
- [ ] No raw large `result_data` persisted in sessionStorage.
- [ ] SafeResultSummary caps are respected.
- [ ] No console errors.

Regression:

- [ ] Prefill navigation still works.
- [ ] SearchableSelect still works.
- [ ] Context Panel still works.
- [ ] Result follow-up routing still uses `resultFollowupResponder`.

## Validation Results

- `cd app && npx.cmd tsc --noEmit`: passed.
- `cd app && npm.cmd run build`: passed with the existing Vite large chunk warning.

Backend validation is not required because no backend files changed.

## Known Limitations

- PathAnalysis quick endpoint handoff uses a local summary id because the current page flow does not expose a saved backend `Analysis` id.
- Handoff does not automatically generate explanations; users must ask a follow-up prompt in AI Workbench.
- Forecast, PathAnalysis, and Attribution handoffs are bounded summaries, not full result replay.

## Next Recommended Phase

Add optional browser smoke tests for result handoff flows and consider extending direct handoff to any remaining result surfaces once their result states are normalized.
