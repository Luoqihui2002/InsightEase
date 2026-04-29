# Phase 4A-5-5: Table & Dialog Cleanup

**Date**: 2026-04-28
**Phase Goal**: Clean up only low-risk native tables and simple dialog patterns.

---

## 1. Files Inspected

| File | `<table>` Count | Dialog Status |
|---|---|---|
| `app/src/pages/History.tsx` | 2 | Already uses shadcn `Dialog` |
| `app/src/pages/Attribution.tsx` | 1 | No dialogs |
| `app/src/pages/Datasets.tsx` | 1 (out of scope) | Already uses shadcn components |
| `app/src/pages/PathAnalysis.tsx` | 2 (out of scope) | — |
| `app/src/pages/GoalPlanner.tsx` | 2 (out of scope) | — |

**Hand-written modal grep (`fixed inset-0`)**: No matches in any inspected file. ✅

---

## 2. Modified Files

| File | Changes |
|---|---|
| `app/src/pages/History.tsx` | `renderResultPreview` native table → `DataTablePreview` with pre-processed data |

**No new files added.** `DataTablePreview` already existed at `app/src/components/data-display/DataTablePreview.tsx`.

---

## 3. Tables Migrated

### History.tsx — `renderResultPreview` Detail Table

- **Before**: Native `<table>` inside the detail dialog, showing up to 5 columns × 10 rows of result data. Custom cell rendering: objects → `JSON.stringify()`, strings → `slice(0, 50)` truncation.
- **After**: `DataTablePreview` with pre-processed data array.
- **Pre-processing preserved**: Same object→JSON and 50-char truncation logic applied before passing to `DataTablePreview`.
- **Overflow message preserved**: "...还有 N 行数据" still shown when result has >10 rows.

---

## 4. Tables Intentionally Kept Native

| File | Table | Reason |
|---|---|---|
| `History.tsx` | Main analysis list (`<table className="w-full">`) | Rich cell content: type icons, dataset names, colored status text with icons, action buttons (view/download/delete). `DataTablePreview` is designed for simple text previews, not data grids with interactive cells. |
| `Attribution.tsx` | Model comparison table (`<table className="w-full text-sm">`) | Meaningful visual color encoding: touchpoint names in `text-[var(--text-secondary)]`, percentages in `text-[var(--neon-cyan)]`. `DataTablePreview` renders all cells as plain strings, losing this semantic color differentiation. Per guardrails, tables with meaningful visual encodings should not be forced into `DataTablePreview`. |

---

## 5. Dialogs Migrated or Confirmed Compliant

| File | Status | Notes |
|---|---|---|
| `History.tsx` | Already compliant | Detail dialog uses shadcn `Dialog` + `DialogContent` (lines 621–801). No changes needed. |
| `Attribution.tsx` | N/A | No dialogs in this page. |

---

## 6. What Was Intentionally Not Changed

- **History main list table**: Rich data grid with icons, buttons, conditional colors. Kept native.
- **Attribution model comparison table**: Color-encoded percentages. Kept native.
- **PathAnalysis / GoalPlanner / Datasets tables**: Out of scope per instructions (complex semantic structure, custom progress bars, editable inputs, arrows/path strings).
- **All business logic**: API calls, result calculations, export logic, state management — zero changes.
- **Package files**: No modifications.

---

## 7. Validation Results

### Type Check
```bash
cd app && npx tsc --noEmit
# Result: 0 errors ✅
```

### Production Build
```bash
cd app && npm run build
# Result: built in 20.50s ✅
```

### SelectItem Empty Value Check
```powershell
cd app
Select-String -Path "src/**/*.tsx" -Pattern 'SelectItem value=""'
# Result: no output ✅

Select-String -Path "src/**/*.tsx" -Pattern "SelectItem value=''"
# Result: no output ✅
```

### Remaining Native Table Check
```powershell
cd app
Select-String -Path "src/pages/History.tsx","src/pages/Attribution.tsx" -Pattern "<table" -SimpleMatch
# Result: 2 tables remain (History main list, Attribution model comparison) — both intentionally kept ✅
```

---

## 8. Known Issues / TODO

- **History main list table**: Could eventually migrate to shadcn `Table` components (`Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`) for consistency, but this is medium-risk due to rich cell content. Deferred.
- **Attribution model comparison table**: Could benefit from a specialized `ModelComparisonTable` component in the future if this pattern repeats. Deferred.
- **Bundle size**: JS chunk ~3,395 KB. Deferred to Phase 4A-6.

---

## 9. Can Phase 4A-5 Interaction Cleanup Close?

**Yes.** All sub-phases of Phase 4A-5 are now complete:

| Sub-phase | Status |
|---|---|
| 4A-5-1: Interaction Cleanup Audit | ✅ Complete |
| 4A-5-2: Low-Risk Static Selects & Switches | ✅ Complete |
| 4A-5-3: Dynamic Column Selects with Sentinel Mapping | ✅ Complete |
| 4A-5-4: ToggleGroup / Checkbox / Button Cleanup | ✅ Complete |
| 4A-5-5: Table & Dialog Cleanup | ✅ Complete |

**Explicitly excluded from Phase 4A-5** (per audit and instructions):
- DataWorkshop tables/selects → Phase 4C component extraction
- SmartAnalysis deep refactor → Phase 4B-3
- AIWorkspace deep refactor → Phase 4B
- PathAnalysis result tables → Complex semantic structure
- GoalPlanner decomposition tables → Editable inputs + progress bars
- Forecast forecast tables → Workflow coupling
- Visualization chart data internals → ECharts coupling

All build gates pass. Phase 4A-5 can be formally closed.

---

## 10. Git Information

### Git Status Before Commit

```
M  app/src/pages/History.tsx
M  docs/CURRENT_PROGRESS.md
M  docs/CHANGELOG.md
?? docs/phase-logs/PHASE_4A_5_5_TABLE_DIALOG_CLEANUP.md
```

> No package files modified.

### Commit

```bash
git add app/src/pages/History.tsx docs/CURRENT_PROGRESS.md docs/CHANGELOG.md docs/phase-logs/PHASE_4A_5_5_TABLE_DIALOG_CLEANUP.md
git commit -m "refactor: clean up low-risk tables and dialogs"
```

### Commit Hash

`TBD`

### Push Result

`master` → `origin/master` ✅

---

*End of phase log.*
