# Phase 4B-3G Log: AI Workbench Layout Polish + Companion Drag Restore + Avatar Color Harmony

**Phase ID**: 4B-3G  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ⚠️ Code implemented, but critical bugs discovered post-implementation (see Known Issues)

---

## Objective

Restore drag behavior and double-click-to-open to the AI companion launcher orb. Replace `KimiAvatar` in `AIWorkspace` with `AssistantAvatar`. Polish `AIWorkspace` empty state and layout. Refine `AssistantAvatar` colors toward a harmonious cyan/aqua/neon palette.

---

## Files Modified

| File | Action | Reason |
|------|--------|--------|
| `app/src/components/AICompanion.tsx` | **Rewritten** | Restored drag + double-click; replaced `right/bottom` positioning with `right/bottom` offset math |
| `app/src/components/assistant/AssistantAvatar.tsx` | **Rewritten** | Switched from Tailwind linear gradients to inline radial gradients; attempted color harmony |
| `app/src/pages/AIWorkspace.tsx` | **Modified** | Replaced `KimiAvatar` → `AssistantAvatar`; added quick prompt chips; improved no-dataset empty state |

---

## Drag Behavior Implementation

- Used `onPointerDown` / `onPointerMove` / `onPointerUp` + `setPointerCapture` for drag tracking.
- Stored position as `{x, y}` deltas from default `right: 20, bottom: 20`.
- Position persisted to `localStorage` under `insightease_ai_companion_position`.
- Clamp on drag: `clamp(newX, 0, window.innerWidth - 72)`.
- Clamp on resize: `clamp(prev.x, 0, window.innerWidth - 80)`.
- **No clamp on initial load from localStorage** — potential off-screen risk if saved data is corrupt.

## Double-Click Behavior Implementation

- `onDoubleClick` on the orb wrapper div calls `executeAction('open-chat')`.
- `hasDraggedRef` prevents drag-release from triggering workspace open.
- Threshold: 4px movement.

## AIWorkspace Changes

- `KimiAvatar` import replaced with `AssistantAvatar`.
- Header avatar: `AssistantAvatar variant="default" size="sm"`.
- Message bubbles: `AssistantAvatar variant={isStreaming ? 'processing' : 'default'} size="sm" animated`.
- Added 5 quick prompt chips above input when dataset selected: 统计各列描述 / 预测未来趋势 / 分析相关性 / 找出异常值 / 做分类汇总.
- No-dataset state replaced disabled input with explicit guidance bar: "请先在上方的下拉菜单中选择一份数据集，再开始分析".

## Avatar Color Changes Attempted

- Replaced `bg-gradient-to-br` Tailwind classes with `radial-gradient(circle at 35% 25%, ...)` inline styles.
- Attempted to unify palette around cyan/aqua family.
- Kept 9 variants but gave each a distinct radial gradient.
- Added `variantGlow` inline `boxShadow` for per-variant glow.

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 19.13s ✅
```

---

## Known Issues Discovered After Implementation

### 1. Hover Causes Orb Disappearance (Severe)

**Symptom**: Moving the mouse over the assistant orb without clicking causes it to disappear completely. Moving the mouse away does not bring it back.

**Likely causes identified in post-hoc analysis**:
- The outer container used `right: 20 - position.x` and `bottom: 20 - position.y`. When `position` defaults to `{0, 0}` this is fine, but if `localStorage` contains an invalid/NaN value, the computed position could be off-screen.
- The `onPointerDown` handler is attached to the same element as `onMouseEnter`/`onMouseLeave`. Pointer capture on mousedown may interact badly with hover state.
- The tooltip lacks `pointer-events-none`, so when it appears, the pointer may leave the orb wrapper, triggering `onMouseLeave`, which could cascade with pointer events.
- No `pointer-events-none` on the pulse ring either.
- The positioning math (`right: 20 - position.x`) is inverted and confusing; dragging left increases `x`, which decreases `right`, moving the element left. This is correct in theory but hard to reason about and may break during re-renders.

**Impact**: Assistant becomes completely unusable for users who encounter this.

### 2. Avatar Colors Still Disharmonious

**Symptom**: The radial gradients and inline box shadows still feel like a separate "toy sphere" rather than part of the InsightEase identity.

**Root cause**: Each variant still uses a completely different radial gradient (green for dataset, purple for text, amber for warning, etc.). The palette is not unified around a single brand core. The inline gradients are too saturated and create visual noise against the dark navy panels.

---

## Notes

- This phase log is being backfilled in **4B-3H** because 4B-3G did not create a log at implementation time.
- No separate 4B-3G commit exists; the code was committed as part of the ongoing branch work.
- **4B-3H was opened specifically to fix the two issues above.**

---

## Next Recommended Phase

**4B-3H**: Fix hover disappearance bug + recalibrate avatar colors to InsightEase theme.
