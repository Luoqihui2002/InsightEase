# Phase 4B-11B: Hermes Result Explainer Live Adapter

## Goal

Implement the first live Hermes integration for result explanation only.

The supported chain is:

```text
SafeResultSummary
-> InsightEase backend /api/v1/assistant/hermes/explain-result
-> remote Hermes Agent
-> response schema validation
-> AI Workbench result follow-up display
-> deterministic fallback on failure
```

## Why This Phase Exists

Phase 4B-11A confirmed the runtime and payload boundaries were ready for a narrow live adapter. Local config testing also found that the backend settings model rejected `HERMES_BASE_URL`, `HERMES_AUTH_TOKEN`, and `HERMES_MODEL`, so live Hermes configuration could not be loaded.

## Scope

Implemented:

- backend settings support for live Hermes result explanation config;
- live status reporting with safe health probing;
- backend live explain-result adapter;
- backend fallback-shaped explain-result responses;
- frontend AI Workbench live explain-result attempt for explicit result follow-up prompts;
- deterministic frontend fallback when live Hermes is disabled, unavailable, malformed, or failed;
- focused backend tests for settings, validation, fallback, and response parsing.

## Non-goals

This phase did not:

- implement live plan-analysis;
- change the default assistant planner runtime;
- call Hermes directly from the browser;
- auto-explain on result handoff;
- auto-run analysis;
- implement joins or Join Builder;
- generate or execute SQL;
- create temporary or saved joined datasets;
- mutate source datasets;
- commit `.env` files or secrets.

## Config Added

Backend settings now accept:

```text
HERMES_BASE_URL=
HERMES_AUTH_TOKEN=
HERMES_MODEL=hermes-agent
HERMES_ASSISTANT_TIMEOUT_MS=10000
```

Expected local live shape:

```text
HERMES_ASSISTANT_ENABLED=true
HERMES_ASSISTANT_MODE=live
HERMES_BASE_URL=http://127.0.0.1:8642/v1
HERMES_AUTH_TOKEN=<local secret, never commit>
HERMES_MODEL=hermes-agent
HERMES_ASSISTANT_TIMEOUT_MS=60000
```

`HERMES_AUTH_TOKEN` is never returned by status responses, frontend types, docs examples, or fallback messages.

The settings parser also accepts `DEBUG=release`, `DEBUG=prod`, and `DEBUG=production` as `False` so local deployment-style env files do not crash settings load.

## Backend Changes

- Added `HERMES_BASE_URL`, `HERMES_AUTH_TOKEN`, `HERMES_MODEL`, and `HERMES_LIVE_CONFIGURED` in `app/core/config.py`.
- Added optional status metadata fields: `available`, `availability`, and `platform`.
- Added `app/services/hermes_live_service.py`.
- Live status now distinguishes disabled, dry-run, misconfigured, live unavailable, and live available states.
- Live status probes `{HERMES_BASE_URL}/health` when live mode is configured.
- Live explain-result calls `{HERMES_BASE_URL}/chat/completions` using an OpenAI-compatible request shape.
- Live explain-result parses direct structured responses or OpenAI-compatible `choices[0].message.content`.
- Live responses are normalized into `HermesExplainResultResponse`.
- Malformed responses, timeouts, HTTP errors, unavailable tunnel, or provider errors return `fallback_used=true`.
- `plan-analysis` remains dry-run only.
- `app/services/__init__.py` no longer imports provider-heavy services as package side effects.

## Frontend Changes

- Added `assistantApi.explainResultWithHermes()` for backend explain-result calls.
- Kept `explainResultWithHermesDryRun()` as a compatibility alias.
- Extended Hermes status types with live availability metadata.
- AI Workbench result follow-up now attempts live Hermes only when:
  - a valid result summary exists;
  - the user explicitly sends a result follow-up prompt;
  - backend status is live, available, and supports `explain_result`.
- If Hermes returns `fallback_used=true`, malformed content, or a request failure, AI Workbench uses deterministic `resultFollowupResponder`.
- If no result context exists, AI Workbench does not call Hermes and asks the user to select or hand off a result.
- Result handoff still stores only `SafeResultSummary`.

## Safety Boundaries

- Browser never calls remote Hermes Agent directly.
- Backend never forwards raw `result_data`.
- Backend validation rejects forbidden raw/sensitive keys such as `raw_rows`, `raw_data`, `full_table`, `result_data`, `storage_path`, `file_path`, `credentials`, `secret`, `token`, `api_key`, `password`, `connection_string`, and `signed_url`.
- Safety flags still require:
  - `allow_raw_data=false`
  - `allow_auto_run=false`
  - `allow_sql_generation=false`
  - `allow_dataset_mutation=false`
