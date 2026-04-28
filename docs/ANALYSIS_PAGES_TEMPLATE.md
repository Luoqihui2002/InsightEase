# Analysis Pages Unified Template Design

**Date**: 2026-04-28
**Phase**: 4A-3-7 (Design-only)
**Status**: Audit Complete, Template Proposed

---

## 1. Current Analysis Pages Inventory

| # | Page | File | Lines | Layout Pattern | Data Source | Result Type | Risk |
|---|------|------|-------|----------------|-------------|-------------|------|
| 1 | Semantic Analysis | `pages/Semantic.tsx` | ~385 | Title + 2-col grid | `analysisApi.create({ type: 'semantic' })` | JSON table | Low |
| 2 | Clustering | `pages/Clustering.tsx` | ~429 | Title + 2-col grid | `analysisApi.create({ type: 'clustering' })` | ECharts scatter + table | Low |
| 3 | Statistics | `pages/Statistics.tsx` | ~515 | Title + 2-col grid | `analysisApi.create({ type: 'descriptive' })` | Stat cards + table | Medium |
| 4 | Attribution | `pages/Attribution.tsx` | ~918 | Title + 2-col grid | `analysisApi.create({ type: 'attribution' })` | ECharts bar + table | Medium |
| 5 | SmartProcess | `pages/SmartProcess.tsx` | ~615 | Title + 2-col grid | `analysisApi.create({ type: 'preprocess' })` | File download | Medium |
| 6 | GoalPlanner | `pages/GoalPlanner.tsx` | ~1134 | Title + config + result | Pure frontend (localStorage forecast) | Table + calendar | Medium |
| 7 | Forecast | `pages/Forecast.tsx` | ~1490 | Title + complex config | `analysisApi.create({ type: 'forecast' })` | ECharts line + table | High |
| 8 | PathAnalysis | `pages/PathAnalysis.tsx` | ~2362 | Title + 5-type selector | `analysisApi.create({ type: 'path_analysis' })` | Funnel/Sankey/Graph | High |
| 9 | SmartAnalysis | `pages/SmartAnalysis.tsx` | ~903 | 5-step wizard | Mixed (mock diagnose + real API) | Multi-step result | High |

### Risk Classification

- **Low**: Simple form (`<select>`/`<input>`), single API endpoint, single result type, no ECharts sub-components.
- **Medium**: Multiple config options, CSV/JSON export, gsap animations, ECharts rendering, or localStorage coupling.
- **High**: Multi-step workflows, multiple analysis types in one page, sub-components, mock APIs mixed with real APIs, complex state machines.

---

## 2. Common Layout Pattern Analysis

Every analysis page follows a **nearly identical structural pattern**:

```
<div className="space-y-6">
  {/* 2.1 Title Bar */}
  <div className="flex items-center justify-between ...">
    <div>
      <h1 className="text-3xl font-bold ...">Page Title</h1>
      <p className="text-[var(--text-secondary)] ...">Description</p>
    </div>
    {/* Optional: view toggle / action buttons */}
  </div>

  {/* 2.2 Dataset Selector */}
  <Card className="glass"><CardContent>
    <DatasetSelector ... />
    <DataTypeValidation ... />
  </CardContent></Card>

  {/* 2.3 Main Content: Left Config + Right Result */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    {/* Left: Config Panel (lg:col-span-1) */}
    <Card className="glass border-[var(--border-subtle)]">
      <CardHeader><CardTitle>分析配置</CardTitle></CardHeader>
      <CardContent>
        {/* Page-specific form controls */}
      </CardContent>
      <CardFooter>
        <Button onClick={runAnalysis}>开始分析</Button>
      </CardFooter>
    </Card>

    {/* Right: Result Panel (lg:col-span-2) */}
    <Card className="glass border-[var(--border-subtle)] lg:col-span-2">
      <CardHeader><CardTitle>分析结果</CardTitle></CardHeader>
      <CardContent>
        {/* Conditional: empty / loading / result */}
      </CardContent>
    </Card>
  </div>

  {/* 2.4 Bottom Sections (optional) */}
  <Card className="glass">...</Card>
</div>
```

### Shared Elements (100% of pages)

| Element | Usage |
|---------|-------|
| `DatasetSelector` | All 9 pages |
| `DataTypeValidation` | All 9 pages |
| `Card className="glass"` | All 9 pages |
| `grid grid-cols-1 lg:grid-cols-3 gap-6` | All 9 pages except GoalPlanner (uses custom layout) |
| Polling pattern (`setInterval` + `analysisApi.getStatus`) | Statistics, Clustering, Semantic, SmartProcess, Forecast, Attribution, PathAnalysis |
| CSV/JSON export button | Statistics, Attribution, SmartProcess, Semantic |
| gsap animation for results | Statistics, Forecast, Attribution |

