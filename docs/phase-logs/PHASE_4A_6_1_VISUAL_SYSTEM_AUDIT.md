# Phase 4A-6-1: Visual System / Style Audit

**Date**: 2026-04-28
**Phase Goal**: Audit the current frontend visual system and produce a concrete Phase 4A-6 implementation plan.

---

## 1. Files Inspected

### Shared Components

| Directory | Components Inspected |
|---|---|
| `app/src/components/layout/` | PageShell, PageHeader, SidePanel, ResultPanel, PageToolbar, ContentGrid, SectionCard |
| `app/src/components/feedback/` | LoadingState, ErrorState, SuccessState |
| `app/src/components/data-display/` | DataTablePreview, StatCard |
| `app/src/components/analysis/` | AnalysisPageShell, AnalysisConfigPanel, AnalysisResultPanel, AnalysisActionBar, AnalysisEmptyState |
| `app/src/components/ui/` | Select, Switch, Tabs, ToggleGroup, Checkbox, Dialog, AlertDialog, Button, Card, Empty |

### Representative Pages

| Page | Focus |
|---|---|
| `Settings.tsx` | shadcn component baseline styling |
| `Upload.tsx` | PageShell, PageHeader, SectionCard usage |
| `History.tsx` | DataTablePreview, Dialog, Empty, LoadingState |
| `Datasets.tsx` | AlertDialog, Empty, LoadingState, table patterns |
| `Dashboard.tsx` | ECharts colors, card density, glass usage |
| `Visualization.tsx` | ECharts colors, shadcn Select styling |
| `Semantic.tsx` | Analysis template component styling |
| `Statistics.tsx` | Result cards, glass usage |
| `Forecast.tsx` | ToggleGroup, Switch, Select, ECharts |
| `PathAnalysis.tsx` | ToggleGroup, ECharts colors, glass usage |
| `SmartProcess.tsx` | Select density, button hierarchy |
| `GoalPlanner.tsx` | Card density, button hierarchy |

### Deferred Complex Pages (mentioned only)

| Page | Reason |
|---|---|
| `DataWorkshop.tsx` | 2320-line monolith; deferred to Phase 4C |
| `AIWorkspace.tsx` | Modal architecture undefined until Phase 4B |
| `SmartAnalysis.tsx` | Wizard flow; deferred to Phase 4B-3 |

### Configuration Files

| File | Focus |
|---|---|
| `app/vite.config.ts` | Bundle splitting configuration |
| `app/package.json` | Major dependencies |
| `app/src/index.css` | CSS variable definitions |

---

## 2. New Documents Created

| Document | Purpose |
|---|---|
| `docs/VISUAL_SYSTEM_AUDIT.md` | Comprehensive visual system audit with 10 sections: summary, shadcn compatibility, card density, button hierarchy, glassmorphism, ECharts colors, empty/loading/error states, bundle size, ResultTable position, and implementation plan. |
| `docs/phase-logs/PHASE_4A_6_1_VISUAL_SYSTEM_AUDIT.md` | This file. Phase log for the audit phase. |

---

## 3. Executive Summary of Visual Debt

| Category | Issues Found | Severity |
|---|---|---|
| shadcn + custom theme compatibility | 101 occurrences of mismatched semantic tokens; `Empty` uses `text-muted-foreground` unpatched | P1 |
| Card density and spacing | Layout components use `p-4`, but page-level cards vary widely | P2 |
| Button hierarchy | Very few `variant="default"` primary buttons; most actions use `outline`/`ghost` | P1 |
| Glassmorphism | 30 occurrences across 6 files; overused on ordinary data cards | P2 |
| ECharts hardcoded colors | 137 hex codes across Visualization, Dashboard, PathAnalysis, Attribution | P1 |
| Empty / Loading / Error states | `ErrorState` / `SuccessState` use Tailwind `red`/`emerald` instead of theme tokens | P2 |
| Bundle size | ~3.4MB JS chunk; no `manualChunks` configured | P2 |

**Total source files modified in this phase**: 0 (audit-only).

---

## 4. Key Findings

### 4.1 Two Parallel Color Systems

The project maintains both shadcn/Tailwind HSL tokens (`--background`, `--primary`, etc.) and custom cyberpunk tokens (`--bg-primary`, `--neon-cyan`, etc.). They are close but not identical, causing subtle visual discontinuities when shadcn primitives render inside pages that use custom tokens.

### 4.2 Button Hierarchy Inverted

Primary actions ("启动预测", "开始分析", "开始处理") use `variant="outline"` instead of `variant="default"`. Destructive actions (delete) use `variant="ghost"` + custom color instead of `variant="destructive"`.

### 4.3 Glassmorphism Overused

30 `glass` class occurrences. Design system says glass is reserved for Dialog/Sheet/AI panel/important cards only. Many ordinary data cards and result sections incorrectly use glass.

### 4.4 ECharts Theme Switching Broken

`Visualization.tsx` and `Dashboard.tsx` use hardcoded hex color objects (`COLORS = { cyan: '#00f5ff', ... }`). When user switches theme (Cyberpunk → Matrix → Sunset), charts stay cyan because ECharts does not read CSS variables.

### 4.5 Bundle Size Untamed

No `manualChunks` in `vite.config.ts`. Major contributors: echarts, xlsx, framer-motion, gsap, recharts, 30 radix-ui packages.

---

## 5. Recommended Next Implementation Phase

**Phase 4A-6-2: Shared Component Visual Refinement**

Start with the lowest-risk, highest-impact fixes:
1. Patch `Empty`, `ErrorState`, `SuccessState` to use theme tokens
2. Verify `Select`, `Checkbox`, `ToggleGroup` checked states
3. Add `density` prop to `SectionCard`

Then proceed through 4A-6-3 → 4A-6-4 → 4A-6-5 → 4A-6-6 → 4A-6-7 as documented in `docs/VISUAL_SYSTEM_AUDIT.md` §9.

---

## 6. Known Risks

1. **Theme alignment is complex**: Aligning shadcn HSL tokens with custom hex tokens may require changing `index.css` root variables, which could have ripple effects across all pages.
2. **ECharts color migration is tedious**: 137 hex codes across multiple files. Must be done carefully to avoid breaking chart rendering.
3. **Glass removal may feel like a downgrade**: Users accustomed to glass cards may perceive solid backgrounds as "less premium." Communicate design system rationale.
4. **Bundle splitting requires testing**: `manualChunks` changes must be verified in production build and runtime.

---

## 7. Git Information

### Git Status Before Commit

```
M  docs/CURRENT_PROGRESS.md
M  docs/CHANGELOG.md
M  docs/ROADMAP.md
?? docs/VISUAL_SYSTEM_AUDIT.md
?? docs/phase-logs/PHASE_4A_6_1_VISUAL_SYSTEM_AUDIT.md
```

> No source files modified.
> No package files modified.

### Commit

```bash
git add docs/VISUAL_SYSTEM_AUDIT.md docs/phase-logs/PHASE_4A_6_1_VISUAL_SYSTEM_AUDIT.md docs/CURRENT_PROGRESS.md docs/CHANGELOG.md docs/ROADMAP.md
git commit -m "docs: audit visual system and style polish plan"
```

### Commit Hash

`c2b0b55`

### Push Result

`master` → `origin/master` ✅

---

*End of phase log.*