- Live result explanation is user-triggered only.
- Relationship Set remains context only, not a Join Plan.
- No SQL, joins, analysis execution, or dataset writes were added.

## Fallback Behavior

Fallback occurs when:

- Hermes is disabled;
- live mode is misconfigured;
- health check is unavailable;
- live explain-result times out;
- remote Hermes returns HTTP or non-JSON errors;
- remote Hermes returns malformed content;
- frontend response validation fails.

Backend fallback responses are marked `fallback_used=true`. Frontend treats those as a signal to render the deterministic local result follow-up response.

## Tests / Validation

Commands run:

```text
cd insightease-backend
python -m pytest tests/test_hermes_live.py
python -m compileall app

cd app
npx tsc --noEmit
```

Results so far:

- `python -m pytest tests/test_hermes_live.py`: passed with 4 passed, 5 skipped. Endpoint tests skipped in this local interpreter because `fastapi` is not installed, even though it is listed in `requirements.txt`.
- `python -m compileall app`: passed.
- `npx tsc --noEmit`: passed.

Additional validation still required before final commit:

- full frontend build;
- frontend lint, expected to retain pre-existing lint debt from Phase 4B-11A;
- full backend pytest command;
- optional live manual check if Hermes tunnel and backend server are running.

Final validation update:

- `npm run build`: passed. Vite reported existing large chunk size warnings.
- `npm run lint`: failed with 424 errors and 11 warnings, consistent with Phase 4B-11A pre-existing frontend lint debt across broad untouched files.
- `python -m pytest`: passed with 61 passed, 5 skipped. The skipped tests are endpoint-level Hermes tests in this local interpreter because `fastapi` is not installed, despite being listed in backend requirements.
- Added `insightease-backend/pytest.ini` so pytest ignores `pytest-cache-files-*` cache-temp directories that this environment creates with inaccessible permissions.
- `python -c "from app.main import app; print('app import ok')"`: failed because this local interpreter does not have `fastapi` installed. This is an environment dependency issue, not a Phase 4B-11B code failure.

## Manual QA

Local tunnel check:

```text
curl.exe http://127.0.0.1:8642/v1/health
```

Result in this environment:

- failed to connect to `127.0.0.1:8642`; the Hermes tunnel was not running during this implementation pass.

Settings smoke check:

```text
python -c "from app.core.config import settings; print(settings.HERMES_ASSISTANT_MODE_SAFE)"
```

Result:

- settings loaded successfully;
- current local mode printed `disabled` because local live env values were not present in the shell used for validation.

Backend app import check:

- `from app.main import app` could not be verified in this interpreter because `fastapi` is not installed.

Manual checks still recommended with the tunnel and backend running:

- backend `/assistant/hermes/status` reports `mode=live`, `available=true`, and does not expose token;
- minimal SafeResultSummary explain-result request returns live normalized response;
- invalid payload with `result_data` is rejected;
- stopping the tunnel causes fallback, not crash;
- AI Workbench result follow-up uses live response only after explicit prompt and falls back deterministically when unavailable.

## Remaining Risks

- The exact Hermes Agent result endpoint is assumed to be OpenAI-compatible `{HERMES_BASE_URL}/chat/completions`.
- Endpoint tests could not run in this local interpreter without installing backend requirements.
- Live tunnel was unavailable during local manual QA.
- Prompt-injection and provider observability remain manual/future hardening areas.
- Frontend still depends on cached status for deciding whether to attempt live explanation.

## Blockers for 4B-11C

- Plan-analysis live adapter must not reuse the result explainer prompt path.
- Planning context must remain bounded metadata only.
- Live plans need strict schema validation and rule-based fallback.
- Relationship Set must remain context only.
- Multi-table execution must route to Phase 5 Join Builder, not live Hermes.
- No SQL, joins, auto-run, or dataset mutation may be introduced.

## Files Changed

- `insightease-backend/app/core/config.py`
- `insightease-backend/app/api/v1/endpoints/hermes.py`
- `insightease-backend/app/schemas/hermes.py`
- `insightease-backend/app/services/hermes_live_service.py`
- `insightease-backend/app/services/__init__.py`
- `insightease-backend/tests/test_hermes_live.py`
- `insightease-backend/pytest.ini`
- `app/src/api/assistant.ts`
- `app/src/types/hermes.ts`
- `app/src/hooks/useHermesStatus.ts`
- `app/src/pages/AIWorkspace.tsx`
- `.gitignore`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/API_CONTRACTS.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/design/HERMES_LIVE_READINESS_CHECKLIST.md`

## Status

Implemented. Final validation and git commit remain.
