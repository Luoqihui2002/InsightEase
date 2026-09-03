# InsightEase Interview Guide

## 30-second answer

InsightEase is an AI-assisted business analytics platform for uploaded CSV/Excel data. Hermes turns a natural-language question into a validated, metadata-only analysis plan; users review table relationships and Join risk before a deterministic pandas engine creates a derived dataset. Existing analysis modules produce structured ResultViews, and Hermes can explain a bounded SafeResultSummary. The LLM never executes SQL, joins, or analyses.

## 2-minute answer

I built InsightEase because business questions often span several tables, but letting an LLM directly generate and execute SQL creates correctness, security, and explainability risks. The system separates reasoning from execution.

First, uploaded datasets are profiled deterministically. Metadata includes schema, inferred field roles, bounded examples, quality signals, and likely analysis uses. Relationship inference proposes edges, but a user must confirm them into a topic-scoped Relationship Set.

Second, Hermes receives only bounded metadata and returns a strict AnalysisPlan. The backend validates every referenced dataset, column, and confirmed edge. If the provider is disabled, fails, or returns an invalid plan, the UI visibly falls back to a deterministic local planner.

For multi-table questions, InsightEase constructs a JoinPlan only from confirmed edges. The deterministic engine previews cardinality, match rates, null/duplicate keys, row multiplier, grain shift, and risk. Preview has no persistence side effect; a derived dataset is created only after explicit confirmation and stores its source IDs, derivation plan, and risk summary.

Finally, the user manually starts an existing analysis module. ResultView is converted into a SafeResultSummary before optional Hermes explanation. The hardest parts were containing hallucination at semantic boundaries and making 1:N/N:N grain risk explicit rather than treating a successful join as a correct join.

## 5-minute deep dive

### Business problem

Analysts often start with a question, not a table. Answering “why did new-customer conversion fall?” may require user, order, acquisition, and event data. The difficult part is not producing a query; it is proving that the selected data, relationship, grain, and interpretation are valid.

### Architecture

The pipeline is: question → Hermes advisory plan → semantic validation → confirmed Relationship Set → deterministic JoinPlan → bounded preview/risk → explicit derived dataset → manual analysis → ResultView → SafeResultSummary → Hermes explanation.

The frontend provides Dataset Catalog, Relationship Review, AI Workbench, Join Builder, analysis pages, and ResultView. FastAPI owns authorization and dataset/analysis APIs. MySQL stores metadata and analysis history, file storage holds uploads/derived CSVs, and pandas performs bounded in-process transformations and joins.

### AI boundary

Planning requests contain bounded metadata, not arbitrary raw rows. The plan must match a strict schema, then semantic validation checks that IDs, fields, and confirmed relationships exist in the supplied context. `source=hermes_live` and `fallback_used=false` are the only acceptable live-demo signals. Fallback remains visible.

### Multi-table safety

Relationship inference is advisory. Confirmed edges are snapshotted into JoinPlan. Preview computes actual cardinality, match and null rates, duplicate keys, output size, multiplier, and likely grain. Unsafe expansion is blocked; high risk requires extra confirmation. LEFT and INNER joins distinguish retention risk: low LEFT-match keeps base records and is medium with a warning, while low INNER-match is high because it drops them.

### Execution and explanation

No LLM execution tool exists. Preview is pure and creates zero datasets. Confirmation creates a new dataset with lineage and never mutates sources. Analyses start only from a user action. Explanations receive SafeResultSummary rather than raw result payloads, and must state limitations when the summary cannot support a conclusion.

### Trade-offs

V1 limits joins to two or three uploaded tables and pandas execution. Relationship Sets are browser-local, which made the interaction model fast to validate but is not collaborative infrastructure. The design favors correctness, auditability, and explicit user control over autonomy.

### Flagship validation

The fixed-seed demo encodes a 24.0% → 18.8% CVR decline. Social ads share rises 15% → 40%, and its CVR falls 16% → 10%, especially checkout → payment success. A pandas reference and the product Join engine both produce 2,054 rows and 15 columns for users LEFT JOIN orders. Real Hermes/browser acceptance remains a release gate until run in a configured environment.

## Required questions

### Q1. Why not let the LLM generate SQL directly?

Generated SQL can reference nonexistent fields, choose the wrong grain, create N:N expansion, bypass ownership assumptions, or execute before review. InsightEase uses the LLM for advisory reasoning and a small deterministic executor for known operations. There is no arbitrary SQL surface in V1.

### Q2. How do you control Hermes hallucination?

