# Visual System Audit

**Date**: 2026-04-28
**Phase**: 4A-6-1 (Audit & Planning)
**Scope**: Audit the current frontend visual system and produce a concrete Phase 4A-6 implementation plan.

---

## Executive Summary

Phase 4A-5 interaction cleanup is formally closed. The project now has standardized shadcn controls across 10+ pages. However, **visual consistency gaps remain** between shadcn's default Tailwind semantic styling and the project's custom dark theme CSS variable system.

**Key findings:**

| Category | Issues Found | Severity |
|---|---|---|
| shadcn + custom theme compatibility | 101 occurrences of mismatched semantic tokens; `Empty` uses `text-muted-foreground` unpatched | P1 |
| Card density and spacing | Layout components use `p-4`, but page-level cards vary widely | P2 |
| Button hierarchy | Very few `variant="default"` primary buttons; most actions use `outline`/`ghost` | P1 |
| Glassmorphism | 30 occurrences across 6 files; overused on ordinary data cards | P2 |
| ECharts hardcoded colors | 137 hex codes across Visualization, Dashboard, PathAnalysis, Attribution | P1 |
| Empty / Loading / Error states | `ErrorState` / `SuccessState` use Tailwind `red`/`emerald` instead of theme tokens | P2 |
| Bundle size | ~3.4MB JS chunk; no `manualChunks` configured | P2 |

**Recommendation**: Proceed with Phase 4A-6 implementation in the order defined in §9.

---

## 1. shadcn + Custom Theme Compatibility Audit

### 1.1 The Core Conflict

shadcn components use Tailwind semantic classes (`bg-primary`, `text-muted-foreground`, `border-input`, etc.) that resolve via `index.css` HSL variables. The project's pages use custom CSS variables (`--bg-secondary`, `--text-muted`, `--border-subtle`, etc.) directly in `className`.

When a page mixes both systems, visual mismatches occur:

| shadcn Token | Tailwind Resolution | Custom Token | Visual Mismatch? |
|---|---|---|---|
| `bg-primary` | `hsl(180 100% 50%)` → `#00f5ff` | — | ✅ Intentional (neon cyan) |
| `text-muted-foreground` | `hsl(215 15% 55%)` | `--text-muted: #64748b` | ❌ Similar but not identical |
| `border-input` | `hsl(225 35% 18%)` | `--border-subtle: rgba(148,163,184,0.1)` | ❌ Different opacity model |
| `bg-secondary` | `hsl(225 40% 16%)` | `--bg-secondary: #151b3d` | ⚠️ Close but not verified |
| `bg-accent` | `hsl(285 90% 56%)` | — | ⚠️ Purple accent; used for hover |

### 1.2 Component-Level Issues

| Component | Current Issue | Severity | Suggested Fix | Phase |
|---|---|---|---|---|
| `Empty` | Uses `text-muted-foreground` without override; `EmptyDescription` uses `text-muted-foreground` class | P2 | Add `text-[var(--text-secondary)]` override or define `--muted-foreground` to match `--text-secondary` | 4A-6-2 |
| `Empty` | `EmptyMedia variant="icon"` uses `bg-muted` / `text-foreground` | P2 | Override with theme tokens | 4A-6-2 |
| `ErrorState` | Uses `border-red-500/20`, `bg-red-500/5`, `text-red-400`, `text-red-300` | P2 | Define status color tokens (`--status-error`) or use `destructive` shadcn token | 4A-6-5 |
| `SuccessState` | Uses `border-emerald-500/20`, `bg-emerald-500/5`, `text-emerald-400`, `text-emerald-300` | P2 | Define status color tokens (`--status-success`) | 4A-6-5 |
| `SelectTrigger` | Uses `border-input`, `bg-transparent` | P1 | Custom style already applied via `className` in migrated pages (`bg-[var(--bg-secondary)]`, `border-[var(--border-subtle)]`) | 4A-6-2 |
| `Checkbox` | Uses `border-input`, `bg-primary` on checked | P2 | Checked state uses shadcn `primary` → neon cyan; acceptable but may need fine-tuning | 4A-6-2 |
| `ToggleGroupItem` | Uses `toggleVariants` with `bg-transparent` / `border-input` defaults | P2 | Custom `data-[state=on]` overrides already applied in migrated pages | 4A-6-2 |
| `Button` (`outline`) | Uses `bg-background`, `hover:bg-accent` | P1 | `bg-background` resolves to `hsl(225 50% 8%)` → `#0a0e27` (matches `--bg-primary`); acceptable | 4A-6-2 |
| `DialogContent` | Uses `bg-popover`, `border-border` | P2 | Dark theme matches reasonably; verify against `--bg-secondary` | 4A-6-2 |

