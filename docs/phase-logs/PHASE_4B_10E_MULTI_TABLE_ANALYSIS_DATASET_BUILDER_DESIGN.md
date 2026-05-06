# Phase 4B-10E: Multi-table Analysis Dataset Builder Design

## Objective

Design the missing bridge between multi-table AI planning and single-table analysis modules.

AI Workbench can reason about Relationship Sets and multi-table plans, but existing analysis modules mostly expect one dataset. This phase defines a safe Join Builder workflow without implementing joins.

## Scope

Included:

- Multi-table Analysis Dataset Builder design.
- JoinPlan, JoinStep, and JoinPreview concepts.
- AI Workbench UX proposal.
- AnalysisPlanCard integration rules.
- Future backend API proposal.
- Hermes/tool registry implications.
- Implementation roadmap.
- QA and project documentation updates.

Excluded:

- No application source code changes.
- No backend execution changes.
- No joins.
- No dataset creation.
- No SQL generation.
- No Hermes/LLM integration.
- No analysis auto-run.

## Files Created

- `docs/design/MULTI_TABLE_ANALYSIS_DATASET_BUILDER_DESIGN.md`
- `docs/phase-logs/PHASE_4B_10E_MULTI_TABLE_ANALYSIS_DATASET_BUILDER_DESIGN.md`

## Files Modified

- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/qa/AI_WORKBENCH_QA_RECIPES.md`

## Design Summary

The design formalizes:

- Relationship Set as allowed context only.
- Join Plan as a user-confirmed execution plan.
- Join Step as an explicit left/right dataset-column join.
- Join Preview as bounded row/column preview plus quality warnings.

The proposed user flow:

1. Select Relationship Set.
2. Select analysis-specific tables.
3. Select join relationships.
4. Select columns to keep.
5. Preview joined result.
6. Confirm temporary or saved derived dataset.
7. Open target analysis page with the derived dataset.

## Safety Contract

- The system may suggest join paths.
- Preview only runs after user action.
- Temp dataset creation requires explicit confirmation.
- Saving a joined dataset requires explicit confirmation.
- Source datasets are never mutated.
- Many-to-many joins are blocked by default or require explicit override.
- High-risk joins require extra confirmation.
- Target analysis pages must not auto-run after a derived dataset prefill.
- Hermes may propose tools in the future but cannot execute them silently.

## Proposed Future APIs

- `POST /api/v1/assistant/join/preview`
- `POST /api/v1/assistant/join/create-temp`
- `POST /api/v1/assistant/join/save-dataset`

The design includes request/response shapes for preview, temporary datasets, and saved derived datasets.

## AnalysisPlanCard Integration

Future behavior:

- single required dataset -> direct prefill remains allowed;
- multiple required datasets with no joined dataset -> show `创建分析数据集`;
- no required dataset -> ask user to select/confirm dataset;
- existing wide table -> allow `选择已有宽表`;
- Relationship Set remains context and is not automatic join input.

## Hermes / Tool Registry Notes

Future tools:

- `preview_join`: execute, requires confirmation;
- `create_temp_analysis_dataset`: execute, requires confirmation;
- `save_joined_dataset`: write, requires confirmation.

Hermes must not generate arbitrary SQL, bypass confirmations, mutate source datasets, or auto-run target analysis.

## Validation Results

- `git status`: docs-only changes.

Frontend/backend validation was not required because no application or backend source files changed.

## Known Limitations

- This phase is design-only.
- No Join Builder UI exists yet.
- No backend preview/create/save endpoints exist yet.
- Current analysis modules still require a single dataset until future implementation phases.

## Next Recommended Phase

Phase 4B-10F: Join Builder Contract and Frontend Mock.
