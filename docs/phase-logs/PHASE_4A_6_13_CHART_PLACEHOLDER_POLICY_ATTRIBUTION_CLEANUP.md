# Phase 4A-6-13: Chart Placeholder Policy & Attribution Cleanup

## Objective
Remove the duplicate chart UI in the Attribution page: the chart placeholder block inside `ResultView` was coexisting with the real ECharts comparison chart rendered outside `ResultView`.

## Issue Found

Phase 4A-6-12's `attributionResultAdapter.ts` emitted a `chart` block:

```typescript
blocks.push({
  type: "chart",
  title: "模型对比分析",
  chartType: "bar",
  ...
});
```

`ResultView` rendered this as a placeholder card:
> "图表块占位符：模型对比分析 — 类型: bar — 图表渲染将在未来阶段实现"

Meanwhile, `Attribution.tsx` preserved the actual ECharts comparison chart below `ResultView`. Users would see both the placeholder and the real chart for the same data.

## Chosen Policy

**Conservative chart placeholder policy:**

> `ResultView` may render chart placeholders only when the page does not already render the corresponding real chart elsewhere.

For Attribution specifically:
- The adapter **no longer emits** a chart placeholder block.
- The real ECharts comparison chart remains in `Attribution.tsx` outside `ResultView`.
- A code comment documents that chart blocks will be enabled once `ResultChartRenderer` is implemented.

`ResultView`'s generic chart placeholder fallback remains available for future pages.

## Files Modified

| File | Change |
|------|--------|
| `app/src/lib/adapters/attributionResultAdapter.ts` | Removed chart placeholder block; added explanatory comment |

## Validation

- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ success (18.10s)
- SelectItem empty value check: ✅ no violations
- No package files modified

## Manual Verification Checklist

| Item | Status | Notes |
|------|--------|-------|
| Attribution page compiles | ✅ `tsc --noEmit` passed | |
| ResultView renders summary, metrics, tables | ✅ Adapter still produces these blocks | |
| No redundant chart placeholder | ✅ Chart block removed from adapter | |
| Real ECharts chart preserved | ✅ `Attribution.tsx` chart section unchanged | |
| Statistics page unaffected | ✅ No changes to Statistics files | |
| Semantic page unaffected | ✅ No changes to Semantic files | |
| Console has no new errors | ✅ Build passed | |

## Known Limitations

1. **ECharts chart remains outside ResultView** — migration deferred to a future `ResultChartRenderer` phase.
2. **No other pages affected** — only the Attribution adapter was changed.

## Next Recommended Phase

**ResultView rollout to Forecast or PathAnalysis** — continue expanding coverage, or **implement `ResultChartRenderer`** to enable real chart rendering inside `ResultView`.

## Git Information

### Commit
- **Hash**: `71aa87e`
- **Message**: `fix: clean up attribution chart placeholder`

### Package Files Modified
- **None**