### 1.3 shadcn Semantic Token Usage Count

```
101 total occurrences across 37 files in app/src/components/ui/
```

Most are inside shadcn primitive component definitions and are acceptable. The risk is when these primitives render inside pages that otherwise use custom CSS variables — the user may perceive subtle color discontinuities.

**Root cause**: The project has two parallel color systems:
1. shadcn/Tailwind HSL system (`--background`, `--foreground`, `--primary`, etc.)
2. Custom cyberpunk system (`--bg-primary`, `--text-primary`, `--neon-cyan`, etc.)

These systems are *close* but not identical. The long-term fix is to align them or standardize on one.

**Short-term fix (Phase 4A-6-2)**: Override shadcn component className at call sites where mismatch is visible. Do not modify shadcn primitive files.

---

## 2. Card Density and Spacing Audit

### 2.1 Layout Component Baseline

| Component | Padding | Gap | Notes |
|---|---|---|---|
| `PageShell` | `p-6` | `gap-6` | Baseline |
| `SidePanel` | `p-4` | `gap-4` | Tighter than PageShell |
| `ResultPanel` | `p-4` | `gap-4` | Tighter than PageShell |
| `PageToolbar` | `p-4` | `gap-3` | Tighter still |
| `ContentGrid` | — | `gap-4` (sm) / `gap-6` (md) | Configurable |

### 2.2 Page-Level Inconsistencies

| Page / Component | Padding Found | Issue | Suggested Rule |
|---|---|---|---|
| `Semantic.tsx` result cards | `p-4` | Consistent with layout | ✅ OK |
| `Statistics.tsx` stat cards | Mixed `p-3` / `p-4` | Inline divs, not `StatCard` | Standardize to `StatCard` or `p-4` |
| `Attribution.tsx` model cards | `p-4` | Consistent | ✅ OK |
| `Forecast.tsx` config panel | `p-4` (AnalysisConfigPanel) | Consistent | ✅ OK |
| `PathAnalysis.tsx` config panel | `p-4` (AnalysisConfigPanel) | Consistent | ✅ OK |
| `GoalPlanner.tsx` planning cards | Mixed `p-2` / `p-3` / `p-4` | Dense input grid | Keep compact for data density |
| `Dashboard.tsx` widget cards | Mixed `p-4` / `p-6` | Custom widget layout | Standardize to `p-4` |
| `DataWorkshop.tsx` cards | `p-4` | Consistent | ✅ OK |
| `SmartAnalysis.tsx` cards | `p-4` | Consistent | ✅ OK |

### 2.3 Density Recommendation

Adopt three density modes for cards:

| Mode | Padding | Use Case |
|---|---|---|
| `compact` | `p-3` | Dense data grids, planning tables, configuration panels |
| `default` | `p-4` | Standard cards, result sections, stat cards |
| `spacious` | `p-6` | Hero sections, empty states, landing content |

Implementation: Add `density` prop to `SectionCard` and `Card` wrappers. Default to `default`.

---

## 3. Button Hierarchy Audit

### 3.1 Current State

Grep for `variant="..."` in pages shows:

