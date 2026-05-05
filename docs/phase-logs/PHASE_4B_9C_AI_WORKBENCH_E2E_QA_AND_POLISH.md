# Phase 4B-9C: AI Workbench End-to-End QA & Polish

## Objective

Run an end-to-end QA and polish pass across the AI Workbench ecosystem after Phase 4B-9B.

The checked flow was:

```text
Dataset Catalog
-> Relationship Set topic graph
-> AI planner candidate narrowing
-> AnalysisPlanCard
-> Prefill navigation
-> Analysis result handoff
-> Safe result summary
-> Result follow-up
-> Hermes dry-run opt-in safety
```

This phase does not add live Hermes/LLM integration, automatic analysis execution, automatic joins, SQL generation, dataset mutation, package changes, backend persistence, or SmartAnalysis changes.

## Scope

Allowed work:

- inspect the full frontend flow;
- fix small regressions and confusing copy;
- make required/candidate dataset display clearer;
- keep prefill navigation safe;
- update phase documentation.

Out of scope:

- new major features;
- Hermes live integration;
- default runtime switch;
- backend changes;
- new dependencies.

## Flows Tested / Audited

Dataset Catalog:

- grouped views by upload day/week/business category/data type/analysis usage;
- catalog search over dataset metadata, schema fields, labels, and analysis tags;
- existing preview/detail/rename/download/delete/batch action paths.

Planner:

- no selected dataset/no relationship set candidate narrowing;
- selected dataset priority;
- active Relationship Set scoping as allowed graph only;
- candidate vs required dataset display.

Navigation:

- AI Workbench plan card prefill payload creation;
- target page readers in Forecast, PathAnalysis, Attribution, and Statistics;
- invalid or empty dataset prefill behavior.

Context and result flow:

- AI Workbench session persistence;
- Context Panel dataset/relationship/history states;
- safe result handoff from History and Statistics;
- deterministic result follow-up responses from `SafeResultSummary`.

Hermes:

- default rule-based provider;
- dry-run provider remains explicit opt-in;
- dry-run failure still falls back to rule-based planning.

## Bugs / Risks Found

1. A plan with no confirmed required dataset could still render a navigation action.
   - Example: a descriptive/statistics prompt without a selected dataset should ask the user to choose a dataset, not create an empty prefill and navigate.

2. Selected-dataset priority was correct but could be misleading for mismatched intent.
   - Example: if a user selects an orders table then asks for path analysis, the selected table remains the priority input, but the planner should warn when catalog signals do not strongly match the question.

3. Candidate dataset copy needed stronger separation from required datasets.
   - Candidate datasets are advisory catalog recommendations and still need user confirmation.

## Fixes Applied

- `analysisPlannerMock.ts`
  - Added a selected-dataset mismatch warning when the question has a specific analysis intent and the selected dataset has no query-specific catalog signal.
  - Suppressed navigation next actions when the plan has no required datasets.
  - Shows a warning next action instead: confirm the required dataset first.

- `AnalysisPlanCard.tsx`
  - Added explanatory copy for required datasets.
  - Added an empty required-dataset state for plans that intentionally need user dataset confirmation.
  - Added explanatory copy for candidate datasets.
  - Disabled navigation buttons defensively when no required dataset is present, preventing empty prefill navigation.

## Files Modified

- `app/src/lib/assistant/analysisPlannerMock.ts`
- `app/src/components/assistant/AnalysisPlanCard.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/design/DATASET_CATALOG_CLASSIFICATION_DESIGN.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/phase-logs/PHASE_4B_9C_AI_WORKBENCH_E2E_QA_AND_POLISH.md`

## Manual QA Checklist

Dataset Catalog:

- [x] Search and grouped views audited in code.
- [x] Existing dataset action paths preserved.

Planner:

- [x] Required datasets are not all datasets.
- [x] Candidate datasets render separately.
- [x] Selected dataset priority works.
- [x] Selected dataset mismatch now warns.
- [x] Relationship set scoping remains query-specific.

Navigation:

- [x] Forecast/Path/Attribution/Statistics prefill readers audited.
- [x] No target page auto-runs analysis.
- [x] Plans without required datasets no longer offer empty prefill navigation.

Context Panel:

- [x] Dataset/relationship/history context paths audited.
- [x] Collapsible state remains session-only.
- [x] Lazy relationship table preview remains per-table.

Result flow:

- [x] History -> AI Workbench handoff audited.
- [x] Statistics -> AI Workbench handoff audited.
- [x] Deterministic follow-up uses `SafeResultSummary`.

Hermes:

- [x] Default provider remains `rule_based`.
- [x] `hermes_dry_run` remains explicit opt-in.
- [x] Dry-run failures fall back to local planner.

Regression:

- [x] RelationshipReviewPanel audited.
- [x] GuidedQuickAnalysisPanel audited.
- [x] Session persistence audited.
- [x] Layout toggle audited.

## Validation Results

- `cd app && npx.cmd tsc --noEmit`: passed.
- `cd app && npm.cmd run build`: passed with the existing Vite large chunk warning.

Backend validation was not required because no backend files changed.

## Known Limitations

- QA was performed through code-path inspection and frontend validation in this environment; no browser click-through evidence is attached.
- Dataset Catalog classification remains deterministic and heuristic.
- Relationship Sets remain browser-local.
- Result follow-up is bounded summary-based text, not deep AI interpretation.
- Forecast, PathAnalysis, and Attribution still do not have direct result-to-Workbench handoff buttons; History and Statistics are wired.
- Semantic and DataWorkshop prefill remain future work.
- Live Hermes remains a separately approved future phase.

## Next Recommended Phase

Add a small QA recipe or developer diagnostics page for replaying Workbench scenarios with seeded demo datasets. Keep live Hermes integration separate and explicitly approved.
