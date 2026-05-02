# SmartAnalysis Legacy Page Audit

**Date**: 2026-04-28  
**Auditor**: Code Agent  
**Scope**: `app/src/pages/SmartAnalysis.tsx` and related navigation  
**Status**: Audit Complete — Recommendation: Hide + Migrate

---

## 1. Executive Summary

`SmartAnalysis` (`智能分析向导`) is a legacy wizard-style page that predates the 4A unified result architecture and the AI Workbench assistant shell. It simulates most of its functionality with `setTimeout`-based mocks, does not use the unified `ResultView` component, and its recommended analysis types overlap with both AI Workbench and dedicated analysis pages.

**Key finding**: The page is **not production-ready**. Diagnosis and preprocessing are entirely mock. Only `statistics` analysis calls the real backend; all other recommendations return fake results. Result rendering is custom inline code, not the 4A `ResultView`. Navigation uses `window.location.href` hard reloads.

**Recommendation**: **Hide from sidebar navigation** in the short term, then migrate useful guided-flow concepts into AI Workbench capabilities.

---

## 2. Source Inventory

### Files Involved

| File | Role | Lines |
|------|------|-------|
| `app/src/pages/SmartAnalysis.tsx` | Main page component | 906 |
| `app/src/App.tsx` | Route definition (`/app/smart-analysis`) | — |
| `app/src/components/AppSidebar.tsx` | Sidebar entry (`智能分析向导`) | — |
| `app/src/pages/Dashboard.tsx` | Dashboard shortcut button to `/app/smart-analysis` | — |
| `app/src/api/analysis.ts` | Backend analysis API (only used for `statistics`) | — |
| `app/src/components/DatasetSelector.tsx` | Dataset dropdown (shared) | — |

### APIs Called

| API | Used By | Real or Mock? |
|-----|---------|---------------|
| `datasetApi.getDetail()` | Step 1 (select) | Real |
| `analysisApi.create()` | Step 4 (analyze) — only for `statistics` | Real |
| `analysisApi.getResult()` | Result polling — only for `statistics` | Real |
| `runDiagnosis()` | Step 2 (diagnose) | **Mock** (`setTimeout` + fake data) |
| `handlePreprocess()` | Step 3 (preprocess) | **Mock** (`setTimeout` + fake data) |
| `handleRunAnalysis()` | Step 4 (analyze) — non-statistics types | **Mock** (`setTimeout` + fake summary) |

### Navigation Actions

| Button Label | Current Action | Target Route | Method | Issue |
|--------------|----------------|--------------|--------|-------|
| 去可视化 | `window.location.href = '/app/visualization'` | `/app/visualization` | Hard reload | Should use React Router |
| 查看历史 | `window.location.href = '/app/history'` | `/app/history` | Hard reload | Should use React Router |
| 查看详细报告 | `toast.info('请从左侧导航进入...')` | None | None | Does nothing useful |
| 继续其他分析 | Clears result, returns to diagnose | Same page | State change | OK |
| 重新开始 | `handleReset()` | Same page | State reset | OK |

---

## 3. Current Flow Audit

### 3.1 选择数据

- Uses `DatasetSelector` shared component
- Calls `datasetApi.getDetail()` to load dataset info
- Auto-triggers diagnosis on selection
- **OK**: Real API, shared component

### 3.2 质量诊断

- **Completely mock**. Code comment: `⚠️ 模拟诊断（尚未接入真实 AI 诊断后端，结果仅供演示）`
- Uses `setTimeout(1500)` then generates fake issues based on `quality_score`
- Displays `演示数据` badge
- **Overlap**: `DatasetUnderstandingCard` (4B-3) already provides real dataset profiling via `assistantApi.profileDataset()`
- **Verdict**: Legacy mock. Should be replaced by real `DatasetProfile` if retained.

### 3.3 预处理

