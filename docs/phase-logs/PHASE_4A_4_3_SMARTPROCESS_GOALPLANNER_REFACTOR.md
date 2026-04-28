# Phase 4A-4-3: SmartProcess + GoalPlanner Pages Migration

**Date**: 2026-04-28
**Phase Goal**: Migrate the two medium-risk analysis pages (`SmartProcess.tsx`, `GoalPlanner.tsx`) to shared analysis/layout components.

---

## 1. Modified Files

| File | Change |
|------|--------|
| `app/src/pages/SmartProcess.tsx` | Full layout migration to analysis template components |
| `app/src/pages/GoalPlanner.tsx` | Outer wrapper migration + glass removal, custom layout preserved |
| `docs/CURRENT_PROGRESS.md` | 追加 Phase 4A-4-3 完成记录 |
| `docs/CHANGELOG.md` | 追加 Phase 4A-4-3 变更摘要 |

## 2. Added Files

None.

---

## 3. Specific UI/Layout Changes for SmartProcess.tsx

### Before
- Hand-written root `<div className="space-y-6">` with inline `rgba()` title bar.
- Hand-written `grid grid-cols-1 lg:grid-cols-3 gap-6` layout.
- Left config used `Card className="glass"` with collapsible `CardHeader`.
- Right result used `Card className="glass"` with inline empty/loading/result rendering.
- Download button was a native `<button>` with inline styling.

### After
- Root replaced with `<AnalysisPageShell title="智能处理" description="自定义数据处理流程，生成高质量数据集">`.
- Layout uses `flex flex-col lg:flex-row gap-6` with `AnalysisConfigPanel` + `AnalysisResultPanel`.
- Left config uses `AnalysisConfigPanel`. Process button moved to `footer`. Collapsible header removed.
- Right result uses `AnalysisResultPanel` with `loading`/`empty`/`actions` props.
- Download replaced with `AnalysisActionBar onDownload`.
- Reprocess button kept as shadcn `<Button variant="outline">`.

### Removed Imports
- `Sparkles`, `Settings2`, `ChevronDown`, `ChevronUp`, `Download`, `BarChart3` (lucide-react)

---

## 4. Specific UI/Layout Changes for GoalPlanner.tsx

### Before
- Hand-written root `<div className="space-y-6">` with inline `rgba()` title bar.
- Hand-written `grid grid-cols-1 lg:grid-cols-3 gap-6` layout.
- Left config used `Card className="glass"` with collapsible `CardHeader`.
- Result area used multiple `Card className="glass"` containers.

### After
- Root replaced with `<AnalysisPageShell title="指标规划" description="多层漏斗目标拆解与路径规划">`.
- Layout keeps `grid grid-cols-1 lg:grid-cols-3 gap-6` (custom layout preserved, not forced into AnalysisConfigPanel + AnalysisResultPanel).
- Left config `Card className="glass"` replaced with `div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 lg:col-span-1 flex flex-col gap-4"`. Collapsible header removed.
- All result area `Card className="glass"` replaced with `Card className="bg-[var(--bg-secondary)]"` (6 occurrences).

### Rationale for Custom Layout Preservation
GoalPlanner has a unique workflow:
- Pure frontend planning (no backend API call for the main calculation).
- Complex config panel with template buttons, dynamic funnel level inputs, target settings, forecast import, decomposition method selection, and custom monthly values.
- Result area with 5+ distinct result sections (gap analysis, comparison, suggestions, decomposition table, path visualization).

Forcing it into `AnalysisConfigPanel` + `AnalysisResultPanel` would have:
- Restricted the config panel to `SidePanel`'s fixed width, which may not accommodate the dense input grid.
- Made the result panel's generic `children` prop awkward for the multi-section result layout.

Instead, only the outer `AnalysisPageShell` was applied, and inner Cards were demoted from `glass` to standard `bg-[var(--bg-secondary)]`.

### Removed Imports / State
- `ChevronDown`, `ChevronUp` (lucide-react)
- `isConfigOpen` / `setIsConfigOpen` state (no longer used)

---

## 5. What Was Intentionally Not Changed

