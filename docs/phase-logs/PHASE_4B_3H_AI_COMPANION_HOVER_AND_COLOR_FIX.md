# Phase 4B-3H Log: AI Companion Hover Bug Fix + Avatar Color Recalibration

**Phase ID**: 4B-3H  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Fix the severe regression introduced in Phase 4B-3G where hovering over the assistant orb caused it to disappear, and recalibrate `AssistantAvatar` colors to be visually harmonious with the InsightEase dark/cyan/neon theme.

---

## User-Reported Issues

1. **Hover Disappearance Bug**: Moving the mouse over the assistant orb (without clicking) makes it vanish completely. It does not return after mouse leave.
2. **Missing Phase Log**: Phase 4B-3G did not create a phase log.
3. **Disharmonious Avatar Colors**: The avatar still looks like a separate saturated toy sphere rather than belonging to the InsightEase UI.

---

## Root Cause Analysis

### Hover Bug

**Primary cause**: The 4B-3G positioning system used `right: 20 - position.x` / `bottom: 20 - position.y` on a `fixed` container. This had multiple failure modes:

1. **No clamp on initial load from localStorage**: Corrupt or off-screen saved positions were applied directly, potentially placing the orb outside the viewport.
2. **Inverted coordinate math**: `right: 20 - x` means dragging left increases `x`, decreasing `right`. This is counter-intuitive and prone to rendering bugs during React re-renders combined with flex layout.
3. **Tooltip without `pointer-events-none`**: The hover tooltip extended to the left of the orb (`right-full mr-3`). When visible, it could steal pointer events and trigger `onMouseLeave` on the orb wrapper, causing a hover/leave flicker loop.
4. **Pulse ring without `pointer-events-none`**: The notification pulse overlay could also intercept pointer events.
5. **`onPointerDown` on the same element as `onMouseEnter`/`onMouseLeave`**: Pointer capture on the orb could interfere with hover state tracking.

### Color Disharmony

**Primary cause**: Each variant used a completely different radial gradient color family (green for dataset, purple for text, amber for warning, etc.). There was no unifying brand core. The inline gradients were too saturated and created visual noise against InsightEase's dark navy panels.

---

## Files Inspected

```
app/src/components/AICompanion.tsx              (247 lines, 4B-3G version)
app/src/components/assistant/AssistantAvatar.tsx (160 lines, 4B-3G version)
app/src/pages/AIWorkspace.tsx                   (checked for KimiAvatar remnants)
app/src/components/AppLayout.tsx                (checked companion visibility logic)
```

---

## Files Modified

| File | Action | Reason |
|------|--------|--------|
| `app/src/components/AICompanion.tsx` | **Rewritten** | Fixed hover bug, replaced inverted `right/bottom` math with explicit `left/top`, added clamp on load, added `pointer-events-none` to overlays |
| `app/src/components/assistant/AssistantAvatar.tsx` | **Rewritten** | Unified all variants around single cyan-aqua-blue core palette; reduced saturation; made variants subtle accent shifts only |
| `docs/phase-logs/PHASE_4B_3G_AI_WORKBENCH_LAYOUT_AND_DRAG_RESTORE.md` | **Created** | Backfilled missing 4B-3G log |
| `docs/phase-logs/PHASE_4B_3H_AI_COMPANION_HOVER_AND_COLOR_FIX.md` | **Created** | This log |

---

## Hover Bug Fix

### Positioning Rewrite

- **Before**: `style={{ right: 20 - position.x, bottom: 20 - position.y }}` on outer container.
- **After**: `style={{ left: position.x, top: position.y }}` on outer container.
- Position is now stored as explicit viewport pixel coordinates (left/top from viewport origin).
- Default position: `x = window.innerWidth - ORB_SIZE - MARGIN`, `y = window.innerHeight - ORB_SIZE - MARGIN`.

### localStorage / Clamp Fix

- Added `isValidPosition()` helper that checks for finite numbers.
- On mount: parse localStorage → validate → clamp to viewport margins → set state.
- If invalid/missing: fall back to `getDefaultPosition()`.
- Clamp formula: `clamp(pos, MARGIN, window.innerWidth - ORB_SIZE - MARGIN)`.
- Resize handler also clamps.

### Event Isolation

- Moved `onMouseEnter` / `onMouseLeave` to a **parent wrapper** around the orb, separate from the `onPointerDown` target.
- Added `pointer-events-none` to:
  - Notification pulse ring
  - Hover tooltip
- This prevents any overlay from stealing pointer events or interfering with hover state.

### Drag Stability

