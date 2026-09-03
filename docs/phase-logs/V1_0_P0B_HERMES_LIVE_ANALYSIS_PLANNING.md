# InsightEase V1.0 P0B — Hermes Live Analysis Planning

**Date:** 2026-09-03  
**Status:** Implemented; deterministic automated verification complete  
**Next boundary:** P0C Multi-table Analysis Dataset Builder

## 1. Scope

P0B upgrades AI Workbench planning from a deterministic/dry-run-only path to live Hermes structured planning. It preserves the metadata-first boundary, validates every provider reference, falls back deterministically, and stops at plan review and user confirmation.

P0B does not create analyses, run transforms, join tables, create derived datasets, generate or execute SQL, mutate datasets, or rerun work.

## 2. Architecture Before / After

Before:

```text
Question -> Assistant Runtime -> deterministic planner -> advisory plan
```

After:

```text
Question
-> bounded metadata context
-> Assistant Runtime
-> authenticated InsightEase backend
-> live Hermes provider
-> strict Pydantic parse
-> dataset / field / relationship validation
-> normalized advisory AnalysisPlan
-> Workbench review

Any provider, schema, or semantic failure
-> deterministic fallback plan
```

The browser never receives Hermes credentials and never calls the provider directly.

## 3. Files Changed

Main implementation areas:

- `app/src/types/assistant.ts`, `app/src/types/hermes.ts` — canonical frontend contracts.
- `app/src/lib/assistant/boundedPlanningContext.ts` — bounded context assembly.
- `app/src/lib/assistant/hermesAssistantRuntime.ts` and runtime config — backend live planning with local fallback.
- `app/src/pages/AIWorkspace.tsx`, `app/src/components/assistant/AnalysisPlanCard.tsx` — shared runtime call and transparent plan review UI.
- `insightease-backend/app/schemas/assistant.py`, `app/schemas/hermes.py` — strict backend request/plan contracts.
- `insightease-backend/app/services/hermes_live_service.py` — live provider call and strict response parsing.
- `insightease-backend/app/services/hermes_validation_service.py` — request and semantic plan validation.
- `insightease-backend/app/services/hermes_planning_service.py` — backend deterministic fallback.
- `insightease-backend/app/api/v1/endpoints/hermes.py` — live/fallback orchestration.
- `insightease-backend/tests/test_hermes_live_planning.py` — P0B regression coverage.

The existing Hermes result-explanation contract and execution services were not changed.

## 4. Final AnalysisPlan Contract

The frontend and backend now share one plan shape containing:

- plan ID, user question, interpreted goal, and supported analysis type;
- required, candidate, and reference dataset IDs;
- dataset-bound field requirements;
- relationship requirements with `confirmed` or `requires_confirmation` status;
- dataset-bound metrics;
- assumptions, warnings, and bounded clarification questions;
- `execution_readiness`: `ready_single_table`, `needs_join`, `needs_clarification`, or `unsupported`;
- `next_action`: `review_plan`, `navigate_analysis`, `create_analysis_dataset`, or `clarify`;
- `source`: `hermes_live` or `deterministic_fallback`;
- confidence and `fallback_used`.

Arbitrary execution types such as SQL, Python, or custom tools are not part of the contract.

## 5. Planning Context Boundary

Allowed context is limited to selected dataset IDs, names, bounded schema metadata, catalog/profile classification, analysis tags, quality warnings, the active Relationship Set, confirmed relationship/risk metadata, and an optional `SafeResultSummary`.

Limits:

- 20 datasets;
- 100 columns per dataset;
- 500 columns total;
- 200 confirmed relationship edges;
- 256 KiB serialized request.

The browser context builder strips sample values and sends no preview rows. The backend rejects raw/result data, paths, secrets, tokens, passwords, API keys, connection strings, and signed URLs at any nesting depth.

## 6. Live Hermes Request Flow

`getAssistantRuntime().generateAnalysisPlan()` remains the only Workbench planning entry. With `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_live`, the runtime sends a bounded request to `/api/v1/assistant/hermes/plan-analysis`. The backend alone applies provider URL, token, model, and timeout settings, then reuses the existing OpenAI-compatible Hermes client.

Provider output is never rendered directly. It is parsed into the strict plan schema and then normalized against the exact request context.

## 7. Validation Rules

- Required, candidate, and reference IDs must exist in the bounded context.
- Required and candidate dataset sets must be disjoint.
- Every field and metric is bound to a required dataset and must exist in its schema.
- A relationship can be `confirmed` only if the exact edge exists in the active Relationship Set.
- Relationship endpoints and fields must exist in the bounded dataset context.
- Multiple required datasets must be connected by declared relationship requirements; unresolved or disconnected relationships require clarification.
- Only current InsightEase analysis modules are accepted.
- Server normalization owns readiness, next actions, source, and fallback flags.

## 8. Fallback Behavior

Disabled/misconfigured Hermes, provider failure or timeout, malformed/non-JSON output, strict schema failure, and hallucinated datasets/fields/relationships all return a deterministic advisory plan. Backend exceptions, response bodies, credentials, and internal URLs are not returned to the UI.

The frontend keeps a final rule-based fallback for transport-level failures and marks the result as `deterministic_fallback`.

## 9. Workbench UX Changes

Plan cards now show `AI Plan · Hermes Live` or `Local Plan · Fallback`, execution readiness, required/candidate/reference datasets, dataset-bound fields, relationships, metrics, assumptions, warnings, and clarification questions.

Only a ready single-table plan can prefill an existing analysis page. This navigation is user-triggered and does not start analysis. Multi-table plans show the future analysis-dataset requirement and remain in Workbench.

## 10. Automated Test Results

- Hermes planning/result focused suite: 35 passed.
- Frontend TypeScript production build: passed.
- Frontend lint: passed with 0 errors and 355 existing warnings.
- Backend full pytest: 92 passed, 6 skipped.

Coverage includes live success, unknown dataset, unknown field, false confirmed relationship, timeout, malformed JSON, disabled mode, bounded provider payload, forbidden keys, size caps, and multi-table `needs_join` normalization.

## 11. Manual QA Results

A repeatable recipe is available at `docs/qa/P0B_HERMES_LIVE_PLANNING_QA.md`. Source-level safety and production rendering paths were verified by build/tests. A real provider smoke test remains environment-dependent because no Hermes credentials are stored in the repository.

## 12. Known Limitations

- Live planning requires an externally configured Hermes-compatible provider.
- The default frontend runtime remains `rule_based`; live mode is an explicit deployment setting.
- Clarification is represented in the plan; there is no separate conversational slot-filling state machine.
- Existing large frontend chunks and historical lint warnings remain outside P0B.

## 13. Deferred Items

Join execution, join preview, derived dataset creation, SQL/tool execution, automated transforms/analyses/reruns, error explanation, dashboard/report redesign, and new analysis algorithms remain deferred.

## 14. P0C Handoff

P0C may begin from a validated multi-table plan containing required dataset IDs, dataset-bound fields, confirmed relationship requirements, and `execution_readiness=needs_join`:

```text
Validated Multi-table AnalysisPlan
-> JoinPlan
-> bounded Join Preview
-> User Confirmation
-> deterministic backend Join
-> Derived Dataset
```

P0B deliberately stops before the first JoinPlan is created.
