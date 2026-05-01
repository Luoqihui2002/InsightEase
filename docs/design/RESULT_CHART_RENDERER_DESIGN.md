# ResultChartRenderer Design Document

**Version**: 1.0  
**Date**: 2026-04-28  
**Status**: Design — implementation deferred to future phases

---

## 1. Problem Statement

`ResultView` currently renders `chart` blocks as placeholder cards:

> "图表块占位符：{title} — 类型: {chartType} — 图表渲染将在未来阶段实现"

This creates an inconsistent user experience across analysis pages:

| Page | Chart Status | Location |
|------|-------------|----------|
| Statistics | No chart | N/A |
| Semantic | No chart | N/A |
| Attribution | **Real ECharts bar chart** | Outside `ResultView` |
| Forecast | **Chart placeholder** | Inside `ResultView` |
| PathAnalysis | **Multiple real ECharts charts/graphs** | Outside `ResultView` |

A rushed implementation risks:
- **Duplicated UI** — chart inside `ResultView` coexisting with page-level chart
- **Lifecycle bugs** — ECharts instances not disposed on unmount, causing memory leaks
- **Bundle bloat** — adding new chart libraries when ECharts is already available
- **Graph complexity** — Sankey, force-directed, and association-rule graphs have very different lifecycle needs from simple line/bar charts

This document proposes a unified but phased approach to chart rendering inside `ResultView`.

---

## 2. Current Chart Inventory

### 2.1 Attribution

| Property | Value |
|----------|-------|
| Chart type | Grouped bar chart |
| Location | `Attribution.tsx`, outside `ResultView` |
| Data | `analysisResult.models` — `Record<model, Record<touchpoint, { percentage }>>` |
| ECharts option | Custom-built with `getChartColors()`, `withAlpha()` |
| Lifecycle | `useEffect` initializes on `analysisResult` change; disposes on unmount |
| Migration candidate | **Yes — simple bar chart, high value** |

The chart compares attribution percentages across models and touchpoints. It is a straightforward grouped bar chart with themed colors.

### 2.2 Forecast

| Property | Value |
|----------|-------|
| Chart type | Line chart (placeholder only) |
| Location | Inside `ResultView` as placeholder card |
| Data | `forecastRows` — `{ date, actual, forecast, lower, upper }[]` |
| Current behavior | Placeholder card with `chartType: "line"` |
| Migration candidate | **Yes — highest priority; no real chart to conflict with** |

The adapter already emits a `chart` block with `chartType: "line"`, `xKey: "date"`, `yKeys: ["actual", "forecast"]`.

### 2.3 PathAnalysis — Funnel

| Property | Value |
|----------|-------|
| Chart type | ECharts funnel |
| Location | `PathAnalysis.tsx`, outside `ResultView` |
| Data | `result.funnel_steps` — `{ name, users, conversion_rate, drop_off_rate }[]` |
| ECharts option | Custom `funnel` series with themed gradient colors |
| Migration candidate | **Later — specialized chart type, medium complexity** |

### 2.4 PathAnalysis — Sankey

| Property | Value |
|----------|-------|
| Chart type | ECharts sankey |
| Location | `PathAnalysis.tsx`, outside `ResultView` |
| Data | `result.sankey_data` — `{ nodes, links }` |
| Special behavior | Falls back to graph view if cycles detected |
| Migration candidate | **Later — graph-like, layout complexity** |

### 2.5 PathAnalysis — Force-Directed Graph

| Property | Value |
|----------|-------|
| Chart type | ECharts `graph` with `layout: 'force'` |
| Location | `PathAnalysis.tsx`, outside `ResultView` |
| Data | `result.graph_data` — `{ nodes, links }` |
| Special behavior | Merges duplicate links; supports roam/drag |
| Migration candidate | **Much later — graph renderer is a separate concern** |

### 2.6 PathAnalysis — Association Rule Graph

| Property | Value |
|----------|-------|
| Chart type | ECharts `graph` (separate component `AssociationRuleGraph`) |
| Location | `PathAnalysis.tsx`, outside `ResultView` |
| Data | `result.association_rules` — `{ antecedent, consequent, support, confidence, lift }[]` |
| Special behavior | Builds nodes/links from rules dynamically |
| Migration candidate | **Much later — graph renderer is a separate concern** |

---

