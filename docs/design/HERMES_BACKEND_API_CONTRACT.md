# Hermes Backend API Contract

## Purpose

This document defines the backend API contract for Hermes assistant integration.

Phase 4B-8M implements a dry-run backend scaffold for the contract endpoints. The scaffold validates bounded payloads and returns contract-shaped mock responses only.

No real Hermes provider, LLM call, frontend runtime switch, SQL generation, automatic analysis execution, automatic join, or dataset mutation exists.

The contract gives the future frontend `HermesAssistantRuntime` a stable backend boundary while preserving the current deterministic fallback behavior.

## Current API Conventions

Current project conventions to preserve:

- Backend framework: FastAPI.
- API prefix: `settings.API_V1_STR`, currently `/api/v1`.
- Router mounting: `insightease-backend/app/api/v1/api.py`.
- Existing assistant router prefix: `/assistant`.
- Future Hermes endpoints should therefore live under `/api/v1/assistant/hermes/...`.
- Success envelope: `ResponseModel[T]` from `app.schemas.base`.
- Success envelope shape:

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

- Frontend wrapper pattern: `request` from `app/src/lib/request.ts` with `/api/v1` base URL.
- Frontend callers receive the unwrapped `ResponseModel<T>` because the Axios interceptor returns `response.data`.
- Auth: frontend sends Bearer token from `localStorage.access_token`; backend endpoints typically depend on `get_current_active_user`.
- Existing read-only assistant endpoints:
  - `POST /api/v1/assistant/profile-dataset`
  - `POST /api/v1/assistant/infer-relationships`
- Existing analysis task endpoint:
  - `POST /api/v1/analyses/` returns `202` and uses `BackgroundTasks`.

Hermes explain/plan endpoints in this contract are advisory and synchronous. They may return recommended actions, but must not create backend analysis tasks.

## Endpoint List

Minimum future endpoints:

```text
GET  /api/v1/assistant/hermes/status
POST /api/v1/assistant/hermes/explain-result
POST /api/v1/assistant/hermes/plan-analysis
```

Implemented status after Phase 4B-8M:

- `status`: dry-run/disabled scaffold exists.
- `explain-result`: validation-only dry-run scaffold exists.
- `plan-analysis`: validation-only dry-run scaffold exists.

Optional future endpoints, not fully specified:

```text
POST /api/v1/assistant/hermes/explain-error
POST /api/v1/assistant/hermes/propose-tool-call
POST /api/v1/assistant/hermes/summarize-dataset
```

## Status Endpoint

### GET /api/v1/assistant/hermes/status

Purpose: let the frontend know whether Hermes is available and which capabilities are enabled.

Response envelope:

```ts
type Response = ResponseModel<HermesStatusResponse>;
```

Payload:

```ts
export interface HermesStatusResponse {
  enabled: boolean;
  provider: "hermes" | "mock" | "disabled";
  mode: "disabled" | "dry_run" | "live";
  supports: {
    explain_result: boolean;
    plan_analysis: boolean;
    explain_error: boolean;
    tool_calls: boolean;
  };
  message?: string;
}
```

Behavior:

- If Hermes is not configured, return `enabled: false`.
- If `mode` is `disabled`, all `supports.*` values should be `false`.
- If `mode` is `dry_run`, the backend may validate payloads and return mock/contract responses without external provider calls.
- If `mode` is `live`, the backend may call the configured Hermes provider after all safety validation passes.
- This endpoint must never expose API keys, credentials, provider secrets, storage paths, or internal file paths.

Frontend behavior:

- `enabled: false` means use `ruleBasedAssistantRuntime` and deterministic `resultFollowupResponder`.
- Request failure also means use deterministic fallback.

Phase 4B-8N frontend status probe:

- AI Workbench can lazily call `GET /assistant/hermes/status` when opened.
- Status is cached in `sessionStorage.insightease_hermes_status_cache` for 5 minutes.
- The status probe is diagnostic metadata only.
- It must not switch runtime selection.
- It must not call `explain-result` or `plan-analysis`.
- Status failure is treated as unavailable and should not block user workflow.

## Result Explanation Endpoint

### POST /api/v1/assistant/hermes/explain-result

Purpose: explain an existing analysis result from a bounded safe summary.

Request:

```ts
export interface HermesExplainResultRequest {
  user_question: string;
  result_summary: SafeResultSummary;
  assistant_context?: {
    selected_dataset_id?: string;
    selected_dataset_name?: string;
    active_relationship_set_id?: string;
    active_relationship_set_name?: string;
    relationship_count?: number;
    reference_dataset_count?: number;
  };
  safety: {
    allow_raw_data: false;
    allow_auto_run: false;
    allow_sql_generation: false;
    allow_dataset_mutation: false;
  };
}
```

