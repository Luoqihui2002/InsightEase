# Phase 4B-4 Log: Multi-table Relationship Inference Design

**Phase ID**: 4B-4  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Design the multi-table relationship inference system for InsightEase AI Data Assistant. This is a documentation-only phase.

---

## Context

Completed 4B foundation phases provide the necessary building blocks:

- `DatasetProfile` / `ColumnProfile` / `ColumnRole` / `TableClassification`
- `DatasetUnderstandingCard` UI component
- AI Workbench shell (modal overlay with chat/capabilities/history tabs)
- 10 manual QA datasets covering users, products, orders, events, marketing, experiments, LTV, reviews, forecast, and edge cases

The next assistant capability is to infer relationships between multiple uploaded datasets.

---

## User Need

Users often upload multiple tables but do not know how they connect. Many analyses require joining user/order/product/event/campaign tables. Incorrect joins can produce misleading results. The assistant should recommend relationships with confidence and evidence, not silently apply them.

---

## Files Created

| File | Description |
|------|-------------|
| `docs/design/TABLE_RELATIONSHIP_INFERENCE_DESIGN.md` | Comprehensive design document covering inputs, output contract, candidate generation, scoring framework, confidence levels, cardinality inference, evidence, warnings, user confirmation model, UI proposal, API proposal, safety constraints, QA dataset expectations, and implementation roadmap |
| `docs/phase-logs/PHASE_4B_4_TABLE_RELATIONSHIP_INFERENCE_DESIGN.md` | This phase log |

---

## Files Modified

| File | Description |
|------|-------------|
| `docs/CURRENT_PROGRESS.md` | Added 4B-4 entry |
| `docs/CHANGELOG.md` | Added 4B-4 entry |
| `docs/ROADMAP.md` | Updated 4B section to reflect actual completed phases |

---

## Design Summary

### Relationship Output Contract

- `TableRelationship`: id, source/target dataset + column, relationship_type (one_to_one / one_to_many / many_to_one / many_to_many / unknown), confidence (0–1), status (suggested / confirmed / rejected), evidence array, warnings array
- `RelationshipEvidence`: type (column_name_match / role_match / type_compatibility / uniqueness_signal / table_type_signal / value_overlap / null_rate_check / manual_confirmation), score, message

### Candidate Generation

- Compare every pair of datasets
- Consider only plausible key-like columns (specific roles, high unique_rate, `_id` suffix, exact name match)
- Exclude metric columns, text fields, high-null columns, type-incompatible columns
- Max 200 total candidates

### Scoring Framework (Heuristic)

| Signal | Max Score |
|--------|-----------|
| Column name similarity | 0.35 (exact match) |
| Column role compatibility | 0.25 (same role) |
| Type compatibility | 0.15 (same family) |
| Uniqueness / cardinality | 0.15 (strong PK/FK) |
| Table type semantic signal | 0.15 (orders→users) |
| Value overlap (optional) | 0.20 (>80% overlap) |

### Confidence Levels

| Range | Label | UI Behavior |
|-------|-------|-------------|
| >= 0.85 | 高置信度 | 默认展示 |
| 0.65–0.85 | 中置信度 | 默认展示，附证据 |
| 0.45–0.65 | 低置信度 | 折叠在「可能的关系」 |
| < 0.45 | 极低 | 默认隐藏 |

### Cardinality Inference

基于 `unique_rate` 推断方向性：
- source 高 unique + target 高 unique → one_to_one
- source 低 unique + target 高 unique → many_to_one
- source 高 unique + target 低 unique → one_to_many
- 两侧都低 → many_to_many / unknown

### User Confirmation

- `suggested` → `confirmed` / `rejected`
- 仅 `confirmed` 关系可用于后续分析规划
- 确认数据可暂存前端，后端持久化推迟到实现阶段

### Safety & Privacy

- 默认仅使用元数据，不扫描原始数据
- 零 LLM 调用（确定性启发式）
- 不自动 join，不自动创建数据集
- 不确定性显性化，避免幻觉 join

### QA Dataset Expectations

定义了 8 条高置信度预期关系（orders→users/products, event_log→users, marketing→users, experiment→users, ltv→users, reviews→users/products）和弱关系/非关系场景。

### Implementation Roadmap

- **4B-5**: Relationship Inference Backend Service（元数据候选生成 + 评分，API only）
- **4B-6**: Relationship Review UI（AI Workbench 关系列表 + 确认/忽略）
- **4B-7**: Relationship-aware Analysis Planner Mock（用 confirmed 关系建议分析路径）
- **远期**: 采样值重叠、关系图可视化、持久化存储、受控 join 预览

---

## Validation

```bash
git status
```

Documentation-only phase. No TypeScript or build validation required.

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Design document exists and covers all required sections | ✅ |
| 2 | Output contract defined with TypeScript-style interfaces | ✅ |
| 3 | Scoring framework is transparent and heuristic-based | ✅ |
| 4 | Confidence levels have clear UI behavior mapping | ✅ |
| 5 | Cardinality inference handles direction correctly | ✅ |
| 6 | Evidence and warnings are human-readable | ✅ |
| 7 | User confirmation model has clear state machine | ✅ |
| 8 | UI proposal is sketched but not implemented | ✅ |
| 9 | API proposal defines request/response shapes | ✅ |
| 10 | Safety and privacy constraints are explicit | ✅ |
| 11 | QA dataset expectations include high-confidence, weak, and non-relationships | ✅ |
| 12 | Implementation roadmap proposes concrete next phases | ✅ |
| 13 | No application source code modified | ✅ |
| 14 | No package files modified | ✅ |

---

## Known Limitations

- 本阶段纯文档，无代码实现
- Value overlap 信号标记为可选未来阶段
- 持久化存储标记为远期
- 同义词映射为手动维护列表，未来可扩展

---

## Next Recommended Phase

**4B-5**: Relationship Inference Backend Service — 实现元数据-only 候选生成和评分，提供 `POST /assistant/infer-relationships` endpoint，使用手动 QA 数据集验证准确性。
