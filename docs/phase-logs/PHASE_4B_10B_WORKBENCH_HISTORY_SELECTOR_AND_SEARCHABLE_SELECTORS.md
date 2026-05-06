# Phase 4B-10B: Workbench History Selector Alignment & Unified Searchable Selectors

## Objective

Align AI Workbench selectors with the new Analysis History Catalog behavior and replace split single-selection patterns such as:

```text
search input
native dropdown
```

with one searchable dropdown/combobox.

This phase does not add Hermes/LLM, backend changes, analysis auto-run, dataset mutation, package changes, dependency changes, or SmartAnalysis changes.

## Files Inspected

- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/components/assistant/RelationshipReviewPanel.tsx`
- `app/src/components/DatasetSelector.tsx`
- `app/src/pages/History.tsx`
- `app/src/pages/Datasets.tsx`
- `app/src/pages/SmartProcess.tsx`
- `app/src/pages/DataWorkshop.tsx`
- `app/src/lib/historyCatalog.ts`
- `app/src/types/historyCatalog.ts`

`app/src/pages/DataPreprocessing.tsx` does not exist in the current codebase. The preprocessing-style dataset selector is currently the shared `DatasetSelector` used by `SmartProcess.tsx`.

## Pre-coding Findings

Current selector locations:

- AI Workbench dataset selector: `AIWorkspace.tsx`, split `datasetSearch` input plus native `<select>`.
- AI Workbench relationship set selector: `AIWorkspace.tsx`, split `relationshipSetSearch` input plus native `<select>`.
- AI Workbench history selector: `AIWorkbenchContextPanel.tsx`, split `historySearch` input plus native `<select>`.
- Relationship set management selector: `RelationshipReviewPanel.tsx`, split search input plus select for choosing active relationship set.
- Data preprocessing selector: shared `DatasetSelector`, used by `SmartProcess.tsx`.

The Dataset and History catalog pages keep their standalone search/filter/grouping controls because those are list-level catalog filters, not single-value selectors.

## Files Created

- `app/src/components/ui/SearchableSelect.tsx`
- `docs/phase-logs/PHASE_4B_10B_WORKBENCH_HISTORY_SELECTOR_AND_SEARCHABLE_SELECTORS.md`

## Files Modified

- `app/src/components/DatasetSelector.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/components/assistant/RelationshipReviewPanel.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/qa/AI_WORKBENCH_QA_RECIPES.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/design/ANALYSIS_HISTORY_CATALOG_DESIGN.md`

## Implementation Summary

Added `SearchableSelect`, a dependency-free single-select component with:

- clickable trigger;
- integrated dropdown search input;
- filtering by label, description, badges, and keywords;
- optional badges and descriptions;
- empty state;
- optional clear action.

Updated AI Workbench:

- top dataset selector is now one searchable dropdown;
- dataset search matches filename, id, schema field names, and Dataset Catalog labels/tags;
- top relationship set selector is now one searchable dropdown;
- relationship set search matches name, description, and included dataset labels;
- relationship set management selector uses the same dropdown pattern.

Updated AI Workbench Context Panel:

- analysis history selector is now one searchable dropdown;
- options use Analysis History Catalog metadata;
- search matches analysis type label, status, dataset id/name, created time, AI-ready label, safe-summary labels, and bounded result keys;
- options show status and AI-ready badges.

Updated shared `DatasetSelector`:

- preprocessing-style dataset selection now uses the unified searchable dropdown;
- existing selected dataset behavior remains unchanged.

## Safety Boundaries

- No Hermes/LLM call.
- No backend API/schema change.
- No server-side search.
- No analysis auto-run.
- No dataset mutation.
- No SmartAnalysis change.
- No dependencies or package file changes.

## Manual QA Checklist

AI Workbench dataset selector:

- [ ] Click selector opens dropdown.
- [ ] Typing filters datasets.
- [ ] Selecting dataset works.
- [ ] Clearing selection works.

AI Workbench relationship set selector:

- [ ] Click selector opens dropdown.
- [ ] Typing filters relationship sets.
- [ ] `不使用关系组` remains available.
- [ ] Selecting relationship set updates Context Panel.

AI Workbench history selector:

- [ ] Can search analysis type.
- [ ] Can search dataset name/id.
- [ ] Can search AI-ready/status labels.
- [ ] Selecting history item updates Context Panel.
- [ ] Result follow-up still works.

Data preprocessing / SmartProcess:

- [ ] Dataset search and select are now one control.
- [ ] Typing filters dropdown options.
- [ ] Selecting dataset works.
- [ ] Existing preprocessing behavior is unchanged.

Regression:

- [ ] Datasets page catalog search still works.
- [ ] History page catalog search still works.
- [ ] AI Workbench session persistence still works.
- [ ] Prefill navigation still works.
- [ ] No console errors.

## Validation Results

- `cd app && npx.cmd tsc --noEmit`: passed during implementation.
- `cd app && npm.cmd run build`: passed with the existing Vite large chunk warning.

Backend validation is not required because no backend files changed.

## Known Limitations

- `SearchableSelect` is intentionally lightweight and local; it is not a full ARIA combobox replacement yet.
- Relationship inference dataset picking remains a searchable multi-select list because users must select multiple tables.
- DataWorkshop operation-specific table/column selects are not changed in this phase because they are not the split search+single-select pattern.

## Next Recommended Phase

If selector usage grows, promote `SearchableSelect` into a fuller design-system combobox with richer keyboard navigation and optional grouped options.
