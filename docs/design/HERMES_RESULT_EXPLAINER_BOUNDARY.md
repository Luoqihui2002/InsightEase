# Hermes Result Explainer Boundary

## Purpose

This document defines the future Hermes Result Explainer boundary for AI Workbench.

The Result Explainer may help users understand an analysis result, identify caveats, and choose next steps. It must operate only on bounded safe context and must never receive raw uploaded datasets or unbounded result payloads.

This is a design contract. No Hermes integration, backend endpoint, or LLM call is implemented in this phase.

## Current Baseline

Current frontend behavior:

- `SafeResultSummary` is the bounded analysis result contract.
- AI Workbench can receive result context from History and Statistics.
- The Context Panel displays attached result context.
- `resultFollowupResponder` provides deterministic responses from `SafeResultSummary`.
- No Hermes/LLM call is connected.

The deterministic responder remains the fallback for all future Hermes behavior.

## Allowed Input Context

Hermes Result Explainer may receive only:

- `SafeResultSummary`;
- selected dataset metadata, not rows;
- active relationship set metadata, not unconfirmed joins;
- user question;
- explicit safety flags.

It may not receive:

- full raw uploaded dataset rows;
- full raw result tables;
- unbounded nested `result_data`;
- credentials;
- storage paths;
- backend file paths;
- database connection strings;
- unrelated saved relationship sets.

## Request Contract

Future request shape:

```ts
export interface HermesResultExplainRequest {
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

Required request rules:

- `result_summary` must be produced by `buildSafeResultSummary`.
- `safety.allow_raw_data` must always be `false`.
- `safety.allow_auto_run` must always be `false`.
- `safety.allow_sql_generation` must always be `false`.
- `safety.allow_dataset_mutation` must always be `false`.
- Relationship context is metadata only; it does not authorize joins.

## Response Contract

Future response shape:

```ts
export interface HermesResultExplainResponse {
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
}
```

Response rules:

- `answer` must be plain-language explanatory text.
- `key_findings` must be grounded in `SafeResultSummary`.
- `risks_and_caveats` must include data/scope limitations when the summary is sparse.
- `suggested_next_steps` may recommend future analysis, but may not run it.
- `recommended_actions` may navigate or propose a plan.
- Any action that executes compute, creates data, joins data, or generates SQL must use `requires_confirmation`.

## Safety Rules

Hermes may:

- explain a result;
- summarize bounded metrics and table previews;
- identify caveats from warnings and status;
- suggest next analytical steps;
- recommend target analysis pages;
- ask clarifying questions.

Hermes may not:

- auto-run analysis;
- create backend analysis tasks;
- create or modify datasets;
- auto-join datasets;
- generate executable SQL without explicit user request and confirmation;
- infer joins outside confirmed relationship sets without labeling them as suggestions;
- receive raw table rows beyond `SafeResultSummary` caps;
- treat isolated/reference relationship-set nodes as joinable.

## Fallback Behavior

Future runtime behavior:

```text
If Hermes is enabled and request succeeds:
  use HermesResultExplainResponse.

If Hermes is disabled:
  use deterministic resultFollowupResponder.

If Hermes request fails:
  show a non-blocking warning and use deterministic resultFollowupResponder.

If SafeResultSummary is sparse:
  explain the limitation and ask the user for more context or a more specific question.
```

The deterministic responder must not be removed. It is the safe baseline and offline fallback.

## UI Flow

Future user flow:

```text
User selects analysis result
  -> AI Workbench Context Panel shows SafeResultSummary
  -> User asks "帮我解释这个结果"
  -> Runtime builds HermesResultExplainRequest
  -> Hermes returns HermesResultExplainResponse
  -> AI Workbench displays structured explanation
  -> Suggested actions appear as chips/buttons
  -> Any execute/write action requires confirmation
```

No automatic explanation should be generated when a result is handed off. The user must ask first.

## Confirmation Requirements

Require explicit confirmation before:

- rerunning analysis;
- launching a new analysis;
- previewing or executing joins;
- creating datasets;
- modifying datasets;
- generating executable SQL;
- calling any backend tool with side effects.

Navigation-only actions may execute without confirmation.

## Runtime Integration Point

The likely integration point is `AssistantRuntime.explainResult`, backed by a future `hermesAssistantRuntime.explainResult`.

Current UI behavior should remain:

- result handoff attaches `SafeResultSummary`;
- deterministic follow-up responder answers locally;
- normal planner flow remains unchanged for non-result prompts.

When Hermes is introduced, `getAssistantRuntime()` may select Hermes runtime by configuration. UI should still call the runtime interface and not know the concrete backend.

## Related Backend API Contract

Phase 4B-8L defines the future backend API endpoint contract separately:

`docs/design/HERMES_BACKEND_API_CONTRACT.md`

The backend contract maps this result explainer boundary to:

- `GET /api/v1/assistant/hermes/status`
- `POST /api/v1/assistant/hermes/explain-result`
- `POST /api/v1/assistant/hermes/plan-analysis`

The endpoint contract preserves this document's safety boundary: Hermes receives only `SafeResultSummary`, bounded metadata context, user question, and explicit safety flags.

## Non-Goals

This boundary document does not:

- implement a backend endpoint;
- implement Hermes;
- implement streaming;
- add runtime authentication behavior;
- replace deterministic follow-up mode;
- change existing result pages.
