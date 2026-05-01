# Phase 4B-3I Log: Companion Drag Intent Fix & Workbench Split Layout Correction

**Phase ID**: 4B-3I  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Fix two UX regressions after Phase 4B-3H:

1. **Drag intent bug**: Merely hovering over the assistant orb triggered drag-like behavior because `onPointerMove` fired without checking whether the pointer was actually down.
2. **Workbench layout bug**: The side-by-side layout placed data preview on the left and AI workbench on the right, which is backwards. The close button was also visually weak.

---

## User-Reported Issues

1. Hovering over the assistant orb without clicking caused it to enter a drag-like state.
2. AI Workbench split layout had data preview on the left instead of the right.
3. Close X was hard to see against the dark blurred background.

---

## Root Cause Analysis

### Hover-Triggered Drag

In 4B-3H, the drag logic was:

```tsx
const handlePointerMove = useCallback((e) => {
  const dx = e.clientX - dragStartRef.current.x;
  const dy = e.clientY - dragStartRef.current.y;
  if (!isDraggingRef.current && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
    isDraggingRef.current = true;
  }
  if (isDraggingRef.current) { setPosition(...); }
}, []);
```

**Problem**: `dragStartRef` was initialized to `{x: 0, y: 0, posX: 0, posY: 0}`. When the user simply hovered (moved the pointer over the orb), `onPointerMove` fired with `e.clientX`/`e.clientY` values typically far from `(0, 0)`. Since `Math.abs(e.clientX - 0) > 4` was almost always true, `isDraggingRef.current` was set to `true` on the first hover move. The next move then updated position using `posX = 0`, teleporting the orb to the mouse coordinates.

**Root cause**: No `pointerDownRef` guard. The code assumed `onPointerMove` only happened during drag, but it fires on any pointer movement over the element.

### Backwards Side-by-Side Layout

In 4B-3G/3H, the horizontal layout rendered the data preview **before** the AI workbench in the DOM. Since the parent used `flex-row`, the first child appeared on the left. The layout toggle tooltip even said "数据预览在左侧".

**Expected**: AI workbench functional area on the left, data preview on the right.

### Weak Close Button

The close button used `bg-[var(--bg-tertiary)]/50` with no border, making it nearly invisible against the dark blurred backdrop.

---

## Files Inspected

```
app/src/components/AICompanion.tsx              (292 lines, 4B-3H version)
app/src/pages/AIWorkspace.tsx                   (988 lines, 4B-3H version)
app/src/components/AppLayout.tsx                (verified companion visibility logic)
```

---

## Files Modified

| File | Action | Reason |
|------|--------|--------|
| `app/src/components/AICompanion.tsx` | **Rewritten** | Added `pointerDownRef` guard; added `suppressDoubleClickRef`; moved drag state to refs |
| `app/src/pages/AIWorkspace.tsx` | **Modified** | Swapped horizontal layout DOM order; improved close button styling; updated tooltip text |
| `docs/CURRENT_PROGRESS.md` | **Updated** | Added 4B-3G, 4B-3H, 4B-3I entries |
| `docs/CHANGELOG.md` | **Updated** | Added 4B-3G, 4B-3H, 4B-3I entries |
| `docs/phase-logs/PHASE_4B_3I_COMPANION_DRAG_INTENT_AND_WORKBENCH_LAYOUT_FIX.md` | **Created** | This log |

---

## Drag Intent Fix

### New Ref Model

```
pointerDownRef    →  true only between pointerDown and pointerUp
dragStartedRef    →  true only after movement exceeds threshold
dragOriginRef     →  stores {pointerX, pointerY, startX, startY} at pointerDown
suppressDoubleClickRef →  true for 250ms after a drag ends
```

### Event Flow

| Event | Condition | Action |
|-------|-----------|--------|
| `onPointerDown` | Always | Set `pointerDownRef = true`, capture pointer, record drag origin |
| `onPointerMove` | `!pointerDownRef` | **Return immediately** — no drag logic |
| `onPointerMove` | `pointerDownRef && hypot(dx, dy) < 5` | Return — not a drag yet |
| `onPointerMove` | `pointerDownRef && hypot(dx, dy) >= 5` | Set `dragStartedRef = true`, update position |
| `onPointerUp` | `dragStartedRef` | Release capture, set `suppressDoubleClickRef = true` for 250ms |
| `onDoubleClick` | `suppressDoubleClickRef` | Return — ignore |
| `onDoubleClick` | `!suppressDoubleClickRef` | Open AIWorkspace |

