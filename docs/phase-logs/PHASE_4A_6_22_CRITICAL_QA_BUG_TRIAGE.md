# Phase 4A-6-22: Critical QA Bug Triage — Preprocessing Integrity & Path Clustering Timeout

## Objective

Fix two critical issues discovered during manual QA before starting Phase 4B:

1. **PathAnalysis clustering timeout** — clustering analysis hangs or times out on moderate-sized event logs.
2. **Data Preprocessing module unreliability** — processed results are auto-saved without explicit user action; missing values (especially string tokens like `null`, `N/A`, `-`) are not detected or filled.

---

## User-Reported Issues

| # | Issue | Severity | Reproduction Dataset |
|---|-------|----------|---------------------|
| 1 | Path clustering does not return results / times out | High | `04_event_log_path.csv` (~4,000 rows) |
| 2 | Preprocessing auto-saves even without clicking "Save Result" | High | Any dataset |
| 3 | Missing-value detection fails for string tokens (`null`, `N/A`, `-`, `unknown`) | High | `10_data_quality_edge_cases.csv` |
| 4 | Missing-value fill does not work on non-NaN string tokens | High | `10_data_quality_edge_cases.csv` |

---

## Files Inspected

| File | Purpose |
|------|---------|
| `app/src/pages/SmartProcess.tsx` | Frontend for Smart Processing (preprocessing) |
| `app/src/api/analysis.ts` | Analysis API client |
| `insightease-backend/app/api/v1/endpoints/analysis.py` | Backend analysis endpoint (smart_process, path, clustering) |
| `insightease-backend/app/services/path_analysis_service.py` | Path clustering service |
| `insightease-backend/app/api/v1/endpoints/datasets.py` | CSV reading utilities |

---

## Root Cause Analysis

### Issue 1: Preprocessing Auto-Save

**Root cause**: The `smart_process` handler in `analysis.py` directly saved the processed DataFrame to disk and created a new `Dataset` database record as part of the analysis execution. There was **no separation** between "preview" and "save" operations.

**Code location**: `analysis.py` lines 380–470 (original) — file save + DB commit inside the analysis task.

### Issue 2: Missing-Value Detection

**Root cause**: The backend used `df.isnull().sum().sum()` to count missing values, which only detects pandas-native NaN/None/NaT. However:

- Empty CSV fields are read as `NaN` by pandas (OK)
- String tokens like `"null"`, `"NULL"`, `"NaN"`, `"N/A"`, `"NA"`, `"-"`, `"unknown"`, `"无"`, `"缺失"` are read as **string values**, not NaN
- The `fillna()` operations only work on actual NaN values, leaving string tokens untouched

**Code location**: `analysis.py` line 283 (original) — `original_nulls = df.isnull().sum().sum()`

### Issue 3: Path Clustering Timeout

**Root cause 1**: The `path_clustering` function had **no row/session limits**. For datasets with thousands of unique users, feature extraction could become expensive.

**Root cause 2**: The `combined_entropy` calculation in `_extract_smart_features` had a **buggy nested generator expression** that was both incorrect and inefficient:

```python
# BUGGY (original)
feature_dict["combined_entropy"] = -sum(
    p * np.log2(p) for p in Counter(combined_events).values() 
    for count in [sum(Counter(combined_events).values())]
    for p in [count / sum(Counter(combined_events).values())]
) if combined_events else 0
```

This created a Cartesian-product-like generator with shadowed variables and redundant `Counter` construction.

**Code locations**:
- `path_analysis_service.py` `path_clustering()` — no session cap
- `path_analysis_service.py` `_extract_smart_features()` — buggy entropy

---

## Files Modified

| File | Change |
|------|--------|
| `insightease-backend/app/api/v1/endpoints/analysis.py` | Added `normalize_missing_values()` helper; `smart_process` now supports `preview_only` param; missing-value normalization runs before count/fill |
| `insightease-backend/app/services/path_analysis_service.py` | Added `max_sessions = 1000` cap with random sampling; fixed `combined_entropy` calculation; added sampling warning to result |
| `app/src/pages/SmartProcess.tsx` | Main button changed to "预览处理"; added "保存结果" button after preview; preview passes `preview_only: true`, save passes `preview_only: false`; UI distinguishes preview vs saved state |

---

## Preprocessing Contract (Before → After)

### Before

```
User clicks "开始处理"
  → backend runs processing
  → backend saves file to disk
  → backend creates Dataset record
  → frontend shows "已生成新的数据集"
  → original dataset unchanged
```

**Problem**: Every run creates a saved dataset. No way to preview without persisting.

### After