### Divergent Elements

| Element | Pages |
|---------|-------|
| Multi-step wizard | SmartAnalysis only |
| 5-type selector tabs | PathAnalysis only |
| Forecast comparison (localStorage) | GoalPlanner only |
| What-if / promotion calendar | Forecast only |
| Custom import dialog | Forecast only |
| Sub-components | PathAnalysis (`AssociationRuleGraph`) |

---

## 3. Proposed Template Components

To avoid refactoring each page independently and inconsistently, introduce the following **analysis-specific shared components** built on top of the existing Phase 4A-2 shared component library.

### 3.1 `AnalysisPageShell`

Wraps `PageShell` with analysis-page-specific defaults.

```tsx
interface AnalysisPageShellProps {
  title: string;
  description: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode; // view toggle, export all, etc.
}
```

Usage:
```tsx
<AnalysisPageShell
  title="描述性统计"
  description="计算数据集的基本统计指标。"
  rightAction={<ViewToggle />}
>
  {/* ... */}
</AnalysisPageShell>
```

### 3.2 `AnalysisConfigPanel`

Replaces the left `Card` in the 2-col grid.

```tsx
interface AnalysisConfigPanelProps {
  title?: string;           // default: "分析配置"
  icon?: React.ReactNode;   // default: <Settings />
  children: React.ReactNode; // form controls
  footer?: React.ReactNode;  // action buttons
  className?: string;
}
```

Built on `SidePanel` (or `SectionCard` if not a side panel).

### 3.3 `AnalysisResultPanel`

Replaces the right `Card` in the 2-col grid. **Must be generic** — do not assume every result is a chart.

```tsx
interface AnalysisResultPanelProps {
  title?: string;           // default: "分析结果"
  icon?: React.ReactNode;   // default: <BarChart3 />
  actions?: React.ReactNode; // export / download buttons
  loading?: boolean;
  loadingMessage?: string;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: React.ReactNode; // result content
  className?: string;
}
```

**Supported content types**:
- ECharts chart (via `ChartCard` when appropriate)
- Data table (via `DataTablePreview`)
- JSON / structured result (plain render)
- File download result (download button + metadata)
- Empty / loading / polling states (built-in)

Built on `ResultPanel`. Uses `ChartCard` **only when the result is actually a chart** — pages with table, JSON, or download results should render children directly without forcing `ChartCard`.

### 3.4 `AnalysisActionBar`

Standardizes export/download button groups.

```tsx
interface AnalysisActionBarProps {
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  onDownload?: () => void;
  disabled?: boolean;
}
```

### 3.5 `AnalysisEmptyState`

Standardized empty state for "no dataset selected" and "no result yet".

```tsx
interface AnalysisEmptyStateProps {
  type: 'no-dataset' | 'no-result' | 'no-config';
  action?: React.ReactNode;
}
```

Built on shadcn `<Empty>`.

### 3.6 `AnalysisResultSummary`

Reusable stat card grid for simple numeric results.

```tsx
interface AnalysisResultSummaryProps {
  stats: { label: string; value: string | number; icon?: React.ReactNode; color?: string }[];
  columns?: 2 | 3 | 4; // default: 4
}
```

Built on `ContentGrid` + `StatCard`.

### 3.7 `AnalysisPollingOverlay`

Optional overlay or inline loading state for polling-based pages.

```tsx
interface AnalysisPollingOverlayProps {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}
```

---

## 4. Page-by-Page Migration Plan