| Item | Reason |
|------|--------|
| Dataset selector logic (SmartProcess) | Business logic |
| Preprocessing config state (SmartProcess) | Business logic |
| `handleProcess` / `pollResult` handlers (SmartProcess) | Business logic |
| File download logic (`handleDownload`) | Business logic |
| `handleReprocess` logic | Business logic |
| Funnel template selection (GoalPlanner) | Business logic |
| Funnel level CRUD (GoalPlanner) | Business logic |
| Target setting and decomposition (GoalPlanner) | Business logic |
| `calculateMonthlyTargets` formula | Business logic |
| `importForecastData` and localStorage reads | Business logic |
| `calculateComparison` logic | Business logic |
| `generateSmartSuggestions` logic | Business logic |
| `gsap` animation timelines | Animation logic |
| Native `<select>` controls | Phase 4A-5 only |

---

## 6. Validation Results

### 6.1 Type Check

```bash
cd app && npx tsc --noEmit
# Result: 0 errors ✅
```

### 6.2 Production Build

```bash
cd app && npm run build
# Result: built in 24.88s ✅
```

### 6.3 SelectItem Empty Value Check

```powershell
cd app
Get-ChildItem -Path src -Recurse -Filter *.tsx | Select-String -Pattern 'SelectItem value=""'
# Result: no output ✅

Get-ChildItem -Path src -Recurse -Filter *.tsx | Select-String -Pattern "SelectItem value=''"
# Result: no output ✅
```

### 6.4 Manual Verification

**SmartProcess:**
- Page structure: title + description render correctly via `AnalysisPageShell`.
- Layout: left config panel + right result panel render side-by-side on desktop.
- Dataset selection: still works.
- Config controls: missing value, duplicate, outlier, standardization, type conversion options still work.
- Process button: triggers same API flow.
- Loading / empty / result states: work via `AnalysisResultPanel`.
- Result: stat cards (original rows, processed rows, removed rows, fixed nulls) render correctly.
- Download: `AnalysisActionBar` triggers same download logic.
- Reprocess: resets state correctly.
- gsap animation: still triggers on `showResult` change.

**GoalPlanner:**
- Page structure: title + description render correctly.
- Layout: left config + right result grid preserved.
- Template selection: buttons still apply templates.
- Funnel levels: add/remove/edit still work.
- Target setting: level, value, date inputs still work.
- Forecast import: `importForecastData` still reads localStorage.
- Decomposition method: linear/accelerated/frontloaded/custom still selectable.
- Custom monthly values: input grid with marketing calendar tags still works.
- Calculate button: triggers same `calculateMonthlyTargets` logic.
- Result sections: gap analysis, comparison, suggestions, decomposition table, path visualization all render.
- gsap animation: still triggers on `showResult` change.

> Note: Full browser E2E verification requires a running backend (RDS) and is deferred to Phase 3G.

---

## 7. Known Issues / TODO

- GoalPlanner still uses `Card` components from shadcn directly for result sections. Future phases could evaluate whether to migrate these to `SectionCard` for consistency.
- `AnalysisResultSummary` was not used in SmartProcess (the stat cards are inline custom divs).
- `AnalysisPollingOverlay` was not used in either page (both use simple boolean loading states).
- Bundle size warning persists (~3,387 KB JS chunk). Bundle splitting remains a future Phase 4A task.

---

## 8. Can the Project Proceed to Forecast Migration?

**Yes.** SmartProcess and GoalPlanner migrated successfully and build-gate clean. The next phase (4A-4-4) can proceed to migrate:

- `Forecast.tsx`

This high-risk page will validate complex config panels and ECharts integration within the template.

---

## 9. Git Information

### Git Status Before Commit

```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  (none — package files were already clean)

Untracked files:
  docs/phase-logs/PHASE_4A_4_3_SMARTPROCESS_GOALPLANNER_REFACTOR.md

Modified files to stage:
  modified:   app/src/pages/SmartProcess.tsx
  modified:   app/src/pages/GoalPlanner.tsx
  modified:   docs/CURRENT_PROGRESS.md
  modified:   docs/CHANGELOG.md
  new file:   docs/phase-logs/PHASE_4A_4_3_SMARTPROCESS_GOALPLANNER_REFACTOR.md
```

> **Package files**: `app/package.json` and `app/package-lock.json` remained clean (no diff). Not staged.

### Commit

```bash
git add app/src/pages/SmartProcess.tsx app/src/pages/GoalPlanner.tsx docs/CURRENT_PROGRESS.md docs/CHANGELOG.md docs/phase-logs/PHASE_4A_4_3_SMARTPROCESS_GOALPLANNER_REFACTOR.md
git commit -m "refactor: migrate smartprocess and goalplanner pages to shared layout"
```

### Commit Hash

`TBD` (will be filled after commit)

### Push Result

`TBD` (will be filled after push)

---

*End of phase log.*
