# Phase 4A-5-2: Low-Risk Static Selects & Switches

**Date**: 2026-04-28
**Phase Goal**: Replace low-risk static native `<select>` controls and simple toggles/tabs with shadcn components.

---

## 1. Modified Files

| File | Changes |
|---|---|
| `app/src/pages/SmartProcess.tsx` | 5 native `<select>` → shadcn `Select` |
| `app/src/pages/Dashboard.tsx` | Custom view tab buttons → shadcn `Tabs` |
| `app/src/pages/Forecast.tsx` | Custom batch mode toggle button → shadcn `Switch` |

## 2. Skipped Files

| File | Reason |
|---|---|
| `app/src/pages/GoalPlanner.tsx` | The single `<select>` is a dynamic funnel level selector (`targetLevelId`), not a static time range select as originally audited. Options come from `funnelLevels` user state. Medium-risk, deferred to Phase 4A-5-3. |

## 3. SmartProcess Select Replacements

Replaced 5 static enum selects with shadcn `Select`:

1. **缺失值处理** (`missingValueStrategy`): mean / median / mode / fill / drop / none
2. **重复值处理** (`duplicateStrategy`): drop / keep_first / keep_last / none
3. **异常值处理** (`outlierStrategy`): none / drop / clip / mark
4. **异常值方法** (`outlierMethod`): iqr / zscore (conditional, shown when outlierStrategy ≠ none)
5. **数据标准化** (`standardization`): none / zscore / minmax / log

All use `onValueChange` mapping to existing `handleConfigChange` with identical state values. No sentinel mapping required (no empty values).

## 4. Dashboard Tabs Replacement

Replaced custom `<button>` view switcher (概览 / 自定义看板) with shadcn `Tabs`:
- `Tabs` with `value={currentView}` and `onValueChange`
- `TabsList` styled with `bg-[var(--bg-secondary)] border-[var(--border-subtle)]`
- `TabsTrigger` with active state styling via `data-[state=active]:bg-[var(--neon-cyan)]/20 data-[state=active]:text-[var(--neon-cyan)]`

## 5. Forecast Switch Replacement

Replaced custom batch mode `<button>` toggle with shadcn `Switch`:
- `Switch checked={isBatchMode} onCheckedChange={...}`
- Preserves side effect: when switching off, `setSelectedBatchColumns([])`
- Label text preserved ("已开启" / "关闭")

## 6. What Was Intentionally Not Changed

- **GoalPlanner select**: Dynamic funnel level selector, deferred.
- **Attribution / Statistics / PathAnalysis / Visualization selects**: Dynamic column selectors with `value=""` semantics. Belong to Phase 4A-5-3.
- **Forecast model selector buttons**: Custom 3-way toggle. Medium-risk, deferred.
- **Forecast promotion/aux var checkboxes**: Native checkboxes. Deferred to Phase 4A-5-4.
- **All business logic**: Zero changes to state management, API calls, or analysis behavior.

## 7. Validation Results

### Type Check
```bash
cd app && npx tsc --noEmit
# Result: 0 errors ✅
```

### Production Build
```bash
cd app && npm run build
# Result: built in 23.85s ✅
```

### SelectItem Empty Value Check
```powershell
cd app
Select-String -Path "src/**/*.tsx" -Pattern 'SelectItem value=""'
# Result: no output ✅

Select-String -Path "src/**/*.tsx" -Pattern "SelectItem value=''"
# Result: no output ✅
```

## 8. Known Issues / TODO

- GoalPlanner's `targetLevelId` select is dynamic and should be handled in Phase 4A-5-3 with other dynamic column selectors.
- shadcn `Select` default styling uses Tailwind semantic classes (`border-input`, `text-muted-foreground`) which may not perfectly match the project's custom dark theme CSS variables in all edge cases. Visual regression testing recommended.

## 9. Can the Project Proceed to Phase 4A-5-3?

**Yes.** Low-risk replacements are complete and build-gate clean. Phase 4A-5-3 (dynamic column selectors with sentinel mapping) can proceed.

## 10. Git Information

### Git Status Before Commit

```
M  app/src/pages/SmartProcess.tsx
M  app/src/pages/Dashboard.tsx
M  app/src/pages/Forecast.tsx
M  docs/phase-logs/PHASE_4A_5_1_INTERACTION_CLEANUP_AUDIT.md
M  docs/CURRENT_PROGRESS.md
M  docs/CHANGELOG.md
```

> No package files modified.

### Commit

```bash
git add app/src/pages/SmartProcess.tsx app/src/pages/Dashboard.tsx app/src/pages/Forecast.tsx docs/phase-logs/PHASE_4A_5_1_INTERACTION_CLEANUP_AUDIT.md docs/CURRENT_PROGRESS.md docs/CHANGELOG.md
git commit -m "refactor: migrate low-risk selects and switches to shadcn"
```

### Commit Hash

`8fad47e`

### Push Result

`master` → `origin/master` ✅

---

*End of phase log.*
