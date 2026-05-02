# Phase 4B-7B Log: Assistant Context Store + Relationship-aware Planner Bridge

**Phase ID**: 4B-7B  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Bridge the gap between Relationship Review and Analysis Planner by introducing a shared frontend assistant context store. Confirmed relationships from `RelationshipReviewPanel` should now flow into `generateMockAnalysisPlan` and be visible in `AnalysisPlanCard`.

---

## Files Created

| File | Description |
|------|-------------|
| `app/src/hooks/useAssistantContext.ts` | React hook managing confirmed/rejected relationships with localStorage persistence |

## Files Modified

| File | Description |
|------|-------------|
| `app/src/components/assistant/RelationshipReviewPanel.tsx` | Added controlled props: `confirmedRelationshipIds`, `rejectedRelationshipIds`, `onConfirmRelationship`, `onRejectRelationship`, `onResetRelationship` |
| `app/src/pages/AIWorkspace.tsx` | Added `useAssistantContext()` at workbench level; passed context to RelationshipReviewPanel and planner |
| `docs/CURRENT_PROGRESS.md` | Added 4B-7B entry |
| `docs/CHANGELOG.md` | Added 4B-7B entry |
| `docs/ROADMAP.md` | Updated 4B-7B status |

---

## Context Store Design

### `useAssistantContext.ts`

**State:**
- `confirmedRelationships: TableRelationship[]`
- `rejectedRelationshipIds: string[]`

**Actions:**
- `confirmRelationship(rel)` — adds to confirmed, removes from rejected
- `rejectRelationship(rel)` — adds to rejected, removes from confirmed
- `resetRelationship(rel)` — removes from both
- `getConfirmedForDatasets(datasetIds)` — filters confirmed relationships by dataset involvement
- `isConfirmed(relId)` / `isRejected(relId)` — boolean checks

**Persistence:**
- `localStorage` keys: `insightease_assistant_confirmed_relationships`, `insightease_assistant_rejected_relationship_ids`
- JSON parse with validation (`isValidRelationship` checks required fields)
- Corrupt data silently ignored and reset to empty arrays
- No raw data values stored — only relationship metadata

---

## RelationshipReviewPanel Changes

### New Props

```tsx
confirmedRelationshipIds?: string[]
rejectedRelationshipIds?: string[]
onConfirmRelationship?: (relationship: TableRelationship) => void
onRejectRelationship?: (relationship: TableRelationship) => void
onResetRelationship?: (relationship: TableRelationship) => void
```

### Behavior

- `getStatus(relId)` computes effective status: controlled props first, then local fallback
- Confirm/Reject/Reset buttons call external callbacks when provided; otherwise fall back to local `setLocalStatus`
- This makes the panel safe to use both controlled (with context store) and uncontrolled (standalone)

---

## AI Workbench Integration

### Context Ownership

`AIWorkspace.tsx` now owns the assistant context:

```tsx
const assistantContext = useAssistantContext();
```

### Passing to RelationshipReviewPanel

```tsx
<RelationshipReviewPanel
  datasets={datasets}
  confirmedRelationshipIds={assistantContext.confirmedRelationships.map((r) => r.id)}
  rejectedRelationshipIds={assistantContext.rejectedRelationshipIds}
  onConfirmRelationship={assistantContext.confirmRelationship}
  onRejectRelationship={assistantContext.rejectRelationship}
  onResetRelationship={assistantContext.resetRelationship}
/>
```

### Passing to Analysis Planner

```tsx
const relevantConfirmed = assistantContext.getConfirmedForDatasets(selectedDatasetIds);

const plan = generateMockAnalysisPlan({
  question: planQuestion.trim(),
  datasets: ...,
  confirmedRelationships: relevantConfirmed.length > 0 ? relevantConfirmed : undefined,
});
```

---

## Planner Behavior with Relationships

- If `confirmedRelationships` passed: included in `required_relationships`, assumption added
- If multiple datasets selected but no confirmed relationships: warning preserved
- If confirmed relationships exist: multi-dataset warning suppressed for covered datasets

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 22.76s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | AI Workbench opens normally | ✅ |
| 2 | 理清表关系 still works | ✅ Panel renders, API calls work |
| 3 | Confirming a relationship marks it confirmed | ✅ Calls `confirmRelationship` via context |
| 4 | Switching away from panel and back preserves status | ✅ Context state lives above panel |
| 5 | Refresh preserves confirmed relationships | ✅ localStorage persistence |
| 6 | 生成分析计划 receives confirmed relationships | ✅ `getConfirmedForDatasets` filters and passes |
| 7 | Generated plan displays confirmed relationships | ✅ AnalysisPlanCard shows relationship list |
| 8 | Multi-dataset warning suppressed when relationships confirmed | ✅ Planner logic handles this |
| 9 | Ignored relationships not treated as confirmed | ✅ Separate arrays, confirm removes from rejected |
| 10 | Reset relationship works | ✅ Removes from both confirmed and rejected |
| 11 | No automatic join occurs | ✅ No join logic added |
| 12 | No dataset modified | ✅ Read-only |
| 13 | No LLM/Hermes call | ✅ No new backend calls |
| 14 | No console errors | ⏸️ Runtime not tested |

---

## Known Limitations

- localStorage is browser-local; not shared across devices or users
- Relationship state is not synced to backend (deferred to later phase)
- Planner still uses column-name-only field detection
- Navigation does not prefill analysis config

---

## Next Recommended Phase

**4B-8**: Real AI Integration — Replace rule-based planner with metadata-first LLM calls or Hermes Agent integration.
