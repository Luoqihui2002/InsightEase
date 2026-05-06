# Hermes Live Readiness Checklist

**Version**: 2026-05-07
**Status**: Phase 4B-11A review complete; live Hermes remains disabled

## Scope

This checklist reviews whether InsightEase is ready to start implementing future Hermes live adapters without weakening the current safety model.

It covers:

- frontend assistant runtime provider gating;
- backend Hermes dry-run endpoint contracts;
- SafeResultSummary result-explanation boundary;
- bounded metadata boundary for plan-analysis;
- fallback and rollback behavior;
- required config and secrets handling for future live phases.

This phase does not connect a live LLM provider, add credentials, enable live runtime selection, implement joins, execute SQL, auto-run analysis, or mutate datasets.

## Current Runtime State

Current frontend runtime selection is intentionally narrow:

- default provider is `rule_based`;
- `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run` is the only explicit non-default frontend provider;
- unknown provider values fall back to `rule_based`;
- no frontend `hermes_live` provider is accepted;
- the Hermes dry-run runtime calls only `/assistant/hermes/plan-analysis`;
- dry-run failure, backend disablement, unavailable status, or invalid plan shape falls back to `ruleBasedAssistantRuntime`.

Current backend state:

- `HERMES_ASSISTANT_ENABLED` defaults to `false`;
- `HERMES_ASSISTANT_MODE` defaults to `disabled`;
- `dry_run` is the only mode that enables dry-run endpoints;
- `live` is schema-reserved but `_active_dry_run_mode()` currently returns `disabled` for live mode;
- no provider credentials are required or used by the dry-run scaffold;
- no backend endpoint calls Hermes, Kimi, OpenAI, or another external LLM.

## Backend Contract Review

Reviewed endpoints:

```text
GET  /api/v1/assistant/hermes/status
POST /api/v1/assistant/hermes/explain-result
POST /api/v1/assistant/hermes/plan-analysis
```

Findings:

- status supports disabled and dry-run states today, with live reserved for future schema compatibility;
- explain-result accepts `SafeResultSummary`, a user question, optional metadata-only assistant context, and explicit safety flags;
- plan-analysis accepts a bounded assistant context, user question, and explicit safety flags;
- safety flags require `allow_raw_data=false`, `allow_auto_run=false`, `allow_sql_generation=false`, and `allow_dataset_mutation=false`;
- plan-analysis additionally requires `require_user_confirmation_for_execution=true`;
- request size is capped at 256 KiB;
- safe result summaries are validated against table, row, and column caps;
- planning context caps dataset count, schema column count, and relationship edge count;
- forbidden keys reject raw or sensitive payloads, including `raw_rows`, `raw_data`, `full_table`, `result_data`, `storage_path`, `file_path`, `credentials`, `secret`, `token`, `api_key`, `password`, `connection_string`, and `signed_url`;
- dry-run responses are advisory, low-confidence, and marked as fallback-shaped;
- no write, execution, SQL, join, dataset creation, or source dataset mutation is exposed by Hermes endpoints.

## Frontend Runtime Review

Reviewed files:

