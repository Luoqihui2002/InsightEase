# Assistant Runtime Adapter Design

**Version**: 1.0  
**Date**: 2026-04-28  
**Status**: Implemented (rule-based runtime active)

---

## Why Runtime Abstraction

The AI Workbench UI (AIWorkspace, AICompanion) should not depend on a specific assistant backend. Currently the UI calls `generateMockAnalysisPlan()` directly. This creates tight coupling:

- Swapping to Hermes/LLM requires UI changes
- Testing is hard because the planner is wired inline
- Side-effect safety is not explicit

A runtime abstraction solves this:

```
AIWorkspace
  → AssistantRuntime (interface)
    → RuleBasedAssistantRuntime  (now)
    → HermesAssistantRuntime     (future)
    → LLMAssistantRuntime        (future)
```

The UI only knows `AssistantRuntime`. Switching backends is a factory change.

---

## Architecture

### Interface

```ts
interface AssistantRuntime {
  mode: AssistantRuntimeMode; // "rule_based" | "hermes" | "llm"

  generateAnalysisPlan(request: AssistantPlanRequest): Promise<AssistantPlanResponse>;
  explainError?(request): Promise<...>;
  explainResult?(request): Promise<...>;
}
```

### Context

The runtime receives a structured `AssistantContext`:

```ts
interface AssistantContext {
  selected_dataset_ids: string[];
  selected_dataset_id?: string;
  confirmed_relationships: TableRelationship[]; // active relationship set only
  relationship_set?: RelationshipSet; // active topic graph only
  available_dataset_nodes?: RelationshipSetDatasetNode[];
  dataset_profiles?: DatasetProfile[];
  datasets?: Array<{ id; filename; name; schema? }>;
  dataset_catalog?: DatasetCatalogMetadata[];
}
```

This context is built by AIWorkspace from:
- `useAssistantContext()` (active relationship set relationships)
- `datasetApi.list()` (dataset list)
- `inferDatasetCatalogMetadata()` (frontend-only deterministic catalog metadata)
- `selectedDataset` state (primary dataset)

Relationship context contract after Phase 4B-8D-C:

- `confirmed_relationships` means relationships from the active Relationship Set only.
- Saved relationship sets that are not active are never passed to the runtime.
- If no active set exists, `confirmed_relationships` is `[]`.
- Relationship sets are local assistant metadata and do not trigger joins or SQL generation.

Relationship context contract after Phase 4B-8D-D:

- `relationship_set` is the active topic-scoped dataset graph.
- `available_dataset_nodes` includes connected and isolated/reference nodes from that active graph.
- `confirmed_relationships` remains a compatibility edge list derived from the active graph only.
- The planner treats the graph as allowed context; it must infer a question-specific subset for `required_datasets`.
- Isolated/reference nodes are not joinable and must not trigger automatic joins.

Dataset catalog context contract after Phase 4B-9B:

- `dataset_catalog` is deterministic frontend-only metadata inferred from the loaded dataset list.
- The rule-based planner uses catalog metadata only for candidate narrowing.
- Candidate datasets are advisory and are distinct from `required_datasets`.
- Selected dataset remains first priority.
- Active Relationship Set nodes constrain the candidate pool; they are not all required.
- Full-library matching is used only for bounded candidate hints when no selected dataset or active graph gives a high-confidence match.
- When no required dataset is confirmed, the planner/card should ask the user to confirm a dataset instead of creating empty analysis-page prefill navigation.

Multi-table execution gap after Phase 4B-10E:

- Relationship Sets remain allowed context graphs only.
- Existing analysis modules mostly require a single analysis dataset.
- Multi-table plans must not silently join source datasets.
- Future Join Builder work should transform a user-confirmed subset of source tables into a temporary or saved derived analysis dataset.
- The runtime may propose a Join Plan, but execution requires explicit user confirmation through Join Builder.

### Factory

```ts
function getAssistantRuntime(): AssistantRuntime {
  return ruleBasedAssistantRuntime;
  // Future: check config, return hermesAssistantRuntime
}
```

---

## Current Runtime: RuleBasedAssistantRuntime

Wraps the existing `generateMockAnalysisPlan()` keyword matcher.

- **No LLM calls**
- **No backend analysis execution**
- **Deterministic and safe**
- **Fully local**

```ts
const ruleBasedAssistantRuntime: AssistantRuntime = {
  mode: "rule_based",
  async generateAnalysisPlan(request) {
    const plan = generateMockAnalysisPlan({
      question: request.question,
      datasets: request.context.datasets ?? [],
      selectedDatasetId: request.context.selected_dataset_id,
      relationshipSet: request.context.relationship_set,
      availableDatasetNodes: request.context.available_dataset_nodes,
      confirmedRelationships: request.context.confirmed_relationships, // active set only
      datasetCatalog: request.context.dataset_catalog,
    });
    return { plan, runtime_mode: "rule_based", warnings: [] };
  },
};
```

---

## Future Runtime: HermesAssistantRuntime

Placeholder exists at `app/src/lib/assistant/hermesAssistantRuntime.ts`.

When backend Hermes adapter is ready:

1. Implement `hermesAssistantRuntime.generateAnalysisPlan()`
   - POST to backend `/assistant/hermes/plan-analysis`
   - Send `AssistantContext` as JSON
   - Receive structured plan or tool-call proposal
2. Update `getAssistantRuntime()` to return Hermes runtime when enabled
3. UI remains unchanged

Hermes runtime may return:
- Direct plan (same shape as rule-based)
- Tool-call proposal (UI shows confirmation dialog)
- Streaming explanation (UI shows streaming text)

### Future Hermes Result Explainer Boundary

Phase 4B-8K defines the result explanation boundary in:

