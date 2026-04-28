# Phase 4A-3-5: Dashboard 页面骨架与看板容器重构

**日期**: 2026-04-28
**Commit**: `7092af1`
**Commit Message**: `refactor: migrate dashboard page to shared layout components`
**Push Result**: `master -> master` ✅
**标签**: `refactor: migrate dashboard page to shared layout components`

---

## 1. Phase Goal

将 Dashboard 页面从手写布局迁移到 Phase 4A-2 建立的共享组件体系，统一页面级容器、统计卡片、图表卡片和弹窗体验。

本阶段为纯 UI/layout 重构，**不改变图表业务逻辑、ECharts 配置、看板状态管理或任何数据流**。

---

## 2. Modified Files

| 文件 | 变更 |
|---|---|
| `app/src/pages/Dashboard.tsx` | 重写页面骨架，接入共享组件，移除本地 StatCard |

---

## 3. Specific UI/Layout Changes

### 3.1 PageShell

- 替换原 `<div className="space-y-6" ref={containerRef}>` 根容器
- 统一页面级 padding 和 max-width

### 3.2 PageHeader

- 标题：`看板`（原英文 `"Dashboard"`）
- 副标题：`查看核心指标、图表组件和自定义数据看板。`
- 右上角操作：保留视图切换 tabs（`overview` / `custom`）

### 3.3 Loading / Error State

- Loading: `<LoadingState message={loadingSlow ? '加载较慢，请稍候...' : '加载中...'} className="h-64" />`
- Error: `<ErrorState title="加载失败" message={error} onRetry={() => window.location.reload()} className="h-64" />`

### 3.4 Overview Stat Cards (共享 StatCard)

**Before**: 本地定义 `StatCard` 组件，接收 `icon` 组件 + `color` 字符串。
**After**: 使用共享 `StatCard`，传入包裹了彩色背景的 `icon` ReactNode。

保留 `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4` 外层 div（gsap 动画依赖此 ref）。

4 张卡片：
- 总数据集数（Database / 青色）
- 总文件数（FileSpreadsheet / 紫色）
- 总分析数（Activity / 粉色）
- 平均质量分（TrendingUp / 绿色，使用 `valueClassName` 彩色数值）

### 3.5 Overview Charts (ChartCard)

**Before**: 手写 `<Card><CardHeader>...</CardHeader><CardContent>...</CardContent></Card>` 包装 ECharts div。
**After**: 使用共享 `ChartCard` 组件。

保留 `grid grid-cols-1 lg:grid-cols-3 gap-6` 外层 div（gsap 动画依赖此 ref）。

3 张图表：
- 数据集趋势（line-chart，height="h-64"）
- 文件类型分布（pie-chart，height="h-64"）
- 分析类型分布（bar-chart，height="h-64"）

ECharts 容器 div 传入 `className="h-full"`，ChartCard 负责外层高度控制。

### 3.6 Bottom Section (SectionCard)

**Before**: 手写 glass Card 包装快捷操作和最近活动。
**After**: 使用 `SectionCard`。

- 快捷操作：`lg:col-span-1`，标题带 Zap 图标
- 最近活动：`lg:col-span-2`，标题带 Clock 图标

### 3.7 Empty States

**自定义看板空状态**（未添加任何 widget 时）：
- 替换手写 div 为 shadcn `<Empty>` 组件
- 包含 EmptyHeader、EmptyMedia（LayoutDashboard）、EmptyTitle、EmptyDescription
- 保留"添加组件"按钮

**最近活动空状态**（无最近活动时）：
- 替换手写 div 为 shadcn `<Empty>` 组件
- 包含 EmptyHeader、EmptyTitle、EmptyDescription

### 3.8 WidgetSelector Dialog

**Before**:
```tsx
{showWidgetSelector && (
  <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={...}>
    <div className="glass w-[800px] h-[600px] flex flex-col">...</div>
  </div>
)}
```

**After**:
```tsx
<Dialog open={showWidgetSelector} onOpenChange={setShowWidgetSelector}>
  <DialogContent className="max-w-3xl max-h-[80vh] p-0 flex flex-col gap-0 overflow-hidden bg-[var(--bg-secondary)] border-[var(--border-subtle)]" showCloseButton={false}>
    {/* 原有 WidgetSelector 内容 */}
  </DialogContent>
</Dialog>
```

- 移除手写 `fixed inset-0` 遮罩和点击关闭逻辑
- Dialog 自动处理遮罩、焦点和 Esc 关闭
- 内容区域使用 `flex-1 overflow-y-auto` 处理滚动

### 3.9 Removed Local StatCard

删除 Dashboard.tsx 内定义的本地 `StatCard` 组件（约 30 行），全部使用共享组件。

---

## 4. What Was Intentionally Not Changed

| 项目 | 原因 |
|---|---|
| ECharts option 生成器（`getLineChartOption`、`getPieChartOption`、`getBarChartOption`） | 图表业务逻辑不变 |
| ECharts 渲染逻辑（`echarts.init`、`setOption`、`resize`） | 图表业务逻辑不变 |
| gsap 入场动画（`gsap.from`、`gsap.to`） | 保留视觉反馈 |
| localStorage 自定义看板缓存 | 业务逻辑不变 |
| 自定义看板状态管理（`customMode`、`widgets`、`showWidgetSelector`） | 业务逻辑不变 |
| Widget CRUD 操作（add/remove/move） | 业务逻辑不变 |
| 导出功能（`exportDashboard`） | 业务逻辑不变 |
| 视图切换逻辑（overview ↔ custom） | 业务逻辑不变 |
| 后端 API 调用（`quickRequest.get('/dashboard')`） | 业务逻辑不变 |
| 定时刷新逻辑 | 业务逻辑不变 |

---

## 5. Validation Results

| 检查项 | 结果 |
|---|---|
| `cd app && npx tsc --noEmit` | 0 errors ✅ |
| `cd app && npm run build` | built in 13.14s ✅ |
| `grep -R 'SelectItem value=""' src --include="*.tsx"` | 无输出 ✅ |
| `grep -R "SelectItem value=''" src --include="*.tsx"` | 无输出 ✅ |

---

## 6. Next Phase

建议继续 Phase 4A-3 的剩余页面重构：

1. `AIWorkspace.tsx` / `DataWorkshop.tsx` — 最复杂，留到最后
2. 或进入 Phase 4A 工程优化：bundle splitting、API 类型统一、Alembic 引入
