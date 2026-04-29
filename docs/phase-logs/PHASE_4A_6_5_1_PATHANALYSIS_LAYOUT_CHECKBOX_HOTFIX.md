# Phase 4A-6-5.1: PathAnalysis Control Layout + Checkbox Visibility Hotfix

## 日期
2026-04-28

## 目标
修复 PathAnalysis 手动 QA 中发现的两个 UI 问题：分析类型控件布局拥挤、未选中复选框在暗色背景下可见性不足。

## 根因评估

### 1. 分析类型布局问题
- **根因**: ToggleGroup 使用 `grid grid-cols-2 gap-2`，5 个子项导致最后一行只有 1 个元素（孤儿项），视觉上拥挤且不对称。
- **影响**: 配置面板中分析类型区域显得压缩，未充分利用可用宽度。

### 2. 复选框可见性问题
- **根因**: shadcn `Checkbox` 基元的未选中状态边框使用 `border-input`，在暗色主题下解析为接近背景色的深色调（`hsl(225 35% 18%)` ≈ `#1a1f3a`），与卡片背景 `#151b3d` 对比度极低。
- **影响**: 用户在未选中状态下几乎看不到复选框轮廓，难以定位可选项。

## 修改文件

### `app/src/pages/PathAnalysis.tsx`
- 分析类型 ToggleGroup 布局：`grid grid-cols-2 gap-2` → `grid grid-cols-2 sm:grid-cols-3 gap-3`
  - 桌面端（sm+）变为 3 列布局，5 个选项呈现为 3+2 的均衡排列
  - 移动端保持 2 列
  - gap 从 8px 增加到 12px，提升呼吸感

### `app/src/components/ui/checkbox.tsx`
- 未选中状态边框：`border-input` → `border-slate-400/40`
  - `slate-400`（`#94a3b8`）与项目暗色主题 `--text-secondary` 一致
  - 40% 透明度在 `#151b3d` 背景上提供足够的可见性，同时不刺眼
  - 选中状态 `data-[state=checked]:border-primary` 保持不变，继续覆盖为霓虹青边框
  - 背景色、聚焦环、禁用状态均未改动

## 为什么采用共享复选框修复

| 考量 | 结论 |
|---|---|
| 使用范围 | Checkbox 在 Forecast.tsx（3 处）和 PathAnalysis.tsx（4 处）均有使用 |
| 背景环境 | 所有使用处均为暗色背景卡片，问题一致 |
| 变更范围 | 仅修改未选中边框色，选中态/聚焦态/禁用态零变更 |
| 回退风险 | `border-slate-400/40` 是中性灰，在任何暗色背景下均可见，无侵入性 |
| 替代方案评估 | 若在每个页面局部覆盖 className，代码重复且易遗漏新页面 |

因此选择共享修复。

## 故意未变更的内容

- 分析类型选项语义、onValueChange 行为、状态逻辑
- ToggleGroupItem 的选中/未选中样式（仅调整容器网格和间距）
- 图表渲染、ECharts 生命周期、数据计算
- 按钮层级、页面布局架构
- 其他页面的 Checkbox 调用方式

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
结果：built in 19.94s ✅

### SelectItem 空值检查
```bash
grep -R "SelectItem value=\"\"" app/src --include="*.tsx"
grep -R "SelectItem value=''" app/src --include="*.tsx"
```
结果：无输出 ✅

### Checkbox 使用范围审计
```bash
grep -R "<Checkbox" app/src --include="*.tsx"
```
结果：Forecast.tsx（3 处）、PathAnalysis.tsx（4 处）、components/ui/checkbox.tsx（1 处）。共享修复覆盖所有使用点 ✅

### 手动 spot-check
- PathAnalysis 分析类型布局：选项不再拥挤，3+2 排列更均衡 — **Pending user manual verification**
- 未选中复选框在暗色背景下可见 — **Pending user manual verification**
- 选中复选框仍保持原有外观 — **Pending user manual verification**
- Console 无新错误 — **Pending user manual verification**

## 已知问题 / TODO
- 无

## 是否可以进入下一阶段
**是。** 本 hotfix 已完成，可进入 Phase 4A-6-6 Button Hierarchy + Bundle Size Triage。

---

## Git 信息

### Commit 前 git status
```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  modified:   src/components/ui/checkbox.tsx
  modified:   src/pages/PathAnalysis.tsx
```

### Commit hash
待补充

### Commit message
```
fix: improve path analysis control layout and checkbox visibility

- PathAnalysis: change analysis-type ToggleGroup to 2-col mobile / 3-col desktop grid with larger gap
- checkbox.tsx: replace border-input with border-slate-400/40 for unchecked visibility on dark backgrounds

Zero business logic change.
```

### Push 结果
待补充

### Package 文件检查
- `package.json` — 未修改 ✅
- `package-lock.json` — 未修改 ✅
