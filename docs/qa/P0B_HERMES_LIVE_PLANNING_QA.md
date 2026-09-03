# P0B Hermes Live Analysis Planning — Manual QA

## Setup

1. Configure backend `HERMES_ASSISTANT_ENABLED=true`, `HERMES_ASSISTANT_MODE=live`, provider URL/token, model, and timeout through local secrets.
2. Start the frontend with `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_live`.
3. Sign in, upload the existing sales and multi-table QA datasets, and create a Relationship Set with confirmed edges.
4. Keep the browser network panel open and confirm planning calls only `/api/v1/assistant/hermes/plan-analysis`.

Never commit local environment files or provider credentials.

## QA-1 — Single-table Forecast

1. Select a sales time-series dataset.
2. Ask `预测未来销售额趋势`.
3. Confirm the card shows `AI Plan · Hermes Live`, Forecast, one required dataset, a time field, and a target metric.
4. Confirm readiness is `单表计划可确认`.
5. Click the confirmation action.

Expected: Forecast opens with prefill only. No analysis POST occurs until the user manually starts it.

## QA-2 — Multi-table Attribution

1. Activate a Relationship Set containing `users`, `orders`, and `marketing_touchpoints` with confirmed keys.
2. Ask `分析不同营销渠道的新客转化表现，并定位转化下降原因`.
3. Inspect required vs candidate/reference datasets, dataset-bound fields, metrics, and confirmed relationships.

Expected: readiness is `needs_join`; Workbench says a multi-table analysis dataset is required. There is no Join request, derived dataset, navigation, or analysis execution.

## QA-3 — Clarification

1. Clear the selected dataset and Relationship Set.
2. Ask an underspecified question such as `帮我分析一下`.

Expected: readiness is `needs_clarification`, bounded questions are visible, and there is no enabled analysis navigation action.

## QA-4 — Provider Failure / Fallback

1. Use an unreachable local provider URL or stop the local provider.
2. Ask a planning question.

Expected: the card still renders, shows `Local Plan · Fallback`, and contains no raw provider error, token, stack trace, or internal response body.

## QA-5 — Source and Safety Audit

For each scenario, verify:

- no dataset preview rows or full `result_data` appear in the planning request;
- no provider credential appears in browser requests or responses;
- planning causes zero automatic Analysis creation;
- planning causes zero Transform, Join, SQL, rerun, or dataset mutation requests;
- the existing SafeResultSummary → Hermes Result Explanation flow still works independently.

## Recording

Record browser/version, backend/provider mode, dataset IDs, observed source badge/readiness, network requests, console errors, and pass/fail for each case. Real-provider results are environment-specific and should not be committed with credentials or raw business data.
