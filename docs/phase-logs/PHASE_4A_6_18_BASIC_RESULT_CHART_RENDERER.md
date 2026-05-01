# Phase 4A-6-18: Basic ResultChartRenderer Implementation

## Objective

Implement the first basic `ResultChartRenderer` for the unified `ResultView` system, supporting P0 chart types: line, bar, area.

## Files Created

| File | Description |
|------|-------------|
| `app/src/components/results/ResultChartRenderer.tsx` | Main chart block renderer — dispatches to `BaseEChart` or placeholder |
| `app/src/components/results/charts/BaseEChart.tsx` | ECharts lifecycle wrapper — init/update/dispose/resize |
| `app/src/components/results/charts/buildChartOption.ts` | Option builder for line/bar/area with theme colors |
| `app/src/components/results/charts/chartTypes.ts` | Supported chart type registry and type guards |

## Files Modified

| File | Change |
|------|--------|
| `app/src/types/result.ts` | Added `"area"` to `ResultChartBlock.chartType` union |
| `app/src/components/results/ResultView.tsx` | Replaced inline chart placeholder with `<ResultChartRenderer block={block} />` |
| `app/src/components/results/index.ts` | Added `ResultChartRenderer` export |

## Implementation Summary

### BaseEChart

- Lazy-initializes `echarts.init(container)` only when container has non-zero dimensions
- Updates option via `setOption(option, true)` on prop change
- Disposes instance on unmount via cleanup effect
- Resizes on `window resize` event
- Renders empty-state fallback when `option` is null

### buildChartOption

- Guards: returns null for unsupported types or empty data
- Extracts x-axis categories from `xKey` (defaults to `"x"`)
- Builds one series per `yKeys` entry (defaults to `["y"]`)
- Applies theme colors via `getChartColors()` / `withAlpha()`
- **Line**: standard line series with tooltip + axis
- **Bar**: standard bar series with tooltip + axis
- **Area**: line series with gradient `areaStyle` (vertical fade)
- Legend auto-shown when `yKeys.length > 1`
- X-axis labels rotate when `categories.length > 12`
- Supports `echartsOptions` override from adapter

### ResultChartRenderer

- Calls `buildChartOption(block)` to get ECharts option
- Renders `BaseEChart` when type is supported and option is valid
- Renders empty-state when supported but no data
- Renders placeholder for unsupported types with message:
  > "图表类型暂未支持：{chartType} — 当前支持：line、bar、area"

### ResultView Integration

```tsx
// Before (placeholder)
case "chart":
  return <div className="...">图表块占位符...</div>;

// After (real renderer)
case "chart":
  return <ResultChartRenderer block={block} />;
```

## Supported Chart Types

| Type | Status | Notes |
|------|--------|-------|
| `line` | ✅ Supported | Multi-series, tooltip, legend |
| `bar` | ✅ Supported | Multi-series, tooltip, legend |
| `area` | ✅ Supported | Gradient fill, same as line with areaStyle |

## Unsupported Chart Types (Placeholder)

| Type | Status | Future Phase |
|------|--------|-------------|
| `scatter` | ⏳ Placeholder | P1 |
| `pie` | ⏳ Placeholder | P1 |
| `histogram` | ⏳ Placeholder | P1 |
| `funnel` | ⏳ Placeholder | P2 |
| `sankey` | ⏳ Placeholder | P2 |
| `graph` | ⏳ Placeholder | P2 (separate renderer) |
| `heatmap` | ⏳ Placeholder | P2 |
| `box` | ⏳ Placeholder | P2 |
| `custom` | ⏳ Placeholder | P2 |

## Validation Results

- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ success (19.52s)
- Bundle impact: index chunk +~4 kB (new renderer code); vendor-echarts unchanged

## Manual Verification Checklist

| Item | Status | Notes |
|------|--------|-------|
| ResultChartRenderer compiles | ✅ `tsc --noEmit` passed | |
| BaseEChart compiles | ✅ | |
| buildChartOption compiles | ✅ | |
| ResultView delegates chart blocks | ✅ Inline placeholder replaced | |
| Unsupported types render placeholder | ✅ ResultChartRenderer fallback | |
| Empty data renders empty state | ✅ BaseEChart + renderer both handle | |
| Existing pages unaffected | ✅ No page files modified | |
| No new dependencies | ✅ Reuses existing echarts | |

## Known Limitations

1. **No page migration yet** — Forecast placeholder still exists in adapter; Attribution chart still outside ResultView; PathAnalysis graphs still outside ResultView.
2. **No ResizeObserver** — Uses `window resize` only; container resize without window resize may not trigger reflow.
3. **Shallow merge only** — `echartsOptions` override uses shallow merge; deep nested overrides may not work.
4. **Area type added to schema** — Minimal schema change; backward compatible since it's an addition to the union.

## Next Recommended Phase

**Phase 4A-6-19: Forecast Chart Migration** — convert Forecast chart placeholder to real line chart inside ResultView.

## Git Information

### Commit
- **Hash**: `8665fbe`
- **Message**: `feat: add basic result chart renderer`

### Package Files Modified
- **None**
