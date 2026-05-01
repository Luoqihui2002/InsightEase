# Phase 4B-1: AI Data Assistant Product & Architecture Design

## Objective

Create a product and architecture design document for the InsightEase AI Data Assistant. This phase is documentation-only — no code implementation.

---

## Files Created

| File | Purpose |
|------|---------|
| `docs/design/AI_DATA_ASSISTANT_DESIGN.md` | Main design document covering product goals, user scenarios, capability modules, metadata contracts, integration strategy, safety, roadmap |

---

## Design Summary

### Product Problem

Users face a "cold start" problem: they upload datasets but do not know how to analyze them, which table contains which entity, how tables relate, or which analysis method is appropriate. The AI Data Assistant should guide users from raw data to insights.

### Product Goals (P0–P2)

| Priority | Goal |
|----------|------|
| P0 | Understand datasets, classify tables, detect column roles |
| P1 | Infer table relationships, recommend analyses, translate questions into plans |
| P2 | Pre-fill analysis pages, explain AnalysisResult outputs |

### Non-Goals

- No AI model integration in this phase
- No chat UI implementation
- No backend API implementation
- No SQL generation or execution
- No automatic data modification
- No Hermes Agent coupling

### Core User Scenarios

1. **Dataset Understanding** — "这个表是干什么的？"
2. **Multi-table Relationship Inference** — "这些表之间是什么关系？"
3. **Analysis Recommendation** — "我想分析为什么转化率下降，应该怎么做？"
4. **Guided Analysis Setup** — step-by-step field selection and analysis type recommendation
5. **Result Interpretation** — explain AnalysisResult blocks in business language

### Capability Modules

| Module | Responsibility |
|--------|---------------|
| Dataset Profiler | Generate `DatasetProfile` + `ColumnProfile` from metadata |
| Table Classifier | Classify table into business entity type (user, order, event, etc.) |
| Column Role Detector | Detect semantic roles (user_id, timestamp, metric, dimension, etc.) |
| Relationship Inference Engine | Infer join keys and cardinality between tables |
| Analysis Planner | Convert user question into `AssistantAnalysisPlan` |
| Result Explainer | Explain `AnalysisResult` blocks and suggest next steps |

### Key Contracts Defined

- `DatasetProfile` / `ColumnProfile` / `ColumnRole` — metadata schema
- `TableClassification` — table type + confidence + evidence
- `TableRelationship` — join key + cardinality + confidence + evidence
- `AssistantAnalysisPlan` — structured analysis plan with required fields, assumptions, warnings, and next actions

### Integration Strategy

- Maps assistant recommendations to existing analysis pages (Statistics, Semantic, PathAnalysis, Forecast, Attribution, SmartProcess)
- Proposes pre-fill payloads so the assistant can navigate users to analysis pages with configuration hydrated
- Consumes `AnalysisResult` blocks for result explanation (does not bypass the schema)
- Future assistant responses can be rendered as `AnalysisResult`-compatible blocks

### Safety & Privacy

- Metadata-first behavior: prefer schema and aggregated stats over raw data
- Sample rows only with explicit opt-in, limited to 5–10 rows
- Inferred relationships are suggestions, not truth; user must confirm
- Never auto-modify datasets; never execute SQL without confirmation
- PII detection heuristic for sensitive columns

### Hermes Agent Positioning

- Hermes is noted as a **possible future execution layer** but not coupled to the design
- Core contracts (`DatasetProfile`, `TableClassification`, etc.) are independent of any agent runtime
- If Hermes is adopted, it orchestrates tools that produce these contracts
- If Hermes is not adopted, backend endpoints call the same tools directly

### Implementation Roadmap

| Phase | Scope |
|-------|-------|
| 4B-2 | Dataset Profile Contract + Metadata Service (static, no AI) |
| 4B-3 | Static Dataset Understanding UI (heuristic rules) |
| 4B-4 | Assistant Panel Mock UI (mock responses) |
| 4B-5 | Analysis Plan Generator Mock (templates/keywords) |
| 4B-6 | Real AI Integration (metadata-first LLM prompt, structured JSON output) |
| 4B-7 | Result Explainer (consume AnalysisResult, generate explanations) |

---

## Validation

- `git status` — only docs/ files modified, no application source code changed ✅
- No package files modified ✅

---

## Git Information

```
Branch: master
Origin: https://github.com/Luoqihui2002/InsightEase.git
```

---

*Phase completed: 2026-04-28*
