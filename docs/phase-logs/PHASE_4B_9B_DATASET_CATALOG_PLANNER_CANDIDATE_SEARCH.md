# Phase 4B-9B: Dataset Catalog Planner Candidate Search

## Status

Implemented.

## Summary

Phase 4B-9B wires the deterministic Dataset Catalog metadata from Phase 4B-9A into AI Workbench planning.

The rule-based planner now ranks dataset candidates using:

- current selected dataset;
- active Relationship Set dataset nodes as the allowed graph;
- Dataset Catalog business category;
- Dataset Catalog data type;
- Dataset Catalog analysis tags;
- deterministic name/schema keyword signals.

No Hermes/LLM call, live AI, SQL generation, auto-run analysis, auto-join, backend persistence, dataset mutation, package change, or SmartAnalysis change was added.

## Code Changes

- Extended `AssistantContext` with optional `dataset_catalog`.
- AI Workbench now computes frontend-only catalog metadata from the loaded dataset list and passes it into assistant runtime context.
- Guided Quick Analysis passes the same catalog metadata while preserving selected-dataset priority.
- `ruleBasedAssistantRuntime` forwards catalog metadata to the planner.
- `analysisPlannerMock` now:
  - infers deterministic analysis intent from the question;
  - ranks datasets for the question;
  - treats selected dataset as highest priority;
  - constrains Relationship Set planning to the active graph;
  - only promotes high-confidence, query-specific matches to `required_datasets`;
  - emits lower-confidence recommendations as `candidate_datasets` and warnings.
- `AnalysisPlanCard` now renders a separate candidate dataset section.

## Product Contract

Dataset candidate search priority is now:

1. Explicitly selected dataset.
2. Active Relationship Set dataset nodes.
3. Dataset Catalog metadata matching the question or analysis type.
4. Schema/name keyword matches.
5. Full dataset library only as bounded candidate hints.

`required_datasets` remains a query-specific subset. Catalog candidates are advisory and visually distinct from required datasets.

## Safety Notes

- Catalog metadata remains deterministic and frontend-only.
- Catalog metadata is not persisted.
- The planner does not call profile APIs in bulk.
- Hermes dry-run remains opt-in only and still falls back to the rule-based runtime.
- No live Hermes/LLM search or classification was added.

## Manual QA Checklist

- No selected dataset, no relationship set:
  - "预测未来销售额趋势" prefers forecast/time-series candidates.
  - "分析用户行为路径" prefers event/path/log candidates.
  - "分析评论情感" prefers review/text candidates.
  - "做描述性统计" asks the user to choose one dataset instead of requiring all datasets.
- Selected dataset:
  - Selecting an orders dataset and asking for descriptive statistics requires only that dataset.
- Active relationship set:
  - A channel conversion question uses a relevant subset of the active graph.
  - If the active graph has no clear match, the plan warns instead of requiring every node.
- Candidate hints:
  - Candidate datasets render separately from required datasets.
- Regression:
  - Relationship set management, prefill navigation, result follow-up, Hermes dry-run opt-in, and Datasets grouped views remain functional.

## Validation

- `cd app && npx tsc --noEmit`
- `cd app && npm run build`
