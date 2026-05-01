# Phase 4B-3C: AI Assistant / AI Workbench UX Audit

**Date**: 2026-04-28  
**Scope**: Frontend assistant components, interaction flows, state models  
**Method**: Static code review + flow tracing + design-doc gap analysis  
**Constraint**: Audit-only; no source modifications in this phase.

---

## 1. Executive Summary

The InsightEase AI assistant layer currently consists of **5 distinct subsystems** that overlap in purpose but do not share state or a unified UX model. Several components contain substantial dead code, mock data, or unused backend endpoints. The user experience is fragmented: a user can encounter up to **three different "AI assistant" surfaces** (full-screen workbench, sidebar chat panel, floating companion) with no visual or functional coherence between them.

**Top-line recommendation**: Consolidate to a single primary assistant surface (AI Workbench), remove dead code, replace mock data with real API calls or clear placeholder UI, and implement the pre-fill navigation strategy described in the 4B-1 design document.

---

## 2. Component Inventory

| # | File | Lines | Purpose | Live/Dead | Issues |
|---|------|-------|---------|-----------|--------|
| 1 | `pages/AIWorkspace.tsx` | 953 | Full-screen modal workbench (chat + analysis + preview) | **Live** | 7 |
| 2 | `components/AIAssistant.tsx` | 251 | Right-side slide-in chat panel | **Dead** — never imported | 4 |
| 3 | `components/AICompanion.tsx` | 221 | Floating draggable avatar + bubble | **Live** | 5 |
| 4 | `services/companion-service.ts` | 409 | Trigger-based proactive messaging engine | **Live** | 4 |
| 5 | `services/intent-recognition.service.ts` | 459 | NL → analysis type mapping | **Live** | 5 |
| 6 | `services/analysis-execution.service.ts` | 648 | Analysis task creation + polling | **Live** | 4 |
| 7 | `components/assistant/DatasetUnderstandingCard.tsx` | 497 | Dataset profile display | **Live** | 3 |
| 8 | `pages/SmartAnalysis.tsx` | 903 | Wizard-style analysis guide page | **Live** | 6 |
| 9 | `components/KimiAvatar.tsx` | 105 | Branded avatar component | **Live** | 2 |
| 10 | `api/ai.ts` | 64 | SSE chat stream client | **Live** (only via intent service) | 1 |
| 11 | `hooks/useCompanion.ts` | 59 | Companion state hook | **Live** | 0 |
| 12 | `services/assistant_profile_service.py` | ~300 | Backend dataset profiler | **Live** | 0 |
| 13 | `api/v1/endpoints/assistant.py` | ~60 | Backend profiling endpoint | **Live** | 0 |
| 14 | `api/v1/endpoints/ai.py` | 170 | Backend AI endpoints | **Live** (50% unused) | 3 |
| 15 | `services/ai_service.py` | 358 | Kimi/OpenAI wrapper | **Live** (only chat_stream used) | 2 |

---

## 3. Interaction Flow Map

### 3.1 Current Entry Points

```
┌─────────────────────────────────────────────────────────────────┐
│                        AppLayout                                │
├─────────────────────────────────────────────────────────────────┤
│  Sidebar ──► "AI 工作台" button ──► AIWorkspace (modal overlay) │
│                           ▲                                     │
│                           │ (companion-action: open-chat)       │
│  AICompanion (floating) ──┘                                     │
│     ├── double-click ──► open-chat event                        │
│     └── suggestions ──► hardcoded page jumps (window.location)  │
├─────────────────────────────────────────────────────────────────┤
│  Route: /app/ai-workspace ──► AIWorkspace (standalone)          │
│  Route: /app/smart-analysis ──► SmartAnalysis (wizard page)     │
├─────────────────────────────────────────────────────────────────┤
│  Datasets page ──► detail dialog ──► DatasetUnderstandingCard   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 AIWorkspace Internal Flow

```
User input
    │
    ▼
┌──────────────┐    ┌─────────────────────────────┐
│ handleSend() │───►│ updateCurrentSession()        │
└──────────────┘    │ (adds user msg to history)    │
                    └─────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────┐
                    │ handleAnalysisRequest()       │
                    │   1. intentRecognitionService   │
                    │      .recognizeIntent()        │
                    │        ├── quickMatch (local)  │
                    │        └── fallback: aiApi     │
                    │            .chatStream()       │
                    │   2. analysisExecutionService   │
                    │      .executeByIntent()        │
                    │        ├── analysisApi.create()│
                    │        └── pollTaskStatus()    │
                    └─────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────┐
                    │ addMessage() / updateLastMsg()│
                    │ showResult + AnalysisResult   │
                    │   Renderer in bottom panel    │
                    └─────────────────────────────┘
