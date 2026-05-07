# Phase 4B-11B-3: Result Explainer QA Hardening

## Goal

Harden the Phase 4B-11B Hermes result explainer after live QA by fixing a Datasets page crash and making live explanations more specific without widening the raw-data boundary.

## Scope

- Fix `DatasetUnderstandingCard` crashes when optional numeric profile fields are missing.
- Add bounded, derived explanation hints to `SafeResultSummary`.
- Teach backend validation and Hermes prompt construction about the enriched safe context.
- Keep deterministic fallback and all Hermes safety gates intact.

## Non-goals

- No live plan-analysis adapter.
- No Join Builder or multi-table execution.
- No SQL generation or execution.
- No automatic analysis rerun.
- No automatic joins.
- No source dataset mutation.
- No raw `result_data` forwarding.
- No raw uploaded dataset row forwarding.
- No direct browser-to-Hermes calls.

## Bug 1: DatasetUnderstandingCard Crash

### Root Cause

`DatasetUnderstandingCard` assumed several backend profile fields were always present and numeric. In partial or older profile responses, fields such as `row_count`, `column_count`, `unique_count`, or `null_rate` can be missing, null, non-numeric, or absent from nested column/classification structures. Direct calls such as `value.toLocaleString()` therefore crashed the Datasets page and triggered the ErrorBoundary.

### Fix

- Added safe numeric and percentage formatters.
- Guarded optional column arrays, examples, quality warnings, classification evidence, and recommended analyses.
- Render missing numeric profile values as `--` instead of crashing.
- Preserved available profile details when only some fields are missing.
- Normalized profile API response handling without adding backend behavior.

## Safe Context Enrichment

### Design

Phase 4B-11B live explanations originally used only the minimal `SafeResultSummary`, which was safe but often too sparse. This phase adds optional `SafeResultSummary.explanation_hints` as derived, bounded context.

Allowed hint content includes:

- analysis goal and method;
- selected fields;
- model name;
- primary metric names and interpretations;
- module-specific findings;
- bounded chart summaries;
- bounded table summaries;
- limitations;
- recommended follow-ups.

Disallowed content remains:

- raw `result_data`;
- raw uploaded dataset rows;
- full tables;
- file or storage paths;
- credentials, secrets, tokens, API keys, passwords, signed URLs;
- SQL;
- dataset mutation or execution instructions.

### Module-specific Summaries Added

- Forecast: model, horizon, date/target fields, forecast value range, trend direction, and confidence interval availability when inferable from safe rows.
- Attribution: attribution models, conversion/journey/value metrics, and bounded top-channel hints when present.
- Statistics: selected variables, descriptive statistic keys, correlation summary hints, and missing/distribution notes when available.
- PathAnalysis: path count, top path hints, conversion rate, and drop-off/transition-style findings when available.
- Semantic: text field, sentiment distribution keys, topic/keyword hints, and quality limitations when available.

All arrays and strings are capped before inclusion.

## Backend Safety Validation

- Backend validation now accepts bounded `result_summary.explanation_hints`.
- Hint list fields are capped at 8 items.
- Direct hint text fields are capped at 500 characters.
- Existing forbidden-key validation still rejects raw/sensitive keys, including `raw_rows`, `raw_data`, `full_table`, `result_data`, `storage_path`, `file_path`, `credentials`, `secret`, `token`, `api_key`, `password`, `connection_string`, and `signed_url`.
- Hermes prompt construction now tells the provider to use `explanation_hints` when available, distinguish confirmed findings from limitations, and avoid claiming it inspected raw data.

## Files Changed

- `app/src/components/assistant/DatasetUnderstandingCard.tsx`
- `app/src/types/resultSummary.ts`
- `app/src/lib/assistant/safeResultSummary.ts`
- `insightease-backend/app/services/hermes_validation_service.py`
- `insightease-backend/app/services/hermes_live_service.py`
- `insightease-backend/tests/test_hermes_live.py`
- `docs/API_CONTRACTS.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/design/HERMES_LIVE_READINESS_CHECKLIST.md`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`

## Manual QA Results

Browser manual QA was not run from this environment. The expected local checks remain:

- Open Datasets and confirm `DatasetUnderstandingCard` no longer crashes with partial profile payloads.
- Open Forecast and Attribution results, hand them to AI Workbench, and ask `帮我解释这个结果。`.
- Confirm Hermes mentions available module-specific hints and clearly states limitations when the safe summary is sparse.
- Stop the Hermes tunnel and confirm deterministic fallback still works.

## Automated Validation Results

- Frontend typecheck: `cd app; npx.cmd tsc --noEmit` passed.
- Frontend build: `cd app; npm.cmd run build` passed with the existing Vite chunk-size warning.
- Targeted frontend lint: `cd app; npx.cmd eslint src/components/assistant/DatasetUnderstandingCard.tsx src/lib/assistant/safeResultSummary.ts src/types/resultSummary.ts` passed.
- Focused backend Hermes tests: `cd insightease-backend; python -m pytest tests/test_hermes_live.py` passed: 12 passed, 5 skipped.
- Backend test suite: `cd insightease-backend; python -m pytest` passed: 69 passed, 5 skipped, 3 warnings.

Warnings were pre-existing framework/cache warnings and did not indicate phase regressions.

## Remaining Limitations

- Explanation quality still depends on which result modules expose structured, safely summarizable result shapes.
- Some module hints are inferred heuristically from existing result structures and may be absent for older or sparse results.
- The frontend still does not auto-generate explanations on handoff; the user must explicitly ask.
- Live plan-analysis remains intentionally unimplemented for Phase 4B-11C.

## Status

Completed. Phase 4B-11B result explanation remains SafeResultSummary-only, now with optional bounded explanation hints for better live response quality.