- **Completely mock**. Code comment: `⚠️ 模拟预处理（尚未接入真实预处理后端，结果仅供演示）`
- Uses `setTimeout(3000)` with hardcoded numbers (`removedDuplicates: 23`, `filledMissing: 133`)
- Does NOT actually modify the dataset
- Displays `演示数据` badge
- **Overlap**: `DataWorkshop` (Phase 3) provides real backend preview + transform
- **Overlap**: `SmartProcess` page provides real data processing
- **Verdict**: Legacy mock. Fully duplicated by DataWorkshop.

### 3.4 智能分析推荐

- Rule-based heuristic (same pattern as AI Workbench planner, but simpler)
- Checks schema dtypes to recommend: preprocess, statistics, clustering, forecast, attribution
- **Statistics** runs real backend analysis (`analysisApi.create` with `analysis_type: 'descriptive'`)
- **All other types** are mock: `setTimeout(2000)` with fake `{ type, title, summary, ready }`
- **Overlap**: AI Workbench `AnalysisPlannerMock` (4B-7) already provides structured plan generation
- **Verdict**: Partially real for statistics only. Recommendations overlap with AI Workbench.

### 3.5 查看结果

- **Custom inline rendering**, NOT using `ResultView`
- For `statistics`: shows `total_rows`, `total_columns`, `column_stats` in custom cards
- For other types: shows only a summary text + "查看详细报告" button that does nothing
- CSV export is custom inline code (not using shared export utilities)
- **Verdict**: Does not follow 4A result architecture. All other analysis pages use `ResultView`.

---

## 4. 4A Refit Compliance Audit

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Uses `ResultView` | ❌ **Not compliant** | No import. Custom inline rendering only. |
| Uses `AnalysisResult` schema | ❌ **Not compliant** | Uses `any`-typed local state (`useState<any>`). |
| Uses `ResultTableRenderer` | ❌ **Not compliant** | Custom inline table logic for CSV export only. |
| Uses `ResultChartRenderer` / `BaseEChart` | ❌ **Not compliant** | No charts rendered inline. |
| Uses adapters under `lib/adapters` | ❌ **Not compliant** | No adapter usage. |
| Avoids page-level custom chart logic | ✅ **Compliant** (by absence) | Doesn't render charts at all. |
| Avoids old placeholder/mock blocks | ❌ **Not compliant** | Diagnosis, preprocess, and most analysis are mock. |
| Shows results directly in page | ✅ **Partially compliant** | Statistics results show inline; others show summary only. |
| Loading/error/empty states consistent | ⚠️ **Partially compliant** | Uses `Loader2` spinners but inconsistent empty states. |

**Comparison**: All other analysis pages (Attribution, Forecast, Statistics, Semantic, PathAnalysis) import and use `ResultView`. SmartAnalysis is the **only** analysis page that does not.

---

## 5. Route and Navigation Audit

### Route Definition

```tsx
// App.tsx
<Route path="smart-analysis" element={<ErrorBoundary><SmartAnalysis /></ErrorBoundary>} />
```

### Sidebar Entry

```tsx
// AppSidebar.tsx
category: '智能分析'
{ path: '/app/smart-analysis', label: '智能分析向导', icon: Brain }
```

### Dashboard Shortcut

```tsx
// Dashboard.tsx
<button onClick={() => navigate('/app/smart-analysis')}>
  智能分析 — AI 驱动的数据分析
</button>
```

### Navigation Issues

| Issue | Location | Detail |
|-------|----------|--------|
| Hard reload | Result step | `window.location.href = '/app/visualization'` causes full page reload |
| Hard reload | Result step | `window.location.href = '/app/history'` causes full page reload |
| No-op button | Result step | "查看详细报告" shows toast but navigates nowhere |
| No React Router | Result step | Should use `useNavigate()` or `companion-navigate` event |

---

## 6. Analysis Type Mapping Audit

