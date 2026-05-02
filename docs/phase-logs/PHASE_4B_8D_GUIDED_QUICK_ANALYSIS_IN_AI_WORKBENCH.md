# Phase 4B-8D: Guided Quick Analysis in AI Workbench

## Objective

Migrate the useful "guided quick analysis" idea from the legacy SmartAnalysis page into AI Workbench as a clean, real, Agent-compatible capability.

- Do **not** restore or modify SmartAnalysis.
- Do **not** implement fake diagnosis, fake preprocessing, or fake analysis results.
- Add a new AI Workbench capability card: **快速分析向导**.

## Files Inspected

| File | Purpose |
|---|---|
| `app/src/pages/AIWorkspace.tsx` | AI Workbench shell — capability cards, panel routing, dataset state |
| `app/src/components/assistant/AnalysisPlanCard.tsx` | Structured plan rendering with navigation actions |
| `app/src/components/assistant/DatasetUnderstandingCard.tsx` | Full dataset profile UI (reference for compact summary) |
| `app/src/lib/assistant/getAssistantRuntime.ts` | Factory returning current runtime |
| `app/src/lib/assistant/assistantRuntime.ts` | Runtime interface and context types |
| `app/src/lib/assistant/ruleBasedAssistantRuntime.ts` | Rule-based runtime wrapping mock planner |
| `app/src/api/assistant.ts` | `assistantApi.profileDataset()` and `inferRelationships()` |
| `app/src/types/assistant.ts` | `DatasetProfile`, `TableRelationship`, `AssistantAnalysisPlan` |

## Files Created

| File | Description |
|---|---|
| `app/src/components/assistant/GuidedQuickAnalysisPanel.tsx` | 3-step guided flow component |

## Files Modified

| File | Changes |
|---|---|
| `app/src/pages/AIWorkspace.tsx` | Add `Zap` import; add `showQuickAnalysisPanel` state; add `GuidedQuickAnalysisPanel` rendering branch; add 快速分析向导 capability card under 通用能力 |

## Flow Design

### Step 1 — Select Dataset

- Displays available datasets as selectable cards (name, row count, column count).
- Allows selecting one dataset.
- If `defaultDatasetId` exists (from AI Workbench dropdown), preselects it.
- Button: **下一步：理解数据** (disabled until selection).

### Step 2 — Understand Dataset

- On entering step 2, calls `assistantApi.profileDataset(datasetId)`.
- Shows loading spinner: "正在理解数据结构..."
- Shows compact summary card containing:
  - Table type badge (e.g., 订单事实表 / 事件日志表)
  - Row/column count + classification confidence
  - Key fields (up to 5 priority role-matched columns)
  - Recommended analyses from `TableClassification`
  - Quality warnings (or green "暂无明显数据质量风险")
- Button: **下一步：生成分析计划** (disabled until profile loads).

### Step 3 — Generate Plan

- Offers 6 goal chips:
  - 我想了解整体数据情况
  - 我想分析转化路径
  - 我想预测未来趋势
  - 我想分析渠道贡献
  - 我想处理缺失和异常
  - 我想分析评论文本
- Also allows custom question input.
- When user clicks **生成计划**:
  ```ts
  const runtime = getAssistantRuntime();
  await runtime.generateAnalysisPlan({
    question,
    context: {
      selected_dataset_id: datasetId,
      selected_dataset_ids: [datasetId],
      confirmed_relationships: confirmedRelationships ?? [],
      datasets: [selectedDataset],
      dataset_profiles: [profile],
    },
  });
  ```
- Renders `AnalysisPlanCard` with `onNavigate` that dispatches `companion-navigate` + closes workbench.
- Safety notice banner:
  > 当前向导只生成分析路径建议，不会自动运行分析、不会修改数据，也不会创建新数据集。当前为规则型分析向导，未来可接入 Hermes/LLM 提供更强的自然语言理解。

## Real APIs Used

| API | Purpose | Read-only? |
|---|---|---|
| `assistantApi.profileDataset(datasetId)` | Get `DatasetProfile` (table type, column roles, quality warnings) | ✅ Yes |
| `getAssistantRuntime().generateAnalysisPlan(...)` | Generate structured `AssistantAnalysisPlan` | ✅ Yes (rule-based, no execution) |

## SmartAnalysis Legacy Pitfalls Avoided

| Legacy Pitfall | How Avoided |
|---|---|
| Fake quality diagnosis numbers | Uses real `profileDataset` API; no mock numbers |
| Fake preprocessing results | No preprocessing step in the flow |
| Fake clustering results | No clustering recommendation; planner navigates to real analysis pages |
| Fake forecast/attribution results | No inline result rendering; plan navigates to existing pages |
| `window.location.href` hard refresh | Uses `companion-navigate` event + `onClose()` |
| Standalone clustering page mapping | Planner maps to `/app/path` for path analysis |
| Inline custom result rendering | Uses `AnalysisPlanCard` → navigation only |

## Validation Results

```bash
cd app
npx tsc --noEmit        # 0 errors ✅
npm run build           # built in 16.72s ✅
```

## Manual QA Checklist

- [ ] SmartAnalysis remains hidden from sidebar.
- [x] AI Workbench opens normally.
- [x] 能力 tab shows 快速分析向导.
- [x] 快速分析向导 is visible without selected dataset.
- [x] User can select dataset inside the wizard.
- [x] Dataset profile loads via `assistantApi.profileDataset`.
- [x] Compact profile summary renders (table type, key fields, recommended analyses, warnings).
- [x] No mock diagnosis/preprocessing numbers appear.
- [x] User can select a goal chip.
- [x] User can type custom question.
- [x] Generate plan calls `AssistantRuntime`, not direct mock function.
- [x] `AnalysisPlanCard` renders.
- [x] Navigation actions close/minimize AI Workbench.
- [x] No backend analysis executes automatically.
- [x] No join/SQL/dataset creation occurs.
- [x] `RelationshipReviewPanel` still works.
- [x] 生成分析计划 still works.
- [x] Top/bottom layout scroll still works.
- [x] No console errors.

## Known Limitations

- `DatasetProfile` availability depends on backend `/assistant/profile-dataset` endpoint.
- If endpoint fails, user sees error message and cannot proceed to step 3 for that dataset.
- Rule-based planner keywords are deterministic; novel phrasing may fall back to "描述统计".
- Navigation does not yet prefill analysis page config (future phase).

## Next Recommended Phase

1. **Prefill navigation payload** — When user clicks plan navigation, pass selected dataset ID and suggested column mappings to the target analysis page via URL query params or shared state.
2. **Hermes runtime integration** — Implement `hermesAssistantRuntime` that calls backend Hermes Agent for natural language understanding and plan generation.
3. **SmartAnalysis deletion** — Once guided flow is proven stable and all useful concepts are migrated, delete the legacy `SmartAnalysis.tsx` page and its route.
