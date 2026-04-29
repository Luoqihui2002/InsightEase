# Phase 4A-6-5.2: PathAnalysis Analysis Type Grid Layout Hotfix

## 日期
2026-04-28

## 目标
修复 PathAnalysis “分析类型”选择器布局：选项拥挤在左上角，未充分利用配置面板宽度。

## 根因
- `ToggleGroup` 缺少 `w-full`，导致 CSS grid 未填满父容器宽度。
- `ToggleGroupItem` 使用 `flex flex-col items-center`（inline-flex 行为），子项收缩至内容宽度，未填满网格单元格。
- `h-auto` 导致各选项高度不一致。
- `sm:grid-cols-3` 使 5 个选项呈 3+2 排列，视觉上不平衡。

## 修改文件

### `app/src/pages/PathAnalysis.tsx`
- `ToggleGroup`：
  - `className` 从 `grid grid-cols-2 sm:grid-cols-3 gap-3` → `grid w-full grid-cols-2 gap-2`
  - 添加 `w-full` 确保 grid 填满父容器
  - 移除 `sm:grid-cols-3`，统一 2 列布局，5 项呈 3+2 排列更稳定
  - gap 恢复为 `gap-2`（8px），与配置面板密度一致
- `ToggleGroupItem`（全部 5 项）：
  - 移除 `flex flex-col items-center`（inline-flex 收缩行为）
  - 添加 `w-full justify-start gap-2 px-3`，使每项填满单元格并左对齐
  - `h-auto` → `h-14`，统一高度
  - 图标添加 `shrink-0` 防止压缩
  - 选中/未选中样式 token 完全保留

## 未修改的内容

- checkbox.tsx — 本次 hotfix 未触碰复选框（4A-6-5.1 的复选框修复保持不变）
- 分析类型选项语义、onValueChange 行为、pathType 状态逻辑
- 图表渲染、ECharts 生命周期、数据计算
- 数据集/字段选择器
- 页面布局架构

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
结果：built in 26.93s ✅

### SelectItem 空值检查
```bash
grep -R "SelectItem value=\"\"" app/src --include="*.tsx"
grep -R "SelectItem value=''" app/src --include="*.tsx"
```
结果：无输出 ✅

### 手动 spot-check
- PathAnalysis 页面打开正常 — **Pending user manual verification**
- “分析类型”选择器使用干净的 2 列网格 — **Pending user manual verification**
- 选项填满可用宽度，无左上角聚集 — **Pending user manual verification**
- 选中状态正常工作，5 种类型切换正常 — **Pending user manual verification**
- Console 无新错误 — **Pending user manual verification**

## 已知问题 / TODO
- 无

## 是否可以进入下一阶段
**是。** 可进入 Phase 4A-6-6 Button Hierarchy + Bundle Size Triage。

---

## Git 信息

### Commit 前 git status
```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  modified:   src/pages/PathAnalysis.tsx
```

### Commit hash
待补充

### Commit message
```
fix: improve path analysis type selector grid layout

- ToggleGroup: add w-full, use fixed 2-col grid, remove sm:grid-cols-3
- ToggleGroupItem: w-full justify-start, uniform h-14, left-aligned icon+text
- Remove flex-col items-center that caused shrink-to-content behavior

Zero business logic change.
```

### Push 结果
待补充

### Package 文件检查
- `package.json` — 未修改 ✅
- `package-lock.json` — 未修改 ✅