## 3. Proposed Chart Block Contract

### 3.1 Current Schema (`app/src/types/result.ts`)

```typescript
export interface ResultChartBlock {
  type: "chart";
  title?: string;
  chartType:
    | "bar"
    | "line"
    | "scatter"
    | "pie"
    | "histogram"
    | "box"
    | "heatmap"
    | "funnel"
    | "sankey"
    | "custom";
  data: Record<string, unknown>[];
  xKey?: string;
  yKeys?: string[];
  seriesNames?: string[];
  colorKey?: string;
  groupKey?: string;
  linkedTableBlockId?: string;
  echartsOptions?: Record<string, unknown>;
}
```

### 3.2 Assessment

The current schema is **sufficient for P0 and P1 chart types** (line, bar, scatter, pie, histogram). It already supports:
- Typed `chartType` discriminator
- Tabular `data` with key mappings (`xKey`, `yKeys`)
- Series labeling (`seriesNames`)
- Escape hatch (`echartsOptions` for custom overrides)

### 3.3 Recommended Additions (Future Phase)

For richer chart support, consider adding:

```typescript
export interface ResultChartBlock {
  // ... existing fields ...

  /** Unique identifier for this chart block */
  id?: string;

  /** Human-readable subtitle or description */
  description?: string;

  /** Semantic hint for the renderer */
  rendererHint?: "echarts" | "placeholder";

  /** Visual encoding overrides */
  encoding?: {
    color?: string;         // CSS color or token
    area?: boolean;         // for line charts
    stack?: boolean;        // for bar/area charts
    smooth?: boolean;       // for line charts
    showLabels?: boolean;
  };

  /** Axis configuration hints */
  axes?: {
    x?: { label?: string; type?: "category" | "time" | "value" };
    y?: { label?: string; format?: "number" | "percent" | "currency" };
  };
}
```

**Do not modify the schema in this phase.** Document these as recommendations for a future schema evolution phase.

---

## 4. Chart Type Support Plan

### P0: Basic Charts (Implement First)

| Type | Use Case | Complexity |
|------|----------|------------|
| `line` | Forecast trend, time-series | Low |
| `bar` | Attribution comparison, category comparison | Low |
| `area` | Stacked trend visualization | Low (line variant) |

**Why first:** These map directly to ECharts `line` and `bar` series. They require only x/y axis mapping, series generation, and basic tooltip formatting. The Forecast and Attribution pages are ready to migrate.

### P1: Statistical Charts (Implement Second)

| Type | Use Case | Complexity |
|------|----------|------------|
| `scatter` | Correlation, regression diagnostics | Medium |
| `histogram` | Distribution analysis | Medium |
| `pie` | Proportion breakdown | Low |

**Why second:** These need additional axis/domain configuration but still fit the standard cartesian/polar model.

### P2: Specialized Charts (Defer)

| Type | Use Case | Complexity |
|------|----------|------------|
| `funnel` | PathAnalysis funnel | Medium — unique layout |
| `sankey` | PathAnalysis flow | High — node/link graph model |
| `graph` / `network` | PathAnalysis force-directed, association rules | High — separate renderer needed |
| `heatmap` | Correlation matrices | Medium |

**Why deferred:**
- Sankey and force-directed graphs use a **node/link data model**, not tabular x/y data
- They require **layout algorithms** that run asynchronously
- Tooltips and interactions are **graph-specific**
- Migration risk is high — these are complex, working visualizations outside ResultView

---

## 5. Rendering Architecture

### 5.1 Proposed File Structure

```
app/src/components/results/
  ResultView.tsx                    (existing — dispatcher)
  ResultChartRenderer.tsx           (new — main chart renderer)
  charts/
    BaseEChart.tsx                  (new — ECharts lifecycle wrapper)
    buildChartOption.ts             (new — chart-type option builders)
    chartTypes.ts                   (new — type definitions + registry)
    options/
      lineChartOption.ts            (new)
      barChartOption.ts             (new)
      scatterChartOption.ts         (new — future)
      pieChartOption.ts             (new — future)
```

### 5.2 Component Responsibilities

**`ResultView`** (existing)
- Dispatches `chart` blocks to `ResultChartRenderer`
- Unchanged except for swapping the placeholder JSX to `<ResultChartRenderer />`

