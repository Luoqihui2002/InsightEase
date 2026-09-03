# InsightEase 文档中心

## QA Recipes

Reusable manual QA recipes and demo scenario scripts live in `docs/qa/`:

- `AI_WORKBENCH_QA_RECIPES.md` covers Dataset Catalog, Relationship Sets, planner narrowing, prefill navigation, Context Panel, result handoff, deterministic follow-up, and Hermes dry-run safety.
- `AI_WORKBENCH_DEMO_SCENARIOS.md` provides concise demo scripts for forecast planning, channel conversion planning, result follow-up, and safety regression checks.
- `P0B_HERMES_LIVE_PLANNING_QA.md` verifies live/fallback source display, clarification, single-table confirmation, multi-table `needs_join`, and zero automatic execution.
- `P0C_MULTI_TABLE_JOIN_BUILDER_QA.md` verifies deterministic Join preview, risk/confirmation boundaries, lineage, and derived-dataset prefill.

本文档中心是 InsightEase 项目的唯一事实来源。

**重要**: `archive/` 目录下的历史材料可能包含旧结论，不代表当前架构。

> Do not use archived files as current architecture unless explicitly instructed.

---

## 推荐阅读顺序

如果你是新加入的开发者或 AI 助手，请按以下顺序阅读：

1. **[CURRENT_ARCHITECTURE.md](CURRENT_ARCHITECTURE.md)** — 当前系统架构、正式主链路、技术边界
2. **[CURRENT_PROGRESS.md](CURRENT_PROGRESS.md)** — 当前完成状态、下一步做什么、已知阻塞项
3. **[decisions/ARCHITECTURE_DECISIONS.md](decisions/ARCHITECTURE_DECISIONS.md)** — 关键架构决策及其当前状态
4. **[API_CONTRACTS.md](API_CONTRACTS.md)** — 前后端 API 契约，重点是 Transform API
5. **[ROADMAP.md](ROADMAP.md)** — 未来阶段路线图（Phase 4-6）
6. **[CHANGELOG.md](CHANGELOG.md)** — 按 Phase 汇总的历史变更
7. **[REFACTOR_SUMMARY.md](REFACTOR_SUMMARY.md)** — Phase 3 架构重构的完整报告（含技术债和文件清单）

如果要接手最近开发进度，还应阅读：

- `docs/phase-logs/` 中最近 3-5 个 Phase log（执行记录、修改文件、验证结果、已知限制）
- `docs/design/` 中与当前任务相关的设计文档（架构方案、功能设计、契约定义）
- `docs/reviews/` 中与当前页面/模块相关的审计文档（页面审计、技术债检查、去留判断）

---

## 当前有效文档

| 文档 | 用途 | 更新频率 |
|---|---|---|
| `README.md` | 本文档，入口导航 | 每次文档结构调整时 |
| `CURRENT_ARCHITECTURE.md` | 当前架构事实 | 架构变更时 |
| `CURRENT_PROGRESS.md` | 当前进度与下一步 | 每完成一个 Phase |
| `decisions/ARCHITECTURE_DECISIONS.md` | 架构决策记录 | 新增或修订 AD 时 |
| `API_CONTRACTS.md` | API 契约 | API 变更时 |
| `ROADMAP.md` | 路线图 | 规划调整时 |
| `CHANGELOG.md` | 变更日志 | 每完成一个 Phase |
| `REFACTOR_SUMMARY.md` | Phase 3 重构报告 | 不再更新（历史记录） |

---

## 工作型文档目录

| 目录 | 用途 | 更新频率 |
|---|---|---|
| `docs/design/` | 当前仍有效的设计文档、架构方案、功能设计 | 新增或调整设计时 |
| `docs/phase-logs/` | 每个 Phase 的执行记录、修改文件、验证结果、已知限制和下一步 | 每完成一个 Phase 必须新增 |
| `docs/reviews/` | 审计、评审、页面去留判断、技术债检查等 review 文档 | 每次专项审计/评审后新增 |
| `docs/decisions/` | 架构决策记录 | 有正式架构决策时 |
| `docs/archive/` | 过时材料，仅用于追溯历史 | 不作为当前依据 |

> `phase-logs/`、`design/`、`reviews/` 是当前工作文档，不属于 archive。不要把它们当成归档；它们是当前项目演进记录。

---

## 归档目录

```
docs/archive/
  audits/          # 早期架构审计报告（可能包含过时结论）
  phase-reports/   # 各阶段详细报告（历史材料）
  old-plans/       # 旧设计文档和计划
```

> 归档文件仅用于追溯历史上下文，**不作为当前架构依据**。

---

## 后续每个 Phase 的文档要求

每完成一个 Phase，开发 AI 必须：

- [ ] 在 `docs/phase-logs/` 新增本 Phase 的 log 文件
- [ ] 在 phase log 中记录：
  - objective
  - files inspected
  - files created/modified
  - key decisions
  - implementation summary
  - validation results
  - manual QA checklist
  - known limitations
  - next recommended phase
- [ ] 更新 `CURRENT_PROGRESS.md`
- [ ] 更新 `CHANGELOG.md`
- [ ] 如路线变化，更新 `ROADMAP.md`
- [ ] 如架构变化，更新 `CURRENT_ARCHITECTURE.md`
- [ ] 如 API 变化，更新 `API_CONTRACTS.md`
- [ ] 如有新架构决策，更新 `decisions/ARCHITECTURE_DECISIONS.md`
- [ ] 如有设计/审计输出，放入 `docs/design/` 或 `docs/reviews/`
- [ ] 通过必要验证后再 commit/push

无需更新的文档：
- `REFACTOR_SUMMARY.md` — 这是 Phase 3 的结案报告，冻结归档

---

## AI 协同开发约定

开发 AI 不应只在对话框中汇报阶段结果。

每个 Phase 完成后，必须将阶段结果沉淀为 Markdown 文件，优先放在：

- `docs/phase-logs/`
- `docs/design/`
- `docs/reviews/`

同时根据影响范围更新主文档，并在验证通过后进行 git commit/push。

特殊规则：
- 如果任务是 bug fix，phase log 必须包含 bug inventory / root cause / fix / validation。
- 如果任务是设计阶段，必须创建 design doc 放入 `docs/design/`。
- 如果任务是审计阶段，必须创建 review doc 放入 `docs/reviews/`。
