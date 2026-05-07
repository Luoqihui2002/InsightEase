# Phase 4B-11A: Hermes Live Readiness Review

## Goal

Audit and harden the Hermes-ready assistant architecture before any live Hermes provider is enabled.

## Why This Phase Exists

InsightEase now has a stable AI Workbench shell, deterministic planning, Dataset/History Catalog metadata, SafeResultSummary, result handoff, result follow-up, Hermes dry-run backend scaffolding, and a dry-run runtime opt-in. Before implementing live adapters, the project needs a clear readiness checklist and risk register so future live work does not weaken the safety boundaries already established.

## Scope

Reviewed:

- frontend assistant runtime provider gating;
- backend Hermes dry-run status, explain-result, and plan-analysis endpoints;
- SafeResultSummary construction and handoff boundary;
- result follow-up routing;
- future plan-analysis metadata boundary;
- Relationship Set semantics;
- fallback and rollback behavior;
- config and secrets expectations for future live phases.

## Non-goals

This phase did not:

- connect a live LLM or Hermes provider;
- add provider credentials or secrets;
- enable live Hermes calls;
- implement the live result explainer adapter;
- implement the live plan-analysis adapter;
- add automatic analysis execution;
- implement joins or Phase 5 Join Builder;
- generate or execute SQL;
- create temporary or saved joined datasets;
- mutate source datasets;
- change SmartAnalysis.

## Reviewed Areas

Documentation:

- `docs/ROADMAP.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/design/MULTI_TABLE_ANALYSIS_DATASET_BUILDER_DESIGN.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/qa/AI_WORKBENCH_QA_RECIPES.md`
- `docs/qa/AI_WORKBENCH_DEMO_SCENARIOS.md`

Frontend:

- `app/src/lib/assistant/assistantRuntimeConfig.ts`
- `app/src/lib/assistant/getAssistantRuntime.ts`
- `app/src/lib/assistant/hermesAssistantRuntime.ts`
- `app/src/lib/assistant/ruleBasedAssistantRuntime.ts`
- `app/src/lib/assistant/assistantRuntime.ts`
- `app/src/lib/assistant/safeResultSummary.ts`
- `app/src/lib/assistant/resultFollowupResponder.ts`
- `app/src/lib/assistant/aiWorkbenchHandoff.ts`
- `app/src/hooks/useHermesStatus.ts`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/api/assistant.ts`
- `app/src/types/hermes.ts`

Backend:

- `insightease-backend/app/api/v1/endpoints/hermes.py`
- `insightease-backend/app/schemas/hermes.py`
- `insightease-backend/app/services/hermes_validation_service.py`
- `insightease-backend/app/core/config.py`

## Findings

Runtime gating:

- Default frontend runtime remains rule-based.
- `hermes_dry_run` requires explicit `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run`.
- Unknown frontend provider values fall back to rule-based.
- No frontend live provider is accepted.
- Backend `live` mode is schema-reserved but currently disabled by implementation.
- Hermes status probing is diagnostic only and does not switch runtimes.

Backend contract:

- Dry-run endpoints validate contracts and return bounded mock responses only.
- Safety flags forbid raw data, auto-run, SQL generation, and dataset mutation.
- Backend validation rejects forbidden raw/sensitive keys including `raw_rows`, `raw_data`, `full_table`, `result_data`, credentials, secrets, tokens, storage paths, and signed URLs.
- Request size, result-summary table dimensions, dataset count, schema column count, and relationship edge count are capped.
- No Hermes endpoint can write data, execute analysis, execute joins, generate SQL for execution, or mutate source datasets.

SafeResultSummary:

- SafeResultSummary caps result keys, metrics, tables, rows, columns, warnings, and long strings.
- History, Statistics, Forecast, PathAnalysis, and Attribution handoffs use bounded summaries.
- AI Workbench handoff storage validates summary shape before accepting it.
- Result follow-up prompts route to deterministic `resultFollowupResponder` when result context exists.
- Result follow-up does not generate a new AnalysisPlanCard when a follow-up intent is detected.

Plan-analysis metadata:

- AI Workbench passes selected dataset, bounded dataset metadata, deterministic Dataset Catalog metadata, active Relationship Set metadata, confirmed edges, and optional SafeResultSummary.
- Raw dataset rows and raw result data are not part of runtime planning context.
- Relationship Set remains an allowed context graph, not a required dataset list, Join Plan, or execution layer.
- Multi-table execution remains deferred to Phase 5 Join Builder work.

## Fixes Applied

No application or backend source changes were required.

The existing implementation already satisfied the runtime gating and fallback requirements for this review. This phase adds documentation deliverables and progress/changelog updates only.

## Remaining Risks

- Future live provider selection and credentials are not designed in code yet.
- Future live responses will need stricter schema validation before rendering.
- Backend validation currently rejects risky keys and enforces caps, but future live work may need value-level redaction or allow-listing.
- Prompt injection testing is still manual and should become part of the 4B-11B/11C QA gates.
- Cost, latency, timeout, provider observability, and audit logging are not implemented for live mode.
- Relationship Set language must continue to avoid implying automatic joins until Phase 5 Join Builder exists.

## Live Adapter Preconditions

For 4B-11B:

- accept only SafeResultSummary for result explanation;
- keep deterministic result follow-up fallback;
- reject raw result data and sensitive keys;
- validate live response shape before rendering;
- never auto-generate explanations on handoff;
- load credentials only from environment or a secrets manager.

For 4B-11C:

- accept only bounded metadata context for planning;
- keep selected dataset and Relationship Set semantics unchanged;
- keep live plans advisory and confirmation-gated;
- reject executable SQL, auto-run, joins, and dataset mutation;
- route multi-table execution needs to Phase 5 Join Builder;
- fall back to rule-based planning on timeout, provider failure, or malformed responses.

## QA / Verification

Commands run:

```text
cd app
npx tsc --noEmit
npm run build
npm run lint

cd insightease-backend
python -m pytest
```

Results:

- `npx tsc --noEmit`: passed.
- `npm run build`: passed. Vite reported existing large chunk size warnings.
- `npm run lint`: failed with 424 errors and 11 warnings across pre-existing frontend lint debt, including broad `no-explicit-any`, React hook lint, Fast Refresh, and purity findings in many untouched files. This phase changed docs only and did not introduce these lint failures.
- `python -m pytest`: passed, 57 tests. Pytest reported two cache-write warnings because it could not create cache files under `insightease-backend/.pytest_cache`.

Backend tests are existing pytest-based transform tests. No backend code was changed, but the command was included because this readiness phase reviewed backend Hermes scaffolding.

## Files Changed

- `docs/design/HERMES_LIVE_READINESS_CHECKLIST.md`
- `docs/phase-logs/PHASE_4B_11A_HERMES_LIVE_READINESS_REVIEW.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`

## Acceptance Criteria

- Readiness checklist exists.
- Phase log exists.
- Current progress and changelog are updated.
- Default assistant runtime remains rule-based.
- Hermes dry-run remains explicit opt-in.
- Live Hermes is not implemented or enabled.
- Unknown provider values fall back to rule-based.
- SafeResultSummary remains the result explanation boundary.
- Raw dataset rows and raw result data are not sent to Hermes.
- Hermes failures have deterministic fallback.
- Relationship Set remains context only.
- No Phase 5 Join Builder implementation is introduced.

## Status

Completed. Live Hermes remains disabled, default runtime remains rule-based, and this phase introduced documentation updates only.
