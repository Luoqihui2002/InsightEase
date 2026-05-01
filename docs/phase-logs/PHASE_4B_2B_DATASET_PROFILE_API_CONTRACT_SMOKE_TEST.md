# Phase 4B-2B: Dataset Profile API Contract Smoke Test & Casing Fix

## Objective

Verify and stabilize the API contract between the backend dataset profile endpoint and frontend TypeScript types. Resolve the potential snake_case / camelCase mismatch noted in Phase 4B-2.

---

## Files Inspected

| File | Purpose |
|------|---------|
| `insightease-backend/app/schemas/base.py` | `ResponseModel` wrapper: `{ code, message, data }` |
| `insightease-backend/app/api/v1/endpoints/assistant.py` | Endpoint returns `ResponseModel[dict]` with snake_case keys |
| `insightease-backend/app/services/assistant_profile_service.py` | Service returns plain Python dicts with snake_case keys |
| `app/src/lib/request.ts` | Axios interceptor returns `response.data` directly |
| `app/src/types/api.ts` | `ApiResponse<T>` and existing types (`Dataset`, `FieldSchema`) use snake_case |
| `app/src/api/assistant.ts` | Frontend API client calling `/assistant/profile-dataset` |

---

## Actual Backend Response Shape

The backend `profile_dataset` service returns a plain Python dict with **snake_case** keys:

```python
{
    "dataset_id": "...",
    "row_count": 500,
    "column_count": 9,
    "columns": [
        {
            "name": "user_id",
            "dtype": "object",
            "semantic_type": "identifier",
            "role": "user_id",
            "null_count": 0,
            "null_rate": 0.0,
            "unique_count": 500,
            "unique_rate": 1.0,
            "examples": ["U00001", "U00002"],
            "min": None,
            "max": None,
            "mean": None,
            "std": None,
            "warnings": []
        }
    ],
    "classification": {
        "table_type": "user",
        "confidence": 0.9,
        "evidence": ["..."],
        "recommended_analyses": ["Statistics"],
        "warnings": []
    },
    "quality_warnings": [],
    "generated_at": "2026-04-28T..."
}
```

The endpoint wraps this in `ResponseModel[dict]`:

```json
{
  "code": 200,
  "message": "success",
  "data": { /* snake_case DatasetProfile */ }
}
```

## ResponseModel Wrapper Behavior

Confirmed: backend uses `ResponseModel[dict]` which serializes as `{ code, message, data }`.

Frontend axios interceptor `(response) => response.data` unwraps this, so `assistantApi.profileDataset()` returns `ApiResponse<DatasetProfile>` directly.

## Existing Project Casing Convention

After inspecting `app/src/types/api.ts`, the project convention is **snake_case in frontend types**:

```ts
// Dataset type — snake_case
export interface Dataset {
  id: string;
  filename: string;
  row_count: number;
  col_count: number;
  file_size: number;
  schema: FieldSchema[];
  quality_score?: number;
  ai_summary?: string;
  status: 'uploaded' | 'scanning' | 'ready' | 'error';
  created_at: string;
}

// FieldSchema — snake_case
export interface FieldSchema {
  name: string;
  dtype: string;
  semantic_type?: string;
  sample_values?: any[];
}

// Analysis type — snake_case
export interface Analysis {
  id: string;
  dataset_id: string;
  result_data?: any;
  ai_interpretation?: string;
  created_at: string;
  completed_at?: string;
  error_msg?: string;
}
```

Also confirmed in `app/src/api/analysis.ts`:
- `dataset_id` parameter names
- `row_count`, `col_count` in response types

## Casing Decision

**Align `DatasetProfile` types with existing snake_case convention.**

Rationale:
1. Backend already returns snake_case.
2. Existing frontend types (`Dataset`, `Analysis`, `FieldSchema`) use snake_case.
3. No mapping/normalizer layer needed — direct type compatibility.
4. Future UI can consume `profile.dataset_id`, `profile.row_count`, `profile.columns[0].null_rate` naturally.

## Files Modified

| File | Change |
|------|--------|
| `app/src/types/assistant.ts` | Changed all fields from camelCase to snake_case to match backend output and existing project convention |

**No other files needed modification.** The backend service already returns snake_case. The API client already passes through snake_case.

### Type mapping applied

| Before (camelCase) | After (snake_case) |
|--------------------|--------------------|
| `datasetId` | `dataset_id` |
| `rowCount` | `row_count` |
| `columnCount` | `column_count` |
| `semanticType` | `semantic_type` |
| `nullCount` | `null_count` |
| `nullRate` | `null_rate` |
| `uniqueCount` | `unique_count` |
| `uniqueRate` | `unique_rate` |
| `tableType` | `table_type` |
| `recommendedAnalyses` | `recommended_analyses` |
| `qualityWarnings` | `quality_warnings` |
| `generatedAt` | `generated_at` |

---

## Validation Results

| Check | Result |
|-------|--------|
| `cd app && npx tsc --noEmit` | ✅ 0 errors |
| `cd app && npm run build` | ✅ built in 23.78s |
| `cd insightease-backend && python -m compileall app` | ✅ no syntax errors |
| No package files modified | ✅ confirmed |

---

## Known Limitations

1. **On-demand only, no caching** — Same as Phase 4B-2. Every request re-reads the file.
2. **No runtime API smoke test** — The backend was not started in this phase. The casing fix is based on static code inspection of the serializer (`ResponseModel` + plain dict) and existing project conventions.
3. **Future UI must use snake_case** — `DatasetUnderstandingCard` and other assistant UI components should access `profile.row_count`, `profile.columns[0].null_rate`, etc.

---

## Next Recommended Phase

**Phase 4B-3: Static Dataset Understanding UI**

- Add `DatasetUnderstandingCard` component
- Populate from `DatasetProfile` using snake_case fields
- Show column role badges, quality warnings, recommended analyses

---

## Git Information

```
Branch: master
Origin: https://github.com/Luoqihui2002/InsightEase.git
```

---

*Phase completed: 2026-04-28*
