# AI Workbench Demo Scenarios

## Purpose

These concise scripts help developers and future AI assistants demo the current AI Workbench flow without changing product behavior.

They assume the recommended demo datasets from `docs/qa/AI_WORKBENCH_QA_RECIPES.md` are available or that equivalent local CSVs have been uploaded.

Safety boundary for all scenarios:

- no live Hermes/LLM;
- no automatic analysis execution;
- no automatic joins;
- no SQL generation;
- no dataset mutation.

## Scenario A: Dataset Catalog -> Forecast Plan

Goal: show that Dataset Catalog grouping and planner narrowing can guide a forecast plan.

Steps:

1. Open Datasets.
2. Set group mode to `按分析用途`.
3. Find the forecast/time-series dataset, for example `06_daily_sales_forecast.csv`.
4. Open AI Workbench.
5. Clear selected dataset and active relationship set if you want to show pure catalog narrowing.
6. Ask: `预测未来销售额趋势`.
7. Confirm the forecast dataset appears as a candidate or required dataset, depending on confidence.
8. Use the plan action to navigate to Forecast if a required dataset is confirmed.

Expected:

- the plan prefers forecast/time-series catalog signals;
- it does not require all datasets;
- if required datasets are empty, navigation is unavailable and the plan asks for confirmation;
- the Forecast page receives prefill only when a required dataset exists;
- no analysis auto-runs.

## Scenario B: Relationship Set -> Channel Conversion Plan

Goal: show that a Relationship Set is an allowed topic graph while the planner still chooses a query-specific subset.

Steps:

1. Open AI Workbench relationship management.
2. Create a relationship set from:
   - `01_users.csv`
   - `03_orders.csv`
   - `04_event_log_path.csv`
   - `05_marketing_touchpoints_attribution.csv`
3. Keep any relevant isolated/reference table if relationship inference cannot connect it.
4. Save and activate the relationship set.
5. Ask: `分析各渠道转化率`.
6. Review `本次计划所需数据集`, `候选数据集`, and relationship context.
7. Navigate to Attribution or Statistics only if the plan has confirmed required datasets.

Expected:

- required datasets are a relevant subset, such as marketing touchpoints plus orders or event data;
- the whole relationship set is not treated as required input;
- isolated/reference tables remain context only;
- high-risk relationships remain visible if present;
- no automatic join or backend analysis starts.

## Scenario C: Result -> AI Workbench Follow-up

Goal: show the bounded result handoff and deterministic follow-up mode.

Steps:

1. Open History.
2. Group by `按 AI 可解释状态`.
3. Search or filter until a completed AI-ready result is visible.
4. Open the completed result.
5. Click `让 AI 解读这个结果`.
6. Confirm AI Workbench opens with result context in the right panel.
7. Ask: `下一步建议做什么？`.
8. Try one more follow-up: `整理成报告文字`.

Expected:

- History Catalog grouping helps locate the result;
- AI Workbench attaches `SafeResultSummary`;
- prompt chips appear;
- no explanation is generated until the user asks;
- follow-up responses are deterministic and summary-based;
- response copy says no analysis is rerun;
- no Hermes/LLM endpoint is called in default mode.

## Scenario D: Safety Regression

Goal: quickly confirm the safest failure paths after future planner or runtime work.

Steps:

1. Clear selected dataset and active relationship set.
2. Ask: `做描述性统计`.
3. Confirm the plan asks the user to choose one dataset and does not navigate.
4. Keep default runtime with no `VITE_ASSISTANT_RUNTIME_PROVIDER`.
5. Ask any planner question and confirm rule-based behavior still works.
6. Navigate to a prefilled page from a valid plan and confirm no analysis auto-runs.
7. If testing dry-run mode, restart frontend with `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run` and ask `预测未来销售额趋势`.

Expected:

- plans without required datasets do not create empty prefill navigation;
- default mode remains local rule-based;
- Hermes dry-run fallback is safe when explicitly enabled;
- target pages prefill configuration only and never auto-run;
- no SQL, joins, dataset mutation, or live LLM call occurs.

## Demo Close-out Checklist

- [ ] Dataset Catalog grouping was shown.
- [ ] Planner narrowing did not require all datasets.
- [ ] Required and candidate datasets were visually distinct.
- [ ] Relationship Set was presented as context, not automatic join input.
- [ ] Prefill navigation configured a target page without auto-running.
- [ ] Result handoff used `SafeResultSummary`.
- [ ] Result follow-up was deterministic.
- [ ] Hermes default/dry-run safety boundary was explained.