Response envelope:

```ts
type Response = ResponseModel<HermesExplainResultResponse>;
```

Payload:

```ts
export interface HermesExplainResultResponse {
  answer: string;
  key_findings: string[];
  risks_and_caveats: string[];
  suggested_next_steps: string[];
  recommended_actions: Array<{
    label: string;
    action_type:
      | "navigate"
      | "generate_plan"
      | "ask_clarifying_question"
      | "requires_confirmation";
    target?: string;
    reason?: string;
  }>;
  confidence?: "low" | "medium" | "high";
  fallback_used?: boolean;
}
```

Safety validation:

Backend must reject the request if:

- `safety.allow_raw_data !== false`;
- `safety.allow_auto_run !== false`;
- `safety.allow_sql_generation !== false`;
- `safety.allow_dataset_mutation !== false`;
- `result_summary` exceeds size limits;
- `result_summary.tables[*].rows` exceeds Safe Result Summary caps;
- request body appears to contain raw uploaded rows, full result tables, storage paths, credentials, secrets, or unbounded nested `result_data`;
- `user_question` is empty or exceeds request limits.

Suggested error codes:

- `HERMES_DISABLED`
- `INVALID_SAFETY_FLAGS`
- `SUMMARY_TOO_LARGE`
- `INVALID_RESULT_SUMMARY`
- `HERMES_TIMEOUT`
- `HERMES_PROVIDER_ERROR`

## Plan Analysis Endpoint

### POST /api/v1/assistant/hermes/plan-analysis

Purpose: generate a structured analysis plan from a user question and bounded assistant context.

Hermes may recommend analysis modules and a question-specific dataset subset. It must not execute analysis.

Request:

```ts
export interface HermesPlanAnalysisRequest {
  user_question: string;
  assistant_context: {
    selected_dataset_ids: string[];
    selected_dataset_id?: string;
    datasets?: Array<{
      id: string;
      name?: string;
      filename?: string;
      schema?: Array<{
        name: string;
        type?: string;
        role?: string;
      }>;
      table_type?: string;
      business_category?: string;
      analysis_tags?: string[];
    }>;
    relationship_set?: {
      id: string;
      name: string;
      dataset_nodes: Array<{
        dataset_id: string;
        dataset_name?: string;
        role: "connected" | "isolated" | "reference_only";
        joinable: boolean;
      }>;
      relationships: Array<{
        source_dataset_id: string;
        source_column: string;
        target_dataset_id: string;
        target_column: string;
        relationship_type?: string;
        risk_level?: "low" | "medium" | "high";
      }>;
    };
    analysis_history_summary?: SafeResultSummary;
  };
  safety: {
    allow_raw_data: false;
    allow_auto_run: false;
    allow_sql_generation: false;
    allow_dataset_mutation: false;
    require_user_confirmation_for_execution: true;
  };
}
```

Response envelope:

```ts
type Response = ResponseModel<HermesPlanAnalysisResponse>;
```

Payload:

```ts
export interface HermesPlanAnalysisResponse {
  plan: AssistantAnalysisPlan;
  clarifying_questions?: string[];
  warnings: string[];
  confidence?: "low" | "medium" | "high";
  fallback_used?: boolean;
}
```

Planning rules:

- `relationship_set` is allowed context, not required input for every plan.
- `plan.required_datasets` must be a query-specific subset.
- Hermes must not set `required_datasets = all workspace datasets`.
- Hermes must not set `required_datasets = relationship_set.dataset_nodes` unless the user explicitly asks to use the whole relationship group.
- Isolated/reference nodes may appear as reference context, but must not be treated as joinable.
- High-risk relationships must be surfaced in warnings or assumptions when relevant.
- Recommended target pages are navigation suggestions only.
- Running an analysis remains a separate user-confirmed action outside this endpoint.

Safety validation:

Backend must reject the request if:

- any safety flag is not the exact required value;
- dataset context exceeds size limits;
- relationship context exceeds size limits;
- schemas include sample values or raw rows;
- analysis history summary violates Safe Result Summary caps;
- request contains storage paths, credentials, secrets, or raw data.

Suggested error codes:

- `HERMES_DISABLED`
- `INVALID_SAFETY_FLAGS`
- `CONTEXT_TOO_LARGE`
- `INVALID_REQUEST`
- `HERMES_TIMEOUT`
- `HERMES_PROVIDER_ERROR`

## Size and Privacy Limits

Initial limits:

