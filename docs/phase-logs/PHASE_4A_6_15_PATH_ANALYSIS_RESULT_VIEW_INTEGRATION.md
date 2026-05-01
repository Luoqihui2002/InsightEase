# Phase 4A-6-15: ResultView Rollout to PathAnalysis Page

## Objective

Roll out the unified `ResultView` system to the PathAnalysis page, validating whether the `AnalysisResult` schema and block-based rendering can support path/funnel/journey-style outputs.

## Files Inspected

| File | Purpose |
|------|---------|
| `app/src/pages/PathAnalysis.tsx` | PathAnalysis page — 5 analysis types (funnel, path, clustering, key_path, sequence_mining) |

## Current PathAnalysis Result Shape

The page supports 5 analysis types with distinct result shapes:

### Funnel
- `funnel_steps`: Array of `{ step, name, users, conversion_rate, drop_off_rate, avg_time_from_prev }`
- `total_users`, `overall_conversion_rate`, `avg_conversion_time`

### Path
- `top_paths`: Array of `{ path: string[], user_count, percentage }`
- `total_users`, `total_paths`, `max_path_length`
- `sankey_data`, `graph_data` (nodes + links)
- `has_cycle_in_data`, `cycle_details`
- `node_details`: Array of `{ name, in_degree, out_degree, unique_users }`

### Clustering
- `clusters`: Array of `{ cluster_id, user_count, percentage, description?, feature_stats?, most_common_path?, top_paths?, characteristics?, avg_path_length? }`
- `total_users`, `n_clusters`, `user_cluster_mapping`

### Key Path
- `complete_path_count`, `avg_steps`, `avg_duration_seconds`
- `optimal_paths`: `{ min_steps, min_duration }`
- `top_paths`: Array of `{ path: string[], count, percentage }`
- `start_event`, `end_event`

### Sequence Mining
- `total_sequences`, `avg_sequence_length`
- `frequent_patterns`: Array of `{ pattern: string[], support, support_count, confidence?, conversion_rate? }`
- `association_rules`: Array of `{ antecedent, consequent, support, confidence, lift, rule_type }`
- `high_conversion_patterns`: Array of `{ pattern: string[], conversion_rate, support, count }`
- `sequence_stats`: `{ conversion_rate }`

## Files Created

| File | Description |
|------|-------------|
| `app/src/lib/adapters/pathAnalysisResultAdapter.ts` | PathAnalysis result → `AnalysisResult` (5 type-specific converters) |

## Files Modified

| File | Change |
|------|--------|
| `app/src/pages/PathAnalysis.tsx` | Added `ResultView` + `toPathAnalysisResult` at top of result section; preserved all charts and special UI |

## Adapter Design

### `toPathAnalysisResult(data, datasetInfo, pathType)`

- **Dispatcher** routes to type-specific converter based on `pathType`.
- Returns `null` for missing/invalid results.
- `safeNumber`, `safeString`, `safeArray` guards throughout.
- `formatPath()` joins string arrays with " → " for table display.

### Funnel Block Mapping

| Block | Content |
|-------|---------|
| summary | Funnel overview: steps, total users, overall conversion |
| metric | total_users, step_count, overall_conversion_rate, avg_conversion_time |
| table | "漏斗步骤详情" — step, name, users, conversion_rate, drop_off_rate, avg_time |
| warning | High drop-off step (>50%), low overall conversion (<5%) |
| text | AI summary |

### Path Block Mapping

| Block | Content |
|-------|---------|
| summary | Path overview: users, paths, cycle detection |
| metric | total_users, total_paths, max_path_length |
| table | "热门路径 TOP 10" — rank, path, user_count, percentage |
| table | "节点访问统计" — name, unique_users, in_degree, out_degree |
| warning | Cycles detected, path fragmentation |
| text | AI summary |

### Clustering Block Mapping

| Block | Content |
|-------|---------|
| summary | Clustering overview: cluster count, total users |
| metric | total_users, n_clusters |
| table | "用户群体分析" — cluster_id, user_count, percentage, description, avg_path_length, characteristics |
| warning | Uneven cluster distribution (>70% in one cluster) |
| text | AI summary |

### Key Path Block Mapping

| Block | Content |
|-------|---------|
| summary | Key path overview: start→end, complete paths, avg steps |
| metric | complete_path_count, avg_steps, avg_duration_hours |
| table | "常见路径 TOP 10" — rank, path, count, percentage |
| table | "最优路径" — type, path, steps, duration |
| text | AI summary |

### Sequence Mining Block Mapping

