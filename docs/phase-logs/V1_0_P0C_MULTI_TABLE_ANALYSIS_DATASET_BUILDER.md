# InsightEase V1.0 P0C — Multi-table Analysis Dataset Builder

**Date:** 2026-09-03
**Status:** implementation complete; automated checks passed, browser QA remains manual

## 1. Scope

P0C closes the gap between a validated multi-table `AnalysisPlan` and the existing single-dataset analysis modules. It supports two or three source datasets, deterministic `left`/`inner` joins, bounded preview, risk review, explicit creation, lineage, and analysis-page prefill.

P0C does not add arbitrary SQL, LLM tool execution, automatic joins, automatic analysis execution, source mutation, a DAG editor, or P0D demo work.

### Implementation inventory

Inspected the existing Dataset model/endpoints, Transform service/storage layer, Assistant contracts and runtime, Relationship Set store/review UI, AnalysisPlanCard/AIWorkspace, prefill navigation, migrations, tests, and current architecture/API/roadmap documents.

Primary additions are `app/src/types/join.ts`, `app/src/api/join.ts`, `app/src/lib/assistant/joinPlanBuilder.ts`, `app/src/components/assistant/JoinBuilderPanel.tsx`, backend `schemas/join.py`, `services/dataset_io_service.py`, `services/join_service.py`, `endpoints/join.py`, the lineage migration, and `tests/test_join_service.py`. Existing Dataset, Transform, AI Workbench, plan card, API router, README, architecture, contract, progress, roadmap, and changelog files were updated in place.

## 2. Architecture

```text
Hermes / deterministic AnalysisPlan
  -> frontend deterministic JoinPlan builder
  -> authenticated backend validation
  -> shared storage-backed Dataset reader
  -> pandas preview + risk engine
  -> explicit user confirmation
  -> existing Dataset persistence
  -> existing analysis-page prefill
```

Hermes proposes requirements only. The frontend constructs the plan from the exact active Relationship Set snapshot; the backend accepts only a strict structured contract and never accepts SQL, Python expressions, or free-form join conditions.

## 3. JoinPlan Contract

`JoinPlan` records the source `AnalysisPlan`, Relationship Set id, base dataset, two or three included datasets, ordered steps, an exact confirmed relationship snapshot, minimal selected fields, warnings, and a mandatory confirmation boundary.

Every step contains the two dataset ids and fields, `left` or `inner` join type, relationship id/status, and oriented expected cardinality. Unknown datasets, extra fields, unsupported join types, incomplete step counts, and malformed contracts are rejected.

## 4. API Contract

- `POST /api/v1/assistant/join/preview`: validates and recomputes a bounded preview; performs no write.
- `POST /api/v1/assistant/join/create-dataset`: recomputes the same plan, enforces risk confirmation, and persists one derived Dataset.

Both endpoints require the normal authenticated user. Preview and write are intentionally separate.

## 5. Relationship Safety Rules

- Join keys must match one exact edge in the supplied active Relationship Set snapshot.
- The snapshot edge and step must both be `confirmed`.
- Matching field names, candidate relationships, or LLM suggestions are never enough.
- Reversed execution of a confirmed edge is supported with cardinality direction inverted (`1:N` becomes `N:1`).
- The backend revalidates ids, fields, order, relationship id/endpoints, and expected cardinality.

Relationship Sets are currently browser-local. Therefore the confirmed edge snapshot is included in the signed-in request and stored in the derived Dataset lineage. Server-side Relationship Set persistence remains deferred.

## 6. Join Preview

Preview reports input and output row counts, output columns, at most 50 result rows, per-step match/unmatched counts, match rate, null-key rate, duplicate-key rate, detected cardinality, row multiplier, warnings, result grain, and aggregate risk.

Null keys never match each other. Preview uses the same deterministic engine as creation but does not call storage save or create a Dataset record.

## 7. Cardinality Detection

Cardinality is detected from non-null key uniqueness on both sides:

