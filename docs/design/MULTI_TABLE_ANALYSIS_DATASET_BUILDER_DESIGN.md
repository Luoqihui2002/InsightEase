# Multi-table Analysis Dataset Builder Design

## Purpose

AI Workbench can now reason about Dataset Catalog metadata, active Relationship Sets, and multi-table analysis plans. The missing bridge is execution: most existing analysis modules still expect one dataset id.

This design defines a safe Multi-table Analysis Dataset Builder that can turn a user-confirmed Relationship Set subset into a temporary or saved analysis-ready dataset in future phases.

This is a design contract only. It does not implement joins, backend execution, SQL generation, dataset creation, Hermes/LLM calls, or analysis auto-run.

## Problem Statement

Users naturally ask multi-table questions:

- 分析各渠道转化率
- 分析用户行为路径和订单转化
- 分析商品评论和商品类目的关系
- 分析用户画像对 LTV 的影响

AI Workbench can identify likely tables and confirmed relationships, but target modules such as Statistics, Forecast, PathAnalysis, and Attribution mostly consume one dataset. Relationship Sets are topic-scoped context graphs; they do not currently create joined data.

The platform needs a user-controlled workflow to:

1. select related tables;
2. choose confirmed join relationships;
3. preview join result;
4. show join quality and risk warnings;
5. let the user confirm temporary or saved output;
6. open the target analysis module with the derived analysis dataset.

## Product Contract

Multi-table join must be user-controlled.

The system may:

- suggest join paths;
- preview join results after the user asks;
- estimate row and column impact;
- warn about many-to-many joins, high-null join keys, duplicate keys, and high-risk relationships;
- create temporary analysis datasets only after explicit confirmation;
- save joined datasets only after explicit user action.

The system must not:

- silently join datasets;
- silently save a joined dataset;
- silently run analysis after join;
- join on unconfirmed relationships without warning;
- execute arbitrary SQL from AI;
- mutate source datasets.

## Core Concepts

### Relationship Set

A Relationship Set is an allowed topic graph:

```text
selected / retained dataset nodes
+ confirmed relationship edges
+ isolated / reference dataset nodes
```

It is context, not execution. It can constrain join suggestions, but it does not create joined data by itself.

### Join Plan

A Join Plan is a specific user-reviewed plan for joining selected tables.

```ts
export interface JoinPlan {
  id: string;
  relationship_set_id?: string;
  source_dataset_ids: string[];
  join_steps: JoinStep[];
  selected_columns?: Record<string, string[]>;
  join_mode: "temporary" | "save_as_dataset";
  warnings: string[];
}
```

Rules:

- `source_dataset_ids` must be a query-specific subset, not every Relationship Set node by default.
- `join_steps` must be ordered and explicit.
- `selected_columns` is optional but should be encouraged to reduce wide outputs.
- `join_mode` controls whether output is short-lived or persisted as a derived dataset.

### Join Step

```ts
export interface JoinStep {
  left_dataset_id: string;
  right_dataset_id: string;
  left_column: string;
  right_column: string;
  join_type: "left" | "inner";
  relationship_type?:
    | "one_to_one"
    | "one_to_many"
    | "many_to_one"
    | "many_to_many"
    | "unknown";
  risk_level: "low" | "medium" | "high";
  warnings: string[];
}
```

Default behavior:

- Prefer `left` join when preserving the primary fact/event table is important.
- Prefer `inner` only when the user confirms unmatched rows can be dropped.
- Block or require explicit override for `many_to_many`.
- Require extra confirmation for high-risk custom relationships.

### Join Preview

Join Preview is a bounded preview of the derived table.

```ts
export interface JoinPreview {
  estimated_rows?: number;
  estimated_columns?: number;
  preview_rows: Record<string, unknown>[];
  column_names: string[];
  warnings: string[];
  join_quality: {
    unmatched_left_rate?: number;
    unmatched_right_rate?: number;
    duplicate_expansion_risk?: "low" | "medium" | "high";
  };
}
```

Preview rules:

- Cap preview rows.
- Cap preview columns.
- Do not expose full source data.
- Show unmatched rates when measurable.
- Show duplicate expansion risk before the user can create output.

## AI Workbench UX

When a plan has multiple required datasets and no joined dataset:

```text
该计划可能需要多表分析。
当前分析模块需要单个分析数据集。
建议先创建一个分析数据集。
```

Primary actions:

- 创建 Join 预览
- 选择已有宽表
- 继续单表分析

### Join Builder Flow

1. Select Relationship Set.
2. Select tables for this analysis.
3. Select join relationships.
4. Select columns to keep.
5. Preview joined result.
6. Confirm temporary dataset or save as dataset.
7. Open target analysis page with the derived dataset.

### Risk Warning Copy

Examples:

- 该 join 是 many-to-many，可能导致行数膨胀。
- join key 缺失率较高，可能导致结果丢失。
- 右表中 join key 不唯一，指标可能被重复计算。
- 该关系为高风险自定义关系，请再次确认。
- 孤立表 / 参考表不会自动参与 join。

## AnalysisPlanCard Integration

Current behavior remains:

- one required dataset -> direct prefill navigation is allowed;
- no required dataset -> ask user to confirm/select a dataset;
- candidate datasets are advisory.

Future Join Builder behavior:

