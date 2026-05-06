# InsightEase Roadmap

**Version**: 2026-05  
**Current focus**: Phase 4B closeout -> Hermes live readiness -> Phase 5 multi-table execution planning

This roadmap is forward-looking. Historical implementation details remain available in `docs/CURRENT_PROGRESS.md`, `docs/CHANGELOG.md`, and `docs/phase-logs/`.

## Current Product Direction

InsightEase is an AI-assisted statistics and analysis platform.

Current product pillars:

- users upload and manage datasets;
- the platform supports statistical analysis, preprocessing, visualization, forecasting, attribution, path analysis, semantic analysis, and AI-assisted planning;
- AI Workbench is the main assistant shell;
- Relationship Sets are topic-scoped dataset graphs and allowed context;
- Safe Result Summary is the boundary for result follow-up and future Hermes result explanation;
- Hermes live integration is not enabled yet;
- default assistant runtime remains deterministic rule-based.

Important safety boundaries:

- no silent joins;
- no automatic analysis execution;
- no arbitrary SQL execution from AI;
- no source dataset mutation;
- no live Hermes/LLM call unless a future phase explicitly enables it;
- execute/write actions require explicit user confirmation.

## Phase 4A: Engineering Stabilization Completed

### Goal

Unify frontend layout, interaction patterns, visual system, result rendering, and analysis-page structure so the product can support richer AI-assisted workflows.

### Completed

- Shared layout and feedback components.
- Analysis page templates.
- Interaction cleanup across native selects, toggles, tables, dialogs, and buttons.
- Visual system polish and token alignment.
- Result schema and `ResultView` rollout.
- `ResultChartRenderer` implementation.
- Forecast chart migration.
- Attribution chart migration.
- Manual QA dataset pack.
- SmartProcess critical bug fixes.
- PathAnalysis critical QA fixes.
- Bundle-size triage.

### Historical Highlights

Detailed Phase 4A history lives in `docs/CURRENT_PROGRESS.md` and `docs/CHANGELOG.md`.

Key historical groups:

- 4A-1 to 4A-4: shared components and page migration;
- 4A-5: interaction cleanup;
- 4A-6: visual system, ResultView, chart renderer, QA dataset pack, and critical bug triage.

### Status

Completed. Future fixes to stabilized surfaces should be tracked under the relevant product phase rather than reopening Phase 4A.

## Phase 4B: AI Workbench & Hermes-ready Assistant In Progress / Near Closure

### Goal

Build a safe AI-assisted analysis workbench that can understand datasets, manage relationship context, generate analysis plans, hand plans off to analysis pages, receive results back, support deterministic result follow-up, and prepare for Hermes live integration.

### Completed Capability Groups

#### Dataset Understanding

- Dataset Profile service.
- Dataset profile API contract/casing fixes.
- `DatasetUnderstandingCard`.
- Deterministic Dataset Catalog metadata.
- Dataset Catalog grouped views and search.

#### Relationship Inference

- Backend relationship inference.
- Relationship Review UI.
- Relationship Set management.
- Relationship Set topic graph model.
- Isolated/reference dataset node support.
- High-risk relationship warnings.

#### AI Workbench Shell

- AI Workbench shell stabilization.
- Companion open/close and layout fixes.
- Horizontal default layout.
- Session continuity.
- Guided Quick Analysis.
- SmartAnalysis public navigation deprecation/hide path.

#### Assistant Runtime Adapter

- `AssistantRuntime` abstraction.
- Rule-based runtime as default.
- Safe Tool Registry.
- Hermes dry-run runtime opt-in.
- Deterministic fallback behavior.

#### Planning and Navigation

- Planner candidate narrowing with Dataset Catalog metadata.
- Selected dataset priority.
- Active Relationship Set scoping.
- Required datasets and candidate datasets are visually distinct.
- Prefill navigation to Forecast, PathAnalysis, Attribution, and Statistics.
- Plans without confirmed required datasets do not navigate with empty prefill payloads.

#### Context Panel

- Right-side AI Workbench Context Panel.
- Dataset context.
- Relationship Set context.
- Analysis history context.
- Collapsible sections.
- Lazy relationship table preview.
- Searchable selectors.