| Variant | Count in Pages | Typical Usage |
|---|---|---|
| `ghost` | ~25 | View, export, download, close, delete, icon-only actions |
| `outline` | ~20 | Start analysis, save, reprocess, create, edit layout |
| `default` | ~1 | Visualization "保存到看板" |
| `destructive` | ~0 | Not used explicitly (delete uses `ghost` + custom color) |

### 3.2 Issues

| Page | Button / Action | Issue | Suggested Fix |
|---|---|---|---|
| `Forecast.tsx` | "启动预测" | `variant="outline"` for primary action | Use `variant="default"` |
| `PathAnalysis.tsx` | "开始分析" | `variant="outline"` for primary action | Use `variant="default"` |
| `SmartProcess.tsx` | "开始处理" | `variant="outline"` for primary action | Use `variant="default"` |
| `GoalPlanner.tsx` | "开始规划" | Custom `<button>` with inline styles | Use `Button variant="default"` |
| `Dashboard.tsx` | "删除看板" | `variant="ghost"` with `text-[var(--neon-pink)]` | Use `variant="destructive"` or add `variant="ghost-danger"` |
| `Datasets.tsx` | "删除" | `variant="ghost"` | Use `variant="destructive"` |
| `History.tsx` | "删除" | `variant="ghost"` | Use `variant="destructive"` |
| Multiple pages | Icon-only buttons | `title` attribute used; no `aria-label` | Add `aria-label` for screen readers |

### 3.3 Button Hierarchy Rules (Proposed)

| Action Type | Variant | Size | Example |
|---|---|---|---|
| Primary action (start analysis, save) | `default` | `default` / `sm` | "启动预测" |
| Secondary action (export, download) | `outline` | `sm` | "导出CSV" |
| Tertiary action (view, close, settings) | `ghost` | `sm` / `icon` | "查看结果" |
| Destructive action (delete, remove) | `destructive` | `sm` / `icon` | "删除" |
| Icon-only action | `ghost` | `icon` | Close, expand, download |

---

## 4. Glassmorphism Boundary Review

### 4.1 Current Usage

**30 occurrences** of `glass` class across 6 files:

| File | Count | Context |
|---|---|---|
| `Profile.tsx` | 10 | User profile cards, settings panels |
| `Attribution.tsx` | 7 | Model result cards, comparison chart, model comparison table |
| `SmartAnalysis.tsx` | 6 | Config panel, diagnosis card, recommendation card, result card |
| `DataWorkshop.tsx` | 5 | Data source, operation chain, preview, result cards |
| `Dashboard.tsx` | 1 | Custom dashboard widget |
| `Statistics.tsx` | 1 | Result card |

### 4.2 Design System Rule

From `FRONTEND_DESIGN_SYSTEM.md`:

> Glassmorphism is reserved for Dialog, Sheet, floating panels, AI assistant panel, and important cards. Ordinary SectionCard, DataTable, list page cards default to `bg-[var(--bg-secondary)]`. **禁止全站卡片强制毛玻璃**.

### 4.3 Audit Results

| Surface | Current Style | Should be glass? | Recommendation |
|---|---|---|---|
| `Attribution.tsx` model result cards | `glass` | ❌ No | Ordinary data cards → `bg-[var(--bg-secondary)]` |
| `Attribution.tsx` comparison chart card | `glass` | ❌ No | Result section → `bg-[var(--bg-secondary)]` |
| `Statistics.tsx` result card | `glass` | ❌ No | Result section → `bg-[var(--bg-secondary)]` |
| `SmartAnalysis.tsx` config panel | `glass` | ⚠️ Maybe | Top-level config panel → acceptable if elevated |
| `SmartAnalysis.tsx` diagnosis card | `glass` | ❌ No | Ordinary card → `bg-[var(--bg-secondary)]` |
| `DataWorkshop.tsx` data source card | `glass` | ⚠️ Maybe | Top-level panel → acceptable |
| `DataWorkshop.tsx` operation chain | `glass` | ❌ No | Ordinary card → `bg-[var(--bg-secondary)]` |
| `Profile.tsx` profile cards | `glass` | ❌ No | Ordinary cards → `bg-[var(--bg-secondary)]` |
| `Dashboard.tsx` widget card | `glass` | ⚠️ Maybe | Widget is elevated → acceptable |