**`ResultChartRenderer`**
- Receives `ResultChartBlock`
- Validates `chartType` against supported types
- Calls `buildChartOption(block)` to generate ECharts option
- Renders `<BaseEChart option={option} />`
- Falls back to placeholder for unsupported types

**`BaseEChart`**
- Receives `option: EChartsOption`
- Manages ECharts instance lifecycle:
  - `echarts.init(container)` on mount
  - `setOption(option)` when prop changes
  - `dispose()` on unmount
  - `resize()` on container/window resize
- Uses `ResizeObserver` or `window resize` listener
- Guards against zero-width containers

**`buildChartOption`**
- Registry of chart-type builders
- Maps `ResultChartBlock` to ECharts `EChartsOption`
- Applies theme colors via `getChartColors()`
- Handles empty/malformed data gracefully

### 5.3 Data Flow

```
Backend result
    ↓
Adapter → AnalysisResult → blocks[]
    ↓
ResultView → BlockDispatcher
    ↓
ResultChartRenderer (chart block)
    ↓
buildChartOption(chartType, data, encoding)
    ↓
BaseEChart → ECharts instance
```

---

## 6. ECharts Lifecycle and Safety

### 6.1 Required Behaviors

| Concern | Requirement |
|---------|-------------|
| **Mount** | Initialize `echarts.init(container)` only after container is rendered and has non-zero dimensions |
| **Update** | Call `setOption(newOption, true)` when data changes; avoid full re-init |
| **Unmount** | Always call `instance.dispose()` to free memory and DOM event listeners |
| **Resize** | Listen to `ResizeObserver` or `window resize`; debounce to ~100ms |
| **Empty data** | Show empty-state message instead of blank chart or error |
| **Malformed data** | Validate `data` is array; validate `xKey`/`yKeys` exist in first row; fallback to placeholder |
| **Duplicate init** | Guard against double-initialization if React strict mode re-runs effects |
| **Hidden container** | Skip rendering if container has zero width/height; re-init when visible |

### 6.2 Reference: Current Lifecycle Patterns

The existing pages already implement safe ECharts lifecycle:

```typescript
// Attribution.tsx pattern (to preserve)
const chartInstance = useRef<echarts.ECharts | null>(null);

useEffect(() => {
  if (analysisResult?.models && chartRef.current) {
    renderComparisonChart();
  }
  return () => {
    chartInstance.current?.dispose();
  };
}, [analysisResult]);

const renderComparisonChart = () => {
  chartInstance.current?.dispose();
  chartInstance.current = echarts.init(chartRef.current);
  // ... build option ...
  chartInstance.current.setOption(option);
};
```

`BaseEChart` should generalize this pattern into a reusable component.

---

## 7. Bundle Size Considerations

### 7.1 Current State

From Phase 4A-6-6B bundle triage:

| Chunk | Size |
|-------|------|
| `vendor-echarts` | ~1,561 kB (uncompressed) |
| `index` | ~1,066 kB (after this phase) |

ECharts is already imported by:
- `Attribution.tsx`
- `PathAnalysis.tsx`
- `GoalPlanner.tsx`

It is already split into `vendor-echarts` via `manualChunks`.

### 7.2 Constraints

- **Do not add new chart libraries.** Reuse the existing ECharts dependency.
- `ResultChartRenderer` will import ECharts types and utilities. These will naturally land in `vendor-echarts` since ECharts is already a dependency.
- No expected bundle size increase beyond the renderer component code (~few KB).
- Future optimization: ECharts tree-shaking (`import * as echarts from 'echarts/core'` + selective imports) is **out of scope** for the first implementation phase.

---

## 8. Migration Strategy

### 8.1 Conservative Sequence

| Step | Action | Page | Risk |
|------|--------|------|------|
| 1 | Implement `ResultChartRenderer` for P0 types only | None (component only) | Low |
| 2 | Migrate Forecast placeholder → real line chart | Forecast | **Low** — no existing chart to conflict |
| 3 | Migrate Attribution bar chart → ResultView | Attribution | Medium — remove page-level chart |
| 4 | Keep PathAnalysis charts outside ResultView | PathAnalysis | N/A — deferred |
| 5 | Later: evaluate funnel/sankey/graph migration | PathAnalysis | High — separate renderer needed |

### 8.2 Why Forecast First

