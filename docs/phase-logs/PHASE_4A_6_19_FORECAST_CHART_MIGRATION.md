# Phase 4A-6-19: Forecast Chart Migration

## Objective

Migrate the Forecast page's chart block from placeholder rendering to a real line chart rendered inside `ResultView` through `ResultChartRenderer`.

## Files Inspected

| File | Purpose |
|------|---------|
| `app/src/lib/adapters/forecastResultAdapter.ts` | Forecast adapter chart block |
| `app/src/components/results/charts/buildChartOption.ts` | Chart option builder expectations |
| `app/src/types/result.ts` | ResultChartBlock schema |

## Files Modified

| File | Change |
|------|--------|
| `app/src/lib/adapters/forecastResultAdapter.ts` | Updated chart block to dynamically include available yKeys; increased preview subset from 50 to 100 rows |

## Forecast Chart Data Shape

Input data (from `buildForecastTableRows`) produces rows like:

```ts
{
  date: string;           // from ds or date field
  forecast: number | null; // from yhat or value
  lower: number | null;    // from yhat_lower or lower
  upper: number | null;    // from yhat_upper or upper
  actual?: number | null;  // matched from historical_data by date
}
```

## Chart Block Mapping

The adapter now dynamically builds `yKeys` and `seriesNames` based on data availability:

| Condition | yKey | Series Name |
|-----------|------|-------------|
| At least one row has numeric `actual` | `actual` | 实际值 |
| Always (forecast rows exist) | `forecast` | 预测值 |
| At least one row has numeric `lower` | `lower` | 下限 |
| At least one row has numeric `upper` | `upper` | 上限 |

This ensures the chart only shows series that have real data, avoiding empty legend entries.

```typescript
blocks.push({
  type: "chart",
  title: "预测趋势图",
  chartType: "line",
  data: chartRows,      // up to 100 rows
  xKey: "date",
  yKeys: ["actual", "forecast", "lower", "upper"], // dynamically filtered
  seriesNames: ["实际值", "预测值", "下限", "上限"],
});
```

## Validation Results

- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ success (19.30s)
- No bundle impact (only adapter logic change)

## Manual Verification Checklist

| Item | Status | Notes |
|------|--------|-------|
| Forecast page compiles | ✅ `tsc --noEmit` passed | |
| Forecast ResultView renders summary/metrics/tables/text/warnings | ✅ Adapter unchanged for these blocks | |
| Forecast chart block renders real line chart | ✅ `chartType: "line"` with ResultChartRenderer | |
| Chart handles missing confidence intervals | ✅ `lower`/`upper` only included when data exists | |
| Chart handles empty/malformed data | ✅ `buildChartOption` returns null; BaseEChart shows empty state | |
| Error diagnostics preserved | ✅ No changes to Forecast.tsx | |
| What-if results preserved | ✅ No changes to Forecast.tsx | |
| CSV export unchanged | ✅ No changes to export logic | |
| Attribution page unaffected | ✅ No Attribution files modified | |
| PathAnalysis page unaffected | ✅ No PathAnalysis files modified | |

## Known Limitations

1. **Confidence intervals as lines, not bands** — `lower` and `upper` render as separate line series. A proper shaded confidence band would require custom ECharts series configuration (e.g., stacked area or custom series). This can be enhanced in a future polish phase.
2. **Preview subset limited to 100 rows** — Very long forecasts (>100 points) are truncated. Full data rendering may need pagination or zoom interaction.
3. **No ResizeObserver** — Chart resizes on window resize but not on container resize.

## Next Recommended Phase

**Phase 4A-6-20: Attribution Chart Migration** — migrate the Attribution comparison bar chart from page-level ECharts into ResultView.

## Git Information

### Commit
- **Hash**: `{TBD}`
- **Message**: `feat: render forecast chart in result view`

### Package Files Modified
- **None**
