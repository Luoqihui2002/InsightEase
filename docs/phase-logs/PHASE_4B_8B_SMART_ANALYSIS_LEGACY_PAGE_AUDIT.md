# Phase 4B-8B Log: SmartAnalysis Legacy Page Audit

**Phase ID**: 4B-8B  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Audit the legacy `SmartAnalysis` / `智能分析向导` page and decide its future product role. No source code was modified in this phase.

---

## Files Inspected

| File | Purpose |
|------|---------|
| `app/src/pages/SmartAnalysis.tsx` | Main component (906 lines) |
| `app/src/App.tsx` | Route definitions |
| `app/src/components/AppSidebar.tsx` | Sidebar navigation |
| `app/src/pages/Dashboard.tsx` | Dashboard shortcuts |
| `app/src/components/results/ResultView.tsx` | 4A unified result component |
| `app/src/types/result.ts` | Unified result schema |
| `app/src/api/analysis.ts` | Backend analysis API |

---

## Key Findings

### Mock Data Prevalence

| Feature | Real or Mock? | Evidence |
|---------|---------------|----------|
| Dataset selection | Real | `datasetApi.getDetail()` |
| Quality diagnosis | **Mock** | `setTimeout(1500)` + fake issues; `演示数据` badge |
| Preprocessing | **Mock** | `setTimeout(3000)` + hardcoded numbers; `演示数据` badge |
| Statistics analysis | Real | `analysisApi.create({ analysis_type: 'descriptive' })` |
| Clustering analysis | **Mock** | `setTimeout(2000)` + fake summary |
| Forecast analysis | **Mock** | `setTimeout(2000)` + fake summary |
| Attribution analysis | **Mock** | `setTimeout(2000)` + fake summary |

### 4A Compliance

SmartAnalysis is the **only** analysis page that does **not** import `ResultView`:

| Page | Uses ResultView? |
|------|-----------------|
| Attribution.tsx | ✅ |
| Forecast.tsx | ✅ |
| Statistics.tsx | ✅ |
| Semantic.tsx | ✅ |
| PathAnalysis.tsx | ✅ |
| **SmartAnalysis.tsx** | ❌ |

### Navigation Issues

- Uses `window.location.href` for "去可视化" and "查看历史" (hard reload)
- "查看详细报告" button does nothing except show a toast
- "聚类分析" recommends a standalone page that does not exist

### Overlap with Other Modules

| SmartAnalysis Capability | Duplicated By |
|--------------------------|---------------|
| Quality diagnosis | DatasetUnderstandingCard (real profile API) |
| Preprocessing | DataWorkshop (real transform API) |
| Analysis recommendation | AI Workbench planner (structured plan) |
| Result viewing | ResultView (unified architecture) |

---

## Recommendation

**Staged approach: Hide → Migrate → Delete**

1. **Short-term**: Hide from sidebar navigation (Option D)
2. **Medium-term**: Migrate guided flow into AI Workbench (Option C)
3. **Long-term**: Delete SmartAnalysis page after migration proven (Option E)

**Not recommended**: Keep as-is (Option A) due to mock data damage to product credibility.

---

## Validation

No source code modified. Documentation-only phase.

```bash
git status
```

---

## Next Phase

**4B-8C: Hide Legacy SmartAnalysis Entry**
- Remove sidebar entry
- Remove Dashboard shortcut
- Add deprecation comments
