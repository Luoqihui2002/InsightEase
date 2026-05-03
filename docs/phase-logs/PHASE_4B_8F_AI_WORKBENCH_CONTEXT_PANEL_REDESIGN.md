# Phase 4B-8F: AI Workbench Context Panel Redesign

## Objective

Redesign the AI Workbench side area from a simple dataset preview into a reusable Context Panel.

The panel helps users understand the current analysis context:

- selected dataset;
- active relationship set;
- relationship graph details;
- related dataset previews;
- future analysis history context placeholder.

## Product Contract

AI Workbench context has three levels:

1. Dataset context
   - selected single dataset;
   - schema, preview, and quality summary.

2. Relationship set context
   - active relationship set;
   - connected tables;
   - isolated/reference tables;
   - confirmed relationship edges;
   - high-risk relationships;
   - lazy preview for each related table.

3. Future analysis history context
   - placeholder only in this phase.

This phase implements levels 1 and 2 and documents the level 3 placeholder.

## Files Inspected

- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/assistant/RelationshipReviewPanel.tsx`
- `app/src/hooks/useAssistantContext.ts`
- `app/src/types/assistant.ts`
- `app/src/components/DatasetSelector.tsx`
- `app/src/api/datasets.ts`
- `app/src/api/assistant.ts`
- `app/src/components/data-display/DataTablePreview.tsx`

## Files Created

- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`

## Files Modified

- `app/src/pages/AIWorkspace.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`

## Current Render Path Before Change

`AIWorkspace.tsx` rendered dataset preview directly in two layout branches:

- vertical: top preview block when `mainLayout === "vertical" && showPreview && datasetPreview`;
- horizontal: right preview block when `mainLayout === "horizontal" && showPreview && datasetPreview`.

If no dataset preview existed, the right-side context disappeared or felt blank. Relationship-set context was not represented in the preview area.

## Context Panel States

### Empty Context

When no dataset and no relationship set is selected, the panel shows a helpful empty state:

- choose a dataset to inspect fields and sample rows;
- choose a relationship set to inspect tables and edges;
- future analysis history context placeholder.

### Dataset Context

When a dataset is selected, the panel shows:

- dataset name;
- row count;
- column count;
- quality score if available;
- first 5 rows via preview API;
- field summary from schema.

### Relationship Set Context

When a relationship set is active, the panel shows:

- relationship set name;
- included dataset count;
- relationship edge count;
- connected tables;
- isolated/reference tables;
- confirmed relationships;
- high-risk relationships.

If both a dataset and relationship set are selected, the dataset is shown as the primary focus and the relationship set is shown as surrounding context.

## Lazy Preview Behavior

- The selected primary dataset preview loads automatically as dataset context.
- Relationship-set table cards are collapsed by default.
- Clicking `查看前 5 行` fetches preview for that dataset only.
- Preview results are cached in component state for the current session.
- Preview rows are not persisted to sessionStorage or localStorage.
- The panel does not fetch every relationship-set table at once.

## Relationship Set Display Behavior

- Connected nodes show table label, role, row/column counts, and lazy preview action.
- Isolated/reference nodes show copy explaining they will not automatically participate in joins.
- Confirmed relationship edges show source/target columns, relationship type, and risk level.
- High-risk edges are visually marked and include caution copy.

## Layout Behavior

- Horizontal layout now reserves the right side for the Context Panel even when no dataset preview exists.
- Vertical layout uses the same component as a compact top context area.
- The panel uses `min-h-0`, `overflow-hidden`, and `overflow-y-auto` to preserve Workbench scrolling behavior.

## Validation Results

- `cd app && npx tsc --noEmit`: passed.
- `cd app && npm run build`: passed with the existing Vite large chunk warning.

## Manual QA Checklist

- Open AI Workbench with no dataset and no relationship set.
- Context Panel shows the empty context state.
- Select one dataset.
- Context Panel shows dataset summary, schema, and first 5 preview rows.
- Select an active relationship set.
- Context Panel shows relationship set name, connected tables, isolated/reference tables, and confirmed edges.
- High-risk edges are marked.
- Click `查看前 5 行` on one relationship-set table.
- Only that table preview loads.
- Select both a dataset and a relationship set.
- Context Panel shows the dataset as primary focus plus relationship set context.
- Horizontal layout uses the right side effectively.
- Vertical layout remains scrollable.
- Existing AI Workbench session persistence still works.
- RelationshipReviewPanel still works.
- GuidedQuickAnalysisPanel still works.
- Forecast/Path/Attribution/Statistics prefill still works.
- Dataset and relationship-set search still works.
- No console errors.

## Known Limitations

- Analysis history context is a placeholder only.
- Relationship graph is displayed as grouped cards and edge rows, not as a visual node-link graph.
- Selected dataset preview still uses the existing dataset preview API and first 5 rows only.

## Next Recommended Phase

Implement analysis history context selection and add a compact graph visualization for relationship sets if users need visual topology.
