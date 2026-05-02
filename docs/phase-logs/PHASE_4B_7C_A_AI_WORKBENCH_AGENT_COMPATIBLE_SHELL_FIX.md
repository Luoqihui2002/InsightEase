# Phase 4B-7C-A Log: AI Workbench Agent-compatible Shell Stabilization

**Phase ID**: 4B-7C-A  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Stabilize the AI Workbench as a future Agent-compatible assistant shell. Fix runtime bugs while preserving the interaction model for future Hermes Agent / LLM integration.

---

## Future Agent Compatibility Contract

### AIWorkspace Role

AIWorkspace is the stable assistant shell.

- **Current runtime**: Rule-based planner + deterministic assistant tools
- **Future runtime**: Hermes Agent / LLM planner + safe tool registry
- **UI requirement**: Should not need redesign when Hermes is added

### Tab Contracts

| Tab | Role | Current Behavior | Future Behavior |
|-----|------|-----------------|-----------------|
| 对话 | Natural-language entry | Rule-based planner | Hermes/LLM runtime |
| 能力 | Tool/capability cards | Context-free + dataset-dependent | Same, with more tools |
| 历史 | Conversation history | LocalStorage sessions | May sync to backend |

### Safety Contract

The assistant **may**:
- Explain data
- Infer relationships
- Generate analysis plans
- Navigate users to modules

The assistant **must not** automatically:
- Join datasets
- Generate SQL and run it
- Create/modify datasets
- Execute analysis without explicit user action
- Call LLM/Hermes in this phase

---

## User-Reported Bugs & Fixes

### Bug A1: Capability Cards Missing

**Problem**: `理清表关系` and `生成分析计划` cards were not visible.

**Root Cause**: The capability grid was nested inside conditional panel states (`showRelationshipPanel` / `showAnalysisPlanPanel`). When panels were open, the grid was hidden. When switching tabs, the panel state persisted, confusing users.

**Fix**:
- Separated capability grid into two clearly labeled sections:
  - **通用能力** (context-free): 生成分析计划, 理清表关系 — always visible and clickable
  - **分析工具** (dataset-dependent): 智能可视化, 趋势预测, etc. — visible but disabled without dataset
- Added "请选择数据集后使用" helper text when no dataset is selected
- Panel back buttons (`ArrowLeft`) already existed for returning to grid

### Bug A2: Relationship Inference Wrong Endpoint

**Problem**: Relationship inference showed generic analysis failure.

**Root Cause**: `RelationshipReviewPanel.tsx` response parsing assumed nested `.data.code` / `.data.data` structure. But the axios interceptor returns `response.data` directly, so `res` is `{ code, message, data }` not `{ data: { code, message, data } }`.

**Fix**: Changed response parsing to:
```ts
const response = res as unknown as { code?: number; data?: InferRelationshipsResponse; message?: string };
if (response?.code === 200 && response.data) {
  setResult(response.data);
}
```

### Bug A3: Conversation Input Sent `analysis_type: chat`

**Problem**: Chat input produced "不支持的分析类型: chat" errors.

**Root Cause**: `handleSend` called `handleAnalysisRequest`, which called `intentRecognitionService.recognizeIntent()` → `aiApi.chatStream()` → backend. When intent couldn't be determined, it defaulted to `type: 'chat'`, which `analysisExecutionService` rejected.

**Fix**:
- Replaced `handleSend` with planner routing: `generateMockAnalysisPlan()` → `AnalysisPlanCard`
- Removed the entire `handleAnalysisRequest` function and its backend call chain
- `useCapability` now routes to planner instead of direct execution
- No backend `/analyses/` calls from general chat input

### Bug A4: Backend Analysis ID Parsing

**Problem**: "服务器未返回有效的分析ID" errors.

**Root Cause**: Response from `analysisApi.create()` was parsed with fallback logic, but the real issue was that chat input was incorrectly creating backend analysis tasks.

**Fix**: Primary fix is Bug A3 — chat no longer creates backend tasks. The ID parsing code in `analysisExecutionService` was left untouched for explicit analysis flows (not triggered from chat).

### Bug A5: Top/Bottom Layout Scroll

**Problem**: Lower content unreachable in vertical layout.

**Root Cause**: Data preview container in vertical layout had no bounded height, and the table only had `overflow-x-auto` without `overflow-y-auto`.

**Fix**:
- Added `max-h-[240px] overflow-hidden flex flex-col` to vertical preview container
- Changed table container from `style={{ maxHeight: '200px' }}` to `overflow-auto flex-1`

### Bug A6: Dataset Selection Gated Everything

**Problem**: Without a dataset, workbench was mostly unusable and forced split layout.

