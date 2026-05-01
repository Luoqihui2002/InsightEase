# Phase 4B-3D Log: AI Assistant Surface Stabilization

**Phase ID**: 4B-3D  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Stabilize the current AI assistant surface before adding new assistant capabilities. Fix P0 interaction and architecture issues found in the 4B-3C audit.

---

## Files Modified

| File | Action | Reason |
|------|--------|--------|
| `app/src/components/AIAssistant.tsx` | **Deleted** | Dead code (0 imports across entire codebase) |
| `app/src/services/companion-service.ts` | Modified | Replaced `window.location.href` with `companion-navigate` custom events |
| `app/src/components/AppLayout.tsx` | Modified | Added `useNavigate()` listener for `companion-navigate` events |
| `app/src/components/AICompanion.tsx` | Modified | Updated tooltip text; neutralized user-facing "Kimi" references |
| `app/src/pages/AIWorkspace.tsx` | Modified | Removed backdrop click-to-close; added non-LLM boundary copy |
| `app/src/pages/SmartAnalysis.tsx` | Modified | Added "演示数据" badges and comments on mock-only sections |
| `app/src/App.tsx` | Modified | Redirected standalone `/app/ai-workspace` route to dashboard |

---

## Changes Detail

### 1. Dead Code Removal

- **Deleted** `app/src/components/AIAssistant.tsx` (251 lines, zero imports).
- Verified via `grep -r "AIAssistant" app/src/` — only self-references found, no external imports.

### 2. Companion Navigation Fix

**Before**: `companion-service.ts` used `window.location.href = '/app/...'` for 4 navigation actions, causing full page reloads.

**After**: All navigation actions dispatch `companion-navigate` custom events with `{ path: '...' }`.

**AppLayout.tsx** listens for `companion-navigate` and uses `useNavigate()` for smooth client-side routing.

Affected actions:
- `goto-upload` → `/app/upload`
- `goto-workshop` → `/app/data-workshop`
- `goto-analysis` → `/app/smart-analysis`
- `auto-analyze` → `/app/smart-analysis`
- `goto-forecast` → `/app/forecast`
- `goto-clustering` → `/app/statistics`
- `goto-association` → `/app/statistics`

### 3. AICompanion Stabilization

- Tooltip text: `双击对话` → `双击打开工作台` (clarifies what double-click does).
- All user-facing `Kimi` references in JSX comments replaced with `AI 助手`.
- Component import name `KimiAvatar` retained (filename rename out of scope).

### 4. AIWorkspace Close Guard

- Removed `onClick={onClose}` from the backdrop overlay.
- Users must now click the explicit close button (top-left X) to close the workspace.
- Prevents accidental dismissal during analysis or data selection.

### 5. Non-LLM Boundary Clarification

- **Welcome message** updated to clarify rule-based nature:
  > "当前支持规则型分析导航：选择数据集后，描述你想做的分析... 自然语言智能规划将在后续阶段开放。"
- **Subtitle** updated: `智能数据分析助手` → `规则型数据助手 · 自然语言能力即将开放`

### 6. SmartAnalysis Mock Labels

- Added `演示数据` Badge to:
  - 数据质量诊断 card header
  - 预处理完成 card header
- Added `⚠️ 模拟诊断/预处理/分析` comments in source code for developer clarity.

### 7. Route Cleanup

- `/app/ai-workspace` standalone route redirected to `/app/dashboard`.
- AIWorkspace should only be accessed via the sidebar button overlay (shared state with AppLayout).
- Removed now-unused `AIWorkspace` import from `App.tsx`.

---

## Assistant Surface Roles (Post-Stabilization)

| Surface | Role | Entry Point | Allowed Actions |
|---------|------|-------------|-----------------|
| **AICompanion** | Lightweight launcher / proactive notification | Floating avatar (bottom-right) | Open workbench, navigate to pages, dismiss notification |
| **AIWorkspace** | Assistant workbench shell | Sidebar button or companion double-click | Dataset selection, capability cards, rule-based analysis request |
| **SmartAnalysis** | Legacy wizard page | Sidebar navigation | Dataset selection, real statistics analysis, mock diagnosis display |
| **DatasetUnderstandingCard** | Dataset profile display | Dataset detail dialog | View classification, roles, quality warnings |

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 20.23s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Upload page opens normally | ⏸️ Not tested (no backend) |
| 2 | DatasetUnderstandingCard still renders in dataset dialog | ✅ Code verified intact |
| 3 | AIWorkspace closes via close button only | ✅ Backdrop click removed |
| 4 | AIWorkspace copy clarifies non-LLM status | ✅ Updated |
| 5 | SmartAnalysis mock sections have "演示数据" badge | ✅ Added |
| 6 | Companion tooltip says "打开工作台" not "对话" | ✅ Updated |
| 7 | No dead AIAssistant surface appears | ✅ File deleted |
| 8 | No `window.location.href` in companion service | ✅ Replaced with events |
| 9 | No unexpected square input state from companion | ✅ No input UI exists in companion |
| 10 | No unrelated pages break | ✅ tsc + build pass |
| 11 | No console errors | ⏸️ Runtime not tested |

---

## Known Limitations

- `KimiAvatar` component filename and export name remain (renaming deferred to avoid import cascade).
- SmartAnalysis diagnosis/preprocessing are still mock-only; badges now clearly label them.
- AIWorkspace chat input is functional for structured analysis requests but not free-form LLM chat.
- General chat function in AIWorkspace remains commented out (out of scope for this phase).

---

## Next Recommended Phase

**4B-3E**: Implement pre-fill navigation skeleton — add query param parsing to analysis pages so the assistant can eventually generate links with pre-populated fields.
