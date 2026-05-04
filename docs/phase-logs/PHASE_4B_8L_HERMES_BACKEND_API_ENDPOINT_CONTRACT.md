# Phase 4B-8L: Hermes Backend API Endpoint Contract

## Objective

Define the future backend API endpoint contract for Hermes assistant integration.

This phase is documentation-only. It does not implement Hermes, add backend endpoints, change frontend runtime behavior, call LLMs, auto-run analysis, auto-join datasets, generate SQL, or modify SmartAnalysis.

## Required Reading and Files Inspected

Docs inspected:

- `docs/README.md`
- `docs/design/HERMES_RESULT_EXPLAINER_BOUNDARY.md`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/CURRENT_ARCHITECTURE.md`
- `docs/API_CONTRACTS.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/ROADMAP.md`

Code and API surfaces inspected:

- `app/src/api/assistant.ts`
- `app/src/api/analysis.ts`
- `app/src/lib/request.ts`
- `app/src/lib/assistant/assistantRuntime.ts`
- `app/src/lib/assistant/hermesAssistantRuntime.ts`
- `app/src/lib/assistant/toolRegistry.ts`
- `app/src/types/resultSummary.ts`
- `app/src/types/api.ts`
- `insightease-backend/app/api/v1/api.py`
- `insightease-backend/app/api/v1/endpoints/assistant.py`
- `insightease-backend/app/api/v1/endpoints/analysis.py`
- `insightease-backend/app/schemas/base.py`
- `insightease-backend/app/schemas/ai.py`
- `insightease-backend/app/schemas/analysis.py`
- `insightease-backend/app/core/config.py`
- `insightease-backend/app/services/`

## Current API Style Audit

Current conventions:

- Backend uses FastAPI routers mounted by `insightease-backend/app/api/v1/api.py`.
- Global API prefix is `settings.API_V1_STR`, currently `/api/v1`.
- Existing assistant endpoints are mounted under `/assistant`.
- Existing assistant endpoints are metadata-first and read-only:
  - `POST /api/v1/assistant/profile-dataset`
  - `POST /api/v1/assistant/infer-relationships`
- Backend success responses use `ResponseModel[T]` from `app.schemas.base`.
- Response envelope is `{ code, message, data }`.
- Frontend `request` wraps Axios and returns `response.data`, so API wrappers receive `ResponseModel<T>`.
- Frontend auth uses Bearer token from `localStorage.access_token`.
- Backend endpoints commonly use `get_current_active_user`.
- Analysis task creation uses `BackgroundTasks` and `202`, but Hermes explain/plan should remain synchronous advisory endpoints and must not create tasks.
- Backend config uses Pydantic `BaseSettings`; no Hermes feature flags exist yet.

## Files Created

- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/phase-logs/PHASE_4B_8L_HERMES_BACKEND_API_ENDPOINT_CONTRACT.md`

## Files Modified