- unique / unique -> `one_to_one`
- unique / duplicate -> `one_to_many`
- duplicate / unique -> `many_to_one`
- duplicate / duplicate -> `many_to_many`

An actual/expected mismatch is high risk.

## 8. Risk Model

- Low: expected shape, good match rate, no material row expansion.
- Medium: moderate expansion, moderate unmatched rate, elevated null keys, or a medium-risk confirmed edge.
- High: `N:N`, unexpected cardinality, more than 2x expansion, under 50% match, or a high-risk confirmed edge.
- Blocked: estimated output above 1,000,000 rows or more than 5x the current intermediate result.

High risk requires an additional checkbox and backend flag. Blocked previews cannot be created.

## 9. Row Explosion Protection

The service estimates exact join output counts from key frequency tables before running each merge. It stops before the dangerous merge when the absolute or multiplier limit is exceeded. V1 also limits sources to three datasets, each source to 250,000 rows / 100 MB, and output to 200 columns.

## 10. Dataset Lineage

Joined outputs reuse `Dataset`; no parallel `JoinedDataset` model was introduced. The model now stores:

- `source_dataset_ids`
- `derivation_type = join`
- `derivation_plan`
- `derivation_risk_summary`
- the existing `parent_dataset_id` as a backward-compatible base-parent pointer

Run `insightease-backend/migrations/20260903_add_join_lineage_fields.sql` once for an existing database. New databases receive the fields from model metadata.

## 11. UI Flow

`AnalysisPlanCard` exposes `创建分析数据集` only for `needs_join` plans with enough confirmed requirements. The modal shows goal, sources, ordered steps, join types/keys, selected fields, preview metrics, risk warnings, bounded rows, filename, and confirmations.

After successful creation, `继续到建议分析页` writes a single derived dataset id into the existing prefill payload. Navigation remains a user action and the target page does not auto-run analysis.

## 12. Tests

Backend coverage includes 1:1, 1:N, N:N, partial matches, null keys, deterministic collision naming, missing/unconfirmed relationships, foreign/missing datasets, missing fields, row explosion, preview no-write behavior, three-table chains, reversed cardinality, high-risk confirmation, and persisted lineage.

Frontend static gates cover the strict contract and UI integration through TypeScript production build and ESLint.

Final automated result: backend `105 passed, 6 skipped`; the skipped cases are opt-in live Hermes integrations. Frontend `npm run build` passed. `npm run lint` passed with zero errors and 355 pre-existing repository warnings. `git diff --check` passed.

## 13. Manual QA

See `docs/qa/P0C_MULTI_TABLE_JOIN_BUILDER_QA.md`. The checklist covers the two-table happy path, three-table sequence, blocked/high risk, unconfirmed edges, explicit write boundary, Dataset Catalog visibility, and prefill without auto-run.

## 14. Known Limitations

- Relationship Sets remain browser-local rather than server-persisted entities.
- Join execution loads bounded source files into one backend process; no distributed/SQL engine is used.
- V1 supports only two or three CSV/Excel datasets and `left`/`inner` joins.
- Selected fields are deterministic minimal defaults; no advanced field editor is included.
- Collision-prefixed fields may not be auto-selected in the target analysis page if the original suggestion name changed.
- Database migration remains a checked-in manual SQL step; Alembic is not yet installed.

## 15. Deferred Items

Server-side Relationship Set persistence, durable audit events, large-data query execution, wider join graphs, advanced field editing, automatic browser tests, and temporary datasets with TTL remain outside P0C.

## 16. P0D Handoff

The product chain is now:

```text
Business Question
-> Hermes Live AnalysisPlan
-> validated multi-table requirements
-> deterministic JoinPlan
-> preview + risk checks
-> user confirmation
-> derived Dataset
-> existing analysis page
-> ResultView / SafeResultSummary
-> Hermes result explanation
```

P0D should contain only fixed demo data, end-to-end scenarios, real Hermes smoke testing, UI polish, bug fixes, recording, and interview narrative. No P0D work is included here.