#### Analysis History and Result Context

- Safe Result Summary contract.
- Analysis History Catalog grouped/searchable views.
- History result handoff to AI Workbench.
- Statistics result handoff.
- Forecast result handoff.
- PathAnalysis result handoff.
- Attribution result handoff.
- Deterministic result follow-up.

#### Hermes Readiness

- Hermes result explainer boundary design.
- Hermes backend API contract.
- Hermes dry-run backend scaffold.
- Hermes status probe.
- Hermes dry-run runtime opt-in.
- Live Hermes remains not implemented.

#### QA and Demo Support

- AI Workbench QA recipes.
- Demo scenario scripts.
- End-to-end AI Workbench QA and polish pass.
- SearchableSelect QA/accessibility polish.

### Remaining Phase 4B Items

#### 4B-10F: Roadmap Consolidation and Phase 5 Planning

Status: current documentation phase.

Consolidate the roadmap around the real state of Phase 4A/4B and define Phase 5 as the multi-table execution layer.

#### 4B-11A: Hermes Live Readiness Review

Review current Hermes contracts, dry-run runtime behavior, backend scaffold, environment flags, safety boundaries, fallback behavior, and missing pieces before any live provider is enabled.

Deliverables:

- readiness checklist;
- risk register;
- required config/secrets plan;
- live-mode gating rules;
- rollback/fallback plan.

#### 4B-11B: Hermes Result Explainer Live Adapter

Enable live Hermes result explanation from `SafeResultSummary` only.

Rules:

- input is bounded `SafeResultSummary` plus metadata context;
- no raw result data;
- deterministic result follow-up remains fallback;
- no analysis rerun;
- no SQL generation;
- no dataset mutation.

#### 4B-11C: Hermes Plan Analysis Live Adapter

Enable live Hermes planning from bounded dataset/catalog/relationship metadata only.

Rules:

- Hermes returns structured analysis plans;
- required datasets must be query-specific;
- Relationship Set remains allowed context;
- no automatic joins;
- no automatic analysis execution;
- no arbitrary SQL;
- rule-based runtime remains fallback.

#### 4B-11D: AI Error Explainer

Add bounded error explanation support for failed analysis tasks and common UI/API failures.

Rules:

- no raw dataset values;
- no automatic retries unless explicitly approved;
- no mutation or task execution;
- deterministic fallback remains available.

### Phase 4B Exit Criteria

Phase 4B can close when:

- AI Workbench is stable as the main assistant shell.
- Hermes live can explain results from `SafeResultSummary`.
- Hermes live can generate structured analysis plans from bounded metadata context.
- Deterministic fallback remains available.
- No automatic joins, SQL, analysis execution, or dataset mutation are introduced.
- Multi-table execution is designed but implemented under Phase 5.

## Phase 5: Multi-table Analysis Execution Layer

### Goal

Turn Relationship Sets and multi-table analysis plans into user-confirmed, analysis-ready datasets.

### Why Phase 5

AI Workbench can already identify relevant datasets and relationships. Current analysis modules mostly operate on a single dataset. Relationship Sets are context graphs, not joined data.

The missing bridge is:

```text
Relationship Set subset
-> user-confirmed Join Plan
-> bounded Join Preview
-> temporary or saved derived analysis dataset
-> target analysis module prefill
```

Reference design:

- `docs/design/MULTI_TABLE_ANALYSIS_DATASET_BUILDER_DESIGN.md`

### Safety Rules

- No silent join.
- No silent save.
- No auto-run after join.
- Source datasets are never mutated.
- Many-to-many joins require warnings and explicit override.
- High-risk joins require confirmation.
- Join preview is bounded.
- Derived datasets are clearly labeled.
- AI may suggest a Join Plan but cannot execute it silently.

### 5A: Join Builder Contract and Frontend Mock

Add frontend contracts and a mock AI Workbench Join Builder flow.

Scope:

- `JoinPlan`, `JoinStep`, and `JoinPreview` types;
- AnalysisPlanCard action: `创建分析数据集`;
- mock Join Builder UI;
- no backend join;
- no dataset creation;
- no SQL generation.

### 5B: Backend Join Preview Service

Implement safe preview only.

Scope:

