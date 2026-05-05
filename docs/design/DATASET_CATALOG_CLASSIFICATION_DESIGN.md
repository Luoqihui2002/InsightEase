# Dataset Catalog Classification Design

## Purpose

Dataset Catalog classification gives the dataset library a deterministic metadata layer for browsing and future AI-safe candidate narrowing.

This design is frontend-only. It does not persist catalog metadata, modify uploaded data, call Hermes/LLM, or classify through an external service.

## Current Contract

The catalog infers:

- business category;
- data type;
- analysis usage tags;
- upload day;
- upload week bucket;
- confidence and short deterministic reasons.

Source signals are limited to already loaded frontend dataset metadata:

- dataset id;
- filename/name;
- row and column counts;
- schema column names, dtypes, semantic types, and roles when present;
- exposed upload timestamp fields such as `created_at`;
- optional profile/classification fields if a caller already has them.

## Classification Rules

The helper uses fixed keyword and schema heuristics.

Business categories include user, product, order, traffic, marketing, experiment, forecast, review text, quality, and unknown.

Data types include dimension table, fact table, event log, time series, experiment table, text table, metrics table, and unknown.

Analysis tags include descriptive, path analysis, forecast, attribution, A/B test, regression, semantic, and data quality.

Every dataset receives `descriptive` and `data_quality` tags as safe baseline use cases. More specific tags require deterministic signals such as event columns, text columns, experiment columns, or forecast/time-series indicators.

## Grouped Views

Datasets page supports grouping by:

- default order;
- upload day;
- upload week;
- business category;
- data type;
- analysis usage.

Search applies before grouping and can match dataset names, schema columns, category labels, data type labels, analysis tag labels, and upload day.

## AI Candidate Narrowing

Planner and future Hermes/dataset search should use this priority:

1. Current selected dataset.
2. Active Relationship Set dataset nodes.
3. Dataset Catalog category or business topic.
4. Analysis usage tags.
5. Full dataset library as last resort.

Phase 4B-9B wires the deterministic catalog metadata into the rule-based AI Workbench planner.

Planner rules:

- selected dataset is always the primary required dataset;
- active Relationship Set is an allowed graph, not an automatic required dataset list;
- catalog matches can become required datasets only when they are high-confidence and query-specific;
- lower-confidence catalog matches are surfaced as candidate datasets, assumptions, or warnings;
- descriptive/statistics requests without a selected dataset ask the user to choose one dataset instead of requiring the full library.

Catalog candidate ranking remains advisory. It does not execute analysis, join tables, generate SQL, or mutate datasets.

## Safety Rules

- No LLM/Hermes call.
- No external service.
- No backend persistence.
- No dataset mutation.
- No automatic analysis execution.
- No SmartAnalysis change.
- Classification is advisory and can be wrong when names/schema are sparse.
