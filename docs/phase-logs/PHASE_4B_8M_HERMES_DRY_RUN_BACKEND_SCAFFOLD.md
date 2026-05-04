# Phase 4B-8M: Hermes Dry-run Backend Scaffold

## Objective

Implement a dry-run backend scaffold for future Hermes assistant integration.

This phase adds endpoint shapes, backend validation, and frontend API wrappers. It does not connect to real Hermes, call LLMs, add provider credentials, auto-run analysis, auto-join datasets, generate SQL, modify datasets, or modify SmartAnalysis.

## Required Reading and Files Inspected

Docs inspected:

- `docs/README.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/design/HERMES_RESULT_EXPLAINER_BOUNDARY.md`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/API_CONTRACTS.md`
- `docs/CURRENT_PROGRESS.md`

Code inspected:

- `insightease-backend/app/api/v1/api.py`
- `insightease-backend/app/api/v1/endpoints/assistant.py`
- `insightease-backend/app/schemas/base.py`
- `insightease-backend/app/schemas/ai.py`
- `insightease-backend/app/core/config.py`
- `app/src/api/assistant.ts`
- `app/src/lib/assistant/hermesAssistantRuntime.ts`
- `app/src/lib/assistant/getAssistantRuntime.ts`
- `app/src/lib/assistant/resultFollowupResponder.ts`
- `app/src/types/resultSummary.ts`

## Pre-coding Audit

1. Current assistant backend route structure:
   - `api.py` mounts `assistant.router` at `/api/v1/assistant`.
   - Existing assistant endpoints are `POST /assistant/profile-dataset` and `POST /assistant/infer-relationships`.

2. Current `ResponseModel` shape:
   - `code: int = 200`
   - `message: str = "success"`
   - `data: Optional[T] = None`

3. Hermes schemas location:
   - Added a dedicated `insightease-backend/app/schemas/hermes.py`.

4. Hermes endpoint mount location:
   - Added `insightease-backend/app/api/v1/endpoints/hermes.py`.
   - Mounted in `api.py` under `/assistant/hermes`.

5. Frontend assistant API wrapper style:
   - `assistantApi` uses the shared `request` wrapper and returns `ApiResponse<T>`.

6. Frontend status usage:
   - This phase adds wrapper methods only.
   - AI Workbench does not call Hermes status or switch runtime behavior.

## Files Created

- `insightease-backend/app/api/v1/endpoints/hermes.py`
- `insightease-backend/app/schemas/hermes.py`
- `insightease-backend/app/services/hermes_validation_service.py`
- `app/src/types/hermes.ts`
- `docs/phase-logs/PHASE_4B_8M_HERMES_DRY_RUN_BACKEND_SCAFFOLD.md`

## Files Modified

- `insightease-backend/app/api/v1/api.py`
- `insightease-backend/app/core/config.py`
- `app/src/api/assistant.ts`
- `docs/API_CONTRACTS.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Backend Config

Added safe defaults:

```text
HERMES_ASSISTANT_ENABLED=false
HERMES_ASSISTANT_MODE=disabled
HERMES_ASSISTANT_TIMEOUT_MS=10000
```

`HERMES_ASSISTANT_MODE_SAFE` normalizes unsupported modes to `disabled`.

In this phase:

- `disabled` is the default;
- `dry_run` is the only enabled scaffold mode;
- `live` is reserved and treated as unavailable by the scaffold;
- no credentials are required.

## Backend Schemas

Added Pydantic schemas for:

- status response;
- supports block;
- safety flags;
- explain-result request/response;
- plan-analysis request/response;
- recommended actions;
- normalized Hermes assistant error payload.

## Validation Behavior

Added validation helpers for:

- max request body size: 256 KB;
- forbidden raw/sensitive keys such as `raw_rows`, `raw_data`, `full_table`, `result_data`, `storage_path`, `file_path`, `credentials`, `secret`, `token`, and related terms;
- Safe Result Summary table caps:
  - max 3 tables;
  - max 5 rows per table;
  - max 12 columns per table;
- planning context caps:
  - max 50 datasets;
  - max 100 schema columns per dataset;
  - max 200 relationship edges.

Validation failures return `HTTPException` detail with the normalized Hermes assistant error shape.

## Endpoints

Added:

- `GET /api/v1/assistant/hermes/status`
- `POST /api/v1/assistant/hermes/explain-result`
- `POST /api/v1/assistant/hermes/plan-analysis`

Status behavior:

- disabled by default;
- dry-run mode reports mock provider and supports result explanation/planning;
- no secrets or provider details exposed.

Explain-result dry-run behavior:

- validates payload;
- extracts bounded key findings from result keys and metrics;
- returns warnings/caveats from the safe summary when present;
- returns `fallback_used: true`;
- does not call Hermes/LLM.

Plan-analysis dry-run behavior:

- validates bounded assistant context;
- returns a minimal `AssistantAnalysisPlan`-shaped advisory object;
- treats relationship set as allowed context, not required datasets;
- returns `fallback_used: true`;
- does not execute analysis.

## Frontend Wrapper

Added `app/src/types/hermes.ts`.

Added `assistantApi` methods:

- `getHermesStatus()`
- `explainResultWithHermesDryRun(request)`
- `planAnalysisWithHermesDryRun(request)`

No runtime switch was added. `getAssistantRuntime()` still returns `ruleBasedAssistantRuntime`.

## Safety Boundaries

Preserved:

- no real Hermes call;
- no LLM call;
- no provider credentials;
- no auto-run analysis;
- no auto-join;
- no SQL generation;
- no dataset mutation;
- no SmartAnalysis changes;
- deterministic frontend fallback remains default.

## Validation Results

- `cd insightease-backend && python -m compileall app` passed.
- `cd app && npx.cmd tsc --noEmit` passed.
- `cd app && npm.cmd run build` passed.
- `git status --short` showed only expected Phase 4B-8M source and docs changes before commit.

Build note:

- Vite retained the existing large chunk warning for `vendor-echarts` and the main app bundle.

## Manual QA Checklist

Backend:

- `GET /api/v1/assistant/hermes/status` returns disabled by default.
- With dry-run config enabled, status returns `mode: dry_run` and supports result explanation/planning.
- Valid explain-result payload returns a dry-run response.
- Payload containing `result_data`, `raw_data`, or `full_table` is rejected.
- Valid plan-analysis payload returns a dry-run response.
- Safety flag violations are rejected.
- No external network or LLM call occurs.

Frontend:

- `assistantApi.getHermesStatus()` is typed and uses the existing request wrapper.
- Dry-run explain/plan wrappers are typed.
- AI Workbench deterministic result follow-up still works.
- AI Workbench planning still uses the rule-based runtime.

## Known Limitations

- No live Hermes provider integration.
- No frontend UI uses the status endpoint yet.
- No `hermesAssistantRuntime` implementation yet.
- No streaming contract.
- Error responses use FastAPI `HTTPException` detail rather than a success-envelope error payload.

## Next Recommended Phase

Add non-invasive runtime probing in a future phase:

- call status lazily;
- show optional developer/debug status only if useful;
- keep rule-based fallback as default;
- implement `hermesAssistantRuntime` only after explicit approval.
