# Phase 4A-6-3: Page-Level Spacing and Density Pass

## 日期
2026-04-28

## 目标
移除普通数据卡片上的不当 `glass` 使用，将卡片背景标准化为 `bg-[var(--bg-secondary)]`，保持配置面板和视觉小部件的 `glass` 豁免。

## 修改文件

### `app/src/pages/Attribution.tsx`
- 移除 7 处 `glass`：
  - 4 个汇总统计卡片（用户旅程数 / 总转化数 / 转化率 / 平均触点数）
  - 1 个模型对比图表卡片
  - 1 个各模型详细结果卡片（在 `Object.entries` 循环中）
  - 1 个模型对比表卡片
- 全部替换为 `bg-[var(--bg-secondary)] border-[var(--border-subtle)]`

### `app/src/pages/Statistics.tsx`
- 移除 1 处 `glass`：
  - 列统计结果卡片（`targetColumns.map` 中的 `Card`）
- 替换为 `bg-[var(--bg-secondary)] border-[var(--border-subtle)]`

### `app/src/pages/SmartAnalysis.tsx`
- 移除 6 处 `glass`：
  - 左侧配置面板（`lg:col-span-1`）
  - 数据集选择空状态提示卡片
  - 数据质量诊断卡片
  - 预处理结果卡片（保留 `border-[var(--neon-green)]/30`）
  - 智能分析推荐卡片
  - 分析结果卡片（保留 `border-[var(--neon-green)]/30`）
- 替换为 `bg-[var(--bg-secondary)]`

### `app/src/pages/Profile.tsx`
- 移除 10 处 `glass`：
  - 页面标题 header div
  - 头像卡片
  - 账户信息卡片
  - 4 个统计卡片（数据集 / 分析任务 / 已完成 / 存储使用）
  - 编辑模式个人信息表单卡片
  - 查看模式个人信息展示卡片
  - 安全设置卡片
- 替换为 `bg-[var(--bg-secondary)]`

## 未修改文件

### `app/src/pages/Dashboard.tsx`
- 保留 1 处 `glass`：自定义看板 widget 卡片（`Dashboard.tsx:709`）
- 理由：widget 是故意抬高的视觉组件，符合设计系统中 "important elevated cards" 的豁免条款

### `app/src/pages/GoalPlanner.tsx`
- 无 `glass` 使用，无需清理
- 已有 padding 模式合理：密集输入区 `p-2`/`p-3`，结果统计区 `p-3`/`p-4`，表格区 `p-2`，无明显不一致

## 卡片密度 / 间距变更

本阶段以 glass 清理为主，padding 调整保持最小化：

| 页面 | 变更前 | 变更后 | 密度 |
|---|---|---|---|
| Attribution 汇总卡片 | `glass` | `bg-[var(--bg-secondary)]` | default (`p-4`) |
| Statistics 结果卡片 | `glass` | `bg-[var(--bg-secondary)]` | default |
| SmartAnalysis 诊断/推荐/结果 | `glass` | `bg-[var(--bg-secondary)]` | default |
| Profile 全部卡片 | `glass` | `bg-[var(--bg-secondary)]` | mixed |
| Dashboard widget | `glass` (保留) | `glass` | default |

GoalPlanner 的 padding 模式（输入区 `p-2`、结果区 `p-3`/`p-4`、表格 `p-2`）已经反映了自然的密度分层，未做额外调整。

## 故意未变更的内容

- **业务逻辑**：所有数据集选择、API 调用、统计计算、模型对比、进度条、导出逻辑零改动
- **ECharts 配置**：Attribution 对比图表、Dashboard widget 图表零改动
- **按钮层级**：未修改任何 `variant`
- **布局架构**：未改变 grid/flex 结构
- **DataWorkshop / AIWorkspace**：深度未碰
- **GoalPlanner 计算逻辑**：模板、漏斗层级 CRUD、目标拆解、localStorage、预测对比零改动

## 验证结果

### 类型检查
```bash
cd app && npx tsc --noEmit
```
结果：0 errors ✅

### 生产构建
```bash
cd app && npm run build
```
结果：built in 19.30s ✅

### SelectItem 空值检查
```bash
grep -R "SelectItem value=\"\"" app/src --include="*.tsx"
grep -R "SelectItem value=''" app/src --include="*.tsx"
```
结果：无输出 ✅

### 定向 glass 检查
```bash
grep -R "glass" app/src/pages/Attribution.tsx app/src/pages/Statistics.tsx app/src/pages/SmartAnalysis.tsx app/src/pages/Profile.tsx app/src/pages/Dashboard.tsx --include="*.tsx"
```
结果：仅 Dashboard.tsx:709 保留 1 处（widget 卡片， intentional）✅

### 手动 spot-check
- Attribution：结果卡片仍正常渲染，图表/表格区仍正常 — **Pending user manual verification**
- Statistics：结果卡片仍正常渲染 — **Pending user manual verification**
- SmartAnalysis：向导/推荐流程仍正常渲染 — **Pending user manual verification**
- Profile：个人资料/设置卡片仍正常渲染 — **Pending user manual verification**
- GoalPlanner：密集输入区仍可用，规划结果仍正常渲染 — **Pending user manual verification**
- Console 无新错误 — **Pending user manual verification**

## 已知问题 / TODO
- 无

## 是否可以进入 Phase 4A-6-4
**是。** 本阶段已完成，可进入 Phase 4A-6-4 Chart Color Token Audit。

---

## Git 信息

### Commit 前 git status
```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  modified:   src/pages/Attribution.tsx
  modified:   src/pages/Profile.tsx
  modified:   src/pages/SmartAnalysis.tsx
  modified:   src/pages/Statistics.tsx
```

### Commit hash
`a3af1fb`

### Commit message
```
refactor: clean up page-level card density and glass usage

- Attribution: remove glass from 7 ordinary data/result cards
- Statistics: remove glass from result card
- SmartAnalysis: remove glass from 6 cards (config, empty, diagnosis, preprocess, recommendations, result)
- Profile: remove glass from 10 cards (header, avatar, account, stats, forms, security)
- Dashboard: intentionally preserve 1 glass widget card
- GoalPlanner: no glass found, padding already consistent

Zero business logic change.
```

### Push 结果
```
To https://github.com/Luoqihui2002/InsightEase.git
   a4c9580..a3af1fb  master -> master
```
（首次 push 因网络中断失败，第二次重试成功）

### Package 文件检查
- `package.json` — 未修改 ✅
- `package-lock.json` — 未修改 ✅
