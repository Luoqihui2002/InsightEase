# InsightEase 文档中心

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

## 归档目录

```
docs/archive/
  audits/          # 早期架构审计报告（可能包含过时结论）
  phase-reports/   # 各阶段详细报告（历史材料）
  old-plans/       # 旧设计文档和计划
```

> 归档文件仅用于追溯历史上下文，**不作为当前架构依据**。

---

## 后续每个 Phase 应更新的文档

完成一个新 Phase 后，请按以下清单更新文档：

- [ ] `CURRENT_PROGRESS.md` — 更新当前阶段状态和下一步
- [ ] `CHANGELOG.md` — 追加新 Phase 的变更摘要
- [ ] `CURRENT_ARCHITECTURE.md` — 如有架构变化则更新
- [ ] `API_CONTRACTS.md` — 如有 API 变化则更新
- [ ] `decisions/ARCHITECTURE_DECISIONS.md` — 如有新决策或决策状态变化则更新
- [ ] `ROADMAP.md` — 如有路线调整则更新

无需更新的文档：
- `REFACTOR_SUMMARY.md` — 这是 Phase 3 的结案报告，冻结归档
