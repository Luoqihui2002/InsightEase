# Phase 4B-3: Static Dataset Understanding UI

## Objective

Build the first visible AI Data Assistant feature: a static, non-LLM `DatasetUnderstandingCard` that calls the on-demand dataset profile endpoint and displays the resulting `DatasetProfile`.

---

## Files Created

| File | Purpose |
|------|---------|
| `app/src/components/assistant/DatasetUnderstandingCard.tsx` | Main dataset understanding card component |

## Files Modified

| File | Change |
|------|--------|
| `app/src/pages/Datasets.tsx` | Integrated `DatasetUnderstandingCard` into dataset detail dialog |

---

## Integration Location

**Page**: `app/src/pages/Datasets.tsx` — dataset list page with detail dialog  
**Placement**: Inside the `DialogContent` for dataset detail view, between the basic metadata grid (file size / rows / cols / quality) and the data preview table.  
**Dataset ID source**: `selectedDataset.id` from existing `selectedDataset` state.

---

## Component Behavior

### Props

```ts
interface DatasetUnderstandingCardProps {
  datasetId: string;
  datasetName?: string;
}
```

### Lifecycle

1. **On mount**: calls `assistantApi.profileDataset(datasetId)`
2. **Loading**: shows spinner with "正在分析数据集结构..."
3. **Error**: shows error message + retry button
4. **Empty**: shows "暂无数据集画像" + re-analyze button
5. **Success**: renders full profile card

### UI Sections

| Section | Content |
|---------|---------|
| **Header** | "AI 数据理解" title, dataset name, row/column count, table type badge, confidence label, refresh button |
| **表类型推断** | `classification.table_type` Chinese label, evidence tags, classification warnings |
| **推荐分析** | `classification.recommended_analyses` as non-clickable badges (future phases will add navigation) |
| **数据质量** | `quality_warnings` list, or green checkmark if none |
| **字段角色分布** | Count badges by `ColumnRole` with icons and colors |
| **语义类型分布** | Count badges by `SemanticType` with colors |
| **关键字段** | Grouped cards: 标识列, 时间列, 指标列, 文本列, 实验分组, 警告列 |
| **字段详情表格** | Compact table: 字段名, 角色, 类型, 缺失率, 唯一值, 示例值, 警告. Shows first 20 with expand toggle. |

### Helper Functions

| Function | Purpose |
|----------|---------|
| `ROLE_LABELS` | Maps `ColumnRole` → Chinese label (17 roles) |
| `SEMANTIC_LABELS` | Maps `SemanticType` → Chinese label (7 types) |
| `TABLE_TYPE_LABELS` | Maps `TableType` → Chinese label (11 types) |
| `getConfidenceLabel` | Returns label + color class for confidence score |
| `getRoleIcon` | Returns Lucide icon for each role |
| `getRoleBadgeColor` | Returns Tailwind color class for role badge |
| `getSemanticBadgeColor` | Returns Tailwind color class for semantic type badge |
| `KeyColumnGroup` | Sub-component for grouped key column cards |

### Styling

- Uses existing project CSS variables: `--bg-secondary`, `--bg-tertiary`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-subtle`, `--neon-cyan`, `--neon-green`, `--neon-orange`, `--neon-pink`
- Consistent with dark theme and existing card/table patterns
- Missing rate > 50% highlighted in pink
- Warning items use orange alert icon

---

## API Contract Usage

The component consumes snake_case `DatasetProfile` fields directly:

```ts
profile.dataset_id
profile.row_count
profile.column_count
profile.quality_warnings
profile.classification.table_type
profile.classification.confidence
profile.classification.evidence
profile.classification.recommended_analyses
profile.classification.warnings
profile.columns[0].name
profile.columns[0].semantic_type
profile.columns[0].role
profile.columns[0].null_rate
profile.columns[0].unique_count
profile.columns[0].examples
profile.columns[0].warnings
```

---

## Manual QA Expected Results

| Dataset | Expected Table Type | Key Detected Roles | Expected Warnings |
|---------|--------------------|--------------------|--------------------|
| `10_data_quality_edge_cases.csv` | `unknown` / `dimension` | — | high nulls, constant col, mixed types |
| `04_event_log_path.csv` | `event_log` | `user_id`, `session_id`, `event_name`, `timestamp` | — |
| `06_daily_sales_forecast.csv` | `metric_summary` | `date`, `metric` (sales, orders, traffic) | — |
| `05_marketing_touchpoints_attribution.csv` | `campaign` / `event_log` | `user_id`, `timestamp`, `category` (channel) | — |
| `07_ab_test_experiment.csv` | `experiment` | `treatment_group`, `metric` (converted, revenue) | — |
| `09_product_reviews_semantic.csv` | `review_text` | `text_field`, `metric` (rating), `category` (topic) | — |

---

## Validation Results

| Check | Result |
|-------|--------|
| `cd app && npx tsc --noEmit` | ✅ 0 errors |
| `cd app && npm run build` | ✅ built in 19.41s |
| No package files modified | ✅ confirmed |

---

## Known Limitations

1. **Recommended analyses are non-clickable badges** — Navigation CTAs with pre-fill configs are deferred to Phase 4B-5.
2. **No caching** — Card re-fetches profile on every dialog open. Caching can be added later.
3. **Heuristic-based classification** — Unconventional column names may be misclassified. This is expected for a deterministic non-LLM system.
4. **Column table limited to 20 rows initially** — Full expansion available via toggle. No pagination.
5. **No multi-table context** — Relationship inference is deferred to Phase 4B-4+.

---

## Next Recommended Phase

**Phase 4B-4: Assistant Panel Mock UI**

- Add a right-side assistant panel component framework
- Mock responses for "Understand this dataset" and "Recommend analysis"
- Validate UX flow before adding real AI integration

---

## Git Information

```
Branch: master
Origin: https://github.com/Luoqihui2002/InsightEase.git
```

---

*Phase completed: 2026-04-28*
