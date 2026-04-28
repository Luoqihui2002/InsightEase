# Phase 4A-5-4: ToggleGroup / Checkbox / Button Cleanup

**Date**: 2026-04-28
**Phase Goal**: Replace remaining low-to-medium risk handwritten toggle / checkbox / button-like selectors with shadcn components.

---

## 1. Modified Files

| File | Replacements |
|---|---|
| `app/src/pages/Forecast.tsx` | Model selector buttons → `ToggleGroup`; Batch/promotion checkboxes → `Checkbox`; Aux variable toggles → `Checkbox` |
| `app/src/pages/PathAnalysis.tsx` | Analysis type buttons → `ToggleGroup`; 4 checkbox groups → `Checkbox` |
| `app/src/pages/GoalPlanner.tsx` | Decomposition method buttons → `ToggleGroup` |

**No new files added.** All shadcn components (`ToggleGroup`, `ToggleGroupItem`, `Checkbox`) were already present in `app/src/components/ui/`.

---

## 2. Forecast.tsx Replacements

### 2.1 Model Selector (Prophet / LightGBM / SARIMA)

- **Before**: 3 custom `<button>` elements with conditional active classes in a `grid grid-cols-3`.
- **After**: `ToggleGroup type="single"` with 3 `ToggleGroupItem` elements.
- **Values preserved**: `'prophet'`, `'lightgbm'`, `'sarima'`.
- **Styling**: `data-[state=on]` classes replicate original active state (`bg-[var(--neon-cyan)]/20`, `border-[var(--neon-cyan)]`, `text-[var(--neon-cyan)]`).

### 2.2 Batch Prediction Column Checkboxes

- **Before**: Native `<input type="checkbox">` inside `<label>` for each numeric column.
- **After**: `Checkbox` component with `onCheckedChange`.
- **Logic preserved**: 20-item limit, add/remove from `selectedBatchColumns` array.

### 2.3 Promotion Checkboxes

- **Before**: Native `<input type="checkbox">` inside `<label>` for each promotion event.
- **After**: `Checkbox` component with `onCheckedChange`.
- **Logic preserved**: Add/remove from `selectedPromotions` array. Type badge styling (爆发/预热/返场) unchanged.

### 2.4 Auxiliary Variable Toggles

- **Before**: Custom `<button>` card grid (2 cols) with icon + name + description, toggle on click.
- **After**: `Checkbox` inside `<label htmlFor={...}>` with card-like styling preserved.
- **Logic preserved**: Add/remove from `selectedAuxVars`, initialize/remove `whatIfConfig` entry.
- **Note**: Clicking the entire card area toggles the checkbox via `htmlFor` + `id` association.

---

## 3. PathAnalysis.tsx Replacements

### 3.1 Analysis Type Selector (5 Types)

- **Before**: 10 custom `<button>` elements (5 types × 2 states) in a `grid grid-cols-2`.
- **After**: `ToggleGroup type="single"` with 5 `ToggleGroupItem` elements.
- **Values preserved**: `'funnel'`, `'path'`, `'clustering'`, `'key_path'`, `'sequence_mining'`.
- **Icons preserved**: `Filter`, `Route`, `Layers`, `Target`, `Share2`.
- **Styling**: `data-[state=on]` classes replicate original active state.

### 3.2 Sequence Additional Columns Checkbox

- **Before**: Native `<input type="checkbox">` for `sequenceAdditionalCols`.
- **After**: `Checkbox` with `onCheckedChange`.

### 3.3 Clustering Additional Event Columns Checkbox

- **Before**: Native `<input type="checkbox">` for `additionalEventCols`.
- **After**: `Checkbox` with `onCheckedChange`.

### 3.4 Clustering Smart Features Checkbox

- **Before**: Native `<input type="checkbox">` for `selectedSmartFeatures` inside categorized grid.
- **After**: `Checkbox` with `onCheckedChange`.
- **Note**: Surrounding expand/collapse toggle and 全选/清空 buttons unchanged.

### 3.5 Clustering Custom Columns Checkbox

- **Before**: Native `<input type="checkbox">` for `selectedCustomColumns`.
- **After**: `Checkbox` with `onCheckedChange`.

---

## 4. GoalPlanner.tsx Replacements

### 4.1 Decomposition Method Selector