```

### 3.3 State Model

```
AppLayout
├── isAIAssistantOpen: boolean          # controls AIWorkspace overlay
│
AIWorkspace (per instance)
├── messages: Message[]                  # chat history (welcome + exchanges)
├── currentSessionId: string             # localStorage session key
├── chatHistory: ChatSession[]           # persisted in localStorage
├── selectedDataset: string | null       # active dataset for analysis
├── datasetPreview: { columns, rows }    # static 5-row preview
├── analysisResult: ExecutionResult | null
├── showResult: boolean                  # toggle result panel
├── activeTab: 'chat' | 'capabilities' | 'history'
├── mainLayout: 'vertical' | 'horizontal'
└── analysisProgress: { status, progress } | null

AICompanion (singleton via companion-service)
├── state.visible: boolean               # bubble visibility
├── state.mood: 'idle' | 'thinking' | 'happy' | 'tip'
├── state.message: string                # current bubble text
├── state.suggestions: Suggestion[]      # action buttons
├── userContext.page: string             # current page name
├── userContext.hasData: boolean
├── userContext.idleTime: number         # ms since last activity
└── userContext.visitCount: number       # from localStorage

SmartAnalysis (page-level)
├── currentStep: 'select' | 'diagnose' | 'preprocess' | 'analyze' | 'result'
├── selectedDataset: string
├── diagnosisResult: DiagnosisResult | null   # SIMULATED
├── preprocessResult: any | null              # SIMULATED
├── recommendations: AnalysisRecommendation[] # heuristic
├── analysisResult: any | null                # partial real (stats only)
└── isDiagnosing / isPreprocessing / isAnalyzing: boolean