- `POST /api/v1/assistant/join/preview`;
- validate datasets, columns, and confirmed relationship edges;
- cap preview rows/columns;
- estimate row/column impact;
- return join quality warnings;
- no temp/save dataset creation.

### 5C: Temporary Analysis Dataset

Create temporary joined datasets with TTL after explicit confirmation.

Scope:

- `POST /api/v1/assistant/join/create-temp`;
- derived temp dataset ids;
- expiration metadata;
- analysis pages can consume temp dataset ids;
- no auto-run after navigation.

### 5D: Save Joined Dataset

Allow explicit save as a new derived dataset.

Scope:

- `POST /api/v1/assistant/join/save-dataset`;
- user-supplied name/description;
- provenance metadata;
- source dataset ids;
- join plan;
- derived row/column counts.

### 5E: Multi-table Plan -> Join Builder -> Analysis Page

Close the loop from multi-table plan to executable analysis page.

Scope:

- AnalysisPlanCard routes multi-table plans to Join Builder.
- Join Builder creates temp/saved dataset after confirmation.
- Target analysis page receives one derived dataset id.
- No target page auto-runs.

## Phase 6: Productization & Reliability

### Goal

Make catalog, history, relationship, QA, permissions, performance, and large-dataset behavior durable enough for heavier use.

### 6A: Server-side Dataset / History Search

Current Dataset Catalog and History Catalog search are frontend/local or current-page bounded. Move high-volume search/filter/grouping to safe backend APIs.

### 6B: Catalog + Relationship Set Persistence

Persist curated catalog metadata, user overrides, Relationship Sets, and derived dataset provenance beyond browser-local session state.

### 6C: Permissions / Privacy / Audit Logs

Add stronger controls for:

- who can view datasets;
- who can create derived datasets;
- who can hand results to AI Workbench;
- audit logs for join preview/create/save and Hermes calls.

### 6D: Automated Browser QA

Convert manual QA recipes into browser smoke tests for:

- Dataset Catalog;
- History Catalog;
- Relationship Set flows;
- planner candidate narrowing;
- prefill navigation;
- result handoff;
- result follow-up;
- Hermes dry-run/live safety gates;
- Join Builder once implemented.

### 6E: Performance / Large Dataset Handling

Harden performance for:

- large dataset catalogs;
- large history pages;
- relationship graphs;
- join preview sampling;
- derived dataset creation;
- chart rendering.

## Phase 7: Advanced Analytics / Dashboard / Reporting

### Goal

Expand advanced analytics, dashboarding, and reporting once AI Workbench and multi-table execution foundations are stable.

### 7A: Dashboard Builder

Future dashboard work moves here.

Potential scope:

- dashboard persistence;
- chart layout editing;
- advanced ECharts interactions;
- dashboard export;
- AI-assisted chart suggestions from bounded metadata/results.

### 7B: Advanced Statistical Modules

Potential scope:

- hypothesis tests;
- regression diagnostics;
- A/B analysis enhancements;
- optimization workflows;
- advanced forecasting improvements;
- model comparison and explainability surfaces.

### 7C: Report Generation

Potential scope:

- Markdown reports;
- PDF reports;
- report templates;
- safe result-summary based narratives;
- chart/table export bundles.

### 7D: Demo / Resume Polish

Potential scope:

- polished demo datasets;
- demo scripts;
- portfolio/resume walkthroughs;
- product story cleanup;
- visual polish for public demos.

## Deferred / Optional Engineering Cleanup

These items are not primary roadmap phases right now but can be revisited when they unblock product work:

- DataWorkshop component splitting.
- Reusable prefill banner extraction.
- Semantic/DataWorkshop prefill support.
- More complete design-system combobox with portal/grouped options.
- Server-side history pagination improvements.
- Relationship graph visualization.

## Next Recommended Sequence

Recommended order:

```text
4B-11A Hermes Live Readiness Review
-> 4B-11B Hermes Result Explainer Live Adapter
-> 4B-11C Hermes Plan Analysis Live Adapter
-> Phase 5A Join Builder Contract and Frontend Mock
```

Reason:

Finish the Phase 4 Hermes advisory loop first, then enter Phase 5 multi-table execution with a clear confirmation and safety model.
