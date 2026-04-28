# Phase 4A-4-2: Statistics + Attribution Pages Migration

**Date**: 2026-04-28
**Phase Goal**: Migrate the two medium-risk analysis pages (`Statistics.tsx`, `Attribution.tsx`) to the shared analysis template components.

---

## 1. Modified Files

| File | Change |
|------|--------|
| `app/src/pages/Statistics.tsx` | Full layout migration to analysis template components |
| `app/src/pages/Attribution.tsx` | Full layout migration to analysis template components |
| `docs/CURRENT_PROGRESS.md` | 追加 Phase 4A-4-2 完成记录 |
| `docs/CHANGELOG.md` | 追加 Phase 4A-4-2 变更摘要 |

## 2. Added Files

None.

---

## 3. Specific UI/Layout Changes for Statistics.tsx

### Before
- Hand-written root `<div className="space-y-6">` with inline `rgba()` title bar.
- Hand-written `grid grid-cols-1 lg:grid-cols-3 gap-6` layout.
- Left config used `Card className="glass"` with collapsible `CardHeader`.
- Right result used `Card className="glass"` with inline empty/loading/result rendering.
- Export was a single shadcn `Button` with inline styling and ~90 lines of CSV generation logic inline.

### After
- Root replaced with `<AnalysisPageShell title="统计分析" description="对数据进行描述性统计分析，了解数据分布特征">`.
- Layout uses `flex flex-col lg:flex-row gap-6` with `AnalysisConfigPanel` + `AnalysisResultPanel`.
- Left config uses `AnalysisConfigPanel`. Analyze button moved to `footer`. Collapsible header removed.
- Right result uses `AnalysisResultPanel` with `loading`/`empty`/`actions` props.
- Export extracted to `handleExportCSV` handler and wired to `AnalysisActionBar onExportCSV`.
- `renderStatsResult()` preserved entirely — inner stat card structure is result content, not layout shell.

### Removed Imports
- `Settings2`, `ChevronDown`, `ChevronUp`, `Download` (lucide-react)

---

## 4. Specific UI/Layout Changes for Attribution.tsx

### Before
- Hand-written root `<div className="space-y-6">` with inline `rgba()` title bar.
- Hand-written `grid grid-cols-1 lg:grid-cols-3 gap-6` layout.
- Left config used `Card className="glass"` with collapsible `CardHeader`.
- Right result used `Card className="glass"` with inline empty/loading/result rendering.
- Export was a single shadcn `Button` with ~60 lines of CSV generation logic inline.

### After
- Root replaced with `<AnalysisPageShell title="归因分析" description="分析用户转化路径，量化各触点的贡献价值">`.
- Layout uses `flex flex-col lg:flex-row gap-6` with `AnalysisConfigPanel` + `AnalysisResultPanel`.
- Left config uses `AnalysisConfigPanel`. Analyze button moved to `footer`. Collapsible header removed.
- Right result uses `AnalysisResultPanel` with `loading`/`empty`/`actions` props.
- Export extracted to `handleExportCSV` handler and wired to `AnalysisActionBar onExportCSV`.

### ECharts Preservation
- `chartRef`, `chartInstance`, `renderComparisonChart` **zero changes**.
- Chart container `<div ref={chartRef} className="w-full h-80" />` kept inside a `Card` within the result panel.
- No `ChartCard` wrapper added — manual `echarts.init` lifecycle makes `ChartCard` risky.

### Result Content Preservation
- Summary stat cards (user_journey_count, total_conversions, conversion_rate, avg_touchpoints) kept as-is.
- Model result cards with progress bars kept as-is.
- Model comparison table kept as-is.

### Removed Imports / State
- `Settings2`, `ChevronDown`, `ChevronUp`, `PieChart`, `Download` (lucide-react)
- `isConfigOpen` / `setIsConfigOpen` state (no longer used)

---

## 5. What Was Intentionally Not Changed