| SmartAnalysis Label | Internal Type | Backend Type | Target Page | Real Page Exists? | Inline Result? |
|---------------------|---------------|--------------|-------------|-------------------|----------------|
| 数据预处理 | `preprocess` | N/A | N/A | ❌ No standalone | N/A (mock) |
| 统计分析 | `statistics` | `descriptive` | `/app/statistics` | ✅ Yes | ✅ Yes (real data) |
| 聚类分析 | `clustering` | N/A | N/A | ❌ **No standalone** | ❌ No (mock summary only) |
| 趋势预测 | `forecast` | N/A | `/app/forecast` | ✅ Yes | ❌ No (mock summary only) |
| 归因分析 | `attribution` | N/A | `/app/attribution` | ✅ Yes | ❌ No (mock summary only) |

### Critical Issue: Clustering

- SmartAnalysis recommends **聚类分析** as a standalone analysis
- There is **no `/app/clustering` route** or standalone clustering page
- Clustering exists only as a sub-mode inside **PathAnalysis** (路径聚类)
- Clicking "开始分析" for clustering returns a mock result with no real data
- **User impact**: Users may be confused why clustering has no detailed result page

---

## 7. Product Role Assessment

### SmartAnalysis Capabilities vs. Other Modules

| SmartAnalysis Capability | Owned By | Overlap? |
|--------------------------|----------|----------|
| Dataset selection | All pages | Minor |
| Quality diagnosis | DatasetUnderstandingCard (4B-3) | **High** — real profile vs mock diagnosis |
| Preprocessing | DataWorkshop (Phase 3), SmartProcess | **High** — real transform vs mock |
| Analysis recommendation | AI Workbench planner (4B-7) | **High** — structured plan vs simple heuristic |
| Run statistics | Statistics page | **Medium** — wizard vs direct page |
| Result viewing | ResultView (4A) | **High** — custom inline vs unified architecture |
| History tracking | History page, AI Workbench history | **Medium** |
| Export CSV | Shared export utilities | **Medium** — custom inline vs shared |

### AI Workbench Comparison

| Capability | AI Workbench | SmartAnalysis |
|------------|--------------|---------------|
| Natural-language planning | ✅ Real planner | ❌ No |
| Relationship inference | ✅ Real API | ❌ No |
| Confirmed context | ✅ Context store | ❌ No |
| Runtime abstraction | ✅ AssistantRuntime | ❌ No |
| Structured plan card | ✅ AnalysisPlanCard | ❌ Simple recommendation list |
| Navigation to modules | ✅ `companion-navigate` | ❌ `window.location.href` |
| Error handling | ✅ Try/catch | ⚠️ Basic toast |
| Dataset profile | ✅ `profileDataset` | ❌ Mock diagnosis |
| Preprocessing | ✅ Can navigate to DataWorkshop | ❌ Mock preprocess |

**Conclusion**: SmartAnalysis is **mostly subsumed** by AI Workbench + dedicated analysis pages. Its only unique value is the **wizard-style guided flow** for beginners.

---

## 8. Decision Options

### Option A — Keep as-is and patch bugs

| Aspect | Assessment |
|--------|------------|
| Pros | Minimal short-term work |
| Cons | Mock data damages product credibility; route bugs persist; no 4A compliance |
| Risks | Users encounter fake results; white screens from hard reloads; clustering confusion |
| Complexity | Low effort, but high reputational risk |
| **Recommendation** | ❌ **Not recommended** |

### Option B — Rename to "快速分析向导" and refit

| Aspect | Assessment |
|--------|------------|
| Role | Simple guided launcher for beginners |
| Required refit | Remove mock diagnosis/preprocess; use `ResultView`; fix routes; disable clustering; inline only real statistics |
| Pros | Keeps guided flow; could be useful for new users |
| Cons | Still overlaps with AI Workbench; significant refit work for marginal value |
| Complexity | Medium (2–3 days) |
| **Recommendation** | ⚠️ **Possible, but low priority** |

### Option C — Merge into AI Workbench

| Aspect | Assessment |
|--------|------------|
| Role | Add "快速分析向导" as an AI Workbench capability card |
| Migration | Quality diagnosis → `DatasetUnderstandingCard`; Preprocessing → DataWorkshop nav; Recommendation → existing planner; Result → navigate to dedicated page with ResultView |
| Pros | Centralizes assistant experience; no orphaned page; consistent with future Agent model |
| Cons | Loses dedicated wizard page; some users may prefer standalone wizard |
| Complexity | Medium (2–3 days) |
| **Recommendation** | ✅ **Preferred long-term** |