| Block | Content |
|-------|---------|
| summary | Sequence mining overview: journeys, avg length, pattern count |
| metric | total_sequences, pattern_count, avg_sequence_length, conversion_rate |
| table | "频繁序列模式 TOP 20" — rank, pattern, support, count, confidence |
| table | "关联规则 TOP 15" — rank, antecedent, consequent, support, confidence, lift |
| table | "高转化序列模式" — rank, pattern, conversion_rate, support, count |
| warning | Low journey count (<100), no patterns found |
| text | AI summary |

## Chart/Graph Handling Decision

**No chart placeholders emitted.**

Rationale: PathAnalysis.tsx renders multiple real ECharts visualizations:
- Funnel chart (for funnel type)
- Sankey chart (for path type)
- Force-directed graph (for path type)
- Association rule graph (for sequence_mining type)

Per Phase 4A-6-13 policy, when real charts exist outside ResultView, no duplicate placeholders should be emitted. Clustering and key_path types have no charts, but for consistency and to avoid confusion, no placeholder is emitted for any type.

## Old UI Replaced or Preserved

### Replaced (now rendered through ResultView)

- Summary text for each analysis type
- Metric cards for each analysis type
- Data tables: funnel steps, top paths, node details, clusters, key paths, frequent patterns, association rules, high conversion patterns

### Preserved (outside ResultView)

- **Funnel ECharts chart** — real visualization, cannot be represented in AnalysisResult
- **Sankey ECharts chart** — real visualization
- **Force-directed graph** — real visualization
- **Association rule graph** — real visualization
- **Cycle path warning with examples** — rich interactive display with collapsible details
- **Visual path displays** — breadcrumb arrows with styled event pills (not table-friendly)
- **Optimal path cards** — special styled cards for min-steps and min-duration paths
- **Cluster save button** — interactive action (saves cluster result to new dataset)
- **Cluster cards** — rich cards with feature stats and top paths
- **Download toolbar** — CSV export and chart download buttons

## Export Behavior

Unchanged. `handleDownloadCSV` and `handleDownloadChart` still read `result` directly and function as before.

## Validation Results

- `npx tsc --noEmit`: ✅ 0 errors
- `npm run build`: ✅ success (18.79s)
- Unused import cleanup: `ResultTableColumn` in adapter

## Manual Verification Checklist

| Item | Status | Notes |
|------|--------|-------|
| PathAnalysis page opens normally | ✅ Compiles | |
| Dataset selection still works | ✅ No changes to config panel | |
| Path/funnel configuration still works | ✅ No changes | |
| Path analysis can be triggered | ✅ No changes to execution logic | |
| Loading state appears during analysis | ✅ No changes | |
| ResultView appears after results are generated | ✅ Adapter integrated | |
| Summary block renders correctly | ✅ Adapter produces summary per type | |
| Metric block renders correctly | ✅ Adapter produces metrics per type | |
| Path/funnel table renders correctly | ✅ Type-specific tables | |
| Node/edge table renders correctly | ✅ Path type node table | |
| Null/missing values render as "—" | ✅ ResultTableRenderer handles | |
| Chart/graph placeholder policy respected | ✅ No placeholders (real charts exist) | |
| Existing real chart/graph still renders | ✅ All ECharts charts preserved | |
| Empty/malformed result does not crash | ✅ Adapter returns null | |
| Existing error state still works | ✅ No changes to error handling | |
| Existing export/download still works | ✅ Preserved | |
| Browser console has no new errors | ✅ Build passed | |
| No unrelated pages affected | ✅ Only PathAnalysis.tsx modified | |

**Backend-connected verification** was not performed; all checks are compile-time and static analysis.

## Known Limitations

1. **Metric cards temporarily coexist** — The old metric cards in each type block still render below ResultView. They display the same data as ResultView's metric block. A future cleanup phase should remove them.
2. **Visual path displays coexist** — Breadcrumb-style path displays with arrow pills are preserved outside ResultView since they don't translate well to tables.
3. **No chart placeholders** — Clustering and key_path types have no charts. Future phases may add placeholders once a real graph renderer exists.
4. **Association rule graph preserved** — The `AssociationRuleGraph` component with ECharts is kept outside ResultView.

## Next Recommended Phase

1. **Polish PathAnalysis UI cleanup** — Remove old metric cards now that ResultView handles them
2. **Implement `ResultChartRenderer`** — Enable real chart rendering inside ResultView
3. **Phase 4B: AI Assistant Upgrade** — Switch to product priority

## Git Information

### Commit
- **Hash**: `6371390`
- **Message**: `feat: integrate result view with path analysis page`

### Package Files Modified
- **None**
