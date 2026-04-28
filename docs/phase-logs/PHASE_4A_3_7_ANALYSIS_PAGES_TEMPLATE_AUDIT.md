# Phase 4A-3-7: Analysis Pages Template Audit

**Date**: 2026-04-28
**Commit**: (design-only, no code changes)
**Commit Message**: `docs: add analysis pages template audit and unified design`
**标签**: `docs: analysis pages template audit`

---

## 1. Phase Goal

Audit all remaining analysis-function pages, identify common layout patterns, and design a unified page template to avoid refactoring each page independently and inconsistently.

**This phase is design-only. No page code, backend code, or APIs were modified.**

---

## 2. Audited Files

| # | Page | File | Lines | Risk |
|---|------|------|-------|------|
| 1 | Semantic Analysis | `app/src/pages/Semantic.tsx` | ~385 | Low |
| 2 | Clustering | `app/src/pages/Clustering.tsx` | ~429 | Low |
| 3 | Statistics | `app/src/pages/Statistics.tsx` | ~515 | Medium |
| 4 | Attribution | `app/src/pages/Attribution.tsx` | ~918 | Medium |
| 5 | SmartProcess | `app/src/pages/SmartProcess.tsx` | ~615 | Medium |
| 6 | GoalPlanner | `app/src/pages/GoalPlanner.tsx` | ~1134 | Medium |
| 7 | Forecast | `app/src/pages/Forecast.tsx` | ~1490 | High |
| 8 | PathAnalysis | `app/src/pages/PathAnalysis.tsx` | ~2362 | High |
| 9 | SmartAnalysis | `app/src/pages/SmartAnalysis.tsx` | ~903 | High |

---

## 3. Key Findings

### 3.1 Universal Pattern

All 9 pages share an identical structural skeleton:

1. Title bar (h1 + description)
2. Dataset selector (`DatasetSelector` + `DataTypeValidation`)
3. `grid grid-cols-1 lg:grid-cols-3 gap-6` with:
   - Left `Card className="glass"` (config, lg:col-span-1)
   - Right `Card className="glass"` (result, lg:col-span-2)
4. Optional bottom sections

### 3.2 Shared Elements (100% of pages)

- `DatasetSelector`
- `DataTypeValidation`
- `Card className="glass"`
- Polling pattern (`setInterval` + `analysisApi.getStatus`) — 7/9 pages
- CSV/JSON export — 4/9 pages
- gsap animations — 3/9 pages

### 3.3 Divergent Elements

- **SmartAnalysis**: 5-step wizard (fundamentally different layout)
- **PathAnalysis**: 5-type selector tabs + sub-component (`AssociationRuleGraph`)
- **GoalPlanner**: No API calls, pure frontend, custom layout (not 2-col grid)
- **Forecast**: Complex multi-section config, What-if analysis, promotion calendar, handwritten import dialog

---

## 4. Deliverables

### 4.1 `docs/ANALYSIS_PAGES_TEMPLATE.md`

Comprehensive template design document containing:

- Current analysis pages inventory table
- Common layout pattern analysis (with Before/After pseudo-code)
- Proposed template components (7 components):
  - `AnalysisPageShell`
  - `AnalysisConfigPanel`
  - `AnalysisResultPanel`
  - `AnalysisActionBar`
  - `AnalysisEmptyState`
  - `AnalysisResultSummary`
  - `AnalysisPollingOverlay`
- Page-by-page migration plan (effort estimates + component mapping)
- Recommended refactor order (risk-ascending)
- Guardrails for future refactors (Do Not Touch / Do Replace lists)
- Open questions and file creation plan for Phase 4A-4-0

---

## 5. Recommended Refactor Order

| Phase | Pages | Risk | Rationale |
|-------|-------|------|-----------|
| 4A-4-0 | Build 7 template components | — | Shared infra first |
| 4A-4-1 | Semantic, Clustering | Low | Validate components |
| 4A-4-2 | Statistics, Attribution | Medium | Validate ECharts + stat cards |
| 4A-4-3 | SmartProcess, GoalPlanner | Medium | Validate file download + custom layout |
| 4A-4-4 | Forecast | High | Validate complex config |
| 4A-4-5 | PathAnalysis | High | Validate multi-type + sub-components |
| 4A-5 | SmartAnalysis | — | Dedicated wizard refactor (outside template) |

---

## 6. Validation Results

This phase produced zero code changes.

| Check | Result |
|-------|--------|
| Code changes | None (design-only) |
| `npx tsc --noEmit` | N/A |
| `npm run build` | N/A |

---

## 7. Next Phase

**Option A**: Continue Phase 4A-4 — build the 7 template components and migrate low-risk pages (Semantic, Clustering).

**Option B**: Pause analysis page migration and switch to Phase 4A engineering work (bundle splitting, API type unification, Alembic).

**Option C**: Tackle the two remaining "super pages" — `AIWorkspace.tsx` and `DataWorkshop.tsx` — before returning to analysis pages.

---

*End of phase log.*
