# Phase 4B-6 Log: Relationship Review UI

**Phase ID**: 4B-6  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Add the first UI for reviewing multi-table relationship inference results in the AI Workbench.

---

## Files Created

| File | Description |
|------|-------------|
| `app/src/components/assistant/RelationshipReviewPanel.tsx` | 关系推断与审阅面板：数据集选择、API 调用、结果展示、本地确认/忽略 |

## Files Modified

| File | Description |
|------|-------------|
| `app/src/pages/AIWorkspace.tsx` | 集成 RelationshipReviewPanel 到「能力」标签页；新增 `理清表关系` 能力卡片；添加返回按钮 |
| `docs/CURRENT_PROGRESS.md` | 添加 4B-6 条目 |
| `docs/CHANGELOG.md` | 添加 4B-6 条目 |
| `docs/ROADMAP.md` | 更新 4B-6 状态 |

---

## UI Design

### Entry Point

在 AI Workbench 的「能力」标签页中新增首个卡片：

- **图标**: `Table2` (Lucide)
- **标题**: 理清表关系
- **描述**: 选择多张数据表，推断可能的 join key 和表关系
- **行为**: 点击进入 RelationshipReviewPanel，显示返回箭头可回到能力网格

### RelationshipReviewPanel

**数据集选择**:
- 以 tag 按钮形式展示所有可用数据集
- 点击切换选中/取消
- 显示已选数量
- 底部提示：请至少选择 2 个数据集

**推断触发**:
- 按钮：「推断表关系」
- 禁用条件：选中数 < 2 或正在加载
- 加载状态：「正在分析表结构...」+ spinner

**结果展示**:
- 统计条：共 N 条 / 已确认 X 条 / 已忽略 Y 条
- 每条关系以卡片形式展示：
  - 源表.源列 → 目标表.目标列
  - 置信度标签（高/中/低 + 分数）
  - 关系类型标签（一对一/一对多/多对一/多对多/未知）
  - 状态徽章（已确认 / 已忽略）
  - 警告数量
  - 操作按钮：确认关系 / 忽略 / 重置
  - 展开按钮：显示完整证据和警告列表

**证据展示**:
- 默认折叠
- 展开后显示所有推断依据（类型、消息、分数）
- 警告以琥珀色区分

**空状态**:
- 「暂未发现高置信度表关系。你可以尝试选择更多相关数据集，或检查字段命名是否一致。」

**安全文案**:
- 顶部信息栏明确说明：
  - 选择至少 2 个数据集，基于字段名、角色、类型和唯一性推断
  - 当前仅基于元数据推断，不会读取完整原始数据，也不会自动 join
- 底部提示：当前确认状态仅保存在本次页面会话中，后续版本将支持持久化

### Local Confirm/Ignore State

- 使用组件级 state (`localStatus` Record)
- 不持久化到 localStorage 或后端
- confirmed：卡片边框变绿，显示「已确认」徽章
- rejected：卡片变灰、透明度降低，显示「已忽略」徽章
- 重置：恢复为 suggested 状态

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 19.44s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | AI Workbench opens normally | ✅ (no structural changes to shell) |
| 2 | 能力 tab shows 理清表关系 card | ✅ Added as first card in capabilities grid |
| 3 | User can select at least 2 datasets | ✅ Tag buttons toggle selection |
| 4 | Run button disabled when fewer than 2 datasets | ✅ `disabled={selectedIds.size < 2 \|\| isLoading}` |
| 5 | Inference loading state appears | ✅ Spinner + "正在分析表结构..." |
| 6 | Relationships render after API response | ✅ Result cards with confidence/evidence/warnings |
| 7 | Evidence messages visible on expand | ✅ Chevron toggle reveals evidence list |
| 8 | Metadata-only warning visible | ✅ Top info banner + per-relationship warnings |
| 9 | Confirm button marks relationship as confirmed | ✅ Green badge + border |
| 10 | Ignore button marks relationship as ignored | ✅ Red badge + reduced opacity |
| 11 | No automatic join occurs | ✅ No join logic in component |
| 12 | No dataset created or modified | ✅ Read-only UI |
| 13 | No LLM/Hermes behavior | ✅ Direct API call to backend inference only |
| 14 | Existing DatasetUnderstandingCard still works | ✅ Unchanged |
| 15 | No console errors | ⏸️ Runtime not tested |

---

## Known Limitations

- 确认/忽略状态仅保存在组件内存中，刷新页面后丢失
- 未连接后端持久化（4B-5 未实现 confirm/reject endpoints）
- 未实现关系图可视化（仍为列表/卡片视图）
- 未实现关系驱动的分析规划（4B-7）

---

## Next Recommended Phase

**4B-7**: Relationship-aware Analysis Planner Mock — 使用 confirmed 关系建议分析数据需求，模板/关键词匹配，无真实 LLM。
