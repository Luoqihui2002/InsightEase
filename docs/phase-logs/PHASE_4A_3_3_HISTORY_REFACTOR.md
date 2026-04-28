# Phase 4A-3-3: History 页面骨架替换

**日期**: 2026-04-28
**Commit**: `待填写`
**标签**: `refactor: migrate history page to shared layout components`

---

## 1. Phase Goal

将 History 页面从手写布局迁移到 Phase 4A-2 建立的共享组件体系，提升布局一致性和可维护性。

本阶段为纯 UI/layout 重构，不改变历史记录业务逻辑。

---

## 2. Modified Files

| 文件 | 变更 |
|---|---|
| `app/src/pages/History.tsx` | 重写页面骨架，接入共享组件，修复类型错误 |
| `app/src/components/data-display/StatCard.tsx` | 新增 `valueClassName` 属性，支持自定义数值颜色 |
| `docs/CURRENT_PROGRESS.md` | 追加 Phase 4A-3-3 记录 |
| `docs/CHANGELOG.md` | 追加 Phase 4A-3-3 记录 |

---

## 3. Specific UI/Layout Changes

### 3.1 PageShell

- 替换原 `<div className="space-y-6">` 根容器
- 统一页面级 padding 和 max-width

### 3.2 PageHeader

- 标题：`历史记录`（原英文 `"History"`）
- 副标题：`查看历史分析任务、结果摘要和导出记录。`

### 3.3 Loading / Error State

- Loading: `<LoadingState message="正在加载分析历史..." />`
- Error: `<ErrorState title="加载失败" message={error} onRetry={handleRetry} />`

### 3.4 ContentGrid + StatCard

- 4 列统计卡片布局替换原手写 grid
- 使用 `valueClassName` 实现彩色数值：
  - 完成率: `text-[var(--neon-green)]`
  - 平均得分: `text-[var(--neon-cyan)]`
  - 进行中: `text-[var(--neon-cyan)]`
  - 总任务: `text-[var(--neon-pink)]`

### 3.5 SectionCard

- 分析记录表格外层包裹 `<SectionCard title="分析记录">`

### 3.6 Empty State

- 替换手写空状态 div 为 shadcn `<Empty>` 组件
- 包含 EmptyHeader、EmptyTitle、EmptyDescription、EmptyMedia

### 3.7 DropdownMenu（下载菜单）

**Before**:
- `group-hover` CSS 控制菜单显隐
- 移动端无法 hover，不可用

**After**:
- `<DropdownMenu>` + `<DropdownMenuTrigger>` + `<DropdownMenuContent>`
- 点击触发，移动端可用
- 4 个导出格式：Excel、CSV、JSON、报告

### 3.8 Dialog（详情弹窗）

**Before**:
- 手写 `fixed inset-0` 模态框
- 自定义 backdrop、动画、关闭按钮

**After**:
- `<Dialog>` + `<DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col overflow-hidden" showCloseButton={false}>`
- 复用已有的 glassmorphism Dialog 样式

---

## 4. Type Fixes

### 4.1 未使用导入

- 移除 `AlertCircle` 导入（原手写 error state 使用，现由 `ErrorState` 组件封装）

### 4.2 `selectedAnalysis` possibly null

**问题**: `<Dialog open={!!selectedAnalysis}>` 时，TypeScript 无法 Narrow 内部 `selectedAnalysis` 类型。

**修复**:
```tsx
{selectedAnalysis && (
  <Dialog open={true} onOpenChange={...}>
    <DialogContent>...</DialogContent>
  </Dialog>
)}
```

Dialog 仅在 `selectedAnalysis` 存在时渲染，内部无需额外 null check。

---

## 5. What Was Intentionally Not Changed

| 项目 | 原因 |
|---|---|
| 历史记录 API 调用（`analysisApi.getHistory` 等） | 业务逻辑不变 |
| 导出函数（`handleDownload`, `downloadMarkdownReport`） | 业务逻辑不变 |
| 状态管理（`history`, `stats`, `filters`, `selectedAnalysis`） | 业务逻辑不变 |
| `gsap` 入场动画 | 保留视觉反馈 |
| 分析结果渲染（`renderResultPreview`） | 业务逻辑不变 |
| 删除确认对话框（`AlertDialog`） | 保留原有交互 |
| 重新分析跳转逻辑 | 保留原有跳转 |

---

## 6. Validation Results

| 检查项 | 结果 |
|---|---|
| `cd app && npx tsc --noEmit` | 0 errors ✅ |
| `cd app && npm run build` | built in 13.06s ✅ |
| `grep -R 'SelectItem value=""' src --include="*.tsx"` | 无输出 ✅ |
| `grep -R "SelectItem value=''" src --include="*.tsx"` | 无输出 ✅ |

---

## 7. Known Issues / TODO

- **无已知问题。**

---

## 8. Next Phase

建议继续 Phase 4A-3 的下一个页面重构，顺序：

1. `Datasets.tsx` — 引入 DataTablePreview + Dialog
2. `Dashboard.tsx` — 引入 ChartCard + ContentGrid
3. `AIWorkspace.tsx` / `DataWorkshop.tsx` — 最复杂，留到靠后
