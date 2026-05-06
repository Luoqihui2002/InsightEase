# Phase 4B-10F: Roadmap Consolidation and Phase 5 Planning

## Objective

Consolidate the InsightEase roadmap so it reflects real project progress and the new next-stage direction.

This phase is documentation-only. It does not modify application source code, backend code, Hermes behavior, join execution, or product behavior.

## Files Inspected

- `docs/README.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/design/MULTI_TABLE_ANALYSIS_DATASET_BUILDER_DESIGN.md`
- `docs/phase-logs/PHASE_4B_10E_MULTI_TABLE_ANALYSIS_DATASET_BUILDER_DESIGN.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/qa/AI_WORKBENCH_QA_RECIPES.md`
- `docs/qa/AI_WORKBENCH_DEMO_SCENARIOS.md`
- `docs/phase-logs/PHASE_4B_10D_RESULT_PAGE_AI_WORKBENCH_HANDOFF.md`

## Why Consolidation Was Needed

The previous `docs/ROADMAP.md` still presented an old Phase 4A stage as current, mixed completed Phase 4A stabilization work with active planning, repeated older AI assistant/Hermes sections, duplicated `4B-9: Result Explainer`, and kept Dashboard/ECharts as the immediate Phase 5 direction.

Recent work changed the project center of gravity:

- Phase 4A is complete.
- Phase 4B has mostly completed the AI Workbench and Hermes-ready assistant foundation.
- Hermes live remains future work, with dry-run only implemented.
- Multi-table Analysis Dataset Builder design identified the next major execution gap.
- Current single-table analysis modules need a user-confirmed derived dataset bridge for multi-table plans.

## Old Sections Removed or Restructured

- Old header saying the current stage was Phase 4A-6-1.
- Long detailed Phase 4A subphase listing as the primary roadmap body.
- Duplicate old Phase 4B AI Assistant / Hermes Agent Research sections.
- Repeated `4B-9: Result Explainer` entries.
- Phase 4C DataWorkshop component split as a primary future phase.
- Old immediate Phase 5 Dashboard & ECharts Upgrade.
- Old broad Phase 6 Statistical Analysis Platform Completion bucket.

Detailed history remains available in `docs/CURRENT_PROGRESS.md`, `docs/CHANGELOG.md`, and `docs/phase-logs/`.

## New Roadmap Structure

The roadmap now uses:

1. Phase 4A: Engineering Stabilization - completed.
2. Phase 4B: AI Workbench & Hermes-ready Assistant - in progress / near closure.
3. Phase 5: Multi-table Analysis Execution Layer.
4. Phase 6: Productization & Reliability.
5. Phase 7: Advanced Analytics / Dashboard / Reporting.

## Phase 4B Remaining Plan

Remaining Phase 4B items are:

- 4B-10F Roadmap Consolidation and Phase 5 Planning.
- 4B-11A Hermes Live Readiness Review.
- 4B-11B Hermes Result Explainer Live Adapter.
- 4B-11C Hermes Plan Analysis Live Adapter.
- 4B-11D AI Error Explainer.

Phase 4B exit criteria now emphasize:

- AI Workbench stability as the main assistant shell.
- Hermes live result explanation from `SafeResultSummary`.
- Hermes live structured planning from bounded metadata context.
- deterministic fallback.
- no automatic joins, SQL, analysis execution, or dataset mutation.
- multi-table execution moves to Phase 5.

## Phase 5 Plan

Phase 5 is now the Multi-table Analysis Execution Layer.

Subphases:

- 5A Join Builder Contract and Frontend Mock.
- 5B Backend Join Preview Service.
- 5C Temporary Analysis Dataset.
- 5D Save Joined Dataset.
- 5E Multi-table Plan -> Join Builder -> Analysis Page.

Safety model:

- no silent join;
- no silent save;
- no auto-run after join;
- source datasets are never mutated;
- many-to-many joins require warning/override;
- high-risk joins require confirmation;
- derived datasets are clearly labeled.

## Phase 6 Plan

Phase 6 is now Productization & Reliability.

Subphases:

- 6A Server-side Dataset / History Search.
- 6B Catalog + Relationship Set Persistence.
- 6C Permissions / Privacy / Audit Logs.
- 6D Automated Browser QA.
- 6E Performance / Large Dataset Handling.

## Phase 7 Plan

Phase 7 now contains the old Dashboard / Advanced Statistics / Reporting ideas:

- 7A Dashboard Builder.
- 7B Advanced Statistical Modules.
- 7C Report Generation.
- 7D Demo / Resume Polish.

## Files Modified

- `docs/ROADMAP.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/phase-logs/PHASE_4B_10F_ROADMAP_CONSOLIDATION_AND_PHASE5_PLANNING.md`

## Validation

- `git status`: docs-only changes.

Frontend/backend validation is not required because no application or backend source files changed.

## Next Recommended Phase

Recommended order:

```text
4B-11A Hermes Live Readiness Review
-> 4B-11B Hermes Result Explainer Live Adapter
-> 4B-11C Hermes Plan Analysis Live Adapter
-> Phase 5A Join Builder Contract and Frontend Mock
```

Reason: finish the Phase 4 Hermes advisory loop first, then enter Phase 5 multi-table execution with a clear confirmation and safety model.