- `docs/API_CONTRACTS.md`
- `docs/design/HERMES_RESULT_EXPLAINER_BOUNDARY.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Endpoint Contract Summary

Fully specified future endpoints:

- `GET /api/v1/assistant/hermes/status`
- `POST /api/v1/assistant/hermes/explain-result`
- `POST /api/v1/assistant/hermes/plan-analysis`

Optional future endpoints listed but not fully specified:

- `POST /api/v1/assistant/hermes/explain-error`
- `POST /api/v1/assistant/hermes/propose-tool-call`
- `POST /api/v1/assistant/hermes/summarize-dataset`

## Status Endpoint

`GET /api/v1/assistant/hermes/status` tells the frontend whether Hermes is enabled and which capabilities are available.

The response includes:

- `enabled`
- `provider`
- `mode`
- `supports`
- optional `message`

The endpoint must not expose secrets or provider credentials.

## Explain Result Endpoint

`POST /api/v1/assistant/hermes/explain-result` explains an existing analysis result from bounded input only.

Input:

- user question;
- `SafeResultSummary`;
- metadata-only assistant context;
- explicit safety flags that must all prohibit raw data, auto-run, SQL generation, and dataset mutation.

Output:

- answer;
- key findings;
- risks and caveats;
- suggested next steps;
- recommended actions;
- confidence;
- optional fallback indicator.

## Plan Analysis Endpoint

`POST /api/v1/assistant/hermes/plan-analysis` generates an advisory analysis plan.

The contract requires Hermes to distinguish:

- available context;
- recommended dataset candidates;
- query-specific required datasets.

Hermes must not treat every workspace dataset or every relationship-set node as required by default.

## Safety Rules

The contract requires backend rejection when:

- safety flags are not exact false/true contract values;
- payload size limits are exceeded;
- Safe Result Summary caps are violated;
- request contains raw rows, full result tables, unbounded `result_data`, storage paths, credentials, secrets, or unrelated relationship sets.

Hermes may explain, plan, summarize, and suggest. It may not execute.

## Size and Privacy Limits

Defined initial limits:

- max request body: 256 KB;
- max datasets in context: 50;
- max schema columns per dataset: 100;
- max relationship edges: 200;
- Safe Result Summary caps inherited from `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`;
- no raw uploaded rows;
- no storage paths;
- no credentials or secrets.

## Feature Flag and Fallback Behavior

Future backend settings:

- `HERMES_ASSISTANT_ENABLED=false`
- `HERMES_ASSISTANT_MODE=disabled|dry_run|live`
- `HERMES_ASSISTANT_TIMEOUT_MS=10000`

Frontend fallback:

- status unavailable or disabled -> deterministic runtime;
- explain-result failure -> deterministic `resultFollowupResponder`;
- plan-analysis failure -> `ruleBasedAssistantRuntime`;
- validation failure -> show safety error and do not retry automatically.

## Error Contract

Defined normalized `HermesAssistantError` with:

- `code`
- `message`
- `user_message`
- `retryable`
- `fallback_available`

Codes include:

- `HERMES_DISABLED`
- `INVALID_SAFETY_FLAGS`
- `SUMMARY_TOO_LARGE`
- `CONTEXT_TOO_LARGE`
- `INVALID_REQUEST`
- `INVALID_RESULT_SUMMARY`
- `HERMES_TIMEOUT`
- `HERMES_PROVIDER_ERROR`

## Tool Action Confirmation Rules

Hermes recommended actions are advisory.

No confirmation needed:

- navigation;
- advisory plan generation;
- clarifying question.

Explicit confirmation required:

- any execution;
- future analysis run;
- future join preview;
- SQL generation;
- dataset creation or mutation.

No execute/write action may run directly from a Hermes response.

## Validation

Documentation-only validation:

```text
git status --short
```

Result before commit: docs-only changes were present for the 8L contract and related documentation.

No TypeScript interfaces, frontend runtime code, backend schemas, or backend endpoints were added, so `tsc` and build were not required by this phase.

## Manual QA Checklist

- Confirm `docs/design/HERMES_BACKEND_API_CONTRACT.md` exists.
- Confirm it defines status, explain-result, and plan-analysis endpoints.
- Confirm it defines request and response contracts.
- Confirm it defines safety validation rules.
- Confirm it defines size/privacy limits.
- Confirm it defines normalized error behavior.
- Confirm it defines fallback behavior.
- Confirm it defines feature flag/mode behavior.
- Confirm it defines tool action confirmation rules.
- Confirm no backend endpoint implementation was added.
- Confirm no frontend runtime behavior changed.

## Known Limitations

- No Hermes backend schemas are implemented yet.
- No frontend `assistantApi` wrapper exists for Hermes endpoints yet.
- No runtime configuration selects `hermesAssistantRuntime` yet.
- No streaming contract is defined.
- No provider-specific retry/backoff policy is defined.

## Next Recommended Phase

Implement a dry-run backend scaffold only after explicit approval:

- add Pydantic schemas matching this contract;
- add `/assistant/hermes/status` returning disabled/dry-run state;
- add dry-run validation-only explain-result and plan-analysis handlers;
- add frontend API wrapper and runtime status check;
- keep deterministic fallback as the default.
