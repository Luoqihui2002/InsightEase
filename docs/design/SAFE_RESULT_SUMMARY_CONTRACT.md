# Safe Result Summary Contract

## Purpose

`SafeResultSummary` is a bounded frontend contract for turning irregular analysis result payloads into safe metadata and small previews.

It is designed for:

- History page summaries;
- AI Workbench history context;
- future ResultView integrations;
- future Hermes or LLM result explanation input.

It is not an AI explanation and does not run analysis.

## Type Location

- Types: `app/src/types/resultSummary.ts`
- Builder: `app/src/lib/assistant/safeResultSummary.ts`

## Contract Fields

`SafeResultSummary` includes:

- analysis metadata: id, type, status, dataset id/name, timestamps;
- title/subtitle;
- existing `ai_summary` or `ai_interpretation` if already present;
- capped top-level result keys;
- capped metrics;
- capped table previews;
- chart/config summaries;
- warnings;
- safe follow-up actions.

## Truncation Rules

- Result keys: max 20.
- Metrics: max 8.
- Tables: max 3.
- Table rows: max 5.
- Table columns: max 12.
- Warnings: max 8.
- Long strings are truncated.
- Nested objects are summarized by key count or key names instead of expanded.

## Privacy and Safety Rules

- Do not include full raw result tables.
- Do not include uploaded dataset rows beyond tiny previews.
- Do not persist raw result data in sessionStorage.
- Do not auto-generate LLM explanations.
- Do not auto-run analysis.
- Unknown result shapes must return graceful empty summaries, not throw.

## Current Consumers

- `AIWorkbenchContextPanel` renders inline "原结果预览" from `SafeResultSummary`.
- `History` renders a compact "安全结果摘要" from the same helper.
- `AssistantContext.analysis_history_summary` is available as an optional future runtime field.

## Future Consumers

- ResultView can optionally expose a compact summary header from this contract.
- Hermes/LLM result explanation should receive this bounded summary instead of raw `result_data`.

## Phase 4B-8I Handoff Use

Analysis result handoff stores `SafeResultSummary` in the temporary AI Workbench handoff payload when needed.

The handoff payload may include:

- `analysis_id` for API-backed History results;
- `safe_result_summary` for immediate bounded display;
- suggested follow-up prompts.

The payload must not include raw `result_data`.

## Phase 4B-8J Result Follow-up Mode

AI Workbench now uses `SafeResultSummary` for deterministic follow-up responses.

Supported intents:

- explain result;
- identify risks/anomalies;
- suggest next steps;
- draft report text.

The responder must use only summary fields and must include a caveat that no analysis is rerun. Unsupported questions continue through the existing planning flow.
