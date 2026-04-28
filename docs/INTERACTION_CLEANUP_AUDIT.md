# Interaction Cleanup Audit

**Date**: 2026-04-28
**Phase**: 4A-5-1 (Audit & Planning)
**Scope**: Audit all migrated and simple pages for interaction inconsistencies before cleanup implementation.

---

## 1. Executive Summary

| Metric | Count |
|---|---|
| Pages audited | 15 |
| Native `<select>` found | 42 occurrences across 11 pages |
| Handwritten toggle/button patterns found | 18 occurrences across 6 pages |
| Clickable `div` / card-like patterns found | 12 occurrences across 4 pages |
| Native `<table>` found | 11 occurrences across 7 pages |
| `alert()` / `confirm()` found | 0 |
| `SelectItem value=""` found | 0 |

**Overall Assessment**: No P0 issues (`SelectItem value=""` or `confirm()`). The debt is concentrated in native `<select>` controls (expected) and handwritten button-like patterns. Tables are mostly in result sections where `DataTablePreview` could eventually apply.

---

## 2. Native Select Inventory

### 2.1 Migrated Analysis Pages

| Page | File | Count | Purpose | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|---|
| Attribution | `Attribution.tsx` | 5 | Column mapping selects (userId, touchpoint, timestamp, conversion, conversionValue) | shadcn `Select` | Medium | Dynamic options from dataset columns. Empty option uses `value=""` semantics → needs sentinel `value="none"` mapped back to `""` |
| Statistics | `Statistics.tsx` | 1 | Analyze column selector (with "all" option + optgroup) | shadcn `Select` | Low | Static-ish options grouped by numeric/categorical. `value="all"` is safe sentinel. |
| SmartProcess | `SmartProcess.tsx` | 5 | Preprocessing config selects (missingValueStrategy, duplicateStrategy, outlierStrategy, outlierMethod, standardization) | shadcn `Select` | Low | Static enum options. No empty values. Safe to replace. |
| Forecast | `Forecast.tsx` | 2 | Date column + value column selectors | shadcn `Select` | Medium | Dynamic options from dataset columns. `value=""` used for "自动检测" → needs sentinel. |
| PathAnalysis | `PathAnalysis.tsx` | 3 | Column selectors (user ID, event, timestamp) | shadcn `Select` | Medium | Dynamic options from dataset columns. `value=""` used for auto-detect → needs sentinel. |
| GoalPlanner | `GoalPlanner.tsx` | 1 | Time range selector (predefined ranges) | shadcn `Select` | Low | Static options (7d, 30d, 90d, etc.). No empty values. |

### 2.2 Other Pages

| Page | File | Count | Purpose | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|---|
| AIWorkspace | `AIWorkspace.tsx` | 1 | Dataset selector inside modal | keep native for now | Medium | Part of complex modal; shadcn `Select` inside modal may have z-index/portal issues. Defer to AIWorkspace refactor phase. |
| Dashboard | `Dashboard.tsx` | 2 | Dashboard selector + layout type selector | shadcn `Select` | Low | Static options from state arrays. No empty values. |
| DataWorkshop | `DataWorkshop.tsx` | 17 | Column selectors across 9 operation config panels | keep native for now | High | 17 selects in inline sub-components. High risk to batch-replace. Should be done after component extraction (Phase 4C). |
| Datasets | `Datasets.tsx` | 0 | — | — | — | Already uses shadcn components. No native selects. |
| History | `History.tsx` | 0 | — | — | — | Already uses shadcn components. No native selects. |
| Settings | `Settings.tsx` | 0 | — | — | — | Already uses shadcn `Select`. No native selects. |
| Upload | `Upload.tsx` | 0 | — | — | — | No native selects. |
| Visualization | `Visualization.tsx` | 4 | Chart axis/selectors (X, Y, group, chart type) | shadcn `Select` | Medium | Dynamic field options. `value=""` used for optional group → needs sentinel. |

### 2.3 Sentinel Value Mapping Required

The following selects use `value=""` for empty/default semantics and will need sentinel mapping when converted to shadcn `Select`:

| Page | Select | Current Empty | Proposed Sentinel | Map Back |
|---|---|---|---|---|
| Attribution | Column selectors | `value=""` → "选择列" | `value="none"` | `onValueChange` → `v === 'none' ? '' : v` |
| Forecast | Date/value columns | `value=""` → "自动检测" | `value="auto"` | `onValueChange` → `v === 'auto' ? '' : v` |
| PathAnalysis | Column selectors | `value=""` → "自动检测" | `value="auto"` | `onValueChange` → `v === 'auto' ? '' : v` |
| Visualization | Group selector | `value=""` → "不分组" | `value="none"` | `onValueChange` → `v === 'none' ? '' : v` |

---

## 3. Handwritten Toggle / Button-like Pattern Inventory

### 3.1 ToggleGroup-like Patterns (mode/type selectors)

