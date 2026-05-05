# Dataset Catalog Classification Design

## Purpose

Dataset Catalog classification gives the dataset library a deterministic metadata layer for browsing and future AI-safe candidate narrowing.

This design is frontend-only in Phase 4B-9A. It does not persist catalog metadata, modify uploaded data, call Hermes/LLM, or change AI Workbench runtime behavior.

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

## Future AI Candidate Narrowing

Future Hermes/dataset search should use this priority:

1. Current selected dataset.
2. Active Relationship Set dataset nodes.
3. Dataset Catalog category or business topic.
4. Analysis usage tags.
5. Full dataset library as last resort.

Phase 4B-9A exports helper functions only. No planner or runtime behavior is changed.

## Safety Rules

- No LLM/Hermes call.
- No external service.
- No backend persistence.
- No dataset mutation.
- No automatic analysis execution.
- No SmartAnalysis change.
- Classification is advisory and can be wrong when names/schema are sparse.
