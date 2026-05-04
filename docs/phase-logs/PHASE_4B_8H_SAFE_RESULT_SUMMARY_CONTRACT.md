# Phase 4B-8H: Safe Result Summary Contract

## Objective

Create a reusable Safe Result Summary contract for analysis results so History, AI Workbench, ResultView, and future Hermes/LLM result explanation can share a bounded summary representation.

This phase does not add Hermes/LLM, does not generate AI explanations, does not rerun analysis, does not store raw large result data in sessionStorage, and does not modify SmartAnalysis.

## Files Inspected

- `app/src/types/api.ts`
- `app/src/api/analysis.ts`
- `app/src/pages/History.tsx`
- `app/src/components/results/`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/pages/Statistics.tsx`
- `app/src/pages/Forecast.tsx`
- `app/src/pages/PathAnalysis.tsx`
- `app/src/pages/Attribution.tsx`
- `app/src/lib/adapters/*ResultAdapter.ts`

## Current Result Shape Findings

`Analysis` contains metadata plus optional `result_data`, `ai_interpretation`, and `ai_recommendations`.

Observed result shapes are intentionally heterogeneous:

- Statistics and Semantic: column summary/statistics tables, quality signals, optional `ai_summary`.
- Forecast: single or batch forecast summaries, forecast rows, decomposition tables, model metrics, chart-ready series.
- PathAnalysis: funnel steps, path rows, nodes, rules, frequent patterns, sequence statistics.
- Attribution: summary metrics, touchpoint tables, model comparison rows, chart-ready model comparison data.
- History: can still display detailed/raw-ish result data, including object fallback rendering.

## Files Created

- `app/src/types/resultSummary.ts`
- `app/src/lib/assistant/safeResultSummary.ts`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`

## Files Modified

- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/pages/History.tsx`
- `app/src/lib/assistant/assistantRuntime.ts`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Data Contract

`SafeResultSummary` includes:

- analysis metadata;
- dataset metadata;
- status;
- existing AI summary or interpretation;
- capped result keys;
- capped metrics;
- capped tables;
- chart/config summaries;
- warnings;
- available actions.

The helper returns safe empty summaries for invalid or null result data.

## Truncation Rules

- Result keys: 20.
- Metrics: 8.
- Tables: 3.
- Rows per table: 5.
- Columns per table: 12.
- Warnings: 8.
- Long strings are truncated.
- Nested objects are summarized by counts or key names.

## UI Changes

AI Workbench inline "原结果预览" now renders from `buildSafeResultSummary`.

History dialog now includes a compact "安全结果摘要" from the same helper while preserving the existing detailed result section.

## Runtime Preparation

`AssistantContext` now has optional `analysis_history_summary?: SafeResultSummary`.

The rule-based runtime does not use this field yet. No Hermes/LLM call was added.

## Validation Results

- `cd app && npx tsc --noEmit`
- `cd app && npm run build`
- `git status`

## Manual QA Checklist

- [ ] Select analysis history in AI Workbench.
- [ ] Click `查看原结果`.
- [ ] Inline preview still works.
- [ ] Table preview is capped to 5 rows.
- [ ] Unknown result shapes do not crash.
- [ ] Open `/app/history?analysis_id=<id>`.
- [ ] History result dialog opens and shows the same compact summary contract.
- [ ] No raw large result data is stored in sessionStorage.
- [ ] No AI explanation is generated.
- [ ] No analysis auto-runs.
- [ ] Existing dataset and relationship-set context panels still work.

## Known Limitations

- The helper is deterministic and shape-based; it does not infer analytical meaning beyond existing metadata.
- History still preserves its detailed result section and export behavior for users who explicitly open/download full results.
- ResultView does not yet render `SafeResultSummary` directly.

## Next Recommended Phase

Use `SafeResultSummary` as the input contract for a future result explainer, after defining the exact backend/Hermes boundary.
