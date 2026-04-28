# Phase 4A-3-2: Upload Page Layout Refactor

**日期**: 2026-04-28  
**Commit**: `5568973`  
**标签**: `refactor: migrate upload page to shared layout components`

---

## 1. Phase Goal

将 Upload 页面从手写布局迁移到 Phase 4A-2 建立的共享组件体系，提升布局一致性和可维护性。

本阶段为纯 UI/layout 重构，不改变上传业务逻辑。

---

## 2. Modified Files

| 文件 | 变更 |
|---|---|
| `app/src/pages/Upload.tsx` | 重写页面骨架，接入共享组件 |
| `app/src/components/data-display/index.ts` | 导出 ScoreRing |
| `docs/CURRENT_PROGRESS.md` | 追加 Phase 4A-3-2 记录 |
| `docs/CHANGELOG.md` | 追加 Phase 4A-3-2 记录 |

## 3. Added Files

| 文件 | 说明 |
|---|---|
| `app/src/components/data-display/ScoreRing.tsx` | 从 Upload.tsx 提取的评分环组件 |

---

## 4. Specific UI/Layout Changes

### 4.1 PageShell

- 替换原 `<div className="space-y-6">` 根容器
- 统一页面级 padding 和 max-width

### 4.2 PageHeader

- 标题：`上传数据`
- 副标题：`上传 CSV / Excel 文件，后端将自动解析字段、质量信息和数据集结构。`

### 4.3 SectionCard

以下区块统一使用 `SectionCard`：

| 区块 | 备注 |
|---|---|
| 拖拽上传区域 | 移除 `glass`，改用默认 `bg-secondary` |
| 上传进度列表 | 新增"清除已完成"按钮 |
| 智能探查报告 | 保留 `border-[var(--neon-cyan)]/30 neon-glow` 作为重要结果卡片 |

### 4.4 ScoreRing 提取

原内联 SVG 评分环提取为 `ScoreRing` 共享组件：

```tsx
export interface ScoreRingProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}
```

- 保留原有 SVG 绘制逻辑（`strokeDasharray` 计算）
- 移除 `animate-spin`（原评分环无旋转，但拖拽区域有）
- 支持 sm/md/lg 三种尺寸

### 4.5 拖拽区域动画简化

**Before**:
- `isDragging` 时显示持续旋转的渐变背景（`animation: spin 3s linear infinite`）

**After**:
- `isDragging` 时仅显示边框高亮（`border-[var(--neon-cyan)]` + `opacity-30`）
- 保留拖拽时的背景色变化（`bg-[var(--neon-cyan)]/10`）和图标放大

### 4.6 清除已完成

新增 `clearCompleted` 函数：
- 仅移除 `status !== 'uploading'` 的项
- 不影响正在上传的文件
- 不改变 upload 状态模型

---

## 5. What Was Intentionally Not Changed

| 项目 | 原因 |
|---|---|
| 上传 API 调用（`datasetApi.upload`） | 业务逻辑不变 |
| 文件过滤逻辑（`.csv/.xlsx/.xls`） | 业务逻辑不变 |
| 上传状态管理（`uploadingFiles` / `scanReport`） | 业务逻辑不变 |
| `gsap` 入场动画 | 保留视觉反馈 |
| `removeFile` 逻辑（删除 completed 时清空 scanReport） | 业务逻辑不变 |
| 字段分析展示 | 仅外层容器替换为 SectionCard |
| AI 摘要展示 | 仅外层容器替换为 SectionCard |
| "去查看数据集"按钮 | 保留原有跳转逻辑 |

---

## 6. Validation Results

| 检查项 | 结果 |
|---|---|
| `cd app && npx tsc --noEmit` | 0 errors ✅ |
| `cd app && npm run build` | built in 12.28s ✅ |
| `grep -R 'SelectItem value=""' src --include="*.tsx"` | 无输出 ✅ |
| `grep -R "SelectItem value=''" src --include="*.tsx"` | 无输出 ✅ |

### 6.1 Manual Verification Checklist

请在浏览器中打开 `http://localhost:5175/upload` 确认：

- [ ] Upload 页面正常打开，无错误边界
- [ ] 拖拽区域渲染正确，边框为虚线
- [ ] 拖拽进入时边框变为实线青色，无旋转动画
- [ ] 选择 CSV/Excel 文件后上传进度条正常显示
- [ ] 上传完成后智能探查报告正常弹出
- [ ] 评分环显示正确（ScoreRing 组件）
- [ ] "清除已完成"按钮可正常移除已完成项
- [ ] Console 无报错

---

## 7. Known Issues / TODO

- **无已知问题。**
- 后续如需进一步统一，可考虑将拖拽区域的 `button` 样式文件选择器替换为 shadcn `Button` + `Input type="file"` 组合（当前使用透明覆盖的 `input` 是常见做法，暂不修改）。

---

## 8. Next Phase

可以继续 Phase 4A-3 的下一个页面重构。建议顺序：

1. `History.tsx` — 简单列表页，验证 PageShell + PageHeader
2. `Datasets.tsx` — 引入 DataTablePreview + Dialog
3. `Dashboard.tsx` — 引入 ChartCard + ContentGrid
4. `AIWorkspace.tsx` / `DataWorkshop.tsx` — 最复杂，留到靠后
