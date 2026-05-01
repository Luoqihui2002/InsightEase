# Phase 4A-6-21: Manual QA Test Dataset Pack

## Objective

Create a stable, deterministic set of local CSV test datasets so the platform can be manually tested end-to-end before entering Phase 4B.

---

## Files Created

| File | Purpose |
|------|---------|
| `manual-test-data/scripts/generate_manual_test_data.py` | Deterministic data generation script (Python stdlib only) |
| `manual-test-data/README.md` | Dataset documentation and recommended test order |
| `manual-test-data/qa-checklist.md` | Manual QA checklist per feature area |
| `manual-test-data/csv/01_users.csv` | User dimension table (500 rows) |
| `manual-test-data/csv/02_products.csv` | Product dimension table (120 rows) |
| `manual-test-data/csv/03_orders.csv` | Order fact table (1,500 rows) |
| `manual-test-data/csv/04_event_log_path.csv` | Event log for PathAnalysis (~4,000 rows) |
| `manual-test-data/csv/05_marketing_touchpoints_attribution.csv` | Marketing touchpoints for Attribution (~2,000 rows) |
| `manual-test-data/csv/06_daily_sales_forecast.csv` | Daily sales for Forecast (365 rows) |
| `manual-test-data/csv/07_ab_test_experiment.csv` | A/B experiment (500 rows) |
| `manual-test-data/csv/08_customer_ltv_regression.csv` | Customer LTV for regression (1,000 rows) |
| `manual-test-data/csv/09_product_reviews_semantic.csv` | Product reviews for Semantic (500 rows) |
| `manual-test-data/csv/10_data_quality_edge_cases.csv` | Edge cases for data quality (300 rows) |

---

## Dataset List

| # | Dataset | Rows | Primary Test Target |
|---|---------|------|---------------------|
| 01 | `01_users.csv` | 500 | Statistics, multi-table, AI classification |
| 02 | `02_products.csv` | 120 | Statistics, Semantic, multi-table |
| 03 | `03_orders.csv` | 1,500 | Statistics, business metrics, join testing |
| 04 | `04_event_log_path.csv` | ~4,000 | PathAnalysis, funnel, sequence mining |
| 05 | `05_marketing_touchpoints_attribution.csv` | ~2,000 | Attribution, model comparison chart |
| 06 | `06_daily_sales_forecast.csv` | 365 | Forecast, time-series, line chart |
| 07 | `07_ab_test_experiment.csv` | 500 | Group comparison, experiment metrics |
| 08 | `08_customer_ltv_regression.csv` | 1,000 | Regression, feature/target selection |
| 09 | `09_product_reviews_semantic.csv` | 500 | Semantic, text field handling |
| 10 | `10_data_quality_edge_cases.csv` | 300 | Data quality, null handling, warnings |

---

## Generation Script Summary

- **Language**: Python 3.8+
- **Dependencies**: None (standard library only)
- **Random seed**: `42` (deterministic output)
- **Encoding**: UTF-8
- **Command**:
  ```bash
  python manual-test-data/scripts/generate_manual_test_data.py
  ```

### Key design choices

1. **Relational data**: `01_users` and `02_products` are generated first, then loaded back to seed `03_orders`, `04_event_log_path`, `05_marketing_touchpoints_attribution`, `07_ab_test_experiment`, `08_customer_ltv_regression`, and `09_product_reviews_semantic` with realistic foreign keys.
2. **PathAnalysis events**: Each session has an ordered event sequence with deterministic funnel outcomes (convert / drop_cart / drop_checkout / bounce).
3. **Attribution journeys**: Each journey has 1–6 ordered touchpoints; ~35% conversion rate with `conversion_value`.
4. **Forecast time series**: Includes weekly seasonality, promo spikes, holiday effects (CNY, National Day), and mild trend/noise.
5. **A/B experiment**: Deterministic group alternation (`control`/`treatment`) with treatment showing higher conversion/revenue.
6. **Data quality edge cases**: Includes >60% nulls, constant column, high cardinality, mixed number/text, outliers, missing dates, and rare categories.
7. **Semantic reviews**: Mix of English and Chinese short reviews with labeled sentiment and topic.

---

## Validation Results

| Check | Result |
|-------|--------|
| Script runs without errors | ✅ |
| 10 CSV files generated | ✅ |
| File sizes moderate (largest ~306 KB) | ✅ |
| No app source code modified | ✅ |
| No package files modified | ✅ |

---

## Manual QA Plan

See `manual-test-data/qa-checklist.md` for the full checklist. Recommended test order:

1. `10_data_quality_edge_cases.csv` → Statistics robustness
2. `09_product_reviews_semantic.csv` → Semantic
3. `06_daily_sales_forecast.csv` → Forecast
4. `05_marketing_touchpoints_attribution.csv` → Attribution
5. `04_event_log_path.csv` → PathAnalysis
6. `07_ab_test_experiment.csv` → Group comparison
7. `08_customer_ltv_regression.csv` → Regression
8. `01_users.csv` + `02_products.csv` + `03_orders.csv` → Multi-table / AI assistant

---

## Known Limitations

1. CSV files are generated locally and are not committed to Git (moderate size, ~750 KB total).
2. Data is synthetic; business insights are not meaningful beyond structural validation.
3. Multi-table join testing requires the platform to support or infer relationships; currently datasets are mostly tested independently.
4. The A/B and regression datasets assume corresponding analysis pages exist or will be added in future phases.

---

## Next Recommended Phase

**Phase 4B: AI Assistant Upgrade / Hermes Agent**

With the result rendering architecture (ResultView / ResultChartRenderer) substantially unified and a stable QA dataset pack in place, the next major phase can begin:

- Design AI assistant product形态 (copilot panel vs modal)
- Research Hermes adapter architecture
- Plan AIWorkspace and SmartAnalysis real-API migration

---

## Git Information

```
Branch: master
Origin: https://github.com/Luoqihui2002/InsightEase.git
```

---

*Phase completed: 2026-04-28*