### 4.4 Recommendation

Remove `glass` from all ordinary data cards and result sections. Reserve `glass` for:
- `Dialog` / `DialogContent`
- `Sheet`
- AI assistant floating panel
- Top-level elevated surfaces only

**Phase**: 4A-6-3 (page-level spacing and density pass).

---

## 5. ECharts / Graph Color Token Audit

### 5.1 Hardcoded Color Inventory

**137 hex codes** found across pages. Key files:

| File | Hardcoded Colors | Usage | Suggested Token | Risk |
|---|---|---|---|---|
| `Visualization.tsx` | `#00f5ff`, `#b829f7`, `#ff0080`, `#00ff9d`, `#ffaa00`, `#3b82f6`, `#ef4444`, `#eab308` | Chart color palette constants | `--neon-cyan`, `--neon-purple`, etc. | Low (already mapped in `COLORS` object) |
| `Visualization.tsx` | `#94a3b8` | Axis labels, legend text | `--text-secondary` | Low |
| `Visualization.tsx` | `#e2e8f0` | Axis line, title text | `--text-primary` | Low |
| `Visualization.tsx` | `#0a0e27` | Chart background, border | `--bg-primary` | Low |
| `Dashboard.tsx` | Same palette + `rgba()` gradients | Chart colors | Same as above | Low |
| `PathAnalysis.tsx` | `#00f5ff`, `#00d4e6`... | Funnel chart colors | `--neon-cyan` family | Low |
| `PathAnalysis.tsx` | `#0a0e27` | Chart background | `--bg-primary` | Low |
| `PathAnalysis.tsx` | `#94a3b8` | Axis labels | `--text-secondary` | Low |
| `PathAnalysis.tsx` | `#00ff9d`, `#ff0080`, `#ffaa00` | Association rule graph colors | `--neon-green`, `--neon-pink`, `--neon-orange` | Low |
| `PathAnalysis.tsx` | `#b829f7`, `#3b82f6` | Graph node colors | `--neon-purple`, `--chart-blue` | Low |
| `Attribution.tsx` | `rgba(21, 27, 61, 0.95)` | Tooltip background | `--bg-secondary` with opacity | Low |
| `Attribution.tsx` | `rgba(0, 245, 255, 0.3)` | Tooltip border | `--border-glow` | Low |
| `Attribution.tsx` | `rgba(148, 163, 184, 0.3)` | Axis line | `--border-subtle` | Low |

### 5.2 The Real Problem

The `COLORS` object in `Visualization.tsx` and `Dashboard.tsx` duplicates the CSS variable values:

```tsx
// Visualization.tsx
const COLORS = {
  cyan: '#00f5ff',      // Same as --neon-cyan
  purple: '#b829f7',    // Same as --neon-purple
  pink: '#ff0080',      // Same as --neon-pink
  // ...
};
```

This means **theme switching breaks**: if the user switches from Cyberpunk to Matrix or Sunset, the charts remain cyan/purple because ECharts options use hardcoded hex strings.

### 5.3 Recommended Fix

Create a `useChartColors()` hook that reads CSS custom properties at runtime:

```tsx
function useChartColors() {
  const root = getComputedStyle(document.documentElement);
  return {
    primary: root.getPropertyValue('--neon-cyan').trim(),
    secondary: root.getPropertyValue('--neon-purple').trim(),
    // ...
  };
}
```

Replace all `COLORS.xxx` references in ECharts option builders with values from this hook.

**Phase**: 4A-6-4 (chart color token audit).

---

## 6. Empty / Loading / Error State Audit

### 6.1 Shared Components

