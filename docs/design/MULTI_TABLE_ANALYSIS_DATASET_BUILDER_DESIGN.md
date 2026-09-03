# Multi-table Analysis Dataset Builder

**Status:** implemented in V1.0 P0C on 2026-09-03
**Detailed closure record:** `docs/phase-logs/V1_0_P0C_MULTI_TABLE_ANALYSIS_DATASET_BUILDER.md`

## Purpose

Existing analysis modules consume one Dataset. P0B can return a validated plan that requires two or three tables. The Analysis Dataset Builder bridges those contracts without giving an LLM execution authority:

```text
AnalysisPlan needs_join
-> deterministic JoinPlan
-> explicit Preview
-> risk review
-> explicit Create Dataset
-> one derived Dataset id
-> existing analysis-page prefill
```

## Product Boundaries

The builder may execute only ordered, structured `left` or `inner` joins over two or three user-owned datasets. It never accepts SQL, arbitrary expressions, Python code, or free-form conditions. It never mutates a source Dataset, saves during preview, creates an analysis task, or auto-runs an analysis.

Hermes proposes dataset, field, metric, and relationship requirements. InsightEase constructs and executes the JoinPlan deterministically only after user actions.

## JoinPlan

```ts
interface JoinPlan {
  id: string;
  source_analysis_plan_id: string;
  relationship_set_id: string;
  base_dataset_id: string;
  included_dataset_ids: string[]; // exactly 2–3
  join_steps: JoinStep[];         // exactly datasets - 1
  confirmed_relationships: ConfirmedJoinRelationship[];
  selected_fields: Record<string, string[]>;
  output_columns: string[];
  warnings: string[];
  requires_confirmation: true;
}

interface JoinStep {
  left_dataset_id: string;
  right_dataset_id: string;
  left_field: string;
  right_field: string;
  join_type: 'left' | 'inner';
  relationship_id: string;
  relationship_status: 'confirmed';
  expected_cardinality:
    | 'one_to_one'
    | 'one_to_many'
    | 'many_to_one'
    | 'many_to_many'
    | 'unknown';
}
```

The frontend chooses the first required dataset as the base and grows a connected ordered chain. Only exact confirmed relationships in the active Relationship Set can become steps. When more than one equal-risk next step exists, it asks for clarification instead of guessing.

Selected fields default to required analysis fields, metric fields, identifiers, and join keys. This prevents accidental wide-table construction.

## Relationship Validation

An executable step must match one confirmed relationship snapshot by:

- relationship id;
- both dataset ids;
- both field names;
- confirmed status;
- oriented expected cardinality.

The same edge may execute in reverse direction. In that case `one_to_many` and `many_to_one` are inverted. Matching column names alone never establish permission to join.

Relationship Sets remain browser-local in V1. The exact confirmed subset is sent with the plan and stored in lineage; server-side Relationship Set persistence is deferred.

## APIs

### `POST /api/v1/assistant/join/preview`

Request:

```json
{
  "join_plan": {},
  "max_preview_rows": 20
}
```

The endpoint authenticates the user, verifies ownership/deletion state for every source, validates the strict contract and fields, reads through the storage abstraction, estimates expansion, performs safe pandas joins, and returns at most 50 preview rows. It does not write files or database records.

### `POST /api/v1/assistant/join/create-dataset`

Request:

```json
{
  "join_plan": {},
  "filename": "channel_analysis_joined.csv",
  "confirm_create": true,
  "confirm_high_risk": false
}
```

The endpoint recomputes the preview rather than trusting client metrics. Blocked joins are rejected; high-risk joins require `confirm_high_risk=true`. A successful request creates one normal Dataset plus lineage.

## Preview and Risk Contract

The response includes input/final row counts, output columns, at most 50 result rows, per-step matched/unmatched counts, match rate, null/duplicate-key rates, detected cardinality, row multiplier, warnings, result grain, and aggregate risk. Null keys never match each other.

### Cardinality

| Left key | Right key | Result |
|---|---|---|
| unique | unique | 1:1 |
| unique | duplicate | 1:N |
| duplicate | unique | N:1 |
| duplicate | duplicate | N:N |

### Risk levels

- `low`: expected shape and healthy matching.
- `medium`: moderate expansion/unmatched/null rates or a medium-risk edge.
- `high`: N:N, expected/actual cardinality mismatch, more than 2x expansion, low match rate, or a high-risk edge.
- `blocked`: estimated result exceeds 1,000,000 rows or the current step exceeds 5x expansion.

Frequency-count estimation runs before each merge so a blocked explosion is not materialized.

## Column Naming

Base-dataset column names are preserved. A conflicting right-side column becomes:

```text
<sanitized_right_filename_stem>__<column>
```

Numeric suffixes are added deterministically if required. Pandas `_x` / `_y` suffixes are never exposed. The duplicate right join key is removed while its lineage maps to the surviving left key, allowing safe three-table chains.

## Storage and Lineage

Join and Transform share `load_dataset_dataframe`, which reads CSV/Excel through the configured storage implementation. The created output is saved as UTF-8 CSV and registered in the existing Dataset model.

Lineage fields:

```text
source_dataset_ids
derivation_type = join
derivation_plan
derivation_risk_summary
parent_dataset_id = base dataset (compatibility only)
```

The Dataset row also retains normal `user_id`, `created_at`, row/column counts, schema, size, quality score, and storage path. Existing databases must apply `migrations/20260903_add_join_lineage_fields.sql`.

## UI Flow

The Workbench plan card exposes `创建分析数据集` for eligible `needs_join` plans. The modal shows analysis goal, source datasets, steps, join keys/types, included fields, preview metrics, risk/grain warnings, preview rows, filename, and confirmations.

The user must open the builder, click Preview, review risk, confirm creation, confirm high risk separately when applicable, and click Continue after creation. Only the last action navigates with the derived dataset prefill. It does not start analysis.

## V1 Limits and Deferred Work

- 2–3 datasets;
- `left` and `inner` only;
- 250,000 rows and 100 MB per source;
- 1,000,000 output rows;
- 200 output columns;
- 50 preview rows;
- in-process pandas execution;
- no arbitrary graph optimizer or SQL engine;
- no temporary TTL datasets;
- no server-side Relationship Set persistence;
- no automatic analysis execution.
