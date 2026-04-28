# Phase 4A-3-4: Datasets 页面骨架与交互一致性重构

**日期**: 2026-04-28
**Commit**: `02022fe`
**Commit Message**: `refactor: migrate datasets page to shared layout components`
**Push Result**: `master -> master` ✅
**标签**: `refactor: migrate datasets page to shared layout components`

---

## 1. Phase Goal

将 Datasets 页面从手写布局迁移到 Phase 4A-2 建立的共享组件体系，消除原生 `confirm()` / `alert()`，提升交互一致性和可维护性。

本阶段为纯 UI/layout + 交互一致性重构，不改变数据集业务逻辑。

---

## 2. Modified Files

| 文件 | 变更 |
|---|---|
| `app/src/pages/Datasets.tsx` | 重写页面骨架，接入共享组件，替换原生确认/提示 |

---

## 3. Specific UI/Layout Changes

### 3.1 PageShell

- 替换原 `<div className="space-y-6">` 根容器
- 统一页面级 padding 和 max-width

### 3.2 PageHeader

- 标题：`数据集`（原英文 `"Datasets"`）
- 副标题：`管理已上传的数据集，预览字段结构、查看详情并进入后续分析。`
- 右上角操作：保留"上传数据"按钮

### 3.3 Loading / Error State

- Loading: `<LoadingState message="正在加载数据集..." className="h-64" />`
- Error: `<ErrorState title="加载失败" message={error} onRetry={loadDatasets} className="h-64" />`

### 3.4 ContentGrid + StatCard

- 4 列统计卡片布局替换原手写 glass Card
- 图标使用彩色背景包裹后传入 `icon` prop
- 平均质量分使用 `valueClassName={getQualityColor(avgQuality)}` 实现彩色数值

### 3.5 SectionCard

- 搜索栏 + 数据集列表外层包裹 `<SectionCard title="数据集列表 ...">`
- 移除原 `glass` 样式，改用标准 `bg-[var(--bg-secondary)]`

### 3.6 Empty State

- 替换表格内手写空行 `<td colSpan={9} className="py-12 text-center">` 为 shadcn `<Empty>` 组件
- 包含 EmptyHeader、EmptyMedia、EmptyTitle、EmptyDescription
- 无数据集时显示"去上传"按钮

### 3.7 Table Density

- 数据单元格：`py-4 px-4` → `py-3 px-3`
- 保持可读性，行操作按钮仍可见

### 3.8 DataTablePreview

**Before**:
- 展开行预览和详情弹窗均使用手写 `<table className="w-full text-xs">`

**After**:
- 展开行预览：`<DataTablePreview columns={...} data={...} maxHeight="300px" />`
- 详情弹窗预览：`<DataTablePreview columns={...} data={...} maxHeight="400px" />`

### 3.9 Detail Dialog Sizing

**Before**:
- `style={{ width: '90vw', height: '90vh', maxWidth: 'none' }}`

**After**:
- `className="max-w-4xl max-h-[80vh] p-0 flex flex-col overflow-hidden"`
- 内部内容区域使用 `flex-1 overflow-y-auto`
- 弹窗头部使用 `p-6 border-b`

### 3.10 Bottom Upload Area

**Before**:
- 完整的虚线边框拖拽区域，含标题、说明文字、图标

**After**:
- 简化为 `Button variant="outline" className="w-full border-dashed"`
- 文字：`去上传数据`
- 点击跳转 Upload 页面

---

## 4. Interaction Consistency Changes

### 4.1 Native confirm() → AlertDialog

