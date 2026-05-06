# AI Workbench QA Recipes

## Purpose

This document gives developers and future AI assistants a reusable manual QA playbook for the AI Workbench ecosystem.

The recipes cover the current safe flow:

```text
Dataset Catalog
-> Relationship Set topic graph
-> Planner candidate narrowing
-> AnalysisPlanCard
-> Prefill navigation
-> Context Panel
-> Result handoff
-> SafeResultSummary
-> Deterministic result follow-up
-> Hermes dry-run opt-in safety
```

These recipes are regression checks only. They must not add live Hermes/LLM calls, auto-run analysis, auto-join tables, generate SQL, modify uploaded datasets, or modify SmartAnalysis.

## Required Local Setup

1. Start the backend and frontend using the normal project development workflow.
2. Sign in with a development account that can upload and view datasets.
3. Keep the default assistant runtime unless a Hermes dry-run recipe explicitly asks for opt-in mode.
4. Use the browser devtools network panel when checking Hermes safety or prefill behavior.
5. Do not mutate existing production-like data. Upload disposable demo CSVs only if the local environment does not already have suitable sample datasets.

Default runtime expectation:

- no `VITE_ASSISTANT_RUNTIME_PROVIDER` means AI Workbench uses the local rule-based runtime;
- `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run` is a development-only opt-in;
- live Hermes/LLM is not part of this QA run.

## Recommended Demo Datasets

The following 10-file set gives broad coverage for catalog classification, relationship inference, planner narrowing, result handoff, and safety checks. If these files are not already present, prepare equivalent local CSVs with matching names and representative schema columns. This checklist is documentation-only; it does not create or mutate datasets.

| Dataset | Expected catalog target |
|---|---|
| `01_users.csv` | 用户相关 / 维表 / 统计分析、回归分析 |
| `02_products.csv` | 商品相关 / 维表 / 统计分析 |
| `03_orders.csv` | 订单交易 / 事实表 / 统计分析、归因分析、回归分析 |
| `04_event_log_path.csv` | 流量行为相关 / 事件日志表 / 路径分析 |
| `05_marketing_touchpoints_attribution.csv` | 营销归因相关 / 事实表或事件日志表 / 归因分析 |
| `06_daily_sales_forecast.csv` | 预测指标相关 / 时间序列表 / 预测分析 |
| `07_ab_test_experiment.csv` | 实验分组 / 实验表 / A/B 检验 |
| `08_customer_ltv_regression.csv` | 用户相关 / 指标汇总表 / 回归分析 |
| `09_product_reviews_semantic.csv` | 评论文本相关 / 文本表 / 语义分析 |
| `10_data_quality_edge_cases.csv` | 数据质量 / 混合或未知类型 / 数据质量 |

Notes:

- Exact labels can vary when schema metadata is sparse. Use the visible Datasets page badges as the source of truth for the current deterministic helper.
- Every dataset can safely show baseline `统计分析` and `数据质量` tags.
- Low-confidence or unknown labels are acceptable when filename/schema signals are intentionally sparse.

Recommended schema hints:

| Dataset | Useful columns |
|---|---|
| `01_users.csv` | `user_id`, `customer_id`, `name`, `city`, `age`, `signup_date` |
| `02_products.csv` | `product_id`, `sku`, `category`, `price`, `brand` |
| `03_orders.csv` | `order_id`, `user_id`, `product_id`, `payment_amount`, `gmv`, `order_time` |
| `04_event_log_path.csv` | `user_id`, `session_id`, `event_name`, `event_time`, `pageview`, `click` |
| `05_marketing_touchpoints_attribution.csv` | `user_id`, `channel`, `campaign`, `touchpoint_time`, `conversion`, `order_id` |
| `06_daily_sales_forecast.csv` | `date`, `sales`, `gmv`, `orders`, `trend` |
| `07_ab_test_experiment.csv` | `experiment_id`, `user_id`, `treatment`, `control`, `variant`, `metric` |
| `08_customer_ltv_regression.csv` | `customer_id`, `ltv`, `orders`, `recency`, `frequency`, `monetary` |
| `09_product_reviews_semantic.csv` | `review_id`, `product_id`, `review_text`, `comment`, `sentiment` |
| `10_data_quality_edge_cases.csv` | `id`, `missing_value`, `null_flag`, `anomaly_score`, `edge_case` |

## Dataset Catalog QA

### Search

Open `Datasets` and test these searches:

- `users`
- `orders`
- `event`
- `forecast`
- `review`
- `missing`
- `user_id`
- `product_id`

Expected:

- matching datasets remain visible;
- schema-field searches such as `user_id` and `product_id` match datasets with those fields;
- catalog labels and analysis-use tags are searchable;
- clearing the query returns all datasets;
- an unmatched query shows `未找到匹配的数据集`;
- preview, detail, rename, download, delete, and batch actions still work after filtering.

### Grouped Views

Test the group selector modes:

- 默认排序
- 按上传日
- 按上传周
- 按业务主题
- 按数据类型
- 按分析用途

Expected:

