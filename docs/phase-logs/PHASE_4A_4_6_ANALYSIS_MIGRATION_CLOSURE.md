# Phase 4A-4-6: Analysis Pages Migration Closure & Complex Pages Plan

**Date**: 2026-04-28
**Phase Goal**: Produce a closure summary for Phase 4A-4 and plan for remaining complex pages (SmartAnalysis, AIWorkspace, DataWorkshop).

---

## 1. Files Inspected

| File | Lines | Purpose |
|---|---|---|
| `app/src/pages/SmartAnalysis.tsx` | 903 | Wizard-style analysis page (5 steps: select → diagnose → preprocess → analyze → result) |
| `app/src/pages/AIWorkspace.tsx` | 953 | AI assistant modal overlay with chat, intent recognition, analysis execution |
| `app/src/pages/DataWorkshop.tsx` | 2320 | Data operation chain builder with backend preview/save |
| `docs/ANALYSIS_PAGES_TEMPLATE.md` | 321 | Template design document |
| `docs/FRONTEND_DESIGN_SYSTEM.md` | 775 | Design system specification |
| `docs/ROADMAP.md` | 76 | Current roadmap |
| `docs/phase-logs/PHASE_4A_4_0_ANALYSIS_TEMPLATE_COMPONENTS.md` | 264 | Template components phase log |
| `docs/phase-logs/PHASE_4A_4_1_SEMANTIC_CLUSTERING_REFACTOR.md` | 216 | Semantic + Clustering migration log |
| `docs/phase-logs/PHASE_4A_4_2_STATISTICS_ATTRIBUTION_REFACTOR.md` | 216 | Statistics + Attribution migration log |
| `docs/phase-logs/PHASE_4A_4_3_SMARTPROCESS_GOALPLANNER_REFACTOR.md` | 216 | SmartProcess + GoalPlanner migration log |
| `docs/phase-logs/PHASE_4A_4_4_FORECAST_MIGRATION.md` | 74 | Forecast migration log |
| `docs/phase-logs/PHASE_4A_4_5_PATHANALYSIS_REFACTOR.md` | 78 | PathAnalysis migration log |

## 2. New Documents Created

- `docs/PHASE_4A_ANALYSIS_MIGRATION_CLOSURE.md` — Closure summary with migration table, validated components, technical debt, and plans for SmartAnalysis / AIWorkspace / DataWorkshop.

## 3. Summary of Migration Closure

### What Has Been Migrated

8 analysis pages migrated to shared layout components:
- Semantic, Clustering (full template)
- Statistics, Attribution (full template + ECharts validation)
- SmartProcess (full template), GoalPlanner (shell + glass removal)
- Forecast, PathAnalysis (shell + config panel + custom results)

### What Shared Components Are Validated

- `AnalysisPageShell` — validated in all 8 migrated pages
- `AnalysisConfigPanel` — validated in 7 pages (GoalPlanner used custom layout)
- `AnalysisResultPanel` — validated in 5 pages (Forecast/PathAnalysis kept custom results)
- `AnalysisActionBar` — validated in 5 pages
- `AnalysisEmptyState` — validated in 5 pages
- `AnalysisResultSummary` — implemented but unused
- `AnalysisPollingOverlay` — implemented but unused

### Technical Debt Remaining

- Native `<select>` in 6+ pages (Phase 4A-5)
- Handwritten toggle buttons and clickable cards (Phase 4A-5)
- Native `<table>` in result sections (Phase 4A-5)
- Hardcoded chart colors (Phase 4A-6)
- Bundle size ~3.4MB (Phase 4A-6)
- API type unification with `as any` (Phase 4A-6)
- E2E regression checklist pending (Phase 3G)

### Complex Pages Plan

- **SmartAnalysis**: Wizard page — should not use 2-col template. Plan: extract `WizardStepper`, replace title bar, remove glass. Mock APIs to be replaced in Phase 4B.
- **AIWorkspace**: Modal overlay — should not be refactored before AI assistant product shape is defined (Phase 4B-0). Hermes integration must go through backend adapter.
- **DataWorkshop**: 2320 lines with 9 inline config panels — should be split into components first (Phase 4C), then polished. Backend preview/save path must remain untouched.

## 4. Recommended Next Phase

**Phase 4A-5: Interaction Cleanup**
- Replace native `<select>` with shadcn `Select`
- Replace handwritten toggles with shadcn `Switch`
- Replace `confirm()` with `AlertDialog`
- Replace inline tables with `DataTablePreview` where low-risk

## 5. Known Risks

- SmartAnalysis has ~60% mock APIs (diagnosis, preprocess, most analysis types). Refactoring without addressing mocks may hide integration issues.
- AIWorkspace's modal architecture may conflict with future copilot-panel design.
- DataWorkshop's 2320-line file with inline sub-components is high-risk for any refactoring.
- Bundle size warning persists and will become more critical as features grow.

## 6. Git Information

### Git Status Before Commit

```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  (none)

Untracked files:
  docs/PHASE_4A_ANALYSIS_MIGRATION_CLOSURE.md
  docs/phase-logs/PHASE_4A_4_6_ANALYSIS_MIGRATION_CLOSURE.md

Modified files to stage:
  docs/CURRENT_PROGRESS.md
  docs/CHANGELOG.md
  docs/ROADMAP.md
```

> No source files modified. No package files modified.

### Commit

```bash
git add docs/PHASE_4A_ANALYSIS_MIGRATION_CLOSURE.md docs/phase-logs/PHASE_4A_4_6_ANALYSIS_MIGRATION_CLOSURE.md docs/CURRENT_PROGRESS.md docs/CHANGELOG.md docs/ROADMAP.md
git commit -m "docs: close analysis page migration and plan complex pages"
```

### Commit Hash

`TBD`

### Push Result

`TBD`

---

*End of phase log.*
