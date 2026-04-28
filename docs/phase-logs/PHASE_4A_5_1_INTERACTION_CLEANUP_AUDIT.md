# Phase 4A-5-1: Interaction Cleanup Audit

**Date**: 2026-04-28
**Phase Goal**: Audit all migrated and simple pages for interaction inconsistencies before cleanup implementation.

---

## 1. Files Inspected

| File | Lines | Audit Focus |
|---|---|---|
| `app/src/pages/Semantic.tsx` | ~385 | Native selects, toggles, tables |
| `app/src/pages/Clustering.tsx` | ~429 | Native selects, toggles, tables |
| `app/src/pages/Statistics.tsx` | ~476 | Native selects, toggles, tables |
| `app/src/pages/Attribution.tsx` | ~879 | Native selects, toggles, tables |
| `app/src/pages/SmartProcess.tsx` | ~570 | Native selects, toggles, tables |
| `app/src/pages/GoalPlanner.tsx` | ~1134 | Native selects, toggles, tables, clickable cards |
| `app/src/pages/Forecast.tsx` | ~1470 | Native selects, toggles, tables, checkboxes |
| `app/src/pages/PathAnalysis.tsx` | ~2331 | Native selects, toggles, tables, mode buttons |
| `app/src/pages/Visualization.tsx` | ~1494 | Native selects, chart config |
| `app/src/pages/Dashboard.tsx` | ~1533 | Native selects, view tabs, widget buttons |
| `app/src/pages/Datasets.tsx` | ~600 | Tables, dialogs |
| `app/src/pages/History.tsx` | ~550 | Tables, dialogs |
| `app/src/pages/Upload.tsx` | ~400 | Selects, buttons |
| `app/src/pages/Settings.tsx` | ~400 | Selects, switches |
| `app/src/pages/SmartAnalysis.tsx` | ~903 | Recommendation cards (inspected, not in cleanup batch) |
| `app/src/pages/AIWorkspace.tsx` | ~953 | Dataset select (inspected, not in cleanup batch) |
| `app/src/pages/DataWorkshop.tsx` | ~2320 | 17 selects + table (inspected, deferred to Phase 4C) |

## 2. New Documents Created

- `docs/INTERACTION_CLEANUP_AUDIT.md` — Comprehensive interaction debt inventory with replacement recommendations and risk ratings.

## 3. Summary of Interaction Debt

### Native `<select>`

- **42 occurrences** across 11 pages
- **Low-risk static selects**: SmartProcess (5), GoalPlanner (1), Dashboard (2) — static enum options, no empty values
- **Medium-risk dynamic selects**: Attribution (5), Statistics (1), Forecast (2), PathAnalysis (3), Visualization (4) — dynamic column options, some use `value=""` semantics
- **Deferred**: DataWorkshop (17), AIWorkspace (1) — complex modal/inline sub-components

### Handwritten Toggle / Button Patterns

- **PathAnalysis**: 10 custom buttons for 5 analysis types (toggle grid)
- **Forecast**: Model selector (3 buttons), batch mode toggle, promotion checkboxes, aux var toggles
- **GoalPlanner**: Template buttons, decomposition method buttons
- **Dashboard**: 2 view tab divs
- **SmartAnalysis**: Recommendation cards (inspected, deferred)

### Native `<table>`

- **11 occurrences** across 7 pages
- **Low-risk candidates**: History (2), AIWorkspace preview (1), Attribution model comparison (1)
- **Keep native**: PathAnalysis funnel/sequence tables, GoalPlanner decomposition/comparison tables, DataWorkshop preview

### `alert()` / `confirm()`

- **0 occurrences** ✅ All confirmations already use Sonner toast or shadcn `AlertDialog`.

### `SelectItem value=""`

- **0 occurrences** ✅ No violations found.

## 4. Recommended Next Implementation Phase

**Phase 4A-5-2: Low-Risk Static Selects & Switches**

Scope:
- SmartProcess: 5 static enum selects (missingValueStrategy, duplicateStrategy, outlierStrategy, outlierMethod, standardization)
- GoalPlanner: 1 time range select
- Dashboard: 2 view tabs → shadcn `Tabs`
- Forecast: batch mode toggle → shadcn `Switch`

Risk: Low. No dynamic options, no empty-value semantics.

## 5. Known Risks

- Dynamic column selectors (Attribution, Forecast, PathAnalysis, Visualization) use `value=""` for empty/default. shadcn `Select` requires sentinel values. Mapping must preserve API behavior.
- PathAnalysis's 5-type button grid is a custom 10-button implementation (active + inactive for each type). `ToggleGroup` migration must preserve the 2-column grid layout.
- DataWorkshop has 17 native selects across 9 inline config panel functions. Batch replacement is high-risk before component extraction.

## 6. Git Information

### Git Status Before Commit

```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  (none)

Untracked files:
  docs/INTERACTION_CLEANUP_AUDIT.md
  docs/phase-logs/PHASE_4A_5_1_INTERACTION_CLEANUP_AUDIT.md

Modified files to stage:
  docs/CURRENT_PROGRESS.md
  docs/CHANGELOG.md
  docs/ROADMAP.md
```

> No source files modified. No package files modified.

### Commit

```bash
git add docs/INTERACTION_CLEANUP_AUDIT.md docs/phase-logs/PHASE_4A_5_1_INTERACTION_CLEANUP_AUDIT.md docs/CURRENT_PROGRESS.md docs/CHANGELOG.md docs/ROADMAP.md
git commit -m "docs: audit interaction cleanup debt"
```

### Commit Hash

`TBD`

### Push Result

`TBD`

---

*End of phase log.*