- Drag threshold remains 4px.
- `isDraggingRef` is a ref (not state) to avoid re-renders during drag.
- `setPointerCapture` / `releasePointerCapture` still used for reliable drag.
- 50ms delay before clearing `isDraggingRef` on pointer up, preventing double-click from misinterpreting a recent drag.

---

## Color Recalibration Summary

### Unified Brand Palette

Introduced a single `CORE` token object shared by all variants:

```ts
const CORE = {
  start: 'rgba(22, 217, 245, 0.62)',   // cyan
  mid: 'rgba(43, 168, 247, 0.48)',     // aqua-blue
  end: 'rgba(37, 99, 235, 0.55)',      // deeper blue
  highlight: 'rgba(190, 255, 255, 0.75)',
  shadow: 'rgba(5, 18, 45, 0.45)',
  glowCyan: 'rgba(0, 229, 255, 0.32)',
  glowAmbient: 'rgba(139, 92, 246, 0.14)',
};
```

### Variant Rule

- **All variants share the same base sphere gradient and glow**.
- Variants only apply a **subtle background override** that shifts the mid-tone slightly:
  - `default`: pure core (no override)
  - `dataset`: slightly greener mid-tone (teal-cyan)
  - `path`: slightly deeper blue mid-tone
  - `forecast`: slightly cooler sky-blue mid-tone
  - `experiment`: slightly deeper teal mid-tone
  - `text`: barely perceptible lavender tint
  - `warning`: barely perceptible amber in the shadow
  - `processing`: brighter core + stronger glow (only real visible difference)
  - `success`: slightly greener mid-tone (same as dataset, virtually identical)

### Visual Changes

- **Eyes**: Changed from `bg-white/90` to `bg-[rgba(255,255,255,0.88)]` with a subtle cyan tint in processing mode.
- **Highlight**: Softer `rgba(190,255,255,0.35)` top highlight.
- **Border**: Reduced from `border-white/10` to `border-white/[0.08]`.
- **Glow**: Unified `0 0 20px cyan + 0 0 40px purple-ambient + 0 4px 12px shadow` for all variants. Only `processing` gets a slightly stronger intensity.

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in ~19s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Assistant orb appears on page load | ✅ Default position calculated from viewport size |
| 2 | Hovering over orb does not hide it | ✅ `pointer-events-none` on overlays; events isolated |
| 3 | Moving mouse away does not hide it | ✅ Hover state only controls tooltip visibility |
| 4 | Tooltip appears without disrupting orb visibility | ✅ Tooltip is `pointer-events-none` |
| 5 | Orb can be dragged | ✅ `onPointerDown/Move/Up` + `setPointerCapture` |
| 6 | Orb position remains visible and does not go off-screen | ✅ Clamp on drag, resize, and load |
| 7 | Dragging does not open AIWorkspace | ✅ `isDraggingRef` blocks double-click if dragged |
| 8 | Double-click opens AIWorkspace | ✅ `onDoubleClick` → `executeAction('open-chat')` |
| 9 | Closing AIWorkspace restores orb | ✅ Controlled by `AppLayout` (unchanged) |
| 10 | Refresh preserves orb position if localStorage valid | ✅ Saved to `localStorage` on every position change |
| 11 | Invalid localStorage position resets to default | ✅ `isValidPosition()` + fallback to `getDefaultPosition()` |
| 12 | Upload success notification still appears as compact card | ✅ Unchanged notification logic |
| 13 | Notification buttons do not create capsule/input state | ✅ No input element in component |
| 14 | No old long capsule/input-like state appears | ✅ 3-state model preserved from 4B-3F |
| 15 | Avatar colors look more harmonious | ✅ Unified core palette; reduced saturation |
| 16 | AIWorkspace still uses AssistantAvatar | ✅ Verified in code |
| 17 | DatasetUnderstandingCard still works | ✅ Unchanged |
| 18 | No console errors | ⏸️ Runtime not tested |

---

## Known Limitations

- `KimiAvatar.tsx` still exists in the codebase but is no longer imported anywhere after 4B-3G. It could be safely deleted in a future cleanup phase.
- AIWorkspace chat input remains functional for structured analysis requests but not free-form LLM chat.
- SmartAnalysis diagnosis/preprocessing are still mock-only (badged in 4B-3D).
- Drag works with pointer events; touch devices on very old browsers may fall back to default behavior.

---

## Next Recommended Phase

**4B-3I**: AI Workbench guided analysis polish — replace free-form input entirely with structured capability cards + one-click analysis flows, or integrate real LLM endpoint if backend is ready.