- `app/src/lib/assistant/assistantRuntimeConfig.ts`
- `app/src/lib/assistant/getAssistantRuntime.ts`
- `app/src/lib/assistant/hermesAssistantRuntime.ts`
- `app/src/lib/assistant/ruleBasedAssistantRuntime.ts`
- `app/src/lib/assistant/assistantRuntime.ts`
- `app/src/hooks/useHermesStatus.ts`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/api/assistant.ts`
- `app/src/types/hermes.ts`

Findings:

- AI Workbench uses `getAssistantRuntime()` instead of calling a live provider directly;
- the diagnostic Hermes status probe is non-blocking and does not select a runtime;
- result follow-up prompts are routed to deterministic `resultFollowupResponder` when a result context exists;
- result follow-up does not call Hermes explain-result in default or dry-run planning mode;
- plan-analysis dry-run responses are validated for a minimum `AssistantAnalysisPlan` shape before rendering;
- invalid dry-run responses fall back to the rule-based planner.

## SafeResultSummary Boundary

SafeResultSummary remains the only allowed payload for result explanation.

Current caps in `buildSafeResultSummary()`:

- result keys: 20;
- metrics: 8;
- tables: 3;
- rows per table: 5;
- columns per table: 12;
- warnings: 8;
- long strings: 120 characters.

Reviewed result handoff paths:

- History result dialog to AI Workbench;
- Statistics result page to AI Workbench;
- Forecast result page to AI Workbench;
- PathAnalysis result page to AI Workbench;
- Attribution result page to AI Workbench.

Findings:

- handoff payloads use `safe_result_summary`;
- handoff payloads are stored in sessionStorage with a 24-hour TTL;
- the handoff reader validates the summary shape before accepting it;
- result follow-up responses are generated from SafeResultSummary only;
- raw `result_data` is summarized in memory and is not persisted into the handoff payload;
- no default path sends raw `result_data` to Hermes explain-result.

## Plan Analysis Metadata Boundary

Allowed future Hermes planning inputs:

- user question;
- selected dataset id;
- loaded dataset metadata such as id, filename/name, and bounded schema summary;
- deterministic Dataset Catalog metadata;
- active Relationship Set metadata;
- confirmed relationship edges from the active set;
- isolated/reference dataset nodes as context only;
- optional SafeResultSummary for selected analysis history context.

Disallowed future Hermes planning inputs:

- raw dataset rows;
- uploaded file contents;
- full raw result tables;
- raw `result_data`;
- credentials, signed URLs, storage paths, or secrets;
- arbitrary SQL execution access;
- automatic joined tables;
- source dataset mutation capability.

Planner semantics confirmed:

- selected dataset remains highest priority;
- active Relationship Set constrains the candidate pool but does not imply all nodes are required;
- required datasets are question-specific;
- candidate datasets are advisory and visually distinct from required datasets;
- Relationship Set is an allowed context graph, not a Join Plan;
- multi-table execution is deferred to Phase 5 Join Builder work.

## Provider Gating Rules

Current 4B-11A rules:

1. Default frontend provider must remain `rule_based`.
2. Dry-run provider must require `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run`.
3. Unknown frontend provider values must fall back to `rule_based`.
4. Backend Hermes must remain disabled unless `HERMES_ASSISTANT_ENABLED=true` and `HERMES_ASSISTANT_MODE=dry_run`.
5. Backend `live` mode must remain non-operational until a future live adapter phase changes the implementation intentionally.
6. Frontend runtime selection must not be driven by the diagnostic status probe.
7. No provider key may be committed to source control.

Future live-mode gates should require all of the following before activation:

- explicit frontend live provider value added in a future phase;
- backend live mode implementation behind a disabled-by-default flag;
- provider credentials loaded from local environment or a secrets manager only;
- schema validation of every live response;
- deterministic fallback for every live failure;
- documented rollback by environment config only;
- QA evidence that no raw dataset rows or raw result data are sent.

## Fallback and Rollback Plan

| Failure or state | Expected behavior |
|---|---|
| Hermes status unavailable | AI Workbench remains usable; diagnostic shows unavailable or cached state. |
| Hermes disabled | Default planner and result follow-up remain deterministic. |
| Hermes dry-run disabled while frontend dry-run is selected | Dry-run request fails safely and falls back to `ruleBasedAssistantRuntime`. |
| Hermes plan-analysis endpoint fails | Rule-based planner is used. |
| Hermes plan-analysis returns malformed plan | Shape validation fails and rule-based planner is used. |
| Hermes explain-result fails in future live mode | Deterministic `resultFollowupResponder` remains available. |
| Safety validation rejects payload | Do not retry with raw data; use local fallback. |
| Timeout | Use deterministic fallback and surface a non-blocking warning. |
| Unknown frontend provider value | Use `rule_based`. |
| Future live rollback | Disable live by environment config; keep frontend/default rule-based path intact. |

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Accidental live provider enablement | High | No live frontend provider exists; backend live mode returns disabled today. |
| Raw dataset or result leakage | High | SafeResultSummary boundary, forbidden-key validation, size caps, and docs gates. |
| Malformed live response rendering unsafe plan | High | Runtime shape validation and rule-based fallback. |
| Relationship Set treated as automatic join plan | High | Planner and docs state it is context only; Phase 5 Join Builder required for execution. |
| Hermes timeout or outage | Medium | Status probe is non-blocking; dry-run planner has fallback. |
| Secrets committed to repo | High | Future live phase must use env/secrets manager; no keys added in 4B-11A. |
| Prompt injection in metadata or summaries | Medium | Bounded metadata only; future live adapter needs prompt-injection QA and response validation. |
| Cost/latency surprises in live mode | Medium | Future live mode needs timeouts, quotas, and provider observability before rollout. |
| Dry-run/live behavior drift | Medium | 4B-11B/11C must preserve the same request/response schemas and fallback contracts. |

## Required Config and Secrets

No live secrets are required for Phase 4B-11A.

Future live phases should use environment-only or secrets-manager configuration such as:

```text
HERMES_ASSISTANT_ENABLED=false
HERMES_ASSISTANT_MODE=disabled|dry_run|live
HERMES_ASSISTANT_TIMEOUT_MS=10000
HERMES_PROVIDER=<provider-name>
HERMES_MODEL=<deployment-or-model>
HERMES_API_KEY=<secret manager or local env only>
```

Rules:

- never commit `.env` files containing real credentials;
- never expose provider secrets through `/assistant/hermes/status`;
- keep `live` disabled by default in all committed config;
- add a rollback path that requires only environment changes.

## Phase 4B-11B Preconditions

Before implementing Hermes Result Explainer Live Adapter:

- live result explanation must accept only `SafeResultSummary`;
- backend must reject raw result data and forbidden sensitive keys;
- frontend must not auto-generate an explanation on handoff;
- deterministic `resultFollowupResponder` must remain fallback;
- response schema validation must reject malformed live responses;
- provider credentials must be configured outside source control;
- status and error messages must not expose secrets.

## Phase 4B-11C Preconditions

Before implementing Hermes Plan Analysis Live Adapter:

- live planning must receive bounded metadata context only;
- Dataset Catalog and Relationship Set semantics must stay advisory/contextual;
- Relationship Set must not become an automatic join plan;
- live plans must not generate executable SQL;
- live plans must not auto-run analysis or create datasets;
- multi-table plans must route to future Phase 5 Join Builder, not direct execution;
- malformed or unsafe plan responses must fall back to rule-based planning.

## Open Questions

- Which provider and deployment will back live Hermes?
- Will live result explanation be synchronous, streaming, or both?
- What observability is required for latency, cost, validation failures, and fallback rates?
- What audit logging is required before exposing live assistant behavior to real users?
- What red-team prompt set should be required before live rollout?
- Should backend validation add value-level sampling guards in addition to key-based forbidden-field checks?

## Status

Phase 4B-11A readiness review is complete.

The project is ready to begin 4B-11B design/implementation work only if the preconditions above are kept. Live Hermes remains disabled, default runtime remains rule-based, and no Phase 5 multi-table execution behavior has been introduced.
