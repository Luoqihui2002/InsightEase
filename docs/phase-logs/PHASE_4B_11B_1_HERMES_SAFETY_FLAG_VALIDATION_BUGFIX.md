# Phase 4B-11B-1: Hermes Safety Flag Validation Bugfix

## Goal

Fix a false positive in Hermes request validation where the required `safety.allow_raw_data=false` flag was rejected because the validator used broad substring matching.

## Issue

Manual QA found that AI Workbench correctly sent `POST /api/v1/assistant/hermes/explain-result`, but the backend rejected the request with:

```json
{
  "message": "Forbidden raw or sensitive key detected: safety.allow_raw_data"
}
```

`safety.allow_raw_data=false` is part of the bounded Hermes safety contract and must be accepted.

## Fix Applied

- Replaced substring matching with path-segment based forbidden-key detection.
- Added explicit allowed safety paths:
  - `safety.allow_raw_data`
  - `safety.allow_auto_run`
  - `safety.allow_sql_generation`
  - `safety.allow_dataset_mutation`
  - `safety.require_user_confirmation_for_execution`
- Kept real raw/sensitive keys rejected, including `raw_rows`, `raw_data`, `full_table`, `result_data`, file/storage paths, credentials, secrets, tokens, API keys, passwords, connection strings, and signed URLs.
- Added a guard so safety flag keys are accepted only on the approved `safety.*` paths.

## Tests Added

- Valid explain-result payload with required safety flags passes validation.
- Valid plan-analysis-style safety flags pass validation.
- Nested `raw_rows` remains rejected.
- `result_data` remains rejected.
- Token-like request keys such as `HERMES_AUTH_TOKEN` remain rejected.
- Safety flag keys outside the approved `safety.*` path remain rejected.

## Validation

- `python -m pytest tests/test_hermes_live.py`
  - Result: 8 passed, 5 skipped.
- `python -m compileall app`
  - Result: passed.

## Safety Notes

This bugfix does not add live plan-analysis, Join Builder behavior, SQL generation, analysis execution, dataset mutation, raw result forwarding, or raw dataset row forwarding.

## Status

Completed.
