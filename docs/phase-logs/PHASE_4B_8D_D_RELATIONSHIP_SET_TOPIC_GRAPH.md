# Phase 4B-8D-D: Relationship Set as Topic Dataset Graph

## Objective

Redesign Relationship Set semantics from a saved list of confirmed edges into a topic-scoped dataset graph:

- dataset nodes selected or retained for the analysis topic;
- confirmed relationship edges between joinable nodes;
- isolated/reference nodes that are relevant to the topic but not joinable;
- local metadata only, with no backend persistence, SQL generation, Hermes/LLM call, or automatic join.

## Product Contract

- A Relationship Set is an allowed analysis context graph, not a list of datasets required for every plan.
- `AnalysisPlan.required_datasets` is a query-specific subset.
- Active relationship set relationships may be used as planning context, but saved inactive sets are not passed to the planner.
- Isolated nodes are reference context only and are marked `joinable: false`.
- High-risk edges require explicit confirmation before inclusion.

## Files Inspected

- `docs/README.md`
- `docs/CURRENT_ARCHITECTURE.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/phase-logs/PHASE_4B_8D_C_RELATIONSHIP_SET_MANAGEMENT_REDESIGN.md`
- `app/src/types/assistant.ts`
- `app/src/hooks/useAssistantContext.ts`
- `app/src/components/assistant/RelationshipReviewPanel.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/assistant/GuidedQuickAnalysisPanel.tsx`
- `app/src/lib/assistant/ruleBasedAssistantRuntime.ts`
- `app/src/lib/assistant/analysisPlannerMock.ts`
- `app/src/components/assistant/AnalysisPlanCard.tsx`

## Files Modified

- `app/src/types/assistant.ts`
- `app/src/hooks/useAssistantContext.ts`
- `app/src/components/assistant/RelationshipReviewPanel.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/assistant/GuidedQuickAnalysisPanel.tsx`
- `app/src/lib/assistant/assistantRuntime.ts`
- `app/src/lib/assistant/ruleBasedAssistantRuntime.ts`
- `app/src/lib/assistant/analysisPlannerMock.ts`
- `app/src/components/assistant/AnalysisPlanCard.tsx`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Data Model Changes

- Added `RelationshipSetDatasetNode` and `RelationshipSetNodeRole`.
- Extended `RelationshipSet` with `dataset_nodes`.
- Kept `dataset_ids` and `relationships` for backward compatibility.
- Added relationship risk metadata: `risk_reasons` and relationship `source`.
- Added plan display metadata: `relationship_set_id`, `relationship_set_name`, and `reference_dataset_nodes`.

## UI Changes

- Relationship Set Management remains visible before inference.
- Candidate relationships are still grouped by key family.
- Selected relationships create connected dataset nodes.
- Selected datasets that are not part of selected edges appear under `未发现关系的表 / 孤立表`.
- Users can keep an unmatched table as an isolated reference node or exclude it.
- Saved sets summarize connected tables, isolated/reference tables, confirmed relationships, and high-risk relationships.

## Planner Changes

- Runtime context now supports `relationship_set` and `available_dataset_nodes`.
- AIWorkspace no longer passes all datasets as `selected_dataset_ids` when no dataset is manually selected.
- The rule-based planner treats the active relationship set as an allowed graph and infers a deterministic query-relevant subset.
- The planner does not fall back to all active relationship set nodes when no clear match exists; it emits a warning instead.
- `AnalysisPlanCard` separates required datasets, active relationship set, and isolated/reference tables.

## Migration Behavior

- Existing edge-only relationship sets are normalized into graph sets by deriving connected nodes from `relationships` and old `dataset_ids`.
- The old `insightease_assistant_confirmed_relationships` key still migrates once into a legacy relationship set.
- New writes use `insightease_assistant_relationship_sets` with `dataset_nodes`.

## Validation Results

- `cd app && npx tsc --noEmit`: passed.
- `cd app && npm run build`: passed.

## Manual QA Checklist

- [ ] Open AI Workbench -> 能力 -> 理清表关系.
- [ ] Relationship set management is visible before inference.
- [ ] Empty state appears if no saved set exists.
- [ ] Select users/products/events/orders plus an unrelated table.
- [ ] Run inference.
- [ ] Candidate relationships are grouped by key family.
- [ ] Unmatched selected table appears under 未发现关系的表 / 孤立表.
- [ ] User can keep isolated table as reference.
- [ ] User can exclude isolated table.
- [ ] Save selected relationships + kept isolated table as a named relationship set.
- [ ] Saved set shows connected tables, isolated tables, and confirmed relationships.
- [ ] Reopen AI Workbench: saved set persists.
- [ ] New conversation does not delete set.
- [ ] product_id -> user_id or similar mismatch shows high-risk warning.
- [ ] High-risk relationship requires explicit confirmation before inclusion.
- [ ] Planner required datasets are a relevant subset, not all relationship set datasets.
- [ ] Guided Quick Analysis passes only context touching the selected dataset.
- [ ] No automatic join, SQL generation, backend persistence, Hermes/LLM call, or console errors.

## Known Limitations

- Dataset relevance is deterministic keyword matching only.
- Relationship sets remain browser-local.
- Isolated nodes are planning context only; no join preview or backend graph persistence is implemented.