| Component | Current Style | Issue | Suggested Fix |
|---|---|---|---|
| `LoadingState` | `Spinner` + `text-[var(--text-secondary)]` | ✅ Clean, uses custom tokens | None |
| `ErrorState` | `border-red-500/20`, `bg-red-500/5`, `text-red-400` | Uses Tailwind `red` instead of theme token | Map to `--status-error` or shadcn `destructive` |
| `SuccessState` | `border-emerald-500/20`, `bg-emerald-500/5`, `text-emerald-400` | Uses Tailwind `emerald` instead of theme token | Map to `--status-success` |
| `AnalysisEmptyState` | Uses `Empty` + custom tokens | ✅ Clean | None |
| `Empty` (shadcn) | `text-muted-foreground`, `border-dashed` | `text-muted-foreground` may mismatch `--text-muted` | Override or align tokens |

### 6.2 Page-Specific Issues

| Page | State | Issue |
|---|---|---|
| `SmartAnalysis.tsx` | Empty recommendation list | Inline div instead of `Empty` component |
| `DataWorkshop.tsx` | Empty preview | Inline div instead of `Empty` component |
| `AIWorkspace.tsx` | No dataset selected | Inline styled div instead of `AnalysisEmptyState` |
| `Visualization.tsx` | No dataset / no fields | Already uses `Empty` ✅ |
| `Forecast.tsx` | No result | Already uses `AnalysisEmptyState` ✅ |

### 6.3 Recommendation

1. Define status color tokens in `index.css`:
   ```css
   --status-error: hsl(330 100% 50%);
   --status-success: hsl(160 100% 45%);
   --status-warning: hsl(35 100% 50%);
   ```
2. Update `ErrorState` and `SuccessState` to use these tokens.
3. Migrate inline empty divs in SmartAnalysis, DataWorkshop, AIWorkspace to `Empty` or `AnalysisEmptyState`.

**Phase**: 4A-6-5.

---

## 7. Bundle Size / Engineering Stabilization

### 7.1 Current State

- JS chunk: **~3,395 KB** (gzip: ~1,015 KB)
- No `manualChunks` in `vite.config.ts`
- Build warning: "Some chunks are larger than 500 kB after minification"

### 7.2 Major Dependencies

| Dependency | Size Impact | Action |
|---|---|---|
| `echarts` | Very high | Split to `echarts` chunk |
| `xlsx` | High | Split to `vendor` chunk |
| `recharts` | Medium | Split to `vendor` chunk or remove if ECharts covers all needs |
| `framer-motion` | Medium | Split to `vendor` chunk |
| `gsap` | Medium | Split to `vendor` chunk |
| `@radix-ui/*` (30 packages) | High | Split to `radix` chunk |
| `lucide-react` | Medium | Tree-shaken, but many icons imported |