1. **No conflict** — it currently has only a placeholder; no existing chart to duplicate
2. **Simple chart type** — time-series line chart is the most straightforward ECharts series
3. **High value** — forecast visualization is core to the page's purpose
4. **Low risk** — if the renderer has bugs, only Forecast is affected

### 8.3 Attribution Second

1. **Simple chart type** — grouped bar chart
2. **Clear data contract** — `models` → `touchpoints` → `percentage`
3. **Medium risk** — must remove the existing page-level chart to avoid duplication
4. The adapter will need to emit a `chart` block (currently omitted per 4A-6-13 policy)

### 8.4 PathAnalysis Deferred

PathAnalysis has **four distinct visualizations** with very different data models:
- Funnel: funnel series
- Sankey: sankey series with node/link data
- Graph: force layout with roam/drag
- Association rules: dynamically built graph

These require either:
- A generic graph renderer abstraction, or
- Page-level chart retention with adapters only providing chart metadata

Both approaches need dedicated design time. Rushing this migration risks breaking working visualizations.

---

## 9. Non-Goals

This design document explicitly does **NOT** cover:

1. **Implementation** — no code is written in this phase
2. **Page migration** — no charts are moved in this phase
3. **New chart dependencies** — no D3, Chart.js, or other libraries
4. **Backend/API changes** — no new endpoints or response shapes
5. **Adapter changes** — adapters continue their current behavior
6. **ECharts tree-shaking** — full ECharts bundle remains acceptable for now
7. **Graph renderer** — Sankey/force/association graphs are out of scope for the first implementation phase
8. **Real-time/animated charts** — streaming data updates are not considered

---

## 10. Future Implementation Phases

### Phase 4A-6-18: Basic ResultChartRenderer Implementation

- Implement `BaseEChart.tsx` with safe lifecycle
- Implement `buildChartOption.ts` with line/bar support
- Implement `ResultChartRenderer.tsx` as dispatcher
- Replace placeholder JSX in `ResultView.tsx`
- Graph types (`funnel`, `sankey`, `graph`) remain as placeholders
- No page migration; test with mock data only

### Phase 4A-6-19: Forecast Chart Migration

- Update `forecastResultAdapter.ts` to keep emitting line chart block
- Verify `ResultChartRenderer` renders real line chart
- Remove placeholder fallback once verified
- Update phase log

### Phase 4A-6-20: Attribution Chart Migration

- Update `attributionResultAdapter.ts` to emit bar chart block (re-enable commented-out section)
- Remove page-level ECharts chart from `Attribution.tsx`
- Verify `ResultChartRenderer` renders grouped bar chart
- Update phase log

### Later: PathAnalysis Graph Strategy

- Design `ResultGraphRenderer` for node/link visualizations
- Evaluate whether funnel/sankey can use `ResultChartRenderer` or need separate renderer
- Evaluate force-directed graph and association rule graph migration
- Decision: migrate into ResultView vs. keep page-level with adapter providing metadata

---

## Appendix A: Current Placeholder Code

```tsx
// app/src/components/results/ResultView.tsx (lines 175-185)
case "chart":
  return (
    <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-tertiary)] p-6 text-center">
      <p className="text-sm text-[var(--text-muted)]">
        图表块占位符：{block.title ?? "未命名图表"}
      </p>
      <p className="text-xs text-[var(--text-muted)] mt-1">
        类型: {block.chartType} — 图表渲染将在未来阶段实现
      </p>
    </div>
  );
```

This placeholder will be replaced by `<ResultChartRenderer block={block} />` in Phase 4A-6-18.

## Appendix B: Relevant Files

| File | Role |
|------|------|
| `app/src/types/result.ts` | `ResultChartBlock` schema |
| `app/src/components/results/ResultView.tsx` | Block dispatcher (currently placeholder) |
| `app/src/lib/adapters/forecastResultAdapter.ts` | Emits line chart placeholder |
| `app/src/lib/adapters/attributionResultAdapter.ts` | Bar chart block intentionally omitted |
| `app/src/pages/Attribution.tsx` | Page-level ECharts bar chart |
| `app/src/pages/PathAnalysis.tsx` | Page-level ECharts funnel/sankey/graph |
| `app/src/hooks/useChartColors.ts` | Theme color tokens |
| `app/vite.config.ts` | `manualChunks` splits `vendor-echarts` |
