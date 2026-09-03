# InsightEase Flagship Demo Script (2–4 minutes)

## 0:00 — Problem and product

“InsightEase is an agentic business analytics platform that separates LLM reasoning from deterministic data execution. I’ll use four synthetic commerce tables to answer why new-customer conversion fell last month.”

## 0:15 — Data context

Show Dataset Catalog and the bounded profiles for users, orders, marketing touchpoints, and event log. Point out that users has user grain, orders has order grain, and no raw rows are sent to Hermes for planning.

## 0:30 — Ask the question

In AI Workbench ask:

> 最近一个月新客转化表现为什么下降？请比较不同营销渠道的转化表现，并帮我定位主要原因。

Show the loading state. After completion, explicitly verify the badge says `AI Plan · Hermes Live`, not fallback.

## 0:45 — Review the plan

Highlight required versus candidate/reference datasets, suggested fields, the confirmed Relationship Set, and `needs_join`. Explain that Hermes proposes; it cannot join tables or start analysis.

## 1:05 — Build and preview

Open Analysis Dataset Builder. Use users as the base and orders as the detail table with a LEFT join on `user_id`. Show:

- actual 1:N cardinality;
- 2,000 → 2,054 rows;
- 1.027× row multiplier;
- 27% of users matching an order;
- user → likely order grain shift;
- medium risk and the warning that unmatched users remain as null order fields.

Emphasize that preview created zero datasets.

## 1:40 — Explicit creation and analysis

Confirm creation once. Open the derived dataset lineage and show both source dataset IDs, the JoinPlan snapshot, and risk summary. Navigate to the recommended existing analysis page, review the prefilled configuration, then manually press Start Analysis.

If two existing modules are needed, use Statistics for exact cohort/channel checks and Path Analysis on event log for the social_ads checkout-to-payment diagnosis. Do not imply a custom analyzer exists.

## 2:20 — Result and explanation

Show ResultView, then press “带到 AI 工作台”. Ask:

1. 帮我解释这个结果。
2. 为什么整体新客转化下降？
3. 接下来最值得进一步验证的是什么？

The expected story is 24.0% → 18.8% CVR: social_ads traffic share rises from 15% to 40%, and social_ads CVR falls from 16% to 10%, especially checkout → payment success. Stop if Hermes invents a metric not present in SafeResultSummary.

## 3:10 — Architecture takeaway

“The safety boundary is the project’s main engineering decision: metadata-only LLM planning, schema and semantic validation, user-confirmed relationships, deterministic pandas execution, explicit derived-dataset creation, and bounded result explanation. There is no LLM SQL or automatic analysis run.”

## Recording guardrails

- Abort and reconfigure if the plan badge says fallback.
- Never show `.env`, tokens, provider URLs, or database credentials.
- Do not browse unrelated menus.
- Do not claim browser-local Relationship Sets or bounded dataframe execution are enterprise infrastructure.