| # | Page | Risk | Effort | Key Changes | Template Components Used |
|---|------|------|--------|-------------|--------------------------|
| 1 | **Semantic** | Low | 1h | Replace title bar → `AnalysisPageShell`; replace Cards → `AnalysisConfigPanel` + `AnalysisResultPanel`; add `AnalysisActionBar` for JSON export | Shell, ConfigPanel, ResultPanel, ActionBar |
| 2 | **Clustering** | Low | 1h | Same as Semantic; column checkboxes + K slider stay unchanged | Shell, ConfigPanel, ResultPanel |
| 3 | **Statistics** | Medium | 2h | Same as above; stat cards grid → `AnalysisResultSummary`; CSV export → `AnalysisActionBar`; keep gsap | Shell, ConfigPanel, ResultPanel, ResultSummary, ActionBar |
| 4 | **Attribution** | Medium | 2h | Same as Statistics; ECharts comparison chart + model table stay unchanged | Shell, ConfigPanel, ResultPanel, ActionBar |
| 5 | **SmartProcess** | Medium | 2h | Same as above; file download stays; multiple `<select>` configs stay | Shell, ConfigPanel, ResultPanel, ActionBar |
| 6 | **GoalPlanner** | Medium | 3h | Custom layout (not 2-col grid); use `PageShell` + `PageHeader` directly; funnel template cards + decomposition table stay; forecast comparison stays | Shell, ActionBar |
| 7 | **Forecast** | High | 4h | Complex config panel with many sections; keep custom layout within `AnalysisConfigPanel`; What-if / promotion calendar stay; import dialog → shadcn `Dialog` | Shell, ConfigPanel, ResultPanel, ActionBar |
| 8 | **PathAnalysis** | High | 5h | 5-type selector → keep as tabs within `AnalysisConfigPanel`; 3 ECharts instances + `AssociationRuleGraph` sub-component stay; result panel has complex conditional rendering | Shell, ConfigPanel, ResultPanel, ActionBar |
| 9 | **SmartAnalysis** | High | 6h | 5-step wizard is structurally different; **not a candidate for the standard 2-col template**. Refactor with dedicated wizard components (future Phase 4A-5). Use `PageShell` + `PageHeader` only for outer wrapper. | Shell only |

---

## 5. Recommended Refactor Order

Follow **risk-ascending order** to build confidence and validate components incrementally.

**Scope boundary**: Phase 4A-4 migrations are **layout/template-only**. Native `<select>` and other interaction controls stay as-is until Phase 4A-5.

1. **Phase 4A-4-0**: Build 7 template components (shared infra first)
2. **Phase 4A-4-1**: Semantic + Clustering (Low risk, validate template components)
3. **Phase 4A-4-2**: Statistics + Attribution (Medium risk, validate `AnalysisResultSummary`, ECharts integration)
4. **Phase 4A-4-3**: SmartProcess + GoalPlanner (Medium risk, validate file download, custom layouts)
5. **Phase 4A-4-4**: Forecast (High risk, validate complex config panels)
6. **Phase 4A-4-5**: PathAnalysis (High risk, validate multi-type selector + sub-components)
7. **Phase 4A-5**: SmartAnalysis (Dedicated wizard refactor, outside this template) + interaction control replacement (native `<select>` → shadcn `Select`, etc.)

---

## 6. Guardrails for Future Analysis Page Refactors

### 6.1 Do Not Touch

- ECharts option generators and rendering logic
- API call payloads and response handling
- Polling intervals and status logic
- File export / download logic
- gsap animation timelines
- localStorage reads/writes (GoalPlanner, Forecast)

### 6.2 Do Replace

- Handwritten `rgba()` title bar backgrounds → `PageHeader`
- Handwritten `<div className="space-y-6">` root → `AnalysisPageShell`
- Handwritten `Card className="glass"` config/result panels → `AnalysisConfigPanel` / `AnalysisResultPanel`
- Handwritten stat card grids → `AnalysisResultSummary`
- Handwritten export button groups → `AnalysisActionBar`
- Handwritten empty states → `AnalysisEmptyState` (built on shadcn `<Empty>`)
- Handwritten `fixed inset-0` modals → shadcn `Dialog`
- Native `<select>` → shadcn `Select` (Phase 4A-5 **only** — do not mix into Phase 4A-4 layout migrations)

### 6.3 Build Gate

After each page refactor:
```bash
cd app && npx tsc --noEmit    # must be 0 errors
cd app && npm run build        # must succeed
grep -R 'SelectItem value=""' src --include="*.tsx"  # must be empty
```

---

## 7. Open Questions

| Question | Recommendation |
|----------|----------------|
| Should `AnalysisConfigPanel` use `SidePanel` (fixed width) or `SectionCard` (flexible)? | Use `SidePanel` for standard 2-col pages; use `SectionCard` for GoalPlanner/Forecast custom layouts |
| Should template components live in `components/analysis/`? | Yes: `app/src/components/analysis/AnalysisPageShell.tsx`, etc. |
| Should SmartAnalysis be refactored to fit the template? | No — wizard pattern is fundamentally different; design dedicated `AnalysisWizard` components in Phase 4A-5 |
| Should AnalysisActionBar support Excel export? | Yes, add `onExportExcel` prop; Statistics currently exports CSV only |

---

## 8. Files to Create (Phase 4A-4-0)

```
app/src/components/analysis/
├── AnalysisPageShell.tsx
├── AnalysisConfigPanel.tsx
├── AnalysisResultPanel.tsx
├── AnalysisActionBar.tsx
├── AnalysisEmptyState.tsx
├── AnalysisResultSummary.tsx
├── AnalysisPollingOverlay.tsx
└── index.ts
```

---

*End of template design document. No code was modified in this phase.*