- group headers are readable;
- dataset count per group is correct;
- dataset badges remain visible;
- empty groups are not shown;
- unknown upload time appears as `未知上传时间`;
- existing row actions still work inside grouped sections;
- no row/card overflows on common desktop widths.

## Relationship Set QA

### Create Topic Graph

Select these datasets in AI Workbench relationship management:

- `01_users.csv`
- `02_products.csv`
- `03_orders.csv`
- `04_event_log_path.csv`
- `05_marketing_touchpoints_attribution.csv`
- `10_data_quality_edge_cases.csv`

Expected:

- candidate relationships are grouped by key family where possible;
- `user_id`, `product_id`, and `order_id` groups appear if schema supports them;
- unrelated or unjoinable datasets appear as isolated/reference candidates;
- the user can keep or exclude isolated tables;
- saving creates a named relationship set;
- the active relationship set persists after closing and reopening AI Workbench;
- isolated/reference tables are described as context only and never automatic joins.

### High-risk Edge

If possible, select a suspicious edge such as:

```text
product_id -> user_id
```

Expected:

- a high-risk warning appears;
- explicit confirmation is required;
- saved relationship set marks the relationship as high risk;
- the Context Panel keeps high-risk relationships prominent.

### Relationship Set Does Not Mean Required Datasets

With an active relationship set containing multiple nodes, ask:

- `分析各渠道转化率`
- `预测未来销售额趋势`
- `分析用户行为路径`

Expected:

- required datasets are a query-specific subset;
- the relationship set appears as allowed context;
- not all relationship-set nodes become required datasets;
- if no relevant dataset exists in the graph, the planner warns instead of requiring every node.

## Planner QA

### No Selected Dataset / No Relationship Set

Clear selected dataset and active relationship set, then ask:

- `预测未来销售额趋势`
- `分析用户行为路径`
- `分析评论情感`
- `做描述性统计`
- `分析各渠道转化率`

Expected:

- forecast prompts prefer time-series or forecast candidates;
- path prompts prefer event/path/log candidates;
- semantic prompts prefer review/text candidates;
- descriptive/statistics prompts ask the user to choose one dataset;
- attribution/channel conversion prompts prefer marketing, order, traffic, or touchpoint candidates;
- the plan never lists the full dataset library as required.

### Selected Dataset Priority

Select `03_orders.csv`, then ask:

- `做描述性统计`
- `分析用户行为路径`

Expected:

- descriptive statistics uses only `03_orders.csv` as the required dataset;
- path analysis keeps selected-dataset priority but warns that the selected dataset may not match path-analysis intent;
- catalog candidates remain advisory if they appear.

### Candidate vs Required Display

Expected:

- `本次计划所需数据集` is visually distinct from `候选数据集`;
- required datasets are the planner's confirmed recommended inputs for this plan;
- candidate datasets are advisory catalog recommendations and still need user confirmation;
- navigation is disabled when required dataset is empty;
- candidate-only plans do not create empty prefill payloads.

## Prefill Navigation QA

Generate plans that target these modules:

| Module | Target |
|---|---|
| Forecast | `/app/forecast` |
| PathAnalysis | `/app/path` |
| Attribution | `/app/attribution` |
| Statistics | `/app/statistics` |

Expected:

- a prefill banner appears on the target page;
- dataset is preselected when payload has `primary_dataset_id`;
- suggested fields are applied only when exact field matches exist;
- no analysis auto-runs;
- invalid or expired prefill key loads the target page normally;
- target pages remain usable if the payload is missing optional fields.

## Context Panel QA

Test these context combinations:

- no dataset and no relationship set;
- selected dataset only;
- relationship set only;
- selected dataset plus relationship set;
- selected analysis history item or attached safe result summary.

Expected:

- empty context state is helpful;
- dataset summary and preview are bounded;
- sample rows are capped;
- field summary is collapsible;
- relationship set shows connected tables, isolated/reference tables, edges, and high-risk edges;
- relationship table preview loads lazily for one table at a time;
- isolated/reference tables say they do not automatically join;
- selected history shows `SafeResultSummary`;
- raw `result_data` is not persisted in session storage.

## Searchable Selector QA

Core selector behavior:

- click a selector trigger and confirm the dropdown opens;
- confirm the search input receives focus after opening;
- type a query and confirm options filter immediately;
- clear the query and confirm all matching options return;
- press `Escape` and confirm the dropdown closes without changing selection;
- reopen and press `ArrowDown` / `ArrowUp` to move the highlighted option;
- press `Enter` and confirm the highlighted option is selected;
- press `Tab` and confirm focus moves normally while the dropdown closes;
- click outside the dropdown and confirm it closes;
- use the clear action, when visible, and confirm the placeholder returns;
- confirm long option lists scroll instead of overflowing nearby panels.

AI Workbench dataset selector:

- click `选择或搜索数据集...`;
- type `orders`, `user_id`, or a catalog label;
- select a matching dataset;
- clear the selection if the clear action is visible.

AI Workbench relationship set selector:

- click `选择或搜索关系组...`;
- search by relationship set name, description, or included dataset name;
- confirm `不使用关系组` remains available;
- select a relationship set and verify the Context Panel updates.

