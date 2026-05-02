# Phase 4B-8C Log: Hide Legacy SmartAnalysis Entry

**Phase ID**: 4B-8C  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Hide the legacy `SmartAnalysis` / `智能分析向导` entry from the main product navigation, based on 4B-8B audit recommendation.

---

## Audit Basis

Phase 4B-8B found:
- Diagnosis and preprocessing are entirely mock (`演示数据` badges)
- Only `statistics` analysis calls the real backend; all others are mock
- Does not use 4A `ResultView` (the only analysis page that doesn't)
- Uses `window.location.href` hard reloads for navigation
- Recommends standalone clustering, but no standalone clustering page exists
- Capabilities overlap with AI Workbench and dedicated analysis pages

**Recommendation**: Short-term hide from sidebar → Medium-term migrate to AI Workbench → Long-term delete.

---

## Files Modified

| File | Change |
|------|--------|
| `app/src/components/AppSidebar.tsx` | Removed `智能分析向导` entry from sidebar; kept comment explaining deprecation |
| `app/src/pages/Dashboard.tsx` | Removed SmartAnalysis shortcut button; removed unused `Sparkles` import |
| `app/src/pages/SmartAnalysis.tsx` | Added `@deprecated` JSDoc comment; added amber deprecation banner on page |

## Preserved

| Item | Status | Reason |
|------|--------|--------|
| `/app/smart-analysis` route | ✅ Kept | Direct URL access should not break; code useful for migration reference |
| `SmartAnalysis.tsx` source | ✅ Kept | Future migration reference |
| `SmartAnalysis` import in `App.tsx` | ✅ Kept | Route still exists |

---

## Changes Detail

### AppSidebar

```tsx
// Before:
{ path: '/app/smart-analysis', label: '智能分析向导', icon: Brain }

// After:
// Deprecated: SmartAnalysis hidden from navigation after Phase 4B-8C.
// Guided analysis will migrate into AI Workbench.
// { path: '/app/smart-analysis', label: '智能分析向导', icon: Brain },
```

### Dashboard

Removed the entire shortcut button card that navigated to `/app/smart-analysis`.

### SmartAnalysis Page

Added file-level JSDoc:
```tsx
/**
 * @deprecated Phase 4B-8C:
 * SmartAnalysis is a legacy wizard page hidden from public navigation.
 * ...
 */
```

Added visible amber banner:
> 该智能分析向导为旧版实验页面，后续将迁移到 AI 工作台。建议使用 AI 工作台生成分析计划。

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 16.41s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Sidebar no longer shows `智能分析向导` | ✅ |
| 2 | Dashboard no longer links to `/app/smart-analysis` | ✅ |
| 3 | `AI 工作台` companion still works | ✅ (not modified) |
| 4 | `数据预处理` sidebar entry still works | ✅ |
| 5 | `语义分析` sidebar entry still works | ✅ |
| 6 | All dedicated analysis pages remain visible | ✅ |
| 7 | Direct URL `/app/smart-analysis` still loads | ✅ (route preserved) |
| 8 | No white screen from removed shortcut | ✅ |
| 9 | No SmartAnalysis internals refactored | ✅ |
| 10 | No package files modified | ✅ |

---

## Next Recommended Phase

**4B-8D**: Guided Quick Analysis in AI Workbench
- Add "快速分析向导" capability card in AI Workbench
- Use real APIs: `profileDataset`, `ruleBasedAssistantRuntime`
- Navigate to dedicated analysis pages for execution
- After proven, proceed to **4B-8E**: Delete SmartAnalysis