### Option D — Hide from sidebar temporarily

| Aspect | Assessment |
|--------|------------|
| Role | Remove public entry point; keep code for future migration |
| Pros | Immediate product polish; no broken user experience; preserves code for Option C |
| Cons | Loses discoverability; users who bookmarked URL can still access |
| Complexity | Very low (30 minutes) |
| **Recommendation** | ✅ **Recommended short-term** |

### Option E — Delete later

| Aspect | Assessment |
|--------|------------|
| Role | Long-term cleanup after full migration to AI Workbench |
| Pros | Clean codebase |
| Cons | Irreversible; should only delete after migration is proven |
| Complexity | Low |
| **Recommendation** | ✅ **Recommended long-term, after Option C** |

---

## 9. Recommendation

### Primary Recommendation: Option D + C + E (staged)

**Short-term (this week)**: **Hide SmartAnalysis from sidebar**
- Remove `AppSidebar.tsx` entry for `智能分析向导`
- Remove or de-emphasize Dashboard shortcut button
- Keep route accessible for direct URL access
- Add code comment marking page as deprecated

**Medium-term (next 1–2 phases)**: **Migrate guided flow into AI Workbench**
- Add "快速分析向导" capability card in AI Workbench
- Reuse real APIs: `profileDataset`, `analysisPlannerMock`
- Navigate to dedicated analysis pages for real execution
- Use `ResultView` on target pages (already implemented)

**Long-term (after migration proven)**: **Delete SmartAnalysis page**
- Remove `SmartAnalysis.tsx`
- Remove route from `App.tsx`
- Remove Dashboard shortcut
- Archive audit document

### Rationale

1. **Product credibility**: Mock diagnosis and preprocessing with `演示数据` badges damage user trust
2. **Architecture alignment**: SmartAnalysis is the only analysis page not using `ResultView`
3. **Overlap**: 80%+ of capabilities are duplicated by AI Workbench + dedicated pages
4. **Low cost to hide**: Removing sidebar entry is trivial and reversible
5. **Future-proof**: AI Workbench is the intended assistant shell; consolidating there aligns with Agent roadmap

---

## 10. Future Implementation Plan

### Phase 4B-8C: Hide Legacy SmartAnalysis Entry

**Scope**:
- Remove `AppSidebar.tsx` entry: `{ path: '/app/smart-analysis', label: '智能分析向导', icon: Brain }`
- Remove or replace Dashboard shortcut button
- Add deprecation comment to `SmartAnalysis.tsx` header
- Add route guard or redirect notice (optional)
- Update docs

**Files**: `AppSidebar.tsx`, `Dashboard.tsx`, `SmartAnalysis.tsx` (comments only)

### Phase 4B-8D: Guided Quick Analysis in AI Workbench

**Scope**:
- Add "快速分析向导" capability card in AI Workbench
- Implement wizard steps using real APIs:
  - Step 1: Dataset selection (real)
  - Step 2: Profile dataset via `assistantApi.profileDataset()` (real)
  - Step 3: Generate plan via `ruleBasedAssistantRuntime` (real)
  - Step 4: Navigate to target analysis page (real)
- Use existing `AnalysisPlanCard` for recommendations

**Files**: `AIWorkspace.tsx`, new wizard component

### Phase 4B-8E: Delete SmartAnalysis

**Scope**:
- Remove `app/src/pages/SmartAnalysis.tsx`
- Remove route from `App.tsx`
- Remove remaining references
- Archive code if needed

---

## 11. Known Unknowns

- User analytics: how many users actually visit `/app/smart-analysis`?
- Whether any existing users have bookmarked the wizard flow
- Whether the mock diagnosis/preprocess code has any value as reference for future real implementations
- Whether backend already has (or plans) a real `quality diagnosis` endpoint that could replace the mock
