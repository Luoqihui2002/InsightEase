# Phase 4B-9A: Dataset Catalog Classification & Grouped Views

## Objective

Make the Datasets page easier to browse when many tables exist, and prepare deterministic catalog metadata for future AI/Hermes dataset candidate narrowing.

This phase does not add live Hermes, LLM calls, backend persistence, dataset mutation, new dependencies, package changes, or SmartAnalysis changes.

## Required Reading

Docs inspected:

- `docs/README.md`
- `docs/CURRENT_ARCHITECTURE.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/API_CONTRACTS.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/HERMES_BACKEND_API_CONTRACT.md`
- recent Phase 4B-8D-D through 4B-8O phase logs

Code inspected:

- `app/src/pages/Datasets.tsx`
- `app/src/components/DatasetSelector.tsx`
- `app/src/api/datasets.ts`
- `app/src/api/assistant.ts`
- `app/src/types/api.ts`
- `app/src/types/assistant.ts`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/lib/assistant/analysisPlannerMock.ts`
- `insightease-backend/app/schemas/dataset.py`
- `insightease-backend/app/models/models.py`
- `insightease-backend/app/api/v1/endpoints/datasets.py`
- `insightease-backend/app/api/v1/endpoints/assistant.py`
- `insightease-backend/app/services/assistant_profile_service.py`

## Pre-coding Findings

Current Datasets page:

- `Datasets.tsx` renders a flat dataset table inside a `SectionCard`.
- It already supports search by filename, row expansion preview, detail dialog, rename, download, delete, batch download/delete, and upload navigation.
- The detail dialog already includes `DatasetUnderstandingCard`.

Current frontend metadata:

- `Dataset` exposes `id`, `filename`, `row_count`, `col_count`, `file_size`, `schema`, `quality_score`, `ai_summary`, `status`, and `created_at`.
- `FieldSchema` exposes `name`, `dtype`, optional `semantic_type`, and `sample_values`.

Timestamp availability:

- Frontend response exposes `created_at`.
- Backend model has `created_at` and `updated_at`.
- Backend `DatasetResponse` does not expose `updated_at`.
- No `uploaded_at` field exists in the current frontend dataset contract.

Profile/classification availability:

- `assistantApi.profileDataset()` exists and returns deterministic `DatasetProfile` metadata on demand.
- The profile includes table classification and recommended analyses.
- The dataset list does not include profile data, so Phase 4B-9A uses list metadata and schema heuristics only unless optional classification data is already present.

Current dataset selector:

- Shared `DatasetSelector` already has client-side filename search.
- It is not changed in this phase to avoid regressing analysis-page selectors.

## Files Created

- `app/src/types/datasetCatalog.ts`
- `app/src/lib/datasetCatalog.ts`
- `docs/design/DATASET_CATALOG_CLASSIFICATION_DESIGN.md`
- `docs/phase-logs/PHASE_4B_9A_DATASET_CATALOG_CLASSIFICATION_GROUPED_VIEWS.md`

## Files Modified

- `app/src/pages/Datasets.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Implementation Summary

Added deterministic catalog types for:

- business category;
- data type;
- analysis usage tag;
- upload week bucket;
- catalog metadata;
- grouped dataset results.

Added `datasetCatalog` helper functions for:

- `inferDatasetCatalogMetadata`;
- upload day grouping;
- upload week grouping;
- business category grouping;
- data type grouping;
- analysis tag grouping;
- search filtering.

Updated Datasets page:

- search now includes filename, id, schema fields, catalog labels, analysis tags, and upload day;
- group-by control supports default order, upload day, upload week, business category, data type, and analysis usage;
- grouped table headers show the current catalog group and dataset count;
- each dataset row shows business category, data type, and up to three analysis-use badges;
- existing row preview, detail dialog, rename, download, delete, upload, and batch actions remain in the same UI path.

## Safety Boundaries

- No Hermes/LLM call.
- No backend API/schema/model change.
- No catalog persistence.
- No uploaded data mutation.
- No analysis auto-run.
- No relationship-set behavior change.
- No SmartAnalysis change.
- No package or dependency change.

## Validation Results

- `cd app && npx.cmd tsc --noEmit`: passed.
- `cd app && npm.cmd run build`: passed with the existing Vite large chunk warning.

Backend validation is not required because no backend files changed.

## Manual QA Checklist

- [ ] Datasets page loads existing datasets.
- [ ] Search works by filename.
- [ ] Search works by field name and catalog label.
- [ ] Group by upload day works.
- [ ] Group by upload week works.
- [ ] Group by business category works.
- [ ] Group by data type works.
- [ ] Group by analysis usage works.
- [ ] Dataset rows show category/type/analysis badges.
- [ ] Empty search state says no matching dataset.
- [ ] Existing preview expansion still works.
- [ ] Existing detail dialog still works.
- [ ] Existing upload/delete/download/rename/batch actions still work.
- [ ] Users/products/orders/events/marketing/forecast/reviews datasets receive expected deterministic labels.
- [ ] AI Workbench still opens.
- [ ] Dataset selector search still works.
- [ ] Relationship set management still works.
- [ ] Hermes dry-run status/runtime behavior is unchanged.

## Known Limitations

- Catalog metadata is inferred every time on the frontend; it is not persisted.
- Classification depends on filenames and schema, so sparse or ambiguous schemas fall back to low-confidence unknowns.
- Existing on-demand `profileDataset` classification is not bulk-fetched for list rows to avoid extra backend reads.

## Next Recommended Phase

Use catalog metadata as optional bounded context in AI Workbench planner requests, while preserving the priority order: selected dataset, active relationship set nodes, catalog topic, analysis tags, and full library last.
