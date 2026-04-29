# Phase 4A-5: Interaction Cleanup Closure

**Date**: 2026-04-28
**Phase**: 4A-5-6 (Documentation & Planning)
**Status**: Closure Complete

---

## 1. Phase 4A-5 Summary

| Phase | Scope | Status | Key Outcome |
|---|---|---|---|
| 4A-5-1 Audit | Audit 15 pages for native `<select>`, handwritten toggles, clickable divs, native `<table>`, `alert()`/`confirm()` | ✅ Complete | `docs/INTERACTION_CLEANUP_AUDIT.md` — 42 native selects, 18 handwritten toggles, 11 native tables, 0 `alert()`/`confirm()`, 0 `SelectItem value=""` |
| 4A-5-2 Static selects / switches | SmartProcess (5 selects), Dashboard (tabs), Forecast (batch mode Switch) | ✅ Complete | 9 controls migrated; GoalPlanner deferred to 5-3 |
| 4A-5-3 Dynamic selects with sentinel mapping | Attribution (5), Statistics (1), Forecast (2), PathAnalysis (3), Visualization (4), GoalPlanner (1) | ✅ Complete | 16 native `<select>` → shadcn `Select`; sentinel mapping (`none`→`""`, `auto`→`""`) verified |
| 4A-5-4 ToggleGroup / Checkbox cleanup | Forecast (model ToggleGroup + 3 checkbox groups), PathAnalysis (mode ToggleGroup + 4 checkbox groups), GoalPlanner (method ToggleGroup) | ✅ Complete | 3 ToggleGroup + 7 checkbox groups migrated |
| 4A-5-5 Table / Dialog cleanup | History (`renderResultPreview` → `DataTablePreview`), Attribution (kept native), dialogs confirmed shadcn-compliant | ✅ Complete | 1 table migrated; 2 tables intentionally kept native |

**Total controls migrated**: 16 selects + 3 ToggleGroup + 7 checkbox groups + 1 Switch + 1 Tabs + 1 table = **29 control replacements**

---

## 2. Standardized Interaction Components

| Control Type | Component | Pages Validated | Notes |
|---|---|---|---|
| Select (static enum) | `shadcn Select` | SmartProcess, Dashboard | No sentinel needed |
| Select (dynamic column) | `shadcn Select` + sentinel mapping | Attribution, Statistics, Forecast, PathAnalysis, Visualization, GoalPlanner | `none`/`auto` → `value` → `""` |
| Boolean toggle | `shadcn Switch` | Forecast (batch mode) | Simple on/off |
| View tabs | `shadcn Tabs` | Dashboard | Overview / custom dashboard |
| Mutually exclusive mode selector | `shadcn ToggleGroup` (type="single") | Forecast (model), PathAnalysis (analysis type), GoalPlanner (decomposition) | Card-like items with icons + descriptions |
| Independent multi-select | `shadcn Checkbox` | Forecast (batch columns, promotions, aux vars), PathAnalysis (sequence cols, event cols, smart features, custom cols) | Inside `<label>` for full-row click area |
| Dialog | `shadcn Dialog` + `DialogContent` | History, Datasets, Upload | Already migrated in earlier phases |
| Alert dialog | `shadcn AlertDialog` | Datasets (delete confirmation) | Already migrated in earlier phases |
| Simple data preview | `DataTablePreview` | History (detail result preview), Datasets | Plain text columns + rows |

### Sentinel Mapping Rule (Mandatory)

| Original Meaning | Sentinel | Maps Back To |
|---|---|---|
| Choose none / unselected | `none` | `""` |
| Auto-detect | `auto` | `""` |
| No grouping | `none` | `undefined` or `""` (depends on original behavior) |
| All columns | `all` | `"all"` (direct pass-through) |

**Explicit rule**: Never use `<SelectItem value="">`. Radix UI throws a runtime assertion error for empty string values. Always use a sentinel and map back in `onValueChange`.

---

## 3. What Remains Deferred

| Area | Examples | Reason Deferred | Future Phase |
|---|---|---|---|
| DataWorkshop selects/tables | 17 native `<select>` controls, 1 complex preview table | 2320-line monolithic file with inline sub-components; needs component extraction first | Phase 4C component split |
| SmartAnalysis wizard interactions | Recommendation cards, step navigation, mock API calls | Wizard flow tied to mock→real migration; layout cleanup only in 4A | Phase 4B-3 mock→real |
| AIWorkspace interactions | Modal overlay architecture, dataset selector | Product shape (copilot vs modal) undefined until 4B-0 design | Phase 4B AI assistant upgrade |
| Complex analytical result tables | PathAnalysis funnel steps (colors, conversion rates, drop-off), GoalPlanner decomposition (editable inputs, progress bars), Forecast forecast tables | Semantic complexity exceeds `DataTablePreview` capabilities | Future `ResultTable` design (see §4) |
| Chart color tokens | Hardcoded `#00f5ff`, `#b829f7`, `#3b82f6` in ECharts options | Visual polish, not interaction cleanup | Phase 4A-6 |
| Bundle splitting | ~3.4MB JS chunk warning | Engineering optimization, not interaction | Phase 4A-6 |
| Dataset rename backend 405 | Known backend API issue | Backend fix needed | Backend/API cleanup |
| `AnalysisResultSummary` / `AnalysisPollingOverlay` | Components built but unused by any page | No page currently needs polling overlay or reusable stat summary | Future when pages adopt granular status |

