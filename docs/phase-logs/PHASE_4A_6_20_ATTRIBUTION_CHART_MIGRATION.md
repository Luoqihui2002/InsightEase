# Phase 4A-6-20: Attribution Chart Migration

## Objective

Migrate the Attribution page's comparison bar chart from page-level ECharts rendering into the unified `ResultView` system through `ResultChartRenderer`.

---

## Files Inspected

| File | Purpose |
|------|---------|
| `app/src/pages/Attribution.tsx` | Old page-level ECharts chart rendering and cleanup target |
| `app/src/lib/adapters/attributionResultAdapter.ts` | Attribution result adapter and chart block generation |
| `app/src/components/results/charts/buildChartOption.ts` | Generic chart option builder for bar chart rendering |
| `app/src/components/results/ResultChartRenderer.tsx` | Result chart block renderer |

---

## Files Modified

| File | Change |
|------|--------|
| `app/src/lib/adapters/attributionResultAdapter.ts` | Added real bar chart block for attribution model comparison |
| `app/src/pages/Attribution.tsx` | Removed old page-level ECharts chart logic and JSX |

---

## Old Chart Behavior

Before this phase, Attribution rendered its comparison chart directly inside `Attribution.tsx` using page-level ECharts lifecycle logic.

The page managed:

- `chartRef` + `chartInstance` refs
- Chart initialization via `echarts.init()`
- Chart disposal on unmount
- Full option construction (title, tooltip, legend, grid, xAxis, yAxis, series)
- Chart `<Card>` JSX section

This was inconsistent with the new `ResultView` architecture where all analysis output should be emitted by adapters and rendered by shared components.

---

## New Chart Behavior

The Attribution adapter now emits a chart block:

```ts
{
  type: "chart",
  title: "各模型归因对比",
  chartType: "bar",
  xKey: "touchpoint",
  yKeys: modelKeys,
  data: chartRows,
  seriesNames: modelKeys.map(mk => MODEL_NAME_MAP[mk] || mk),
}
```

The chart is rendered through:

```
ResultView
  → ResultChartRenderer
  → BaseEChart
  → buildChartOption("bar")
```

This is consistent with the Forecast line chart migration (Phase 4A-6-19).

---

## Chart Data Normalization

The raw Attribution result has nested model data:

```ts
models: Record<string, Record<string, { percentage: number }>>
```

The adapter converts it into flat chart rows:

```ts
{
  touchpoint: string;
  [modelKey]: number;
}
```

This lets `ResultChartRenderer` render a grouped bar chart where:

- **x-axis** = touchpoint
- **series** = attribution models
- **value** = attribution percentage

Model keys are mapped to Chinese display names where available:

| Model Key | Display Name |
|-----------|--------------|
| `first_touch` | 首次触点 |
| `last_touch` | 末次触点 |
| `linear` | 线性归因 |
| `time_decay` | 时间衰减 |
| `position_based` | 位置归因 |
| `shapley` | Shapley值 |

---

## Cleanup Performed

Removed from `Attribution.tsx`:

- `chartRef` ref
- `chartInstance` ref
- `renderComparisonChart()` function (~56 lines)
- Page-level chart `useEffect` (init + dispose)
- Old chart `<Card>` JSX section
- Unused imports:
  - `echarts`
  - `getChartColors`
  - `withAlpha`
  - `Card`, `CardContent`, `CardHeader`, `CardTitle`

---

## Validation Results

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npm run build` | ✅ success (built in 19.01s) |
| No package files modified | ✅ confirmed |

---

## Manual Verification Checklist

| Item | Status | Notes |
|------|--------|-------|
| Attribution page compiles | ✅ | `tsc --noEmit` passed |
| Attribution ResultView still renders summary, metrics, and tables | ✅ | Adapter still emits existing blocks |
| Attribution comparison chart renders inside ResultView | ✅ | Bar chart block emitted by adapter |
| Old external ECharts chart removed | ✅ | Page-level chart logic removed |
| No duplicate chart UI remains | ✅ | Only ResultView chart remains |
| Export CSV behavior remains unchanged | ✅ | Export logic not modified |
| Forecast chart unaffected | ✅ | No Forecast files modified |
| PathAnalysis charts/graphs unaffected | ✅ | No PathAnalysis files modified |
| Empty or malformed model data handled safely | ✅ | Adapter guards model data |
| No unrelated pages modified | ✅ | Only Attribution adapter/page touched |

---

## Known Limitations

1. The Attribution chart now uses the generic bar chart renderer. Highly customized page-level styling from the old ECharts chart (e.g. per-series colors from `ATTRIBUTION_MODELS`) is not fully preserved — `buildChartOption` uses the themed color palette instead.
2. Advanced chart interactions remain limited to what `ResultChartRenderer` currently supports.
3. PathAnalysis graph-style visualizations (funnel, sankey, force-directed graph) remain outside ResultView and are deferred to P2 per the design doc.

---

## Next Recommended Phase

Possible next phases:

1. **ResultChartRenderer polish**:
   - Better grouped bar labels
   - Tooltip formatting (e.g. append `%` for attribution percentages)
   - ResizeObserver support
   - Confidence band support for Forecast

2. **Phase 4B: AI Assistant Upgrade**:
   - Start designing the AI data assistant system now that the result rendering architecture is substantially unified.

---

## Git Information

```
Branch: master
Origin: https://github.com/Luoqihui2002/InsightEase.git
```

---

*Phase completed: 2026-04-28*
