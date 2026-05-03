# Phase 4B-8D-C: Relationship Set Management Redesign

## Objective

Redesign AI Workbench relationship confirmation from a flat global confirmed-edge list into user-managed Relationship Sets.

## Files Inspected

| File | Purpose |
|---|---|
| `docs/README.md` | Documentation entrypoint |
| `docs/CURRENT_ARCHITECTURE.md` | Current architecture summary |
| `docs/CURRENT_PROGRESS.md` | Current phase status |
| `docs/CHANGELOG.md` | Historical implementation log |
| `docs/ROADMAP.md` | Phase roadmap |
| `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md` | Runtime context contract |
| `docs/phase-logs/PHASE_4B_8D_GUIDED_QUICK_ANALYSIS_IN_AI_WORKBENCH.md` | Prior 4B-8D/B/B.1 context |
| `app/src/hooks/useAssistantContext.ts` | Actual relationship state owner |
| `app/src/components/assistant/RelationshipReviewPanel.tsx` | Actual relationship review UI |
| `app/src/pages/AIWorkspace.tsx` | Planner/runtime context assembly |
| `app/src/components/assistant/GuidedQuickAnalysisPanel.tsx` | Quick analysis runtime context |

## Audit Summary

- The previous implementation stored confirmed relationships as a flat global edge list.
- The list was persisted in `localStorage["insightease_assistant_confirmed_relationships"]`.
- `RelationshipReviewPanel` rendered a global confirmed section and a flat candidate list with row-level confirm/ignore actions.
- `AIWorkspace` scoped that global list at runtime via `getConfirmedForDatasets`, but the model still lacked named analysis contexts.
- Manual QA correctly identified that the flat model was insufficient for set selection, lifecycle, and planner clarity.

## Files Modified

| File | Changes |
|---|---|
| `app/src/types/assistant.ts` | Added `RelationshipSet`, `RelationshipSetSummary`, `RelationshipRiskLevel`, and optional risk metadata on `TableRelationship` |
| `app/src/hooks/useAssistantContext.ts` | Replaced primary flat confirmed state with localStorage-backed relationship sets and active-set state; added migration from legacy confirmed key |
| `app/src/components/assistant/RelationshipReviewPanel.tsx` | Rebuilt UI around relationship set management, grouped selectable candidates, save-as-set flow, rename/delete/clear active set, and high-risk warning confirmation |
| `app/src/pages/AIWorkspace.tsx` | Added compact active relationship set selector; planner/runtime now receives only active set relationships |
| `app/src/components/assistant/GuidedQuickAnalysisPanel.tsx` | Uses active relationship set only, scoped to relationships touching the selected dataset |
| `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md` | Updated context contract to active relationship set semantics |
| `docs/CURRENT_PROGRESS.md` | Added phase status |
| `docs/CHANGELOG.md` | Added implementation log |
| `docs/ROADMAP.md` | Added 4B-8D-C completion entry |

## New localStorage Keys

| Key | Purpose |
|---|---|
| `insightease_assistant_relationship_sets` | Saved relationship sets |
| `insightease_assistant_active_relationship_set_id` | Current active relationship set |

## Migration

If legacy `insightease_assistant_confirmed_relationships` exists and no new relationship-set storage exists, the hook creates one set:

- name: `旧版已确认关系`
- source: `inferred`
- relationships: old confirmed relationships
- active by default

The new implementation does not continue writing the old confirmed relationship format.

## Behavior

- Relationship set management is visible before inference.
- Inference results remain temporary candidate relationships.
- Candidate rows use checkbox selection instead of permanent row confirmation.
- Candidate relationships are grouped by key family (`user_id`, `product_id`, `order_id`, `campaign_id`, or `其他 / 需人工确认`).
- Saving selected candidates creates a named relationship set and sets it active.
- High-risk relationships require explicit confirmation before selection.
- Active set can be switched, renamed, deleted, or cleared.
- New conversation does not delete relationship sets.
- No backend persistence, auto-join, SQL generation, Hermes, or LLM behavior was added.

## Planner Integration

- Chat planning uses `activeRelationshipSet?.relationships ?? []`.
- Standalone plan generation uses `activeRelationshipSet?.relationships ?? []`.
- It no longer passes all saved sets.

## Guided Quick Analysis Integration

Guided quick analysis receives only the active relationship set, then scopes relationships to the selected dataset:

```ts
const scoped = activeSetRelationships.filter(rel =>
  rel.source_dataset_id === selectedDatasetId ||
  rel.target_dataset_id === selectedDatasetId
);
```

If the active set does not touch the selected dataset, the generated plan receives `[]` and the UI shows the single-table hint.

## Validation Results

```bash
cd app
npx.cmd tsc --noEmit  # 0 errors
npm.cmd run build      # built in 20.39s
```

Note: the first sandboxed build failed with esbuild `spawn EPERM`; rerunning the required build with approval completed successfully. Vite still reports the pre-existing large chunk warning.

## Manual QA Checklist

- [ ] Open AI Workbench → 能力 → 理清表关系.
- [ ] Relationship set management section is visible before inference.
- [ ] Empty state appears when no saved sets exist.
- [ ] Select 2+ datasets and infer relationships.
- [ ] Candidate relationships are grouped by key family.
- [ ] User can select multiple candidates.
- [ ] User can save selected candidates as a named relationship set.
- [ ] Saved relationship set appears in management section.
- [ ] Active relationship set selector shows the saved set.
- [ ] New conversation does not delete relationship set.
- [ ] Reopen AI Workbench: relationship set persists.
- [ ] User can delete relationship set.
- [ ] High-risk relation such as `product_id -> user_id` shows warning before selection.
- [ ] Planner uses only active relationship set.
- [ ] Planner does not use all saved sets.
- [ ] GuidedQuickAnalysis uses only active set relationships touching selected dataset.
- [ ] No automatic join occurs.
- [ ] No backend persistence occurs.
- [ ] No console errors.

## Known Limitations

- Relationship sets are browser-local only and not shared across devices.
- Custom relationship creation is limited to high-risk candidate confirmation; a free-form manual relationship editor is deferred.
- Legacy rejected relationship IDs are retained only as compatibility state and are not part of the new primary model.