- **Before**: 4 custom `<button>` elements with conditional active classes in a `grid grid-cols-1`.
- **After**: `ToggleGroup type="single"` with 4 `ToggleGroupItem` elements.
- **Values preserved**: `'linear'`, `'seasonal'`, `'momentum'`, `'custom'`.
- **Styling**: `data-[state=on]` classes replicate original active state (`bg-[var(--neon-purple)]/20`, `border-[var(--neon-purple)]`, `text-[var(--neon-purple)]`).

---

## 5. Controls Intentionally Kept Custom

| Page | Control | Reason |
|---|---|---|
| GoalPlanner | Template selection buttons (`applyTemplate`) | Action buttons rather than persistent selected state. `selectedTemplate` is only visual feedback of last click. shadcn `Button` would change visual design significantly. |
| GoalPlanner | Month tag / calendar buttons | Simple filter chips. Replacement would not improve accessibility (they are already `<button>` elements) and would risk changing visual semantics. |
| All 3 pages | Action buttons (Start Analysis, Add Level, Download, etc.) | These are one-shot actions, not toggle/checkbox/select controls. Out of scope. |

---

## 6. What Was Intentionally Not Changed

- **All business logic**: state initialization, API payload construction, ECharts lifecycle, polling logic, CSV export, result rendering — zero changes.
- **GoalPlanner template buttons**: Action buttons with side effects. Kept custom.
- **GoalPlanner month tags**: Filter chips. Kept custom.
- **Result tables**: Native tables in result sections. Deferred to Phase 4A-5-5.
- **DataWorkshop, AIWorkspace, SmartAnalysis**: Explicitly excluded per instructions.
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
# Result: built in 21.32s ✅
```

### Remaining Native Checkbox Check
```powershell
cd app
Select-String -Path "src/pages/Forecast.tsx","src/pages/PathAnalysis.tsx","src/pages/GoalPlanner.tsx" -Pattern 'type="checkbox"' -SimpleMatch
# Result: no output ✅
```

### SelectItem Empty Value Check
```powershell
cd app
Select-String -Path "src/**/*.tsx" -Pattern 'SelectItem value=""'
# Result: no output ✅

Select-String -Path "src/**/*.tsx" -Pattern "SelectItem value=''"
# Result: no output ✅
```

### Remaining Toggle-like Button Check
```powershell
cd app
Select-String -Path "src/pages/Forecast.tsx","src/pages/PathAnalysis.tsx","src/pages/GoalPlanner.tsx" -Pattern "<button" -SimpleMatch
# Result: only action buttons remain (start analysis, add level, download, import, etc.) ✅
```

---

## 8. Known Issues / TODO

- **shadcn ToggleGroup/Checkbox styling**: Default Tailwind semantic classes may not perfectly match the project's custom dark theme CSS variables in all edge cases. Visual regression testing recommended when backend is available.
- **Bundle size**: JS chunk ~3,395 KB. Deferred to Phase 4A-6.

---

## 9. Can the Project Proceed to Phase 4A-5-5?

**Yes.** All low-to-medium risk toggle/checkbox/button selectors have been migrated. Build gate is clean. No native checkboxes remain in the three target pages. Phase 4A-5-5 (Table & Dialog Cleanup) can proceed.

---

## 10. Git Information

### Git Status Before Commit

```
M  app/src/pages/Forecast.tsx
M  app/src/pages/PathAnalysis.tsx
M  app/src/pages/GoalPlanner.tsx
M  docs/CURRENT_PROGRESS.md
M  docs/CHANGELOG.md
?? docs/phase-logs/PHASE_4A_5_4_TOGGLEGROUP_CHECKBOX_CLEANUP.md
```

> No package files modified.

### Commit

```bash
git add app/src/pages/Forecast.tsx app/src/pages/PathAnalysis.tsx app/src/pages/GoalPlanner.tsx docs/CURRENT_PROGRESS.md docs/CHANGELOG.md docs/phase-logs/PHASE_4A_5_4_TOGGLEGROUP_CHECKBOX_CLEANUP.md
git commit -m "refactor: migrate toggles and checkboxes to shadcn components"
```

### Commit Hash

`280bc21`

### Push Result

`master` → `origin/master` ✅

---

*End of phase log.*
