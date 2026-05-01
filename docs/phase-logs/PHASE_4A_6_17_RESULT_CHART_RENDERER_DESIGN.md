# Phase 4A-6-17: ResultChartRenderer Design Document

## Objective

Create a design document for future `ResultChartRenderer` support inside the unified `ResultView` system. This is a documentation-only phase.

## Scope

- Inspected current chart usage across Attribution, Forecast, and PathAnalysis
- Reviewed `ResultChartBlock` schema in `app/src/types/result.ts`
- Documented proposed architecture, lifecycle requirements, bundle considerations, and migration strategy
- No application source code modified

## Files Created

| File | Description |
|------|-------------|
| `docs/design/RESULT_CHART_RENDERER_DESIGN.md` | Chart rendering architecture design document |

## Files Modified

- **None** — documentation-only phase

## Design Document Summary

### Problem Statement

`ResultView` renders chart blocks as placeholder cards. Several pages render real ECharts charts outside `ResultView`, creating inconsistency. A rushed implementation risks duplicated UI, lifecycle bugs, and bundle bloat.

### Current Chart Inventory

| Page | Chart | Location | Migration Priority |
|------|-------|----------|-------------------|
| Attribution | Grouped bar chart (model comparison) | Outside ResultView | Medium (P0) |
| Forecast | Line chart placeholder only | Inside ResultView | **High (P0)** |
| PathAnalysis — Funnel | ECharts funnel | Outside ResultView | Low (P2) |
| PathAnalysis — Sankey | ECharts sankey | Outside ResultView | Low (P2) |
| PathAnalysis — Graph | Force-directed graph | Outside ResultView | **Deferred** |
| PathAnalysis — Assoc. | Association rule graph | Outside ResultView | **Deferred** |

### Proposed Architecture

```
ResultView → BlockDispatcher → ResultChartRenderer
                                    ↓
                           buildChartOption(chartType, data)
                                    ↓
                              BaseEChart (lifecycle wrapper)
                                    ↓
                                ECharts instance
```

### Chart Type Priority

- **P0** (implement first): `line`, `bar`, `area` — simple cartesian charts
- **P1** (implement second): `scatter`, `histogram`, `pie` — statistical charts
- **P2** (defer): `funnel`, `sankey`, `graph` — specialized/graph visualizations

### Migration Sequence

1. Phase 4A-6-18: Implement `ResultChartRenderer` for P0 types only
2. Phase 4A-6-19: Migrate Forecast placeholder → real line chart
3. Phase 4A-6-20: Migrate Attribution bar chart → ResultView
4. Later: Evaluate PathAnalysis graph strategy separately

### Bundle Size

- Reuse existing ECharts dependency (already in `vendor-echarts` ~1,561 kB)
- No new chart libraries
- No expected bundle increase beyond renderer component code

### Non-Goals

- No implementation in this phase
- No page migration in this phase
- No new chart dependency
- No backend/API change
- No adapter changes
- No ECharts tree-shaking
- No graph renderer in first implementation phase

## Validation

- `git status`: ✅ Only `docs/` files changed; no source code modified

## Known Limitations

- Design is forward-looking; actual implementation may reveal edge cases not anticipated
- Graph visualizations (sankey, force-directed, association rules) need separate dedicated design

## Next Recommended Phase

**Phase 4A-6-18: Basic ResultChartRenderer Implementation** — implement line/bar support, keep graph types as placeholders, no page migration yet.

## Git Information

### Commit
- **Hash**: `{TBD}`
- **Message**: `docs: design result chart renderer`

### Package Files Modified
- **None**