---

## 4. ResultTable Design Rationale

### Why Not All Tables Should Migrate to `DataTablePreview`

`DataTablePreview` is designed for **simple, non-interactive, plain-text data previews**. It accepts `columns: string[]` and `data: Record<string, unknown>[]`, renders a sticky header, and truncates to `maxRows`. This is perfect for dataset previews and transform results.

However, analytical result tables have richer semantics that `DataTablePreview` cannot express:

**`DataTablePreview` is good for:**
- Simple columns + rows
- Plain text preview
- Dataset preview
- Transformed data preview
- Non-interactive table samples

**`DataTablePreview` is NOT good for:**
- Rows with icons, action buttons, or status badges (History main list)
- Model comparison with colored metrics (Attribution top3 percentages)
- Path/funnel tables with conversion rates, drop-off rates, and color coding (PathAnalysis)
- Editable planning tables with numeric inputs and progress bars (GoalPlanner decomposition)
- Multi-row business semantics (e.g., path strings with arrows)
- Chart-coupled result sections where table and chart share data context

### Proposed Future Component Family (Design Only — Do Not Implement)

| Component | Intended Use | Key Features |
|---|---|---|
| `ResultTableShell` | Wrapper for any analytical result table | Consistent header, border, overflow, empty state |
| `ResultTable` | Generic analytical result table | Custom cell renderers via render prop, sortable columns, row actions |
| `MetricComparisonTable` | Model/scenario comparison | Side-by-side metrics with delta indicators, color-coded improvements/declines |
| `PathStepTable` | Funnel / path step visualization | Step number, user count, conversion rate, drop-off rate with progress bars |
| `EditablePlanTable` | Goal planning / decomposition | Editable numeric inputs per row, progress bars, auto-calculation hooks |

**Decision**: Do not build these in Phase 4A. Wait until:
1. At least 2 pages need the same table pattern (rule of three)
2. Backend API returns standardized result shapes
3. Visual system (Phase 4A-6) stabilizes color tokens

---

## 5. Phase 4A-6 Recommendation

**Recommended next phase**: **Phase 4A-6: Visual System / Style Polish**

### Focus Areas

1. **shadcn component visual consistency**
   - `Select` / `ToggleGroup` / `Checkbox` default styling uses Tailwind semantic classes (`border-input`, `text-muted-foreground`) which may not perfectly match the project's custom dark theme CSS variables
   - Audit and patch visual mismatches

2. **Card density and spacing**
   - Mixed `p-4` / `p-6` usage across pages
   - Standardize density modes (compact / default / spacious)

3. **Button hierarchy**
   - Ensure primary/secondary/ghost variants are used consistently
   - Review icon-only buttons for accessibility

4. **PageHeader and PageShell refinement**
   - Mobile responsiveness gaps
   - Action button placement consistency

5. **Glassmorphism boundary review**
   - `glass` class still exists in SmartAnalysis and DataWorkshop
   - Decide whether to keep, replace, or standardize

6. **Chart color token audit**
   - ECharts options use hardcoded hex colors (`#00f5ff`, `#b829f7`, `#3b82f6`)
   - Map to CSS variables for theme consistency

7. **Empty / loading / error visual polish**
   - Some pages still use inline divs instead of `Empty`, `LoadingState`, `ErrorState`

8. **Bundle size warning triage** (if included as engineering stabilization)
   - `manualChunks` for vendor / echarts / radix

### Explicitly Exclude from 4A-6

- Hermes integration → Phase 4B
- AIWorkspace deep refactor → Phase 4B
- DataWorkshop component split → Phase 4C
- Backend API changes → Backend sprints
- Major ECharts feature expansion → Phase 5

---

## 6. Recommended Next Phase Order

1. **Phase 4A-6-1**: Visual style audit — inventory all visual inconsistencies (colors, spacing, typography, responsive gaps)
2. **Phase 4A-6-2**: Shared component style refinement — patch shadcn component styling to match custom dark theme; standardize card density
3. **Phase 4A-6-3**: Chart color token audit — replace hardcoded ECharts colors with CSS variable references
4. **Phase 4A-6-4**: Optional `ResultTable` design document — if analytical table patterns stabilize
5. **Phase 4B-0**: AI assistant product shape design — copilot panel vs modal, streaming vs polling, tool call UX
6. **Phase 4C-0**: DataWorkshop component split plan — audit inline sub-components, define extraction order

---

## 7. Guardrails

1. **Do not mix visual polish with business logic changes.** One concern per phase.
2. **Do not modify API payloads.** Visual changes only.
3. **Do not change ECharts calculations.** Only color tokens and container styling.
4. **Do not reintroduce browser-local processing.** Sacred backend contract.
5. **Do not force complex tables into `DataTablePreview`.** Use native tables or wait for `ResultTable` design.
6. **Do not introduce `SelectItem value=""`.** Sentinel rule remains in force.
7. **Every implementation phase must run `tsc --noEmit`, `npm run build`, SelectItem grep, update phase log, update `CURRENT_PROGRESS` / `CHANGELOG`, and git commit/push.**
