# Phase 4A-3-6: Visualization 页面骨架与图表容器重构

**日期**: 2026-04-28
**Commit**: `4f90f8f`
**Commit Message**: `refactor: migrate visualization page to shared layout components`
**Push Result**: `master -> master` ✅
**标签**: `refactor: migrate visualization page to shared layout components`

---

## 1. Phase Goal

将 Visualization 页面从手写布局迁移到 Phase 4A-2 建立的共享组件体系，统一页面级容器、配置面板、图表容器和底部区块体验。

本阶段为纯 UI/layout 重构，**不改变图表业务逻辑、ECharts 配置、字段推断、智能推荐、聚类分析或任何数据流**。

---

## 2. Modified Files

| 文件 | 变更 |
|---|---|
| `app/src/pages/Visualization.tsx` | 重写页面骨架，接入共享组件，调整按钮层级和网格响应式 |

---

## 3. Specific UI/Layout Changes

### 3.1 PageShell

- 替换原 `<div className="space-y-6">` 根容器
- 统一页面级 padding 和 max-width（`max-w-7xl`）

### 3.2 PageHeader

- 标题：`可视化分析`（原无显式 PageHeader，标题为手写 h1）
- 副标题：`选择数据集和字段，生成图表并保存到看板或下载结果。`
- 无右上角操作（保留在 ChartCard actions 中）

### 3.3 SidePanel（左侧配置面板）

**Before**:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
  <Card className="glass border-[var(--border-subtle)] lg:col-span-1">
    <CardHeader>...</CardHeader>
    <CardContent>...</CardContent>
  </Card>
```

**After**:
```tsx
<div className="flex flex-col lg:flex-row gap-6">
  <SidePanel width="default" className="w-full min-w-0 lg:w-96 lg:min-w-[384px]">
    {/* header + config content */}
  </SidePanel>
```

- 使用 `SidePanel` 替代手写 `Card className="glass"`
- 移动端覆盖为 `w-full min-w-0`，桌面端恢复 `w-96 min-w-[384px]`
- 面板标题从 `CardTitle` 改为普通 h3，保持图标和文字

### 3.4 ResultPanel + ChartCard（右侧图表区域）

**Before**:
```tsx
<Card className="glass border-[var(--border-subtle)] lg:col-span-3">
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle>图表预览</CardTitle>
    <div className="flex gap-2">...buttons...</div>
  </CardHeader>
  <CardContent>
    {/* conditional empty/loading/chart */}
  </CardContent>
</Card>
```

**After**:
```tsx
<ResultPanel>
  <ChartCard
    title="图表预览"
    actions={...buttons...}
    height="h-96"
  >
    {/* conditional empty/loading/chart */}
  </ChartCard>
</ResultPanel>
```

### 3.5 Empty / Loading States

**未选择数据集**:
- Before: 手写 `<div className="h-96 flex items-center justify-center"><Database icon />...</div>`
- After: `<Empty className="h-full border-none"><EmptyHeader><EmptyMedia><Database /></EmptyMedia><EmptyTitle>请选择数据集</EmptyTitle><EmptyDescription>...</EmptyDescription></EmptyHeader></Empty>`

**数据加载中**:
- Before: 手写 `animate-spin` border div
- After: `<LoadingState message="加载数据中..." className="h-full" />`

**字段未配置**:
- Before: 手写 `<div className="h-96 flex items-center justify-center"><BarChart3 icon />...</div>`
- After: `<Empty className="h-full border-none">...</Empty>`

### 3.6 Button Hierarchy

**Before**:
- `保存到看板` → `variant="outline"` + `border-[var(--neon-purple)] text-[var(--neon-purple)]`
- `下载图表` → `variant="outline"` + `border-[var(--neon-cyan)] text-[var(--neon-cyan)]`

**After**:
- `保存到看板` → `variant="default"`（主操作，neon cyan 背景）
- `下载图表` → `variant="outline"`（次操作）

### 3.7 Chart Type Grid Responsiveness

**Before**: `grid grid-cols-3 gap-2`（在窄屏幕上 3 列可能拥挤）
**After**: `grid grid-cols-2 sm:grid-cols-3 gap-2`（小屏幕 2 列，sm 以上 3 列）

### 3.8 Bottom Sections (SectionCard)

**智能图表推荐**和**字段概览**:
- Before: `Card className="glass border-[var(--border-subtle)]"`
- After: `SectionCard` with title ReactNode（包含图标）

---

## 4. Interaction Consistency Changes

None in this phase — no `confirm()` / `alert()` existed in Visualization.tsx.

---

## 5. What Was Intentionally Not Changed

| 项目 | 原因 |
|---|---|
| ECharts option 生成器（`buildChartOption`） | 图表业务逻辑不变 |
| ECharts 渲染逻辑（`echarts.init`、`setOption`、`resize`） | 图表业务逻辑不变 |
| 字段类型推断（`inferFieldType`） | 业务逻辑不变 |
| 智能图表推荐（`recommendations` useMemo） | 业务逻辑不变 |
| 聚类分析逻辑（`runClustering`） | 业务逻辑不变 |
| 数据聚合逻辑（`aggregateData`） | 业务逻辑不变 |
| 直方图计算（`calculateHistogram`） | 业务逻辑不变 |
| 数据集 API 调用（`datasetApi.getDetail`、`datasetApi.preview`） | 业务逻辑不变 |
| 分析 API 调用（`analysisApi.runClustering`） | 业务逻辑不变 |
| 保存到看板逻辑（`saveToDashboard`） | 业务逻辑不变 |
| 下载图表逻辑（`handleDownload`） | 业务逻辑不变 |
| 原生 `<select>` 字段选择器 | 替换为 shadcn Select 属于 4A-5 交互一致性治理，本阶段不改动 |
| 手写聚类 toggle switch（`<button className="relative w-10 h-5...">`） | 替换为 shadcn Switch 属于 4A-5，本阶段不改动 |
| 图表类型选择 `<button>` | 当前实现功能正常，替换为 shadcn ToggleGroup 属于 4A-5 |
| 推荐卡片 `<div onClick={...}>` | 当前实现功能正常，结构复杂，替换为 Button 属于 4A-5 |

---

## 6. Validation Results

| 检查项 | 结果 |
|---|---|
| `cd app && npx tsc --noEmit` | 0 errors ✅ |
| `cd app && npm run build` | built in 13.30s ✅ |
| `grep -R 'SelectItem value=""' src --include="*.tsx"` | 无输出 ✅ |
| `grep -R "SelectItem value=''" src --include="*.tsx"` | 无输出 ✅ |

### 6.1 Manual Verification Checklist

请在浏览器中打开 `http://localhost:5175/visualization` 确认：