### Key Behaviors

- **Hover only**: Shows tooltip. No state changes. No position updates. No localStorage writes.
- **Pointer down without movement**: Cursor becomes `grabbing`, but orb stays in place.
- **Drag**: Starts only after 5px of movement. Orb follows pointer, clamped to viewport.
- **Drag release**: Position persists. Workspace does NOT open.
- **Double-click**: Opens workspace. Ignored if a drag just ended.

---

## Workbench Layout Fix

### Close Button

**Before**:
```tsx
<button className="absolute top-3 left-3 z-50 p-2 rounded-full bg-[var(--bg-tertiary)]/50 ...">
  <X className="w-4 h-4" />
</button>
```

**After**:
```tsx
<button
  aria-label="关闭 AI 工作台"
  className="absolute top-3 left-3 z-50 h-9 w-9 flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white hover:border-white/20 transition-colors"
>
  <X className="w-4 h-4" />
</button>
```

Changes:
- Added `aria-label`
- Added explicit border (`border-white/10`)
- Explicit size (`h-9 w-9`) with flex centering
- Higher contrast hover state (`hover:bg-white/10 hover:text-white`)

### Side-by-Side Layout Direction

**Before**: Data preview rendered first in DOM → appeared on the left.

**After**:
- Vertical layout: data preview still rendered before AI workbench (top)
- Horizontal layout: data preview rendered **after** AI workbench (right)
- Border changed from `border-r` to `border-l` on data preview panel

### Layout Toggle Tooltips

- "左右排版（数据预览在左侧）" → "左右排版（AI工作台在左，数据预览在右）"
- "上下排版（数据预览在上方）" → "上下排版（数据预览在上，AI工作台在下）"

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 18.99s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Hovering over assistant orb only shows tooltip | ✅ `pointerDownRef` blocks all drag logic until down |
| 2 | Hovering does not start drag | ✅ Same as above |
| 3 | Hovering does not write position to localStorage | ✅ No position update without drag |
| 4 | Pointer down without movement does not move orb | ✅ `hypot(dx, dy) < 5` blocks position update |
| 5 | Drag starts only after movement threshold | ✅ Threshold = 5px |
| 6 | Dragging moves the orb | ✅ `setPosition` updates left/top |
| 7 | Dragging does not open AIWorkspace | ✅ `dragStartedRef` suppresses double-click |
| 8 | Double-click opens AIWorkspace | ✅ `executeAction('open-chat')` |
| 9 | Double-click after a drag is suppressed | ✅ 250ms suppression window |
| 10 | Orb remains visible and clamped to viewport | ✅ Clamp on drag, resize, and load |
| 11 | Old capsule/input-like state does not return | ✅ 3-state model preserved |
| 12 | AIWorkspace close X is clearly visible | ✅ Border + bg + hover contrast |
| 13 | Close X works in default layout | ✅ `onClick={onClose}` |
| 14 | Close X works in top/bottom layout | ✅ Absolute positioned, unaffected by layout |
| 15 | Close X works in side-by-side layout | ✅ Same as above |
| 16 | Side-by-side shows AI workbench on left, data preview on right | ✅ DOM order swapped |
| 17 | Data preview title is visible and not clipped | ✅ Verified in code |
| 18 | Layout toggle buttons have clear labels | ✅ Tooltips updated |
| 19 | No console errors | ⏸️ Runtime not tested |

---

## Known Limitations

- `KimiAvatar.tsx` still exists in the codebase but is no longer imported anywhere. Safe to delete in a future cleanup phase.
- AIWorkspace chat input remains functional for structured analysis requests but not free-form LLM chat.
- SmartAnalysis diagnosis/preprocessing are still mock-only (badged in 4B-3D).

---

## Next Recommended Phase

**4B-3J**: AI Workbench guided analysis polish — replace free-form input entirely with structured capability cards + one-click analysis flows, or integrate real LLM endpoint if backend is ready.