**批量删除**:
```tsx
// Before
if (!confirm(`确定要删除选中的 ${selectedRows.size} 个数据集吗？`)) return;

// After
<AlertDialog open={deleteDialogOpen} ...>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>确认删除</AlertDialogTitle>
      <AlertDialogDescription>确定要删除选中的 N 个数据集吗？此操作不可撤销。</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>取消</AlertDialogCancel>
      <AlertDialogAction onClick={executeDelete}>确认删除</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**单条删除**：同样使用 AlertDialog，通过 `deleteTarget` 状态区分 batch/single。

### 4.2 Native alert() → toast

| 场景 | Before | After |
|---|---|---|
| 重命名非法字符 | `alert('文件名包含非法字符')` | `toast.error('文件名包含非法字符')` |
| 批量删除失败 | `alert('批量删除失败: ' + err.message)` | `toast.error('批量删除失败: ' + err.message)` |
| 单条删除失败 | `alert('删除失败: ' + err.message)` | `toast.error('删除失败: ' + err.message)` |
| 下载失败 | `alert(err.message \|\| ...)` | `toast.error(err.message \|\| ...)` |
| 批量删除部分失败 | `alert('N 个数据集删除失败')` | `toast.error('N 个数据集删除失败')` |
| 重命名成功 | 无反馈 | `toast.success('重命名成功')` |
| 删除成功 | 无反馈 | `toast.success('删除成功')` |
| 批量删除成功 | 无反馈 | `toast.success('批量删除成功')` |

---

## 5. What Was Intentionally Not Changed

| 项目 | 原因 |
|---|---|
| 数据集 API 调用（`quickRequest.get('/datasets')`、`datasetApi.preview` 等） | 业务逻辑不变 |
| 下载函数（`downloadFile`） | 业务逻辑不变 |
| 状态管理（`datasets`, `selectedRows`, `previewData` 等） | 业务逻辑不变 |
| `gsap` 入场动画 | 保留视觉反馈 |
| 重命名业务逻辑（正则验证、API 调用） | 业务逻辑不变 |
| 展开行预览加载逻辑 | 业务逻辑不变 |
| 多选逻辑（toggleRowSelection, toggleAllSelection） | 业务逻辑不变 |
| 字段结构展示（schema 遍历） | 业务逻辑不变 |
| AI 摘要展示 | 业务逻辑不变 |
| 行内重命名 UI 交互（Input + Check/X 按钮） | 交互模式已合理，仅保留 |

---

## 6. Validation Results

| 检查项 | 结果 |
|---|---|
| `cd app && npx tsc --noEmit` | 0 errors ✅ |
| `cd app && npm run build` | built in 14.96s ✅ |
| `grep -R 'SelectItem value=""' src --include="*.tsx"` | 无输出 ✅ |
| `grep -R "SelectItem value=''" src --include="*.tsx"` | 无输出 ✅ |

### 6.1 Manual Verification Checklist

请在浏览器中打开 `http://localhost:5175/datasets` 确认：

- [x] Datasets 页面正常打开，无错误边界
- [x] 页面标题为中文 `数据集`
- [x] 数据集列表正常渲染
- [x] 搜索/过滤正常工作
- [x] 展开行预览正常显示（DataTablePreview）
- [x] 详情弹窗正常打开/关闭，大小合适
- [ ] 重命名正常工作 — **失败**（见下方已知问题）
- [x] 单条删除触发 AlertDialog，确认后删除成功
- [x] 批量删除触发 AlertDialog，确认后删除成功
- [x] 下载正常工作
- [x] "去上传数据"按钮可正常跳转 Upload 页面
- [x] Console 无新报错

**手动验证摘要**：
UI/layout 重构项均验证通过。重命名功能因后端 API 返回 405 失败，属后端/前端契约不匹配，非本阶段 UI 回归问题。

---

## 7. Known Issues / TODO

- Dataset rename currently fails because the frontend sends `PATCH /api/v1/datasets/{dataset_id}`, but the backend returns `405 Method Not Allowed`.
- This appears to be a backend API / frontend contract mismatch, not a UI layout regression.
- Track for later backend/API cleanup phase.
- This issue does not block continuing Phase 4A frontend layout refactors.

---

## 8. Next Phase

建议继续 Phase 4A-3 的下一个页面重构，顺序：

1. `Dashboard.tsx` — 引入 ChartCard + ContentGrid
2. `AIWorkspace.tsx` / `DataWorkshop.tsx` — 最复杂，留到靠后
