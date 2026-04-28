# Phase 4A-4-5: PathAnalysis Page Migration

## Phase Goal

将高风险的 `PathAnalysis.tsx` 页面迁移到分析模板组件体系，保留 5 种分析类型切换、ECharts 图表生命周期、`AssociationRuleGraph` 子组件及复杂的条件结果渲染。

## Modified Files

- `app/src/pages/PathAnalysis.tsx`

## Added Files

- `docs/phase-logs/PHASE_4A_4_5_PATHANALYSIS_REFACTOR.md`

## Specific UI/Layout Changes

### 1. Root Layout

- 手写 `<div className="space-y-6">` + 标题栏 替换为 `AnalysisPageShell`。
- `title="路径分析"`，`description="分析用户行为路径，优化转化漏斗，发现关键路径模式"`。

### 2. Layout Switch

- 从 `grid grid-cols-1 lg:grid-cols-4 gap-6` 切换为 `flex flex-col lg:flex-row gap-6`。
- 左侧 `AnalysisConfigPanel`（基于 `SidePanel`，固定宽度）+ 右侧 `flex-1 space-y-6 min-w-0`。

### 3. Left Config Panel

- `Card className="glass... lg:col-span-1"` + 可折叠 `CardHeader` 替换为 `AnalysisConfigPanel`。
- 数据集选择、分析类型选择（漏斗/路径/聚类/关键路径/序列模式）、列选择、数据验证、使用指南等配置内容全部保留为 children。
- 分析按钮（"开始分析"）和"重新配置"按钮移至 `AnalysisConfigPanel` 的 `footer`。
- 移除 `showConfig` 状态及 `ChevronUp`/`ChevronDown` 导入。

### 4. Right Result Area

- 右侧结果区保留自定义结构，未强制套用 `AnalysisResultPanel`，避免对 5 种分析类型的复杂条件渲染产生不可预期的布局影响。
- 保留模式特定的结果卡片：漏斗分析（概览卡片 + 漏斗图 + 步骤详情表）、路径分析（桑基图 + 路径列表）、路径聚类（聚类卡片 + 中心路径）、关键路径（关键路径卡片）、序列模式（关联规则网络图 + 频繁序列表）。
- 空状态和加载状态保留为 `Card`（移除 `glass`）。

### 5. Remove glass Class

- 从所有 `Card` 组件中移除 `glass` 毛玻璃类（31 处替换）。

### 6. Import Adjustments

- 新增：`AnalysisPageShell`、`AnalysisConfigPanel` from `@/components/analysis`。
- 移除：`ChevronUp`、`ChevronDown` from `lucide-react`。

## What Was Intentionally Not Changed

- **5 种分析类型切换逻辑**：`pathType`（funnel/path/clustering/key_path/sequence_mining）及对应的 `setPathType` 逻辑零改动。
- **ECharts 图表生命周期**：`echarts.init`、`setOption`、`dispose` 通过 `funnelChartRef`、`sankeyChartRef`、`graphChartRef` 管理，零改动。
- **`AssociationRuleGraph` 子组件**：内部 ECharts 图表初始化、节点/边构建、力导向布局配置零改动。
- **结果渲染逻辑**：每种 `pathType` 对应的结果卡片结构、表格、统计摘要零改动。
- **导出/下载逻辑**：`handleDownloadCSV`、`handleDownloadChart` 零改动。
- **API 调用**：`handleAnalyze` 及后端分析任务创建零改动。
- **原生 `<select>` 控件**：全部保留，未替换为 shadcn Select。
- **无 `SelectItem value=""`**。

## Validation Results

```bash
cd app && npx tsc --noEmit
# 0 errors ✅

cd app && npm run build
# built in 22.94s ✅

grep -R 'SelectItem value=""' app/src --include="*.tsx"
# no output ✅

grep -R "SelectItem value=''" app/src --include="*.tsx"
# no output ✅
```

## Manual Verification Checklist

- [ ] 页面正常打开
- [ ] 页面标题和描述正确渲染
- [ ] 数据集选择正常工作
- [ ] 分析类型切换（漏斗/路径/聚类/关键路径/序列模式）正常工作
- [ ] 路径/漏斗/事件配置控件正常工作
- [ ] 开始分析触发相同的 API 流程
- [ ] 加载/结果状态正常工作
- [ ] 现有图表/图形/表格正常渲染
- [ ] AssociationRuleGraph 子组件正常渲染
- [ ] 导出/下载正常工作
- [ ] Console 无新错误
- [ ] 无重复主操作按钮

## Known Issues / TODO

- 结果区存在大量手写 `<table>`（步骤详情表、关联规则表等），待 Phase 4A-4 或 4A-5 统一替换为 `DataTablePreview`。
- 分析类型选择器使用原生 `<button>` 而非 shadcn `ToggleGroup`，待 Phase 4A-5 统一替换。
- `AssociationRuleGraph` 使用硬编码颜色值（`#00f5ff`、`#b829f7`、`#3b82f6` 等），待 Phase 4A-6 统一使用 CSS variable 动态获取。

## Project Can Proceed

PathAnalysis 迁移已完成，项目可继续推进至 SmartAnalysis / AIWorkspace / DataWorkshop 规划阶段。

## Git Information

### git status summary before commit

```
M  app/src/pages/PathAnalysis.tsx
A  docs/phase-logs/PHASE_4A_4_5_PATHANALYSIS_REFACTOR.md
M  docs/CURRENT_PROGRESS.md
M  docs/CHANGELOG.md
```

### Commit hash

`TBD`

### Push result

`TBD`

### Package files clean

`app/package.json` 和 `app/package-lock.json` 未修改，保持未暂存状态。
