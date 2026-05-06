# Analysis History Catalog Design

## Purpose

Analysis History Catalog gives historical analysis artifacts a deterministic metadata layer for browsing and future AI Workbench / Hermes result-context selection.

This phase is frontend-only. It does not persist metadata, change backend schemas, rerun analyses, call Hermes/LLM, generate SQL, or mutate datasets.

## Catalog Metadata

Each loaded `Analysis` item is classified into:

- analysis type label;
- status label;
- dataset id/name when the loaded dataset map contains it;
- created day;
- created week bucket;
- AI-ready status;
- safe-summary availability flags;
- bounded result key count;
- searchable labels and deterministic reasons.

The helper uses `buildSafeResultSummary()` as the safe boundary for result-derived metadata. Search and badges use summary keys, metrics/table presence, existing `ai_interpretation`, and basic analysis metadata. It must not scan or expose full raw result tables.

## Grouped Views

History supports grouping by:

- default order;
- created day;
- created week;
- analysis type;
- status;
- dataset;
- AI-ready status.

Search and filters apply before grouping.

## AI-ready Status

AI-ready status is deterministic and advisory:

- `AI 可解释`: completed item with useful safe-summary signals or existing interpretation.
- `摘要较少`: completed item with sparse safe-summary context.
- `结果未完成`: pending, running, or failed item.
- `不可解释`: no usable result metadata.

This does not imply an AI explanation has been generated. It only indicates whether the item has enough bounded context to bring into AI Workbench safely.

## Current Pagination Contract

History currently loads one backend page of analysis records. Grouping and search operate on the loaded page only.

This avoids new backend behavior and keeps the phase low risk. A future phase can add server-side search or full-history pagination if needed.

## Safety Rules

- No Hermes/LLM call.
- No automatic explanation.
- No analysis rerun.
- No SQL generation.
- No dataset mutation.
- No backend persistence.
- Handoff to AI Workbench must use `SafeResultSummary`.
- Detailed result display/export remains an explicit History-page user action.