- multiple required datasets and no joined dataset -> show `创建分析数据集`;
- selected Relationship Set appears as allowed context, not as automatic join input;
- isolated/reference nodes are shown as context only;
- direct navigation is disabled until one analysis-ready dataset exists;
- if the user already has a suitable wide table, show `选择已有宽表`.

The plan card should distinguish:

- 所需数据集: query-specific source tables;
- 当前关系组: allowed graph/context;
- Join 预览: not yet executed until user clicks;
- 分析数据集: temporary or saved derived output after confirmation.

## Backend API Proposal

Future endpoints:

```text
POST /api/v1/assistant/join/preview
POST /api/v1/assistant/join/create-temp
POST /api/v1/assistant/join/save-dataset
```

### Join Preview Request

```ts
export interface JoinPreviewRequest {
  relationship_set_id?: string;
  source_dataset_ids: string[];
  join_steps: JoinStep[];
  selected_columns?: Record<string, string[]>;
  max_preview_rows?: number;
}
```

### Join Preview Response

```ts
export interface JoinPreviewResponse {
  preview: JoinPreview;
  warnings: string[];
}
```

### Create Temp Analysis Dataset Request

```ts
export interface CreateTempAnalysisDatasetRequest {
  join_plan: JoinPlan;
  ttl_minutes?: number;
}
```

### Create Temp Analysis Dataset Response

```ts
export interface CreateTempAnalysisDatasetResponse {
  temp_dataset_id: string;
  expires_at: string;
  row_count: number;
  column_count: number;
}
```

### Save Joined Dataset Request

```ts
export interface SaveJoinedDatasetRequest {
  join_plan: JoinPlan;
  name: string;
  description?: string;
}
```

### Save Joined Dataset Response

```ts
export interface SaveJoinedDatasetResponse {
  dataset_id: string;
  name: string;
  row_count: number;
  column_count: number;
}
```

## Backend Validation Rules

The backend should validate:

- source datasets exist and are readable by the current user;
- join columns exist in their datasets;
- join steps reference selected datasets only;
- relationship ids/edges match the active Relationship Set when supplied;
- unconfirmed/high-risk relationships cannot execute without explicit override;
- many-to-many joins are blocked by default or require explicit override;
- selected columns exist;
- preview row/column caps are enforced server-side.

## Dataset Output Semantics

Temporary analysis datasets:

- have TTL;
- are clearly labeled as derived;
- are suitable for immediate analysis-page prefill;
- should not appear as normal persisted uploads unless intentionally surfaced.

Saved joined datasets:

- require explicit naming;
- are clearly labeled as derived;
- store provenance metadata:
  - source dataset ids;
  - join plan;
  - created by user id;
  - created time;
  - derived row/column counts.

Source datasets are never modified.

## Hermes / Tool Registry Implications

Future tools:

```text
preview_join
create_temp_analysis_dataset
save_joined_dataset
```

Safety classification:

| Tool | Side Effect | Requires Confirmation | Notes |
|---|---|---|---|
| `preview_join` | execute | yes | May run bounded compute/query. |
| `create_temp_analysis_dataset` | execute | yes | Creates temporary derived dataset. |
| `save_joined_dataset` | write | yes | Persists a derived dataset. |

Hermes may propose these tools later, but cannot call them silently.

Hermes must not:

- generate arbitrary SQL for execution;
- bypass relationship confirmation;
- create temporary or saved datasets without user confirmation;
- mutate source datasets;
- auto-run target analysis after join.

## Safety Rules

- Preview is allowed only after user clicks preview.
- Temp dataset creation requires explicit confirmation.
- Save as dataset requires explicit confirmation.
- Source datasets are never modified.
- Join output is clearly labeled as derived.
- AI may suggest a join plan but cannot execute without user confirmation.
- High-risk joins require extra confirmation.
- Many-to-many joins are blocked by default or require explicit override.
- Target analysis pages must not auto-run after receiving a derived dataset prefill.

## Implementation Roadmap

### Phase 4B-10F: Join Builder Contract and Frontend Mock

- Add frontend JoinPlan / JoinStep / JoinPreview types.
- Add AI Workbench Join Builder mock.
- Add AnalysisPlanCard `创建分析数据集` action for multi-table plans.
- No backend join.
- No dataset creation.

### Phase 4B-10G: Backend Join Preview Service

- Implement safe preview only.
- Validate datasets, columns, and relationship edges.
- Limit preview rows and columns.
- Return join quality and warnings.
- No temp or saved dataset creation.

### Phase 4B-10H: Temporary Analysis Dataset

- Create temp joined dataset with TTL after confirmation.
- Allow target analysis pages to consume temp dataset ids.
- Preserve no auto-run behavior.

### Phase 4B-10I: Save Joined Dataset

- Let user explicitly save joined result as a new derived dataset.
- Persist provenance metadata.
- Add catalog/history visibility for derived datasets.

## Open Questions

- Should temporary analysis datasets appear in Dataset Catalog search?
- Should many-to-many joins be fully blocked in early releases?
- Should Join Builder support more than left/inner joins later?
- How should column name collisions be resolved by default?
- Should join previews sample deterministically or use top rows?

## Non-goals

- No live Hermes integration.
- No arbitrary SQL generation.
- No automatic joins.
- No automatic analysis execution.
- No source dataset mutation.
- No backend implementation in this design phase.
