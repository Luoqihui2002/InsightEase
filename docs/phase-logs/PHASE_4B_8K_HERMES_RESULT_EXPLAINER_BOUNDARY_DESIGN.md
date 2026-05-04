# Phase 4B-8K: Hermes Result Explainer Boundary Design

## Objective

Define the future Hermes Result Explainer boundary for AI Workbench.

This is a design/contract phase only. It does not implement Hermes integration, call an LLM, add backend endpoints, auto-generate explanations, auto-run analysis, read full raw `result_data`, or modify SmartAnalysis.

## Existing Contract Findings

### SafeResultSummary

`SafeResultSummary` currently contains:

- analysis id, type, status;
- dataset id/name;
- created/completed timestamps;
- title/subtitle;
- existing `ai_summary` and `ai_interpretation`;
- capped result keys;
- capped metrics;
- capped table previews;
- chart/config summaries;
- warnings;
- available actions.

The builder caps:

- result keys: 20;
- metrics: 8;
- tables: 3;
- rows per table: 5;
- columns per table: 12;
- warnings: 8;
- long strings: 120 characters.

### AssistantContext

`AssistantContext` currently contains:

- selected dataset ids;
- primary selected dataset id;
- active relationship-set relationships;
- active topic-scoped relationship set;
- active relationship-set dataset nodes;
- optional dataset profiles;
- lightweight dataset schema metadata;
- optional `analysis_history_summary?: SafeResultSummary`.

### Current Result Follow-up

`resultFollowupResponder` detects result follow-up intents and produces deterministic answers from `SafeResultSummary`.

Supported current intents:

- explain result;
- risks/anomalies;
- next steps;
- report summary.

This deterministic responder should remain fallback when Hermes is disabled or fails.

## Files Inspected

- `app/src/types/resultSummary.ts`
- `app/src/lib/assistant/safeResultSummary.ts`
- `app/src/lib/assistant/assistantRuntime.ts`
- `app/src/lib/assistant/resultFollowupResponder.ts`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`

## Files Created

- `docs/design/HERMES_RESULT_EXPLAINER_BOUNDARY.md`
- `docs/phase-logs/PHASE_4B_8K_HERMES_RESULT_EXPLAINER_BOUNDARY_DESIGN.md`

## Files Modified

- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Request Contract

The proposed future request is:

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

## Response Contract

The proposed future response is:

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

## Safety Rules

Hermes may explain, summarize, and suggest.

Hermes may not:

- receive full raw uploaded dataset rows;
- receive full raw result tables;
- receive unbounded nested `result_data`;
- receive credentials or storage paths;
- auto-run analysis;
- auto-join datasets;
- create or modify datasets;
- generate executable SQL without explicit request and confirmation;
- infer joins outside confirmed relationship sets without labeling them as suggestions.

## UI Flow

Future flow:

```text
User selects analysis result
  -> AI Workbench Context Panel shows SafeResultSummary
  -> User asks "帮我解释这个结果"
  -> Runtime builds HermesResultExplainRequest
  -> Hermes returns HermesResultExplainResponse
  -> AI Workbench displays structured explanation
  -> Suggested actions appear as chips/buttons
  -> Execute/write actions require confirmation
```

No explanation is generated automatically on handoff.

## Fallback

The deterministic responder remains the fallback:

- Hermes disabled -> deterministic response.
- Hermes failure -> show warning and deterministic response.
- Sparse summary -> explain limitation and ask for more context.

## Validation Results

- `git status`

No TypeScript interfaces or runtime code were added in this phase, so no frontend build was required.

## Manual QA Checklist

- [ ] Confirm `docs/design/HERMES_RESULT_EXPLAINER_BOUNDARY.md` exists.
- [ ] Confirm the request contract only accepts `SafeResultSummary` and bounded context.
- [ ] Confirm the response contract is structured.
- [ ] Confirm safety rules prohibit raw data, auto-run, SQL, joins, and dataset mutation.
- [ ] Confirm fallback to deterministic responder is documented.
- [ ] Confirm UI flow requires user question before explanation.

## Known Limitations

- No backend endpoint is defined yet.
- No TypeScript runtime interface was added in code.
- No Hermes feature flag is defined yet.

## Next Recommended Phase

Add design-only backend API endpoint contract, then optionally add frontend TypeScript interfaces once the endpoint shape is approved.
