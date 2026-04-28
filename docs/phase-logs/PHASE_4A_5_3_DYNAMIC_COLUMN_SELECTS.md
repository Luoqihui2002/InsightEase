# Phase 4A-5-3: Dynamic Column Selects with Sentinel Mapping

**Date**: 2026-04-28
**Phase Goal**: Replace medium-risk dynamic native `<select>` controls (column/field selectors with empty-string semantics) with shadcn `Select`, using sentinel value mapping to preserve API payload semantics.

---

## 1. Modified Files

| File | Native Selects Replaced | Sentinel |
|---|---|---|
| `app/src/pages/Attribution.tsx` | 5 (userIdCol, touchpointCol, timestampCol, conversionCol, conversionValueCol) | `none` → `""` |
| `app/src/pages/Statistics.tsx` | 1 (selectedColumn, grouped by type) | none (`"all"` is valid) |
| `app/src/pages/Forecast.tsx` | 2 (dateColumn, valueColumn) | `auto` → `""` |
| `app/src/pages/PathAnalysis.tsx` | 3 (userIdCol, eventCol, timestampCol) | `auto` → `""` |
| `app/src/pages/Visualization.tsx` | 4 (xAxis, yAxis, colorBy, aggregation) | `none` → `""` / `undefined` |
| `app/src/pages/GoalPlanner.tsx` | 1 (targetLevelId) | `none` → `""` |

**Total: 16 native `<select>` → shadcn `Select`**

---

## 2. Sentinel Mapping Rules

| Context | Empty Meaning | Sentinel | Revert Logic |
|---|---|---|---|
| Attribution column selectors | "未选择" / "无" | `none` | `v === "none" ? "" : v` |
| Forecast date/value columns | "自动检测" | `auto` | `v === "auto" ? "" : v` |
| PathAnalysis column selectors | "选择列" | `auto` | `v === "auto" ? "" : v` |
| Visualization x/y axes | "选择字段" | `none` | `v === "none" ? "" : v` |
| Visualization colorBy | "不分组" | `none` | `v === "none" ? undefined : v` |
| GoalPlanner targetLevelId | "未选择" | `none` | `v === "none" ? "" : v` |
| Statistics selectedColumn | "全部分析" | `all` | direct pass-through |

---

## 3. Optgroup → SelectGroup + SelectLabel

Three pages had native `<optgroup>` for column categorization. shadcn `Select` does not support `<optgroup>`, but exports `SelectGroup` and `SelectLabel` which provide equivalent visual grouping:

- **Attribution.tsx** (`timestampCol`): "推荐的时间列" / "其他列"
- **Forecast.tsx** (`dateColumn`): "推荐的日期列" / "其他列"
- **PathAnalysis.tsx** (`timestampCol`): "推荐的时间列" / "其他列"
- **Statistics.tsx** (`selectedColumn`): "数值型列" / "分类型列" / "其他列"

All groups preserved with identical labels and item filters.

---

## 4. Per-Page Details

### Attribution.tsx

- **userIdCol**: `<option value="">选择列</option>` → `<SelectItem value="none">选择列</SelectItem>`
- **touchpointCol**: same pattern
- **timestampCol**: optgroup replaced with `SelectGroup` + `SelectLabel`
- **conversionCol**: `<option value="">无</option>` → `<SelectItem value="none">无</SelectItem>`
- **conversionValueCol**: filtered to numeric columns only, same sentinel

### Statistics.tsx

- No sentinel needed (`selectedColumn` defaults to `"all"`).
- Three `<optgroup>` blocks replaced with three `SelectGroup` blocks.

### Forecast.tsx

- **dateColumn**: `<option value="">自动检测</option>` → `<SelectItem value="auto">自动检测</SelectItem>`
- **valueColumn**: same sentinel, no optgroups (two inline `.filter()` blocks)

### PathAnalysis.tsx

- **userIdCol**, **eventCol**, **timestampCol**: all use `auto` sentinel.
- **timestampCol** has optgroups → `SelectGroup`.