### 7.3 Recommended `manualChunks` Config

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        echarts: ['echarts', 'recharts'],
        radix: ['@radix-ui/react-dialog', '@radix-ui/react-select', /* ... */],
        vendor: ['xlsx', 'framer-motion', 'gsap', 'axios'],
        ui: ['lucide-react', 'class-variance-authority', 'tailwind-merge'],
      },
    },
  },
}
```

**Expected outcome**: JS chunk reduced from ~3.4MB to ~1.5MB + lazy-loaded chunks.

### 7.4 Additional Bundle Actions

| Action | Impact | Phase |
|---|---|---|
| `manualChunks` | High | 4A-6-6 |
| Lazy-load analysis pages | Medium | 4A-6-6 |
| Remove `recharts` if redundant | Low | 4A-6-6 |
| Audit unused Radix packages | Low | 4A-6-6 |

---

## 8. ResultTable Position

### 8.1 Current State

No `ResultTable` family exists. `DataTablePreview` is used for simple previews only.

### 8.2 Need Assessment

| Candidate Component | Pages That Need It | Priority | Recommendation |
|---|---|---|---|
| `ResultTableShell` | PathAnalysis, Forecast, Attribution, GoalPlanner | Medium | Wait until visual tokens stabilize |
| `MetricComparisonTable` | Attribution, Statistics | Medium | Wait until at least 2 pages share the same pattern |
| `PathStepTable` | PathAnalysis (funnel steps) | Low | Highly specialized; keep native for now |
| `EditablePlanTable` | GoalPlanner (decomposition) | Low | Highly specialized; keep native for now |

### 8.3 Decision

**Defer ResultTable implementation.**

Reasons:
1. Each analytical result table has unique semantic requirements (conversion rates, drop-offs, progress bars, editable inputs).
2. Visual tokens (colors, spacing, density) must stabilize before designing table cell renderers.
3. The "rule of three" is not met — no two pages share the same table pattern.

**Action**: Include a `ResultTable` design document in Phase 4A-6-7 as a research spike, not implementation.

---

## 9. Recommended Phase 4A-6 Implementation Plan

### Phase 4A-6-2: Shared Component Visual Refinement

**Scope**: Fix shadcn/custom theme mismatches in shared components.

**Tasks**:
1. Patch `Empty` description color to use `--text-secondary`
2. Patch `EmptyMedia` icon variant to use theme tokens
3. Update `ErrorState` to use `--status-error` token
4. Update `SuccessState` to use `--status-success` token
5. Verify `Select`, `Checkbox`, `ToggleGroup` checked states match theme
6. Add `density` prop to `SectionCard`

### Phase 4A-6-3: Page-Level Spacing and Density Pass

**Scope**: Remove `glass` overuse, standardize card padding.

**Tasks**:
1. Remove `glass` from ordinary data cards in Attribution, Statistics, SmartAnalysis, Profile
2. Standardize card padding to `p-4` (default) unless explicitly compact
3. Fix GoalPlanner dense input grid padding

### Phase 4A-6-4: Chart Color Token Audit

**Scope**: Replace hardcoded ECharts colors with CSS variable references.

**Tasks**:
1. Create `useChartColors()` hook
2. Replace `COLORS` object in Visualization.tsx and Dashboard.tsx
3. Replace hardcoded hex in PathAnalysis.tsx, Attribution.tsx, Forecast.tsx ECharts options
4. Verify theme switching updates chart colors

### Phase 4A-6-5: Empty / Loading / Error State Polish

**Scope**: Standardize feedback states.

**Tasks**:
1. Define `--status-error`, `--status-success`, `--status-warning` in `index.css`
2. Update `ErrorState` and `SuccessState`
3. Migrate inline empty divs in SmartAnalysis, DataWorkshop, AIWorkspace to `Empty`

### Phase 4A-6-6: Button Hierarchy + Bundle Size Triage

**Scope**: Fix button variants and split JS chunks.

**Tasks**:
1. Change primary action buttons from `outline` to `default`
2. Change destructive actions from `ghost` + custom color to `destructive`
3. Add `aria-label` to icon-only buttons
4. Add `manualChunks` to `vite.config.ts`
5. Lazy-load analysis pages if feasible

### Phase 4A-6-7: ResultTable Design Document

**Scope**: Research spike only. No implementation.

**Tasks**:
1. Document requirements for `ResultTableShell`, `ResultTable`, `MetricComparisonTable`
2. Identify common patterns across PathAnalysis, Forecast, Attribution result sections
3. Propose props API
4. Mark as deferred until visual tokens stable and rule-of-three met

---

## 10. Guardrails

1. **Do not mix visual polish with business logic changes.** One concern per phase.
2. **Do not change API payloads.** Visual changes only.
3. **Do not change chart calculations.** Only color tokens and container styling.
4. **Do not reintroduce browser-local processing.** Sacred backend contract.
5. **Do not force complex tables into `DataTablePreview`.** Use native tables or wait for `ResultTable`.
6. **Do not implement `ResultTable` before visual tokens stabilize.**
7. **Do not add Hermes.** Phase 4B only.
8. **Do not touch DataWorkshop preview/save path.**
9. **Every implementation phase must run `tsc --noEmit`, `npm run build`, SelectItem grep, update phase log, update `CURRENT_PROGRESS` / `CHANGELOG`, and git commit/push.**
