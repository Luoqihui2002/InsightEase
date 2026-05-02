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
  confirmed_relationships: TableRelationship[];
  dataset_profiles?: DatasetProfile[];
  datasets?: Array<{ id; filename; name; schema? }>;
}
```

This context is built by AIWorkspace from:
- `useAssistantContext()` (confirmed relationships)
- `datasetApi.list()` (dataset list)
- `selectedDataset` state (primary dataset)

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
      confirmedRelationships: request.context.confirmed_relationships,
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
   - POST to backend `/assistant/hermes/plan`
   - Send `AssistantContext` as JSON
   - Receive structured plan or tool-call proposal
2. Update `getAssistantRuntime()` to return Hermes runtime when enabled
3. UI remains unchanged

Hermes runtime may return:
- Direct plan (same shape as rule-based)
- Tool-call proposal (UI shows confirmation dialog)
- Streaming explanation (UI shows streaming text)

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