### Visualization.tsx

- **xAxis**, **yAxis**: `none` sentinel, revert to `""`
- **colorBy**: `none` sentinel, revert to `undefined` (preserves original `|| undefined` semantics)
- **aggregation**: static enum (sum/avg/count/min/max), no sentinel needed, direct pass-through

### GoalPlanner.tsx

- **targetLevelId**: dynamic options from `funnelLevels` state. Added placeholder `<SelectItem value="none">选择目标层级</SelectItem>` for empty state.
- No empty option existed in native select, but state can be `''` before user selection.

---

## 5. What Was Intentionally Not Changed

- **All business logic**: state initialization, API payload construction, ECharts options, polling logic, CSV export — zero changes.
- **Multi-select checkboxes**: Attribution's `additionalTouchpointCols`, PathAnalysis's `sequenceAdditionalCols`, Forecast's `selectedBatchColumns` — native checkboxes remain.
- **Forecast model selector buttons**: Custom 3-way toggle (modelType). Medium-risk button group, deferred.
- **Forecast promotion/aux var checkboxes**: Native checkboxes. Deferred to Phase 4A-5-4.
- **Other native controls**: Any `<table>`, `<input type="checkbox">`, `<input type="number">` not in scope.

---

## 6. Validation Results

### Type Check
```bash
cd app && npx tsc --noEmit
# Result: 0 errors ✅
```

### Production Build
```bash
cd app && npm run build
# Result: built in 29.80s ✅
```

### Remaining Native Select Check
```powershell
cd app
Select-String -Path "src/pages/Attribution.tsx","src/pages/Statistics.tsx","src/pages/Forecast.tsx","src/pages/PathAnalysis.tsx","src/pages/Visualization.tsx","src/pages/GoalPlanner.tsx" -Pattern "<select" -SimpleMatch
# Result: no native `<select` remaining ✅ (only `<Select` component tags)
```

### SelectItem Empty Value Check
```powershell
cd app
Select-String -Path "src/**/*.tsx" -Pattern 'SelectItem value=""'
# Result: no output ✅

Select-String -Path "src/**/*.tsx" -Pattern "SelectItem value=''"
# Result: no output ✅
```

---

## 7. Known Issues / TODO

- **shadcn Select styling**: Default Tailwind semantic classes may not perfectly match custom dark theme in all edge cases. Visual regression testing recommended when backend is available.
- **Bundle size**: JS chunk ~3,392 KB. Deferred to Phase 4A-6.

---

## 8. Can the Project Proceed to Phase 4A-5-4?

**Yes.** All dynamic column selectors have been migrated with sentinel mapping verified. Build gate is clean. Phase 4A-5-4 (remaining native checkboxes, custom toggles, and tables) can proceed.

---

## 9. Git Information

### Git Status Before Commit

```
M  app/src/pages/Attribution.tsx
M  app/src/pages/Statistics.tsx
M  app/src/pages/Forecast.tsx
M  app/src/pages/PathAnalysis.tsx
M  app/src/pages/Visualization.tsx
M  app/src/pages/GoalPlanner.tsx
M  docs/CURRENT_PROGRESS.md
M  docs/CHANGELOG.md
?? docs/phase-logs/PHASE_4A_5_3_DYNAMIC_COLUMN_SELECTS.md
```

> No package files modified.

### Commit

```bash
git add app/src/pages/Attribution.tsx app/src/pages/Statistics.tsx app/src/pages/Forecast.tsx app/src/pages/PathAnalysis.tsx app/src/pages/Visualization.tsx app/src/pages/GoalPlanner.tsx docs/CURRENT_PROGRESS.md docs/CHANGELOG.md docs/phase-logs/PHASE_4A_5_3_DYNAMIC_COLUMN_SELECTS.md
git commit -m "refactor: migrate dynamic column selects to shadcn Select with sentinel mapping"
```

---

*End of phase log.*