| Page | File | Count | Purpose | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|---|
| PathAnalysis | `PathAnalysis.tsx` | 10 | 5 analysis type buttons (funnel/path/clustering/key_path/sequence_mining), each with active/inactive pair | shadcn `ToggleGroup` | Medium | 10 `button` elements in a grid. Each type has two states (selected/unselected). Perfect `ToggleGroup` candidate. |
| Forecast | `Forecast.tsx` | 3 | Model selector (Prophet/LightGBM/SARIMA), batch mode toggle, promotion selection | shadcn `ToggleGroup` / `Switch` | Medium | Model selector is a 3-way toggle. Batch mode is a boolean. Promotions are checkboxes. |
| GoalPlanner | `GoalPlanner.tsx` | 4 | Template buttons, decomposition method buttons, month tag buttons | shadcn `ToggleGroup` / `Button` | Low | Template and method selectors are toggle-like. Month tags are filter chips. |
| Dashboard | `Dashboard.tsx` | 2 | View mode tabs (overview/custom) | shadcn `Tabs` | Low | Simple 2-tab switch. Currently uses `onClick` divs. |

### 3.2 Checkbox Patterns

| Page | File | Count | Purpose | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|---|
| Forecast | `Forecast.tsx` | 2 | Batch prediction column checkboxes, promotion checkboxes | shadcn `Checkbox` | Low | Native `<input type="checkbox">` with custom styling. Safe to replace. |
| PathAnalysis | `PathAnalysis.tsx` | ~5 | Cluster mode checkbox, sequence config checkboxes | shadcn `Checkbox` | Low | Mixed native checkbox usage. |

### 3.3 Shadcn Switch Candidates

| Page | File | Count | Purpose | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|---|
| Forecast | `Forecast.tsx` | 1 | Batch mode toggle (currently a custom styled button) | shadcn `Switch` | Low | Boolean on/off. Currently uses custom button with conditional classes. |

---

## 4. Clickable Card / div onClick Inventory

Flagged only button-like or selector-like patterns that are keyboard/accessibility problematic.

| Page | File | Pattern | Purpose | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|---|
| Dashboard | `Dashboard.tsx` | `<div onClick={() => setCurrentView(...)}>` | View tab switcher | shadcn `Tabs` | Low | Two divs acting as tabs. Missing ARIA roles. |
| PathAnalysis | `PathAnalysis.tsx` | `<button onClick={() => setPathType(...)}>` | Analysis type grid | shadcn `ToggleGroup` | Medium | 10 custom buttons in 2x5 grid. No keyboard group navigation. |
| GoalPlanner | `GoalPlanner.tsx` | `<button onClick={() => applyTemplate(key)}>` | Template selection cards | shadcn `Button` or `Card` with button | Low | Template cards are essentially buttons. Current styling is acceptable but not standard. |
| GoalPlanner | `GoalPlanner.tsx` | `<button onClick={() => setDecompositionMethod(...)}>` | Decomposition method selector | shadcn `ToggleGroup` | Low | 4 method buttons. ToggleGroup candidate. |
| SmartAnalysis | `SmartAnalysis.tsx` | `<div onClick={() => handleRunAnalysis(rec)}>` | Recommendation cards | shadcn `Card` with `Button` | Low | Recommendation cards are clickable. Missing focus states. |
| Forecast | `Forecast.tsx` | `<button onClick={() => setSelectedModel(...)}>` | Model selector buttons | shadcn `ToggleGroup` | Low | 3 model buttons. ToggleGroup candidate. |
| Forecast | `Forecast.tsx` | `<button onClick={() => { ... }}>` | Auxiliary variable toggles | shadcn `ToggleGroup` or `Checkbox` | Low | 6 variable buttons. Toggle-like behavior. |

---

## 5. Native Table Inventory

### 5.1 Result Section Tables

| Page | File | Table Purpose | Data Shape | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|---|
| Attribution | `Attribution.tsx` | 1 | Model comparison table (model names, scores, percentages) | `DataTablePreview` | Low | Simple rows with text + progress bars. Progress bars may not render in `DataTablePreview`. Keep native or create custom component. |
| PathAnalysis | `PathAnalysis.tsx` | 2 | Funnel steps table + frequent sequences table | keep native | Medium | Funnel table has custom styling (user counts, conversion rates, drop-off rates with color coding). Frequent sequences table has path strings with arrows. Semantic complexity makes `DataTablePreview` unsuitable. |
| GoalPlanner | `GoalPlanner.tsx` | 2 | Decomposition table + comparison table | keep native | Medium | Decomposition table has month rows with editable inputs and progress bars. Comparison table has nested structure. |
| History | `History.tsx` | 2 | Analysis history list + detail table | `DataTablePreview` | Low | Simple tabular data. Could migrate. |
| Datasets | `Datasets.tsx` | 1 | Dataset preview table | keep native | Low | Already has custom preview modal. Uses shadcn `Table` in some places. |

### 5.2 Data Preview Tables

