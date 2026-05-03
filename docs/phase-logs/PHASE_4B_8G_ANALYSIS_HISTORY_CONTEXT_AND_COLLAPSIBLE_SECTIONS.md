# Phase 4B-8G: Analysis History Context and Collapsible Sections

## Objective

Improve AI Workbench Context Panel usability by making context modules collapsible and adding an initial, safe analysis history context block.

This phase keeps the existing safety contract: no Hermes/LLM, no automatic analysis execution, no automatic joins, no SQL generation, no dataset mutation, and no SmartAnalysis changes.

## User-Reported Need

Phase 4B-8F made the right-side AI Workbench area useful, but the panel can become too long when dataset context, relationship graph details, table previews, and future history context are all visible. Users need module-level collapse controls and an initial way to attach a previous analysis result as context for future follow-up work.

## Files Inspected

- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/pages/History.tsx`
- `app/src/api/analysis.ts`
- `app/src/types/assistant.ts`
- `app/src/types/api.ts`
- `app/src/components/results/`

## Files Modified

- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Collapsible Section Design

The Context Panel now uses reusable section behavior inside `AIWorkbenchContextPanel`.

Each section has:

- a clickable button header;
- expand/collapse icon;
- optional subtitle;
- optional badge;
- accessible `aria-expanded` semantics;
- `hidden` content instead of destructive unmounting, so local UI state is preserved where practical.

Section open/closed state is stored in:

```text
sessionStorage.insightease_ai_workbench_context_panel_sections
```

Only boolean section states are stored. No preview rows or raw result data are persisted.

## Default Open / Closed Rules

Expanded by default:

- current primary dataset summary;
- active relationship set summary;
- selected analysis history summary;
- high-risk relationship section when high-risk edges exist.

Collapsed by default:

- sample rows;
- field summary when many fields exist;
- isolated/reference tables;
- confirmed relationship edges when there are more than three;
- relationship-set table previews.

Connected tables are open by default for small relationship sets and collapsed for larger sets.

## Analysis History Data Source

The initial history context uses the existing frontend analysis API:

```text
analysisApi.list(page, pageSize)
```

The underlying item shape is `Analysis` from `app/src/types/api.ts`:

- `id`
- `dataset_id`
- `type`
- `status`
- `params`
- optional `result_data`
- optional `ai_interpretation`
- optional `ai_recommendations`
- `created_at`
- optional `completed_at`
- optional `error_msg`

The history context derives a compact summary from metadata, `ai_interpretation`, recommendation count, or top-level result keys. It does not render full result tables.

## History Context Behavior

The Context Panel includes an "analysis history context" module:

- loads a small recent-history list;
- supports keyword search by type, dataset id, status, and created time;
- lets users select one history item;
- shows a safe summary with type, dataset, status, and created time;
- provides "view original result" navigation to History;
- supports clearing selected history context.

No AI explanation is generated in this phase. The copy explicitly says this context is for future explanation and follow-up support.

## Session Persistence Behavior

`AIWorkspace` now stores only the selected history id in the active session snapshot:

```text
selected_analysis_history_id
```

It does not store raw result data. Closing and reopening AI Workbench restores the selected history context id along with the existing session state.

## Validation Results

- `cd app && npx tsc --noEmit`
- `cd app && npm run build`
- `git status`

Validation was run after implementation.

## Manual QA Checklist

- [ ] Open AI Workbench.
- [ ] Select one dataset.
- [ ] Confirm current dataset, sample rows, and field summary sections can collapse and expand.
- [ ] Select an active relationship set.
- [ ] Confirm connected tables, isolated/reference tables, confirmed relationships, and high-risk relationships can collapse and expand.
- [ ] Confirm high-risk relationships remain prominent when present.
- [ ] Confirm lazy table preview still loads only after clicking a table preview action.
- [ ] Confirm the analysis history context section appears.
- [ ] If history exists, select a history item and see a compact safe summary.
- [ ] Clear the selected history context.
- [ ] Close and reopen AI Workbench; selected history id is restored without storing raw result rows.
- [ ] Confirm no analysis runs automatically.
- [ ] Confirm RelationshipReviewPanel, GuidedQuickAnalysisPanel, and prefill navigation still work.

## Known Limitations

- The history summary is deterministic and metadata-based; it is not an AI result explanation.
- The selected history context is not yet used by the rule-based planner.
- The "view original result" action opens the History page rather than a deep-linked result detail when no stable detail route is available.

## Next Recommended Phase

Add a safe result-summary contract that can be reused by History, ResultView, and AI Workbench before connecting any future AI result explainer.
