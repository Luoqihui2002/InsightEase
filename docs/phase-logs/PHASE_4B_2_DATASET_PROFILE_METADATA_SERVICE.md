# Phase 4B-2: Dataset Profile Contract + On-demand Metadata Service

## Objective

Implement the first backend/frontend contract layer for the InsightEase AI Data Assistant: a deterministic, non-LLM, metadata-first dataset profiling service.

---

## Files Created

| File | Purpose |
|------|---------|
| `app/src/types/assistant.ts` | Frontend TypeScript contracts: `ColumnRole`, `SemanticType`, `TableType`, `ColumnProfile`, `TableClassification`, `DatasetProfile` |
| `app/src/api/assistant.ts` | Frontend API client: `assistantApi.profileDataset(datasetId)` |
| `insightease-backend/app/services/assistant_profile_service.py` | Backend profiling service with deterministic heuristics |
| `insightease-backend/app/api/v1/endpoints/assistant.py` | FastAPI endpoint: `POST /assistant/profile-dataset` |

## Files Modified

| File | Change |
|------|--------|
| `insightease-backend/app/api/v1/api.py` | Registered `assistant.router` with prefix `/assistant` |

---

## Endpoint

```http
POST /api/v1/assistant/profile-dataset?dataset_id={id}&include_examples=true
```

**Request**: query params only  
**Response**: `ResponseModel<DatasetProfile>`

**Properties**:
- Read-only: never modifies source dataset, never creates new datasets
- On-demand: profile is computed at request time, not cached (caching deferred to future phase)
- Reuses `normalize_missing_values` from Phase 4A-6-22 for consistent missing-value handling

---

## Contract Summary

### DatasetProfile

```ts
{
  datasetId: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  classification: TableClassification;
  qualityWarnings: string[];
  generatedAt: string;
}
```

### ColumnProfile

```ts
{
  name: string;
  dtype: string;
  semanticType: "numeric" | "categorical" | "datetime" | "boolean" | "text" | "identifier" | "unknown";
  role: ColumnRole; // e.g. "user_id", "timestamp", "metric", "text_field"
  nullCount: number;
  nullRate: number;
  uniqueCount: number;
  uniqueRate: number;
  examples: unknown[];
  min?: number | string | null;
  max?: number | string | null;
  mean?: number | null;
  std?: number | null;
  warnings?: string[];
}
```

---

## Column Role Detection Heuristics

Deterministic rules based on column name, dtype, cardinality, and sample values:

| Role | Detection Rule |
|------|---------------|
| `user_id` | Name matches `user_id`, `uid`, `customer_id`, `member_id` |
| `device_id` | Name matches `device_id`, `did` |
| `session_id` | Name matches `session_id` |
| `order_id` | Name matches `order_id`, `txn_id`, `transaction_id`, `journey_id` |
| `product_id` | Name matches `product_id`, `sku_id`, `spu_id`, `item_id`, `goods_id` |
| `timestamp` | Name contains `time`, `timestamp`, `created`, `updated`, `event_time` + datetime dtype |
| `date` | Name contains `date`, `dt`, `day` + date-like dtype |
| `event_name` | Name contains `event`, `action`, `page`, `screen` |
| `treatment_group` | Name contains `group`, `variant`, `treatment` + low cardinality |
| `amount_revenue` | Name contains `amount`, `revenue`, `gmv`, `sales`, `price`, `cost`, `ltv` + numeric |
| `metric` | Name contains metric keywords + numeric dtype |
| `status` | Name contains `status`, `state`, `type` + low cardinality |
| `category` | Low/medium cardinality string |
| `text_field` | Name contains `review`, `comment`, `text`, `content` or long strings |
| `label_target` | Name contains `label`, `target`, `converted`, `churn`, `retention` |
| `dimension` | Boolean or very low cardinality |
| `unknown` | Fallback |

---

## Table Classification Heuristics

| Table Type | Key Signals | Recommended Analyses |
|------------|-------------|---------------------|
| `user` | `user_id` + user attributes (region, gender, age) | Statistics, Semantic |
| `order` | `order_id` + amount + time | Statistics, Forecast |
| `experiment` | `treatment_group` + outcome metrics | Statistics, Group comparison, Regression |
| `review_text` | `text_field` + rating/sentiment | Semantic, Statistics |
| `event_log` | `user_id`/`session_id` + `event_name` + timestamp | PathAnalysis, Funnel, Sequence mining |
| `product` | `product_id` + category/brand/price | Statistics, Semantic |
| `metric_summary` | `date` + multiple metrics, no entity ID | Forecast, Statistics |
| `campaign` | marketing fields + timestamp | Attribution, Statistics |
| `dimension` | categorical only, no metrics | Statistics |
| `unknown` | no strong signals | Statistics |

Confidence levels:
- `0.9+`: multiple strong signals
- `0.7–0.9`: one strong signal + supporting fields
- `0.5–0.7`: ambiguous
- `<0.5`: unknown

---

## Quality Warning Logic

### Dataset-level
- Row count < 100 → "统计结果可能不稳定"
- Column count > 50 → "列数较多，建议关注核心字段"
- No time column detected → "时间序列和趋势分析可能受限"
- No ID column detected → "多表关联和个体分析可能受限"
- Overall null rate > 20% → "整体缺失率较高"

### Column-level
- Null rate > 50%
- Unique rate > 95% for non-ID columns
- Constant column (uniqueCount == 1)

---

## Manual QA Dataset Checks (Expected Behavior)

| Dataset | Expected Table Type | Key Detected Roles | Expected Warnings |
|---------|--------------------|--------------------|--------------------|
| `10_data_quality_edge_cases.csv` | `unknown` or `dimension` | — | high nulls, constant col, mixed types |
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
| `cd app && npm run build` | ✅ built in 23.64s |
| `cd insightease-backend && python -m compileall app` | ✅ no syntax errors |
| No package files modified | ✅ confirmed |

---

## Known Limitations

1. **On-demand only, no caching** — Every request re-reads and re-analyzes the file. Caching can be added in a future phase.
2. **Heuristic-based, not ML** — Role detection relies on name patterns and dtype. Unconventional column names will be misclassified.
3. **No multi-table relationship inference** — This is planned for Phase 4B-3+.
4. **No LLM augmentation** — Natural-language summaries and business context require Phase 4B-6.
5. **Backend uses snake_case in JSON** — The frontend types expect camelCase. The existing backend `ResponseModel` wrapper may flatten this, but if raw snake_case is returned, frontend mapping may be needed in a future polish phase.

---

## Next Recommended Phase

**Phase 4B-3: Static Dataset Understanding UI**

- Add `DatasetUnderstandingCard` component
- Populate from `DatasetProfile` (heuristic, no LLM)
- Show column role badges, quality warnings, recommended analyses
- Validate UX flow before adding complexity

---

## Git Information

```
Branch: master
Origin: https://github.com/Luoqihui2002/InsightEase.git
```

---

*Phase completed: 2026-04-28*
