# Phase 4B-3F Log: AI Companion Hard Reset

**Phase ID**: 4B-3F  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Hard reset the floating AI companion interaction. The previous stabilization (4B-3D) did not fully resolve the broken floating assistant behavior. The UI still showed an awkward avatar + long capsule / input-like bubble after upload or recommendation actions.

---

## User-Reported Problem

- Floating assistant notification appeared on the right.
- After clicking or moving through assistant actions, the assistant became an awkward long capsule / input-like bar.
- Avatar identity felt unattractive.
- User wants a softer, rounder assistant identity — closer to a spherical friendly companion.

---

## Root Cause Analysis

The old `AICompanion.tsx` had **two visual modes** controlled by `isVisible` from `useCompanion()`:

1. **`!isVisible` (collapsed)**: Floating avatar with glow + tooltip + double-click handler.
2. **`isVisible` (active)**: A **320px wide bubble card** (`w-[320px] p-4 rounded-2xl`) containing:
   - A message paragraph
   - Suggestion buttons
   - A second avatar below the bubble
   - Drag behavior on the entire container

**The capsule/input-like UI** was this 320px bubble. It:
- Was wide enough to resemble a chat input or search bar
- Had rounded corners that looked like a capsule
- Contained text + buttons in a single horizontal-ish block
- Was draggable, making it feel like a floating input panel
- Had a second avatar below it, creating visual clutter

**State variable**: `state.visible` in `companion-service.ts` triggered the switch.
**JSX block**: Lines 118–218 of old `AICompanion.tsx` rendered the bubble.
**Trigger**: Any `recordAction('upload', ...)` or trigger firing set `visible = true`.

---

## Files Modified

| File | Action | Reason |
|------|--------|--------|
| `app/src/components/AICompanion.tsx` | **Rewritten** | Replaced old bubble/capsule UI with clean 3-state model |
| `app/src/services/companion-service.ts` | **Simplified** | Removed mock AI, idle tracking, excessive triggers; kept page API |
| `app/src/components/assistant/AssistantAvatar.tsx` | **Created** | New soft spherical avatar with 9 variants |
| `app/src/components/assistant/index.ts` | **Created** | Barrel export for assistant components |

---

## New State Model

```
collapsed
  └── Launcher sphere only (bottom-right)
  └── Single click opens AIWorkspace
  └── Hover tooltip: "打开 AI 工作台"

notification
  └── Compact card (280px) above launcher
  └── Message + up to 3 action buttons + close button
  └── Never morphs into input
  └── Never shows a text input
  └── Never becomes a long capsule

workspace_open
  └── AIWorkspace overlay visible
  └── Companion hidden by AppLayout
```

**Forbidden states**: input, typing, chat, expanded_input, capsule, freeform.

---

## Changes Detail

### 1. AICompanion.tsx Rebuilt

**Removed:**
- `useRef` drag constraints
- `isDragging` state
- `onDragStart` / `onDragEnd` handlers
- 320px wide bubble card with `bg-[var(--bg-secondary)]/95 backdrop-blur-lg`
- Second avatar below the bubble
- `GripHorizontal` tooltip icon
- Double-click handler (replaced with single click)

**Added:**
- Compact 280px notification card (`w-[280px]`) with clear separation from launcher
- Launcher is now a `<button>` with `aria-label`
- `AssistantAvatar` replaces `KimiAvatar`
- `justNotified` pulse ring animation on new notifications
- Single click opens workspace

### 2. AssistantAvatar.tsx Created

Visual direction:
- Round, soft, friendly spherical companion
- Soft cyan/blue gradient (default)
- Simple two white dot eyes
- Top highlight + bottom micro-shadow for 3D sphere feel
- Subtle pulse glow
- 9 color variants for future dataset-specific forms

Variants implemented: default, dataset, path, forecast, experiment, text, warning, processing, success.

Sizes: sm (36px), md (48px), lg (64px).

Pure CSS/div. No images. No dependencies.

### 3. Companion Service Simplified

**Removed:**
- `generateAIContent()` — mock AI random responses
- `idle-with-data` trigger — caused unexpected popups
- `large-file` trigger — non-critical
- `security-mode-enabled` trigger — non-critical
- `error-help` trigger — non-critical
- `debugResetCooldowns()` / `debugGetContext()` — dev only
- Idle tracking event listeners and timer

**Kept:**
- `setPage()` — used by 11 pages
- `updateContext()` — used by DataWorkshop
- `recordAction()` — used by Upload/DataWorkshop
- `dismiss()` — used by AICompanion
- `executeAction()` — navigation dispatching (4B-3D fix preserved)
- `subscribe()` / `getState()` — used by useCompanion hook

**Updated upload-complete copy:**
- Old: "要我帮你快速分析一下吗？" → action: `auto-analyze`
- New: "收到 'filename'，共 N 行数据。" → actions: `查看数据理解`, `进入数据工坊`, `稍后再说`

---

## Preserved 4B-3D Fixes

| Fix | Status |
|-----|--------|
| No `window.location.href` in companion | ✅ Still uses `companion-navigate` events |
| React Router navigation in AppLayout | ✅ Unchanged |
| AIWorkspace backdrop click guard | ✅ Unchanged (not modified) |
| Non-LLM boundary copy in AIWorkspace | ✅ Unchanged (not modified) |
| `AIAssistant.tsx` deleted | ✅ Not recreated |
| SmartAnalysis mock labels | ✅ Unchanged (not modified) |

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 19.34s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Upload page opens normally | ⏸️ Not tested (no backend) |
| 2 | Upload success notification appears as compact card | ✅ Code path verified (`recordAction('upload')` → trigger) |
| 3 | No long capsule/input-like assistant state | ✅ Old 320px bubble removed |
| 4 | Clicking notification buttons never creates input box | ✅ No input element in component |
| 5 | "稍后再说" dismisses notification | ✅ `dismiss()` action preserved |
| 6 | Assistant launcher has stable bottom-right position | ✅ Fixed `bottom-5 right-5` |
| 7 | Launcher uses new soft round AssistantAvatar | ✅ `AssistantAvatar variant="default"` |
| 8 | Launcher opens AIWorkspace predictably | ✅ Single click → `executeAction('open-chat')` |
| 9 | AIWorkspace close behavior from 4B-3D still works | ✅ Unchanged |
| 10 | React Router navigation still works | ✅ `companion-navigate` events preserved |
| 11 | DatasetUnderstandingCard still works | ✅ Unchanged |
| 12 | No user-facing Kimi branding in companion | ✅ Replaced with AssistantAvatar |
| 13 | No console errors | ⏸️ Runtime not tested |

---

## Known Limitations

- `KimiAvatar.tsx` still exists and is used by `AIWorkspace.tsx`. Full rename deferred.
- AIWorkspace chat input remains functional for structured analysis requests but not free-form LLM chat.
- SmartAnalysis diagnosis/preprocessing are still mock-only (badged in 4B-3D).

---

## Next Recommended Phase

**4B-3E**: Pre-fill navigation skeleton — add query param parsing to analysis pages.