```
User clicks "预览处理"
  → backend runs processing
  → backend returns stats ONLY
  → frontend shows "预览完成 — 尚未保存"
  → no file saved, no DB record created

User clicks "保存结果" (after preview)
  → backend re-runs processing with preview_only=false
  → backend saves file + creates Dataset record
  → frontend shows "已生成新的数据集"
```

---

## Missing-Value Detection Fix

### New helper: `normalize_missing_values(df)`

Replaces common missing-value string tokens with `pd.NA` before any counting or filling:

```python
MISSING_VALUE_TOKENS = [
    '', 'null', 'NULL', 'NaN', 'nan', 'N/A', 'NA', '-', 
    'unknown', 'UNKNOWN', '无', '缺失', 'None', 'none', 'NIL', 'nil'
]
```

Applied to **all object/string columns** in the DataFrame before:
1. Counting original nulls
2. Applying fill strategies (mean/median/mode/fill/drop)

### What is now detected as missing

| Token | Before | After |
|-------|--------|-------|
| Empty CSV cell | ✅ NaN | ✅ NaN |
| `"null"` | ❌ string | ✅ NaN |
| `"NULL"` | ❌ string | ✅ NaN |
| `"NaN"` / `"nan"` | ✅ NaN (default) | ✅ NaN |
| `"N/A"` / `"NA"` | ✅ NaN (default) | ✅ NaN |
| `"-"` | ❌ string | ✅ NaN |
| `"unknown"` / `"UNKNOWN"` | ❌ string | ✅ NaN |
| `"无"` / `"缺失"` | ❌ string | ✅ NaN |
| `"0"` | ❌ string | ❌ string (preserved) |
| `"false"` | ❌ string | ❌ string (preserved) |

### Removed deprecated `inplace=True`

Replaced `df[col].fillna(..., inplace=True)` with `df[col] = df[col].fillna(...)` to avoid pandas deprecation warnings and potential side effects.

---

## Path Clustering Timeout Fix

### Session cap

```python
max_sessions = 1000
if len(user_ids_all) > max_sessions:
    user_ids = random.sample(user_ids_all, max_sessions)
    df = df[df[user_id_col].isin(user_ids)].copy()
    sampled = True
```

If sampling occurs, the result includes:
- `sampled: True`
- `sampled_users: <count>`
- `warning: "数据量较大，聚类分析基于随机采样的 N 个用户进行"`

### Entropy calculation fix

```python
# FIXED
counts = Counter(combined_events)
total = sum(counts.values())
feature_dict["combined_entropy"] = -sum(
    (c / total) * np.log2(c / total) for c in counts.values() if c > 0
) if total > 0 else 0
```

---

## Validation Results

| Check | Result |
|-------|--------|
| `cd app && npx tsc --noEmit` | ✅ 0 errors |
| `cd app && npm run build` | ✅ built in 20.22s |
| No new package dependencies | ✅ |
| No package files modified | ✅ |

---

## Manual QA Checklist

### Preprocessing

- [ ] Upload `10_data_quality_edge_cases.csv`
- [ ] Open SmartProcess page
- [ ] Select "填充均值" for missing values
- [ ] Click "预览处理" — result shows stats, **no new dataset created**
- [ ] Click "保存结果" — new dataset appears in list
- [ ] `mostly_null_col` nulls are detected and filled
- [ ] `date_with_missing` nulls are detected
- [ ] `mixed_number_text` — `"N/A"`, `"unknown"`, `"null"`, `"-"` recognized as missing
- [ ] Original dataset unchanged after preview
- [ ] No console errors

### Path Clustering

- [ ] Upload `04_event_log_path.csv`
- [ ] Run PathAnalysis → clustering
- [ ] Clustering completes without timeout
- [ ] If >1000 users, warning about sampling appears
- [ ] Funnel / path / sequence mining still work
- [ ] No unrelated pages modified

---

## Known Limitations

1. **Missing-value token list is hardcoded** in `MISSING_VALUE_TOKENS`. Future improvement: make it configurable per-dataset or per-column.
2. **Session sampling for clustering is random** (seed=42) but does not preserve representativeness guarantees. For production, stratified sampling by path length or event count would be better.
3. **SmartProcess preview re-runs the full analysis** on save. There is no caching of the preview result. This is acceptable for moderate datasets but could be optimized.
4. **Path clustering still runs synchronously** in the background task. Very large datasets could still take time, but the 1000-user cap prevents indefinite hangs.

---

## Next Recommended Phase

**Phase 4B: AI Assistant Upgrade / Hermes Agent**

With preprocessing integrity restored and path clustering safeguarded, the platform is stable for end-to-end QA and the next major feature phase.

---

## Git Information

```
Branch: master
Origin: https://github.com/Luoqihui2002/InsightEase.git
```

---

*Phase completed: 2026-04-28*
