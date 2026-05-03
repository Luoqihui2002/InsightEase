# Phase 4B-8E: Prefill Navigation Payload from AI Workbench

## Objective

Connect AI Workbench analysis plans to dedicated analysis pages with safe prefilled context.

The handoff carries query-specific dataset IDs and suggested fields from an `AnalysisPlanCard` next action to the destination page. The destination page may preselect a dataset and show or apply exact field-name suggestions, but it must not auto-run analysis.

## Files Inspected

- `app/src/components/assistant/AnalysisPlanCard.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/lib/assistant/analysisPlannerMock.ts`
- `app/src/types/assistant.ts`
- `app/src/App.tsx`
- `app/src/pages/Forecast.tsx`
- `app/src/pages/PathAnalysis.tsx`
- `app/src/pages/Attribution.tsx`

## Route Mapping

- `forecast` -> `/app/forecast`
- `path_analysis` -> `/app/path`
- `attribution` -> `/app/attribution`
- `descriptive`, `ab_test`, `regression` -> `/app/statistics`
- `semantic` -> `/app/semantic`
- `smart_process` -> `/app/data-workshop`

## Files Created

- `app/src/lib/assistant/prefillNavigation.ts`

## Files Modified

- `app/src/types/assistant.ts`
- `app/src/lib/assistant/analysisPlannerMock.ts`
- `app/src/components/assistant/AnalysisPlanCard.tsx`
- `app/src/pages/Forecast.tsx`
- `app/src/pages/PathAnalysis.tsx`
- `app/src/pages/Attribution.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/API_CONTRACTS.md`

## Payload Contract

`AnalysisPrefillPayload` is frontend-only:

- `source: "ai_workbench"`
- `plan_id`
- `analysis_type`
- `dataset_ids`
- `primary_dataset_id`
- `relationship_set_id`
- `relationship_set_name`
- `suggested_fields`
- `user_question`
- `created_at`

`dataset_ids` are populated from the plan's query-specific required dataset IDs, not from all workspace datasets and not from all relationship-set nodes.

## Transfer Mechanism

The AI Workbench next-action click stores the payload in `sessionStorage` under a generated key:

`insightease_analysis_prefill_<plan_id>_<timestamp>_<suffix>`

The destination route receives `?prefill=<key>`. Target pages read and validate the key, then clear it after reading. Invalid JSON, expired payloads, missing keys, or wrong analysis types return `null` and the target page loads normally.

TTL: 24 hours.

## Target Pages Supported

- Forecast
  - Reads forecast payloads.
  - Preselects `primary_dataset_id` when present.
  - Applies exact `time_column` and `target_metric` suggestions when those columns exist.
  - Shows suggestion chips and safety banner.

- PathAnalysis
  - Reads path analysis payloads.
  - Preselects `primary_dataset_id` when present.
  - Applies exact `user_id`, `event_name`, and `time_column` suggestions when those columns exist.
  - Shows suggestion chips and safety banner.

- Attribution
  - Reads attribution payloads.
  - Preselects `primary_dataset_id` when present.
  - Applies exact `user_id`, `dimension`, `time_column`, and `target_metric` suggestions when those columns exist.
  - Shows suggestion chips and safety banner.

## Safety Behavior

- No analysis auto-runs.
- No backend task is created by navigation.
- No auto-join is introduced.
- No SQL is generated.
- No Hermes or LLM call is added.
- No raw dataset values are stored in the prefill payload.
- SmartAnalysis was not modified.

## Manual QA Checklist

- AI Workbench opens.
- Generate a forecast plan and click the forecast next action.
- Forecast opens with `?prefill=<key>`, shows the prefill banner, and does not run analysis.
- Forecast preselects the query-specific dataset when a dataset ID is available.
- Generate a path analysis plan and click the path next action.
- PathAnalysis opens, shows the prefill banner, and does not run analysis.
- Suggested path fields are shown or applied only when exact column names exist.
- Generate an attribution plan and click the attribution next action.
- Attribution opens, shows the prefill banner, and does not run analysis.
- Invalid prefill keys load target pages normally.
- Plans with no required dataset load target pages normally.
- `sessionStorage` does not contain raw dataset values.
- No console errors.

## Validation Results

- `cd app && npx tsc --noEmit`: passed.
- `cd app && npm run build`: passed with the existing Vite large chunk warning.

## Known Limitations

- The first batch supports Forecast, PathAnalysis, and Attribution only.
- Statistics, Semantic, and DataWorkshop route mapping is documented but not yet prefilled.
- Field matching is exact and deterministic. Fuzzy matching remains future work.
- React Router query params are not cleaned from the URL after read; the sessionStorage payload is cleared.

## Next Recommended Phase

Add the same safe reader pattern to Statistics and Semantic, then consider a reusable prefill banner component if more target pages adopt this contract.