AI Workbench history selector:

- open the Context Panel history section;
- click `选择或搜索分析历史...`;
- search by analysis type, dataset name/id, status, or AI-ready label;
- select a history item and confirm `SafeResultSummary` appears;
- ask a result follow-up prompt and confirm it stays deterministic.

SmartProcess / preprocessing selector:

- click the dataset selector;
- type a dataset keyword;
- select the dataset;
- confirm existing preprocessing controls remain unchanged.

Expected:

- single-selection tasks use one searchable dropdown, not separate search and select controls;
- Datasets and History catalog page searches are unchanged.

## History Catalog QA

Open History and verify the analysis catalog controls:

- search by analysis type, for example `统计` or `forecast`;
- search by dataset id or visible dataset filename;
- search by status, for example `已完成` or `failed`;
- search by bounded safe-summary result key when available;
- group by `按创建日`;
- group by `按创建周`;
- group by `按分析类型`;
- group by `按状态`;
- group by `按数据集`;
- group by `按 AI 可解释状态`;
- filter by status;
- filter by AI-ready state.

Expected:

- grouping and search apply to the currently loaded History page only;
- group headers show readable labels and counts;
- rows show analysis type, status, AI-ready, and dataset badges;
- empty search shows `未找到匹配的分析历史`;
- result dialog still opens;
- `让 AI 解读这个结果` still hands off a `SafeResultSummary`;
- no history result is rerun and no AI explanation is generated automatically.

## Result Handoff QA

### From History

1. Open a result in History.
2. Click `让 AI 解读这个结果`.

Expected:

- AI Workbench opens;
- right Context Panel shows result context;
- follow-up prompt chips appear;
- no explanation is auto-generated;
- the handoff payload uses bounded safe summary data.

### From Statistics

1. Run or open a Statistics result in the normal way.
2. Click `带到 AI 工作台`.

Expected:

- AI Workbench opens;
- `SafeResultSummary` is attached;
- no analysis reruns;
- follow-up prompts are available.

Known current limitation:

- Forecast, PathAnalysis, and Attribution direct result-to-Workbench buttons are not yet wired. Use History for those result types.

## Result Follow-up QA

With result context attached, ask:

- `帮我解释这个结果`
- `有哪些异常或风险？`
- `下一步建议做什么？`
- `整理成报告文字`

Expected:

- responses are deterministic and based only on `SafeResultSummary`;
- response copy says the answer is based on a safe result summary and does not rerun analysis;
- no Hermes/LLM endpoint is called in default mode;
- no raw result table is included;
- unsupported questions continue through the normal planner path.

## Hermes Dry-run QA

### Default Mode

Run with no `VITE_ASSISTANT_RUNTIME_PROVIDER`.

Expected:

- AI Workbench uses local rule-based planning;
- Hermes diagnostic is subtle and non-blocking;
- `/assistant/hermes/status` may be probed for diagnostics only;
- `/assistant/hermes/plan-analysis` and `/assistant/hermes/explain-result` are not called by default planning or result follow-up.

### Dry-run Opt-in

Run with:

```text
VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run
```

Expected:

- AI Workbench shows Hermes dry-run runtime with fallback enabled;
- if backend dry-run is disabled or unavailable, rule-based fallback works;
- if backend dry-run is enabled, `plan-analysis` dry-run responses render safely;
- result follow-up remains deterministic;
- no live LLM, SQL, join execution, analysis auto-run, or dataset mutation occurs.

## Regression Checklist

Dataset Catalog:

- [ ] Search and grouped views work.
- [ ] Dataset actions still work.

Planner:

- [ ] Required datasets are not all datasets.
- [ ] Candidate datasets render separately.
- [ ] Selected dataset priority works.
- [ ] Relationship set scoping works.

Navigation:

- [ ] Forecast/Path/Attribution/Statistics prefill works.
- [ ] No auto-run occurs.
- [ ] Plans without required datasets do not navigate.

Context Panel:

- [ ] Dataset, relationship, and history contexts work.
- [ ] Collapsible sections work.
- [ ] Lazy preview works.

Result flow:

- [ ] History to AI Workbench works.
- [ ] Statistics to AI Workbench works.
- [ ] Deterministic follow-up works.

Hermes:

- [ ] Default rule-based mode works.
- [ ] Dry-run opt-in remains safe.

Regression:

- [ ] RelationshipReviewPanel works.
- [ ] GuidedQuickAnalysisPanel works.
- [ ] Session persistence works.
- [ ] Layout toggle works.
- [ ] No console errors.

## Known Limitations

- Dataset Catalog classification is deterministic and heuristic.
- Catalog metadata is frontend-only and not persisted.
- Relationship Sets are local assistant context and do not execute joins.
- Browser-local session state can still become stale after schema changes or deleted datasets; start a new conversation if context looks confusing.
- Result follow-up is summary-based, not live AI interpretation.
- Forecast, PathAnalysis, and Attribution direct result-to-Workbench buttons are not yet wired.
- Semantic/DataWorkshop prefill remains future work.
- Hermes live integration remains a separate future phase.