`docs/design/HERMES_RESULT_EXPLAINER_BOUNDARY.md`

Hermes result explanation must accept only bounded safe context:

- `SafeResultSummary`
- selected dataset metadata
- active relationship set metadata
- user question
- explicit safety flags

Hermes result explanation must not receive raw dataset rows, full raw result tables, unbounded nested `result_data`, credentials, storage paths, or unrelated saved relationship sets.

The deterministic `resultFollowupResponder` remains fallback when Hermes is disabled, fails, or the safe summary is too sparse.

### Future Hermes Backend API Contract

Phase 4B-8L defines the backend endpoint contract in:

`docs/design/HERMES_BACKEND_API_CONTRACT.md`

Future runtime calls should use:

- `GET /api/v1/assistant/hermes/status`
- `POST /api/v1/assistant/hermes/explain-result`
- `POST /api/v1/assistant/hermes/plan-analysis`

The runtime must keep deterministic fallback behavior:

- disabled/unavailable Hermes -> `ruleBasedAssistantRuntime` for planning;
- failed result explanation -> deterministic `resultFollowupResponder`;
- safety validation error -> no retry with raw data.

The runtime must not send raw dataset rows, full result tables, storage paths, credentials, or unrelated relationship sets.

Phase 4B-8M implementation note:

- Backend dry-run endpoints now exist for status, result explanation, and plan analysis.
- `assistantApi` has wrapper methods for exercising the contract.
- `getAssistantRuntime()` still returns `ruleBasedAssistantRuntime`.
- `hermesAssistantRuntime` remains a placeholder and must not be selected until a future explicit runtime integration phase.

Phase 4B-8N implementation note:

- AI Workbench may lazily probe `GET /assistant/hermes/status` for diagnostics.
- Probe results are cached in `sessionStorage` for 5 minutes.
- The probe is diagnostic only and must not change runtime selection.
- AI Workbench must not call Hermes `explain-result` or `plan-analysis` endpoints in this phase.

Phase 4B-8O implementation note:

- `getAssistantRuntime()` now supports an explicit development-only provider switch.
- Default remains `rule_based`.
- `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run` selects `hermesAssistantRuntime`.
- `hermesAssistantRuntime.generateAnalysisPlan()` calls only `/assistant/hermes/plan-analysis`.
- If the dry-run endpoint is disabled, unavailable, or returns an invalid plan, the runtime falls back to `ruleBasedAssistantRuntime`.
- Result follow-up remains deterministic and does not call Hermes explain-result.

---

## Safe Tool Registry

All assistant capabilities are declared in `ASSISTANT_TOOL_REGISTRY`:

| Tool | Implemented | Requires Confirmation | Side Effect |
|------|-------------|----------------------|-------------|
| profile_dataset | ✅ | No | read |
| infer_relationships | ✅ | No | read |
| generate_analysis_plan | ✅ | No | none |
| navigate_to_module | ✅ | No | none |
| explain_result | ❌ | No | none |
| explain_error | ❌ | No | none |
| preview_join | ❌ | Yes | execute |
| run_analysis | ❌ | Yes | execute |

Future Join Builder tools from Phase 4B-10E:

| Tool | Implemented | Requires Confirmation | Side Effect |
|------|-------------|----------------------|-------------|
| create_temp_analysis_dataset | No | Yes | execute |
| save_joined_dataset | No | Yes | write |

**Safety rule**: any tool with `side_effect_level: "execute"` or `"write"` must get explicit user confirmation before running. The UI must not auto-call these.

---

## Confirmation Rules

| Action | Auto-allowed? | Why |
|--------|---------------|-----|
| Explain data / infer relationships | ✅ | Read-only, no side effects |
| Generate analysis plan | ✅ | No side effects, purely advisory |
| Navigate to module | ✅ | No data mutation |
| Preview join | ❌ | May trigger heavy query |
| Run analysis | ❌ | Creates backend task, consumes compute |
| Modify dataset | ❌ | Data mutation |

---

## Future Join Builder Tool Safety

Phase 4B-10E defines the Multi-table Analysis Dataset Builder design in:

`docs/design/MULTI_TABLE_ANALYSIS_DATASET_BUILDER_DESIGN.md`

Future runtime/tool behavior:

- `preview_join` may be proposed but requires user confirmation before bounded preview execution.
- `create_temp_analysis_dataset` requires explicit confirmation and must create a clearly labeled derived dataset with TTL.
- `save_joined_dataset` requires explicit confirmation and must persist provenance metadata.
- Hermes/LLM must not generate arbitrary SQL for execution.
- Hermes/LLM must not silently join, save, mutate source datasets, or auto-run target analysis.
- Many-to-many and high-risk joins require warnings and explicit override.

---

## AIWorkspace Stability Contract

AIWorkspace must:
1. Call `getAssistantRuntime()` once per session (or per request)
2. Build `AssistantContext` from current UI state
3. Call `runtime.generateAnalysisPlan()` with user question + context
4. Render `response.plan` via `AnalysisPlanCard`
5. Handle `response.warnings` if any

AIWorkspace must not:
1. Call `generateMockAnalysisPlan()` directly
2. Know which runtime is active
3. Auto-execute side-effect tools
4. Send raw dataset values to any runtime

---

## Files

| File | Role |
|------|------|
| `app/src/lib/assistant/assistantRuntime.ts` | Interface + types |
| `app/src/lib/assistant/ruleBasedAssistantRuntime.ts` | Current runtime |
| `app/src/lib/assistant/hermesAssistantRuntime.ts` | Future placeholder |
| `app/src/lib/assistant/getAssistantRuntime.ts` | Factory |
| `app/src/lib/assistant/toolRegistry.ts` | Safe tool registry |
| `app/src/pages/AIWorkspace.tsx` | UI consumer |
