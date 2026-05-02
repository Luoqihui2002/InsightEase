# Phase 4B-8A Log: Assistant Runtime Adapter + Safe Tool Registry Scaffold

**Phase ID**: 4B-8A  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Introduce an Agent-compatible assistant runtime abstraction for AI Workbench. Refactor the runtime boundary so future Hermes Agent / LLM integration can be added without redesigning the UI.

---

## Files Created

| File | Description |
|------|-------------|
| `app/src/lib/assistant/assistantRuntime.ts` | Core types: `AssistantRuntime`, `AssistantContext`, `AssistantPlanRequest/Response`, `AssistantMessage`, error/result explain types |
| `app/src/lib/assistant/ruleBasedAssistantRuntime.ts` | Rule-based runtime adapter wrapping `generateMockAnalysisPlan()` |
| `app/src/lib/assistant/getAssistantRuntime.ts` | Factory returning active runtime (currently rule-based) |
| `app/src/lib/assistant/toolRegistry.ts` | Safe tool registry with 8 tool definitions, confirmation rules, side-effect levels |
| `app/src/lib/assistant/hermesAssistantRuntime.ts` | Future placeholder (throws "not implemented") |
| `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md` | Runtime architecture design doc |

## Files Modified

| File | Description |
|------|-------------|
| `app/src/pages/AIWorkspace.tsx` | Replaced direct `generateMockAnalysisPlan` calls with `getAssistantRuntime().generateAnalysisPlan()`; added try/catch error handling |

---

## Runtime Architecture

```
AIWorkspace
  → getAssistantRuntime() → AssistantRuntime (interface)
    → ruleBasedAssistantRuntime  (now)
    → hermesAssistantRuntime     (future)
```

### Key Types

- `AssistantRuntimeMode`: `"rule_based" | "hermes" | "llm"`
- `AssistantContext`: datasets, confirmed relationships, selected dataset ID
- `AssistantPlanRequest`: question + context
- `AssistantPlanResponse`: plan + runtime mode + warnings

### Tool Registry

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

**Safety rule**: `execute`/`write` tools require explicit user confirmation.

---

## AIWorkspace Refactor

### Before

```ts
import { generateMockAnalysisPlan } from '@/lib/assistant/analysisPlannerMock';

const plan = generateMockAnalysisPlan({
  question,
  datasets: [...],
  confirmedRelationships: [...],
});
```

### After

```ts
import { getAssistantRuntime } from '@/lib/assistant/getAssistantRuntime';

const runtime = getAssistantRuntime();
const response = await runtime.generateAnalysisPlan({
  question,
  context: {
    selected_dataset_ids: [...],
    selected_dataset_id: ...,
    confirmed_relationships: [...],
    datasets: [...],
  },
});

// response.plan, response.runtime_mode, response.warnings
```

### Error Handling

Both `generatePlanForQuestion` and `handleGeneratePlan` now have try/catch:
- Chat errors show an assistant error message
- Plan panel errors log to console and clear loading state

---

## Design Doc

`docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md` covers:
- Why runtime abstraction is needed
- Current rule-based runtime
- Future Hermes runtime path
- Safe tool registry and confirmation rules
- AIWorkspace stability contract
- File map

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 19.34s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | AI Workbench opens normally | ✅ |
| 2 | 对话 tab generates analysis plans | ✅ |
| 3 | Sample question chips still work | ✅ |
| 4 | 生成分析计划 capability still works | ✅ |
| 5 | 理清表关系 still works | ✅ |
| 6 | Confirmed relationships appear in plans | ✅ |
| 7 | No Hermes/LLM network call | ✅ |
| 8 | No chat endpoint called | ✅ |
| 9 | No automatic analysis execution | ✅ |
| 10 | No join/SQL/dataset creation | ✅ |
| 11 | Navigation actions close/minimize workbench | ✅ |
| 12 | Top/bottom layout scroll works | ✅ |
| 13 | No SmartAnalysis files changed | ✅ |
| 14 | No console errors | ⏸️ Runtime not tested |

---

## Known Limitations

- `hermesAssistantRuntime` is a placeholder; throws on use
- `explainError` and `explainResult` are optional interface methods, not implemented
- Only `generateAnalysisPlan` is wired into AIWorkspace
- Tool registry is a contract; no UI consumes it yet

---

## Next Recommended Phase

**4B-8B**: Hermes Backend Adapter — Implement backend endpoint and wire `hermesAssistantRuntime` to it.