DatasetUnderstandingCard (per dataset dialog)
├── profile: DatasetProfile | null
├── loading: boolean
├── error: string
└── showAllColumns: boolean
```

---

## 4. UX Problems (Ranked by Severity)

### 🔴 Critical — Breaks User Trust or Functionality

#### C1. Dead Code: `AIAssistant.tsx` (251 lines, 0 references)
The `AIAssistant` component is a complete right-side chat panel implementation that is **never imported by any file**. It duplicates ~70% of AIWorkspace's chat logic. It creates maintenance burden and confuses developers about which component is canonical.

**Evidence**: `grep -r "AIAssistant" app/src/` returns only the file itself and interface definitions within it. No `import { AIAssistant }` exists.

**Impact**: Developers may edit the wrong file; bundle includes unreachable code.

#### C2. SmartAnalysis Page is Mostly Simulated
The "智能分析向导" page (`SmartAnalysis.tsx`) presents a 5-step wizard that appears to perform real analysis, but:
- **Diagnosis** (`runDiagnosis`) is a `setTimeout` mock using synthetic issue counts.
- **Preprocessing** (`handlePreprocess`) is a `setTimeout` mock with hardcoded numbers.
- **Non-statistics analyses** (`handleRunAnalysis`) are simulated with fake summaries.
- Only **statistics** calls the real `analysisApi.create()` endpoint.

**Impact**: Users believe they are running real analysis when they are seeing synthetic data. This erodes trust when real analysis eventually returns different results.

#### C3. Three Uncoordinated Assistant Surfaces
Users encounter AI assistance through:
1. **AI Workbench** (modal overlay) — chat-driven analysis
2. **Smart Analysis page** (/app/smart-analysis) — wizard-driven analysis
3. **AI Companion** (floating avatar) — proactive tips

These three surfaces do not share:
- Chat history
- Selected dataset context
- Analysis results
- Session state

A user can start an analysis in the Smart Analysis wizard, switch to the AI Workbench, and have zero context about what they just did.

#### C4. Backend AI Endpoints Completely Unused
The backend provides four AI endpoints in `ai.py`:
| Endpoint | Used By Frontend? |
|----------|-------------------|
| `POST /ai/interpret` | ❌ No |
| `POST /ai/suggestions` | ❌ No |
| `POST /ai/ask` | ❌ No |
| `POST /ai/chat` | ✅ Yes (only via intent-recognition service) |
| `GET /ai/status` | ❌ No |

~80% of the backend AI service surface area is unreachable from the frontend.

#### C5. Companion Actions Use Full Page Reloads
`companion-service.ts` line 345–356: all navigation actions use `window.location.href = '...'` instead of React Router `navigate()`. This causes:
- Full page reloads (losing React state)
- Flash of unstyled content
- Broken history stack

#### C6. AI Workbench General Chat is Disabled
In `AIWorkspace.tsx`, the `handleGeneralChat` function is entirely commented out (lines 357–376). The AI Workbench can **only** run structured analyses; it cannot answer general questions, explain concepts, or have free-form conversation — despite having a chat UI that suggests otherwise.

#### C7. No Pre-fill Navigation (Design Doc Gap)
The 4B-1 design document (Section 10) specifies that the assistant should generate `payload` objects to pre-fill analysis page configuration. **Zero analysis pages accept initial config** via query params or navigation state. The assistant can recommend "去归因分析" but cannot actually populate the Attribution page's fields.

---

### 🟠 High — Significant Friction or Risk

#### H1. Intent Recognition Sends Massive Prompts to LLM
`intent-recognition.service.ts` builds a prompt containing:
- Full dataset schema (all columns, types, sample values)
- Full list of all available datasets
- Large instruction block with all analysis types

This is sent to `aiApi.chatStream()` for **every user message**, even when `quickMatch()` already found a high-confidence match. The prompt can exceed 4K tokens for datasets with many columns.

**Suggested fix**: Use quickMatch result directly when score ≥ 2. Only call LLM when no keyword match or user request is ambiguous.

#### H2. Intent Recognition JSON Parsing is Brittle
`parseResult()` (line 389) uses regex extraction and raw `JSON.parse()` with no schema validation. If the LLM returns malformed JSON (e.g., trailing commas, unescaped quotes, markdown outside code blocks), the entire user request fails.

**Suggested fix**: Use Zod or similar for runtime validation; provide a robust fallback.

#### H3. DatasetUnderstandingCard is Buried
The card is rendered only inside the dataset detail dialog on the Datasets page. Users must:
1. Navigate to Datasets
2. Click a dataset row
3. Scroll past basic metadata and data preview
4. Then see "AI 数据理解"

There is no entry point from the dashboard, upload flow, or analysis pages.

#### H4. AI Workbench Closes on Background Click
Clicking the backdrop overlay closes the entire AIWorkspace, discarding:
- Unsent input text
- In-progress analysis state
- Chat context (though history is persisted)

There is no "Are you sure?" guard.

#### H5. Kimi Branding is Hardcoded Throughout
`KimiAvatar`, "Powered by Kimi", `companionService` references to Kimi — all assume a specific API provider. If the provider changes (e.g., to OpenAI, Claude, or a local model), the branding becomes incorrect.

#### H6. localStorage Chat History Has No Size Cap
`ai_workspace_sessions` and `insightease_companion` store unbounded data in localStorage. A heavy user could accumulate megabytes of chat history, hitting browser storage limits.

---

### 🟡 Medium — Noticeable but Not Blocking

#### M1. No Cancel Button During Analysis
The analysis progress bar (lines 788–801) shows status and percentage but offers no cancel action. The user must close the modal or wait for timeout (30 retries × 2–3s = up to 90s).

#### M2. Dataset Preview is Static (5 Rows, No Interaction)
The preview table in AIWorkspace shows only the first 5 rows with no scrolling, pagination, or search. For wide datasets, horizontal overflow is hidden.

#### M3. Capability Cards Show No Contextual Reasoning
The 6 capability cards (visualization, forecast, clustering, etc.) are generic. They do not adapt to the selected dataset's schema. A dataset with no datetime column still shows "趋势预测" with no warning.

#### M4. Companion Idle Timer Leaks Event Listeners
`companion-service.ts` lines 260–262 attach global event listeners (`mousedown`, `keydown`, `touchstart`, `scroll`) that are never removed. In a long-lived SPA session, this is minor, but it is technically a leak.

#### M5. Duplicate Welcome Message
`AIWorkspace.tsx` initializes `messages` with a welcome message (lines 76–84), and `createNewSession()` creates another welcome message (lines 183–189). The welcome text is duplicated inline.

---

## 5. Design Document (4B-1) vs. Implementation Gap

| Design Doc Requirement | Status | Gap |
|------------------------|--------|-----|
| G1: Understand datasets via DatasetProfile | ✅ Partial | Backend + card exist; card is hard to discover |
| G2: Classify tables | ✅ Done | `assistant_profile_service.py` implements this |
| G3: Summarize in natural language | ❌ Missing | No NL summary generated or displayed |
| G4: Detect PK/FK/time/metric columns | ✅ Partial | Roles detected but not surfaced as actionable hints |
| G5: Infer table relationships | ❌ Missing | No backend endpoint or UI |
| G6: Recommend analysis paths | ✅ Partial | `recommended_analyses` shown as tags, not clickable CTAs |
| G7: NL → structured analysis plan | ❌ Missing | Intent service exists but returns flat type, not `AssistantAnalysisPlan` |
| G8: Pre-fill analysis pages | ❌ Missing | No page accepts initial config |
| G9: Explain analysis results | ❌ Missing | `explain-result` endpoint not built; Result Explainer not implemented |
| Section 12: Right-side assistant panel | ❌ Missing | No `AssistantPanel` component; `AIAssistant.tsx` is dead |
| Section 12: Dataset context selector | ❌ Missing | AIWorkspace has a `<select>` but no multi-select |
| Section 12: "Apply to analysis page" CTA | ❌ Missing | No navigation with pre-fill |

---

## 6. Recommended Direction

### 6.1 Immediate (Next Sprint)

1. **Remove `AIAssistant.tsx`** — It is dead code. Extract any unique UX patterns (e.g., quick questions) into AIWorkspace if desired.

2. **Deprecate or Replace SmartAnalysis Mock Data**
   - Option A: Remove mock `setTimeout` flows; redirect users to AIWorkspace.
   - Option B: Keep the wizard but wire every step to real API calls.
   - **Recommended**: Option A. The chat-driven AIWorkspace is more aligned with the design doc's vision.

3. **Fix Companion Navigation**
   - Replace `window.location.href` with React Router `navigate()` or dispatch router-aware events.

4. **Add Click Guard to AIWorkspace Backdrop**
   - Either ignore backdrop clicks during analysis, or add a confirmation dialog.

### 6.2 Short-Term (Next 2–3 Sprints)

5. **Consolidate Assistant Surfaces**
   - Make AIWorkspace the single primary assistant entry point.
   - Retain AICompanion as an ambient trigger (entry point only), but have it open AIWorkspace instead of its own bubble.
   - Remove or redirect the `/app/smart-analysis` route.

6. **Implement Pre-fill Navigation**
   - Add query param support to all analysis pages (`/app/attribution?dataset_id=...&user_id_col=...`).
   - When the assistant recommends an analysis, generate a link with pre-filled params.
   - Hydrate page form state from URL on mount.

7. **Make DatasetUnderstandingCard Actionable**
   - Add "Open in [Analysis]" buttons next to each `recommended_analysis` tag.
   - Show the card on the Dashboard (recent datasets) and Upload success screen.

8. **Optimize Intent Recognition**
   - Skip LLM call when `quickMatch` score ≥ 2.
   - Add Zod validation for LLM JSON responses.
   - Cache intent results per dataset in session memory.

### 6.3 Medium-Term (Following Phase)

9. **Build `AssistantPanel` (Design Doc Section 12)**
   - Right-side collapsible panel that is always available on Dataset and Analysis pages.
   - Shows current dataset context, profile summary, and recommended next steps.
   - Reuses `DatasetUnderstandingCard` as its header section.

10. **Implement Result Explainer**
    - Backend endpoint: `POST /assistant/explain-result`.
    - Consumes `AnalysisResult` blocks + user question.
    - Returns natural-language explanation as structured blocks.
    - Renders inside AIWorkspace chat as assistant messages.

11. **Add Relationship Inference**
    - Backend endpoint: `POST /assistant/infer-relationships`.
    - Frontend: simplified join-key preview UI (row count, overlap %).
    - User confirms/rejects inferred relationships before use.

12. **Unbrand or Genericize AI Provider**
    - Rename `KimiAvatar` → `AIAvatar`.
    - Replace "Powered by Kimi" with dynamic string from `/ai/status` response.

---

## 7. Appendix: File Reference

### Frontend (app/src)
```
components/
  AIAssistant.tsx              ← DEAD CODE
  AICompanion.tsx              ← Live, needs nav fix
  KimiAvatar.tsx               ← Live, branding issue
  AppLayout.tsx                ← Mounts AIWorkspace + AICompanion
  AppSidebar.tsx               ← "AI 工作台" button
  AnalysisResultRenderer.tsx   ← Result rendering (shared)
  assistant/
    DatasetUnderstandingCard.tsx ← Live, needs discoverability
pages/
  AIWorkspace.tsx              ← Primary assistant surface
  SmartAnalysis.tsx            ← Mostly mock data
  Datasets.tsx                 ← Hosts DatasetUnderstandingCard
services/
  companion-service.ts         ← Trigger engine, mock AI content
  intent-recognition.service.ts ← LLM overuse, brittle parsing
  analysis-execution.service.ts ← Polling + result transform
api/
  ai.ts                        ← SSE chat client
  assistant.ts                 ← profile-dataset endpoint
```

### Backend (insightease-backend)
```
app/api/v1/endpoints/
  ai.py                        ← 4 endpoints, 1 used
  assistant.py                 ← profile-dataset, live
app/services/
  ai_service.py                ← Kimi wrapper, chat_stream only used
  assistant_profile_service.py ← Heuristic profiler, live
```

---

*Audit completed. No source modifications made.*