The request is bounded to a concrete metadata inventory. Provider output must pass strict Pydantic schema validation and semantic validation: referenced dataset IDs and fields must exist, and an edge can be “confirmed” only if it exactly matches the active Relationship Set. Invalid output falls back visibly; validation is never relaxed to make the demo pass.

### Q3. How does AI know which datasets to use?

The planner sees dataset names, schemas, inferred roles, classifications, selected context, and the active Relationship Set. It classifies each table as required, candidate, or reference. This is a proposal, not discovery of a database or proof of relevance; the user reviews it.

### Q4. What if two tables are joined incorrectly?

Only confirmed edge snapshots can enter a JoinPlan. The preview recomputes actual cardinality and compares it with the expected relationship. It also exposes match rates, duplicate/null keys, row multiplier, and grain shift. A mismatch becomes high risk, unsafe expansion is blocked, and no dataset exists until confirmation.

### Q5. Why does a Relationship Set not join automatically?

A relationship graph describes allowed context, not a unique execution plan. Join order, join type, selected fields, denominator, and grain are business decisions. Keeping the set advisory prevents metadata inference from silently changing data.

### Q6. How are N:N and row explosion handled?

The engine measures uniqueness on both join keys. N:N is high risk. It estimates output rows before executing dangerous merges and blocks plans beyond bounded row or multiplier limits. Non-blocked high-risk output requires explicit secondary confirmation.

### Q7. Why can AI see only SafeResultSummary?

Full result payloads can be large, contain sensitive rows, and tempt the model to overfit incidental data. SafeResultSummary exposes bounded metrics, small previews, warnings, and module-specific hints that are sufficient for explanation while preserving an auditable boundary.

### Q8. Why separate planning and execution?

They have different trust models. Planning benefits from language reasoning but is probabilistic; execution needs reproducibility and ownership checks. The separation allows the plan to fail or fall back without mutating data, and makes every execution a user-reviewed deterministic action.

### Q9. Why are Relationship Sets browser-local today?

It was a deliberate V1 scope choice to validate the graph/review interaction without introducing server CRUD, sharing, RBAC, migrations, and conflict semantics. It is suitable for a single-user portfolio workflow, but it is explicitly a limitation rather than a production claim.

### Q10. What would you upgrade for a real product?

First move Relationship Sets and lineage policy to server-side versioned storage with ownership, RBAC, audit logs, and migrations. Then add governed connectors and a query engine behind the same plan/confirmation boundary, observability and cost controls for Hermes, and evaluation datasets for planner/explainer quality. I would not start by adding more agent autonomy.

## STAR project deep dive

### Situation

The project had many real analysis modules but its assistant and multi-table story ended at a plan. Legacy mock paths also blurred what was actually live.

### Task

Turn it into one defensible V1 story: natural-language planning through safe multi-table preparation, real analysis, and bounded explanation, without giving an LLM execution authority.

### Architecture decision

I chose a staged control plane/data plane split. Hermes produces typed advice; InsightEase validates context and executes a deliberately small operation set only after user confirmation.

### Key challenges

The two hardest challenges were semantic hallucination control and grain safety. A syntactically valid plan can still refer to the wrong table, while a technically successful join can silently duplicate business metrics.

### Implementation

I created bounded planning contracts, provider and deterministic runtimes, exact semantic validation, confirmed Relationship Sets, a 2–3 table JoinPlan builder, cardinality/risk preview, persisted derived lineage, analysis-page prefill without auto-run, and SafeResultSummary result handoff.

### Validation

Unit and integration tests cover provider parsing, invalid references, fallback, join cardinality, null behavior, row explosion, confirmation, lineage, and ownership. The P0D synthetic benchmark fixes the causal story in source generation and cross-checks the product engine against pandas.

### Trade-offs and result

I traded arbitrary SQL and scale for a bounded, explainable V1. That yields a coherent portfolio architecture and measurable safety properties, while leaving server-side collaboration and large-data execution as honest future work. Real provider/browser evidence is still required before calling the release ready.

## Technical deep dive: hallucination control

There are four gates: bounded input, strict structural parsing, context-aware semantic validation, and visible fallback. The important distinction is that JSON validity is not truth: after parsing, dataset IDs, fields, relationship status, readiness, and next actions are normalized against the exact request context. The fallback cannot execute either.

## Technical deep dive: join risk and cardinality

Cardinality is measured from actual non-null key uniqueness at preview time. The engine treats nulls as nonmatching with collision-proof sentinels, compares actual versus expected cardinality, estimates expansion before merge, prefixes colliding right-side fields, and records grain warnings in lineage. Risk depends on information loss as well as expansion: low-match INNER JOIN is high, while a preserving LEFT JOIN is medium and explicit about null detail fields.