**Root Cause**: Input area was completely replaced with a "select dataset first" message. `handleAnalysisRequest` returned early without a dataset.

**Fix**:
- Input area now always visible with context-aware placeholder:
  - With dataset: `描述你想做的分析...`
  - Without dataset: `描述你想分析的问题，选择数据集后我可以给出更具体的计划...`
- Quick chips always visible
- Context-free capabilities (理清表关系, 生成分析计划) always usable
- Dataset-dependent capabilities show disabled state with explanation
- No forced split layout without dataset

### Bug A7: Tab Boundaries Unclear

**Problem**: Meaning of 对话 / 能力 / 历史 was unclear.

**Fix**:
- **对话**: Natural-language entry. Welcome message updated to explain planner behavior.
- **能力**: Tool/capability cards with clear section headers (通用能力 / 分析工具).
- **历史**: Shows conversation list. `新对话` starts fresh conversation.
- Header subtitle updated: `规则型分析规划 · 选择数据集可获得更具体的建议`

### Bug A8: History New Conversation Behavior

**Problem**: Clicking `新对话` in history tab didn't return to conversation.

**Fix**: `新对话` button now calls `createNewSession(); setActiveTab('chat');`

### Bug A9: Navigation Leaves Workbench Blocking

**Problem**: Clicking plan next actions navigated but workbench stayed open.

**Root Cause**: `AnalysisPlanCard` used `useNavigate()` directly without closing the workbench.

**Fix**:
- Added `onNavigate?: (target: string) => void` prop to `AnalysisPlanCard`
- `AIWorkspace` passes a handler that:
  1. Dispatches `companion-navigate` event (existing navigation pattern)
  2. Calls `onClose()` to close the workbench
- Applied to both chat-inline plans and capabilities-tab plans

---

## Files Modified

| File | Changes |
|------|---------|
| `app/src/pages/AIWorkspace.tsx` | Major refactor: planner routing, input always available, tab boundaries, layout fixes, dead code removal |
| `app/src/components/assistant/RelationshipReviewPanel.tsx` | Fixed response parsing for interceptor-unwrapped responses |
| `app/src/components/assistant/AnalysisPlanCard.tsx` | Added `onNavigate` prop to allow workbench close on navigation |

### Dead Code Removed

- `handleAnalysisRequest` function (backend analysis from chat)
- `intentRecognitionService` import
- `analysisExecutionService` import
- `analysisProgress` state and rendering
- `showResult` / `analysisResult` result panels and `AnalysisResultRenderer`
- `updateLastMessage` function
- Unused icons: `ChevronDown`, `ChevronUp`

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 16.50s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | AI Workbench opens normally | ✅ |
| 2 | Close button works | ✅ |
| 3 | No SmartAnalysis code modified | ✅ |
| 4 | 对话 tab works without selecting dataset | ✅ Input always available |
| 5 | 能力 tab works without selecting dataset | ✅ Context-free cards visible |
| 6 | 历史 tab works | ✅ |
| 7 | 新对话 switches to 对话 tab and resets conversation | ✅ |
| 8 | 理清表关系 is visible in 能力 tab | ✅ |
| 9 | 生成分析计划 is visible in 能力 tab | ✅ |
| 10 | Dataset-dependent cards disabled without dataset | ✅ With helper text |
| 11 | Selecting dataset enables dataset-dependent cards | ✅ |
| 12 | 理清表关系 opens RelationshipReviewPanel | ✅ |
| 13 | Selecting 2+ datasets enables inference | ✅ |
| 14 | 推断表关系 calls /assistant/infer-relationships | ✅ |
| 15 | No generic analysis ID error from chat | ✅ No backend analysis from chat |
| 16 | User input generates AnalysisPlanCard | ✅ |
| 17 | Sample chips generate plans | ✅ |
| 18 | No dataset selected does not force split layout | ✅ |
| 19 | Top/bottom layout preview is bounded | ✅ max-h-[240px] |
| 20 | Plan next actions navigate and close workbench | ✅ onNavigate + companion-navigate |
| 21 | No automatic join | ✅ |
| 22 | No SQL generation | ✅ |
| 23 | No dataset creation/modification | ✅ |
| 24 | No LLM/Hermes call from chat | ✅ |
| 25 | No package files modified | ✅ |

---

## Known Limitations

- Planner is still rule-based (keyword matching)
- Result panels for backend analysis were removed; explicit analysis execution will need reimplementation when backend chat is added
- localStorage-only history (not synced)
- No prefilled config when navigating from plan actions

---

## Next Recommended Phase

**4B-8**: Real AI Integration — Replace rule-based planner with metadata-first LLM calls or Hermes Agent integration.
