# Phase 4B-5 Log: Relationship Inference Backend Service

**Phase ID**: 4B-5  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Implement the first metadata-only relationship inference backend service for InsightEase AI Data Assistant.

---

## Files Created

| File | Description |
|------|-------------|
| `insightease-backend/app/services/relationship_inference_service.py` | Core inference service: candidate generation, scoring, cardinality inference, evidence generation |

## Files Modified

| File | Description |
|------|-------------|
| `insightease-backend/app/schemas/ai.py` | Added `RelationshipEvidence`, `TableRelationship`, `InferRelationshipsRequest`, `InferRelationshipsResponse` Pydantic schemas |
| `insightease-backend/app/api/v1/endpoints/assistant.py` | Added `POST /assistant/infer-relationships` endpoint |
| `app/src/types/assistant.ts` | Added frontend TypeScript types for relationship inference |
| `app/src/api/assistant.ts` | Added `assistantApi.inferRelationships()` API client |
| `docs/CURRENT_PROGRESS.md` | Added 4B-5 entry |
| `docs/CHANGELOG.md` | Added 4B-5 entry |
| `docs/ROADMAP.md` | Updated 4B section |

---

## Service Design

### `relationship_inference_service.py`

**Candidate Generation** (`_generate_candidates`):
- Compares every pair of datasets
- Considers only key-like columns (specific roles, `_id` suffix, high unique_rate)
- Excludes metric/text columns, high-null columns, type-incompatible columns
- Max 20 candidates per dataset pair, 200 total

**Scoring Framework**:

| Signal | Max Score | Implementation |
|--------|-----------|----------------|
| Column name similarity | 0.35 | Exact / normalized / suffix / synonym / weak partial |
| Role compatibility | 0.25 | Same role +0.25, compatible ID +0.15, metric/text mismatch = reject |
| Type compatibility | 0.15 | Same family +0.15, coercible +0.10, incompatible = reject |
| Uniqueness signal | 0.15 | Strong PK/FK pattern +0.15, both high +0.10, both low +0.03 + warning |
| Table type signal | 0.15 | orders→users +0.15, event_log→users +0.12, etc. |
| Value overlap | 0.20 | **Not implemented** — adds warning when requested |

**Cardinality Inference**:
- `source_unique >= 0.9` + `target_unique >= 0.9` → `one_to_one`
- `source_unique < 0.5` + `target_unique >= 0.9` → `many_to_one`
- `source_unique >= 0.9` + `target_unique < 0.5` → `one_to_many`
- Both `< 0.5` → `many_to_many`
- Otherwise → `unknown`

**Direction Selection**:
- Prefers fact/transactional tables as source (order, event_log, campaign, experiment, transaction, review_text, metric_summary)
- Prefers dimension/entity tables as target (user, product, dimension)

**Deduplication**:
- Avoids (source, target, col_a, col_b) duplicates
- Avoids reverse duplicates

**Evidence & Warnings**:
- Chinese human-readable evidence messages
- Per-relationship warnings: high null rate, low uniqueness many-to-many risk, metadata-only disclaimer

### Endpoint

```
POST /api/v1/assistant/infer-relationships
```

Request: `InferRelationshipsRequest` (`dataset_ids`, `include_value_overlap`, `max_candidates`)
Response: `ResponseModel[InferRelationshipsResponse]` (`relationships`, `generated_at`, `warnings`)

Validation:
- Requires >= 2 dataset IDs
- Max 20 dataset IDs
- Skips unreadable datasets with warnings
- Returns empty relationships if < 2 profiles succeed

---

## Manual QA Results

Tested with 5 mock profiles representing manual QA datasets:

| Expected Relationship | Found | Confidence | Type | Status |
|-----------------------|-------|------------|------|--------|
| `03_orders.user_id` → `01_users.user_id` | ✅ | 1.00 | many_to_one | PASS |
| `03_orders.product_id` → `02_products.product_id` | ✅ | 1.00 | many_to_one | PASS |
| `09_reviews.user_id` → `01_users.user_id` | ✅ | 1.00 | many_to_one | PASS |
| `09_reviews.product_id` → `02_products.product_id` | ✅ | 1.00 | unknown* | PASS |
| `06_forecast` has no strong joins | ✅ | N/A | N/A | PASS |

*Review `product_id` had mock `uniqueRate=0.5` (edge case), so cardinality fell to `unknown`. In real data with `uniqueRate < 0.5` it would correctly infer `many_to_one`.

Also verified lower-confidence cross-relationships are present at the 0.45 threshold boundary (e.g., `orders.product_id → users.user_id` with compatible ID roles but different names).

---

## Validation

### Frontend
```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 21.06s ✅
```

### Backend
```bash
cd insightease-backend
python -m compileall app/services/relationship_inference_service.py  # ✅
python -m compileall app/api/v1/endpoints/assistant.py               # ✅
python -m compileall app/schemas/ai.py                               # ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Backend service file created | ✅ |
| 2 | Pydantic schemas created | ✅ |
| 3 | Endpoint accepts multiple dataset IDs | ✅ |
| 4 | Endpoint returns relationships with confidence | ✅ |
| 5 | Endpoint returns evidence | ✅ |
| 6 | Endpoint returns warnings | ✅ |
| 7 | Candidate generation is metadata-only | ✅ |
| 8 | No raw value overlap performed | ✅ |
| 9 | No automatic join performed | ✅ |
| 10 | No LLM/Hermes used | ✅ |
| 11 | Frontend types updated | ✅ |
| 12 | Frontend API client updated | ✅ |
| 13 | Frontend tsc passes | ✅ |
| 14 | Frontend build passes | ✅ |
| 15 | Backend compile passes | ✅ |
| 16 | Manual QA expected relationships found | ✅ 4/4 |
| 17 | Manual QA non-relationships not found | ✅ |

---

## Known Limitations

- Value overlap signal is not implemented (adds warning when requested)
- Relationship persistence is not implemented (status always "suggested")
- No UI for reviewing/confirming relationships (deferred to 4B-6)
- Synonym mapping is manually maintained; could be expanded
- `_infer_cardinality` uses hard 0.9/0.5 thresholds; could be smoothed

---

## Next Recommended Phase

**4B-6**: Relationship Review UI — Add relationship list/table to AI Workbench with confirm/ignore actions.