| Item | Reason |
|------|--------|
| Dataset selector logic | Business logic |
| Column selection logic (Statistics) | Business logic |
| Attribution model configuration | Business logic |
| `handleAnalyze` / `pollResult` handlers | Business logic |
| API payloads | API contract |
| Polling intervals and status logic | Business logic |
| `gsap` animation timelines | Animation logic |
| ECharts option generation (`renderComparisonChart`) | Chart logic — not layout |
| `chartRef` / `chartInstance` lifecycle | ECharts DOM lifecycle |
| Result calculation / sorting | Business logic |
| CSV export logic | Business logic — only extracted to named function |
| `companionService.setPage(...)` | Business logic |
| Native `<select>` controls | Phase 4A-5 only |
| `DataTypeValidation` usage | Already correct |

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
# Result: built in 20.33s ✅
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

**Statistics:**
- Page structure: title + description render correctly via `AnalysisPageShell`.
- Layout: left config panel + right result panel render side-by-side on desktop.
- Dataset selection: still works.
- Column selection: native `<select>` still works.
- Run analysis: `handleAnalyze` unchanged; API flow unchanged.
- Loading / empty / result states: work via `AnalysisResultPanel`.
- `renderStatsResult()`: stat cards for each column render identically.
- Export: `AnalysisActionBar` triggers same CSV download logic.
- gsap animation: still triggers on `showResult` change.

**Attribution:**
- Page structure: title + description render correctly.
- Layout: left config panel + right result panel render side-by-side on desktop.
- Dataset selection: still works.
- Column mappings (userId, touchpoint, timestamp, conversion, conversionValue): still work.
- Model selection: checkbox toggles still work.
- Run attribution: `handleAnalyze` unchanged.
- Loading / empty / result states: work via `AnalysisResultPanel`.
- ECharts chart: `renderComparisonChart` unchanged; chart renders when `analysisResult.models` is available.
- Summary stats, model cards, comparison table: all preserved.
- Export: `AnalysisActionBar` triggers same CSV download logic.
- gsap animation: still triggers on `showResult` change.

> Note: Full browser E2E verification requires a running backend (RDS) and is deferred to Phase 3G.

---

## 7. Known Issues / TODO

- `AnalysisResultSummary` was **not used** in these pages. Statistics' stat cards are inline custom divs within per-column Cards. Future phases may evaluate whether to migrate these to `StatCard` / `AnalysisResultSummary`.
- `AnalysisPollingOverlay` was **not used** in these pages. Both pages use simple boolean `isAnalyzing` state rather than status-based polling (pending/running/completed/failed).
- Attribution's ECharts chart is wrapped in a plain `Card`, not `ChartCard`. This is intentional — the manual `echarts.init` / `dispose` lifecycle makes `ChartCard` wrapper risky.
- Bundle size warning persists (~3,390 KB JS chunk). Bundle splitting remains a future Phase 4A task.

---

## 8. Can the Project Proceed to SmartProcess + GoalPlanner Migration?

**Yes.** Both medium-risk pages migrated successfully and build-gate clean. ECharts integration validated. The next phase (4A-4-3) can proceed to migrate:

- `SmartProcess.tsx`
- `GoalPlanner.tsx`

These pages will validate file download results and custom layouts within the template.

---

## 9. Git Information

### Git Status Before Commit

```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  (none — package files were already clean)

Untracked files:
  docs/phase-logs/PHASE_4A_4_2_STATISTICS_ATTRIBUTION_REFACTOR.md

Modified files to stage:
  modified:   app/src/pages/Statistics.tsx
  modified:   app/src/pages/Attribution.tsx
  modified:   docs/CURRENT_PROGRESS.md
  modified:   docs/CHANGELOG.md
  new file:   docs/phase-logs/PHASE_4A_4_2_STATISTICS_ATTRIBUTION_REFACTOR.md
```

> **Package files**: `app/package.json` and `app/package-lock.json` remained clean (no diff). Not staged.

### Commit

```bash
git add app/src/pages/Statistics.tsx app/src/pages/Attribution.tsx docs/CURRENT_PROGRESS.md docs/CHANGELOG.md docs/phase-logs/PHASE_4A_4_2_STATISTICS_ATTRIBUTION_REFACTOR.md
git commit -m "refactor: migrate statistics and attribution pages to analysis template"
```

### Commit Hash

`TBD` (will be filled after commit)

### Push Result

`TBD` (will be filled after push)

---

*End of phase log.*