| Page | File | Table Purpose | Data Shape | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|---|
| AIWorkspace | `AIWorkspace.tsx` | 1 | Dataset preview (first 5 rows) | `DataTablePreview` | Low | Simple preview of columns + rows. Good candidate. |
| DataWorkshop | `DataWorkshop.tsx` | 1 | Transform preview table | keep native | High | Complex preview with operation annotations. Part of 2320-line file. Defer to Phase 4C. |

---

## 6. Alert / Confirm Inventory

| Page | File | Usage | Suggested Replacement | Risk | Notes |
|---|---|---|---|---|---|
| — | — | — | — | — | **No `alert()` or `confirm()` found in any `.tsx` file.** ✅ |

All destructive confirmations already use either:
- `toast.confirm()` (Sonner)
- Inline modal dialogs
- `AlertDialog` (shadcn)

---

## 7. SelectItem Empty Value Check

```powershell
cd app
Select-String -Path "src/**/*.tsx" -Pattern 'SelectItem value=""'
# Result: no output ✅

Select-String -Path "src/**/*.tsx" -Pattern "SelectItem value=''"
# Result: no output ✅
```

**Status**: No `SelectItem value=""` violations found. Pages that already use shadcn `Select` are compliant.

---

## 8. Recommended Phase 4A-5 Implementation Plan

### Phase 4A-5-2: Low-Risk Static Selects & Switches

| Scope | Pages | Changes |
|---|---|---|
| Static enum selects | SmartProcess (5 selects) | missingValueStrategy, duplicateStrategy, outlierStrategy, outlierMethod, standardization |
| Static range select | GoalPlanner (1 select) | Time range selector |
| Simple toggles | Forecast (batch mode), Dashboard (view tabs) | Switch + Tabs |

**Risk**: Low. No dynamic options, no empty-value semantics.
**Validation**: `tsc --noEmit`, `npm run build`, SelectItem grep.

### Phase 4A-5-3: Dynamic Column Selects

| Scope | Pages | Changes |
|---|---|---|
| Column selectors with sentinel mapping | Attribution (5), Statistics (1), Forecast (2), PathAnalysis (3), Visualization (4) | Replace native `<select>` with shadcn `Select`. Map `value=""` → sentinel → back. |

**Risk**: Medium. Dynamic options from API. Sentinel mapping must preserve existing business logic.
**Validation**: Same as above + manual check of default/unselected behavior.

### Phase 4A-5-4: ToggleGroup & Button Cleanup

| Scope | Pages | Changes |
|---|---|---|
| Analysis type selectors | PathAnalysis (5-type grid), Forecast (model selector) | shadcn `ToggleGroup` |
| Template/method selectors | GoalPlanner (template + decomposition) | shadcn `ToggleGroup` or `Button` group |
| Recommendation cards | SmartAnalysis | `Card` with explicit `Button` inside |
| Checkbox replacements | Forecast (batch columns, promotions, aux vars), PathAnalysis | shadcn `Checkbox` |

**Risk**: Medium. Visual appearance will change. Must preserve all `onChange` handlers.
**Validation**: Same as above + visual regression check.

### Phase 4A-5-5: Table & Dialog Cleanup

| Scope | Pages | Changes |
|---|---|---|
| Simple result tables | History, Attribution (model comparison) | `DataTablePreview` or shadcn `Table` |
| Data preview tables | AIWorkspace | `DataTablePreview` |

**Risk**: Low-Medium. Only tables with simple row/column semantics.
**Validation**: Same as above.

### Excluded from Phase 4A-5

| Page | Reason |
|---|---|
| DataWorkshop | 17 selects + 1 table in 2320-line file with inline sub-components. Defer to Phase 4C component extraction. |
| SmartAnalysis (deep refactor) | Wizard flow + mock APIs. Layout cleanup only; deep interaction refactor belongs to Phase 4B-3. |
| AIWorkspace (deep refactor) | Modal architecture may change in Phase 4B. Only low-risk selects should be touched in 4A-5. |
| PathAnalysis result tables | Semantic complexity (funnel steps with colors, frequent sequences with arrows). Keep native. |
| GoalPlanner decomposition table | Has editable inputs and progress bars. Keep native. |

---

## 9. Guardrails

1. **Do not mix interaction cleanup with visual redesign.** One control type per phase.
2. **Do not change API payloads.** `onChange` handlers must produce the same values sent to APIs.
3. **Do not change analysis logic.** Only replace the UI control, not the state management.
4. **Do not change ECharts lifecycle.** Chart containers and options untouched.
5. **Do not change DataWorkshop preview/save path.** Sacred backend contract.
6. **Do not introduce `SelectItem value=""`.** Use sentinel values (`none`, `auto`, `default`).
7. **Run `tsc --noEmit`, `npm run build`, and SelectItem grep after every implementation phase.**
8. **Update phase logs, CURRENT_PROGRESS, CHANGELOG, and git commit/push after every implementation phase.**

---

*End of Interaction Cleanup Audit.*