- Max request body: 256 KB.
- Max `SafeResultSummary.result_keys`: inherit Safe Result Summary cap, currently 20.
- Max `SafeResultSummary.metrics`: inherit cap, currently 8.
- Max `SafeResultSummary.tables`: inherit cap, currently 3.
- Max rows per safe table: inherit cap, currently 5.
- Max columns per safe table: inherit cap, currently 12.
- Max datasets in planning context: 50.
- Max schema columns per dataset: 100.
- Max relationship edges: 200.
- Max user question length: 2,000 characters.
- Max generated answer length: backend should cap provider output to a bounded product-safe size.

Forbidden payload content:

- raw uploaded dataset rows;
- full raw result tables;
- unbounded nested `result_data`;
- credentials;
- API keys;
- database connection strings;
- local or cloud storage paths;
- signed download URLs;
- unrelated saved relationship sets.

If limits are exceeded:

- return a normalized Hermes assistant error;
- frontend falls back to deterministic planner/responder when possible;
- UI may show the `user_message` from the error response.

## Feature Flags and Modes

Future backend settings:

```text
HERMES_ASSISTANT_ENABLED=false
HERMES_ASSISTANT_MODE=disabled|dry_run|live
HERMES_ASSISTANT_TIMEOUT_MS=10000
```

Phase 4B-8M implementation note:

- defaults are disabled;
- `dry_run` is the only enabled scaffold mode;
- `live` is reserved for a future phase and is treated as unavailable by the scaffold;
- no provider credentials are required.

Mode behavior:

- `disabled`: status returns unavailable; explain/plan endpoints return `HERMES_DISABLED`.
- `dry_run`: endpoints validate request payloads and return deterministic mock/contract responses; no external provider call.
- `live`: endpoints validate request payloads, call Hermes provider, normalize response, and enforce action safety.

No real secret names or provider credentials should be documented beyond generic configuration placeholders.

## Error Response Contract

Errors should be normalized into a stable payload. The transport may use the existing FastAPI error mechanism, but the response body should expose this shape where possible:

```ts
export interface HermesAssistantError {
  code:
    | "HERMES_DISABLED"
    | "INVALID_SAFETY_FLAGS"
    | "SUMMARY_TOO_LARGE"
    | "CONTEXT_TOO_LARGE"
    | "INVALID_REQUEST"
    | "INVALID_RESULT_SUMMARY"
    | "HERMES_TIMEOUT"
    | "HERMES_PROVIDER_ERROR";
  message: string;
  user_message: string;
  retryable: boolean;
  fallback_available: boolean;
}
```

Example:

```json
{
  "code": "HERMES_DISABLED",
  "message": "Hermes assistant mode is disabled.",
  "user_message": "AI explanation service is unavailable, so InsightEase used the local summary fallback.",
  "retryable": false,
  "fallback_available": true
}
```

Frontend fallback rules:

- If `fallback_available` is true, use deterministic fallback and show a non-blocking warning.
- If timeout/provider error occurs, use fallback.
- If safety validation fails, do not retry automatically; show a safety error.

## Tool Action Confirmation Contract

Hermes may return recommended actions, but the frontend must classify them before rendering or executing anything.

Allowed without confirmation:

- `navigate`: open a target page.
- `generate_plan`: create or display an advisory plan only.
- `ask_clarifying_question`: ask the user for more context.

Requires explicit confirmation:

- `requires_confirmation`: any action that could trigger compute, join, write, SQL, or backend task creation.
- Future `run_analysis`: requires confirmation.
- Future `preview_join`: requires confirmation.

Prohibited unless a future phase explicitly defines the feature:

- `modify_dataset`.
- automatic dataset creation.
- executable SQL generation.
- automatic join execution.

No execute/write action should run directly from a Hermes response.

## Frontend Runtime Integration

Future `hermesAssistantRuntime` should call:

- `GET /assistant/hermes/status` before enabling Hermes mode or as a cached capability check.
- `POST /assistant/hermes/explain-result` for result-context follow-up questions.
- `POST /assistant/hermes/plan-analysis` for planner prompts when Hermes is enabled.

Current deterministic behavior remains required fallback:

- `ruleBasedAssistantRuntime` for planning;
- `resultFollowupResponder` for result explanation;
- no UI path should depend exclusively on Hermes.

## Non-Goals

This contract and dry-run scaffold do not:

- implement live Hermes provider calls;
- switch runtime mode;
- add streaming;
- add provider secrets;
- call Hermes/LLM;
- auto-run analysis;
- auto-join datasets;
- generate SQL;
- modify SmartAnalysis.
