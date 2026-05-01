# Phase 4A-6-14: ResultView Rollout to Forecast Page

## Objective

Roll out the unified `ResultView` system to the Forecast page, validating whether the `AnalysisResult` schema and block-based rendering can support time-series forecast outputs.

## Files Inspected

| File | Purpose |
|------|---------|
| `app/src/pages/Forecast.tsx` | Forecast page — single & batch forecast modes, What-if analysis, export |

## Current Forecast Result Shape

### Single Forecast (`analysisResult`)

```ts
interface ForecastResultData {
  error?: string;
  solution?: string;
  diagnostic?: unknown;
  sample_data?: unknown[];
  forecast?:
    | { ds?: string[]; yhat?: number[]; yhat_lower?: number[]; yhat_upper?: number[] }
    | Array<{ date/ds, value/yhat, lower/yhat_lower, upper/yhat_upper }>;
  historical_data?: unknown[];
  statistics?: { forecast_mean?, trend_direction?, historical_mean?, mae?, rmse?, mape?, r2? };
  trend?: { direction?: string };
  forecast_periods?: number;
  ai_summary?: string;
  decomposition?: { trend?, seasonal?, promotion?, residual? };
  promotion_impact?: Array<{ name, date, type, lift }>;
  what_if?: unknown;
}
```

### Batch Forecast (`batchResult`)

```ts
interface BatchForecastResultData {
  summary?: { total_sku?, success_count?, avg_growth?, top_growing?, top_growth_rate? };
  forecasts?: Array<{ column, error?, forecast?, growth_rate?, statistics? }>;
}
```

## Files Created

| File | Description |
|------|-------------|
| `app/src/lib/adapters/forecastResultAdapter.ts` | Forecast result → `AnalysisResult` (supports single + batch) |

## Files Modified

| File | Change |
|------|--------|
| `app/src/pages/Forecast.tsx` | Integrated `ResultView` + `toForecastAnalysisResult`; preserved error diagnostics, What-if results, export button |

## Adapter Design

### `toForecastAnalysisResult(data, datasetInfo, forecastDays)`

- **Auto-detects** batch vs single mode by presence of `forecasts` array.
- Returns `null` for missing/invalid results.
- All numeric fields guarded with `safeNumber()`.
- All string fields guarded with `safeString()`.
- Supports both forecast data shapes (parallel arrays vs point objects).

### Single Forecast Block Mapping

| Block | Source Data | Notes |
|-------|-------------|-------|
| summary | trend direction, forecast periods, forecast vs historical mean | tone = negative if trend is "下降" |
| metric | forecast_mean, historical_mean, trend_direction, forecast_periods, mae, rmse, mape, r² | mape > 20% gets caution tone |
| table | "预测结果明细" — date, actual, forecast, lower, upper | normalized from both forecast shapes |
| table | "预测分解" — component, contribution | if `decomposition` present |
| table | "大促影响分析" — name, date, type, lift | if `promotion_impact` present |
| text | "AI 智能解读" — `ai_summary` | |
| chart | "预测趋势图" line placeholder | **emitted** because Forecast.tsx has no real ECharts chart |
| warning | error, high MAPE, low data volume | defensive generation |

### Batch Forecast Block Mapping

| Block | Source Data |
|-------|-------------|
| summary | total SKU, success count, avg growth, top growing |
| metric | total_sku, success_count, forecast_periods, avg_growth |
| table | "各SKU预测详情" — sku, status, historical_mean, forecast_mean, growth_rate |
| warning | failed SKU count |

## Chart Handling Decision

**Chart placeholder emitted** for single forecast.

Rationale: Forecast.tsx does not render any real ECharts chart outside ResultView. The existing UI only shows metric cards, tables, and text. Therefore, per Phase 4A-6-13 policy, a chart placeholder is appropriate.

## Old UI Replaced or Preserved

### Replaced (now rendered through ResultView)

- Metric cards (预测均值, 趋势, 预测天数)
- Inline AI summary
- Decomposition card → converted to table block
- Promotion impact card → converted to table block
- Duplicate AI summary card → deduplicated into text block

### Preserved (outside ResultView)

- **Error display with diagnostics** — ResultView error state is generic; the existing rich error display with collapsible diagnostics and sample data is preserved.
- **What-if analysis results** — interactive complex layout not representable in AnalysisResult schema.
- **Export CSV button** — reads `analysisResult` directly; kept unchanged.
- **Debug info** — original data inspector when no forecast data present.

## Export Behavior

Unchanged. The export button still reads `analysisResult` directly and constructs a CSV with the same columns.

## Validation Results

- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ success (18.88s)
- Unused variable cleanup: `metrics` in adapter, `Calendar`/`BarChart3` in Forecast.tsx

## Manual Verification Checklist

| Item | Status | Notes |
|------|--------|-------|
| Forecast page opens normally | ✅ Compiles | |
| Dataset selection still works | ✅ No changes to config panel | |
| Time/target column selection still works | ✅ No changes | |
| Forecast configuration still works | ✅ No changes | |
| Forecast analysis can be triggered | ✅ No changes to execution logic | |
| Loading state appears during analysis | ✅ No changes | |
| ResultView appears after results are generated | ✅ Adapter integrated | |
| Summary block renders correctly | ✅ Adapter produces summary | |
| Metric block renders correctly | ✅ Adapter produces metrics | |
| Forecast table renders correctly | ✅ Normalized from both shapes | |
| Confidence interval columns render correctly | ✅ lower/upper columns | |
| Null/missing values render as "—" | ✅ ResultTableRenderer handles | |
| Chart placeholder policy respected | ✅ Placeholder emitted (no real chart on page) | |
| Existing real chart still renders | N/A | No real chart existed |
| Empty/malformed result does not crash | ✅ Adapter returns null, page shows fallback | |
| Existing error state still works | ✅ Preserved outside ResultView | |
| Existing export/download still works | ✅ Preserved | |
| Browser console has no new errors | ✅ Build passed | |
| No unrelated pages affected | ✅ Only Forecast.tsx modified | |

**Backend-connected verification** was not performed; all checks are compile-time and static analysis.

## Known Limitations

1. **Error diagnostics preserved outside ResultView** — ResultView's error state is a simple banner; the rich diagnostic collapsibles remain in the page.
2. **What-if results preserved outside ResultView** — interactive layout not yet representable in AnalysisResult.
3. **Chart is placeholder only** — real ECharts rendering deferred to `ResultChartRenderer` phase.
4. **Forecast data shape dual handling** — adapter supports both parallel-array and point-object shapes, but only the shapes observed in the rendering code are handled.

## Next Recommended Phase

1. **ResultView rollout to PathAnalysis** — continue expanding coverage
2. **Implement `ResultChartRenderer`** — enable real chart rendering inside ResultView
3. **Phase 4B: AI Assistant Upgrade** — switch to product priority

## Git Information

### Commit
- **Hash**: `43da438`
- **Message**: `feat: integrate result view with forecast page`

### Package Files Modified
- **None**