- [x] Visualization 页面正常打开，无错误边界
- [x] 页面标题为中文 `可视化分析`
- [x] 数据集选择器正常渲染
- [x] 图表类型选择网格在窄屏为 2 列、宽屏为 3 列
- [x] 字段选择（原生 select）正常工作
- [x] 选择数据集后图表预览正常渲染
- [x] 保存到看板按钮样式为主操作（filled）
- [x] 下载图表按钮样式为次操作（outline）
- [x] 未选数据集时显示 Empty 空状态
- [x] 数据加载时显示 LoadingState
- [x] 字段未配置时显示 Empty 空状态
- [x] 智能推荐区块正常渲染
- [x] 字段概览区块正常渲染
- [x] Console 无新报错

---

## Hotfix: Cluster Toggle Knob Overflow

- **Issue**: 聚类分析 toggle 的白色旋钮在 enabled 状态下向右溢出，超出青色 track 边界
- **Root cause**: 旋钮使用 `absolute` 定位但未显式指定 `left`，依赖默认布局位置，在不同浏览器/渲染环境下位置不一致；disabled 状态使用 `translate-x-0.5` 但 enabled 状态使用 `translate-x-5`，位移量与 track 宽度不匹配
- **Fix**:
  - 为旋钮显式添加 `left-0.5`，确保起始位置固定在 track 左内侧
  - disabled 状态改为 `translate-x-0`（仅依靠 `left-0.5` 的 2px 偏移）
  - enabled 状态保持 `translate-x-5`（20px 位移），track 宽 40px，旋钮宽 16px，右侧保留 2px 边距
  ```tsx
  <span className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
    enableClustering ? 'translate-x-5' : 'translate-x-0'
  }`} />
  ```
- **Validation**:
  - `tsc --noEmit` 0 errors ✅
  - `npm run build` built in 14.38s ✅
  - 切换行为、聚类逻辑、状态变量均未改动
- **Commit**: `4f90f8f` 之后的独立 hotfix commit
- **Push result**: `master -> master` ✅

---

## 7. Known Issues / TODO

| 项目 | 说明 | 计划解决 |
|---|---|---|
| 原生 `<select>` 字段选择器 | 当前使用 4 个原生 `<select>`，应替换为 shadcn Select | Phase 4A-5 |
| 手写聚类 toggle switch | ~~当前为手写 `<button>` 模拟 toggle，应替换为 shadcn Switch~~ 视觉 bug 已 hotfix，后续仍计划替换为 shadcn Switch | Phase 4A-5 |
| 图表类型选择 `<button>` | 当前为手写 `<button>`，应替换为 shadcn ToggleGroup | Phase 4A-5 |
| 推荐卡片 `<div onClick={...}>` | 当前为可点击 div，应使用 shadcn Button 或 Card with hover | Phase 4A-5 |

---

## 8. Next Phase

建议继续 Phase 4A-3 的剩余页面重构：

1. `AIWorkspace.tsx` / `DataWorkshop.tsx` — 最复杂，留到最后
2. 或进入 Phase 4A-5: 交互一致性治理（替换原生 select、toggle、confirm/alert）
