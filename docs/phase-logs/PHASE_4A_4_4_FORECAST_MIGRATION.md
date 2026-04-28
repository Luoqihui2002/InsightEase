# Phase 4A-4-4: Forecast Page Migration

## 目标

将高风险的 `Forecast.tsx` 页面迁移到分析模板组件体系，保留复杂的业务逻辑和自定义结果结构。

## 变更文件

- `app/src/pages/Forecast.tsx`

## 详细变更

### 1. 根布局替换

- 手写 `<div className="space-y-6">` + 标题栏 替换为 `AnalysisPageShell`。
- `title="趋势预测"`，`description="基于 Prophet 模型的时间序列预测"`。

### 2. 左侧配置面板替换

- `Card className="glass ... lg:col-span-1"` + 可折叠 `CardHeader` 替换为 `AnalysisConfigPanel`。
- 配置内容（数据集选择、数据验证、使用说明、日期列选择、批量模式、数值列选择、预测周期、模型选择、大促日历、辅助变量、What-if 分析）全部保留为 children。
- 分析按钮（"启动预测" / "批量预测"）移至 `AnalysisConfigPanel` 的 `footer`。
- 移除 `isConfigOpen` 状态及 `ChevronUp`/`ChevronDown` 导入。

### 3. 右侧结果区保留自定义结构

- 右侧结果区包含多种复杂的条件渲染卡片（预测结果、批量预测结果、预测分解、大促影响分析、What-if 分析结果、AI 智能解读）。
- 每个卡片有自己的 `CardHeader`/`CardTitle`，若强制套用 `AnalysisResultPanel` 会产生双层标题冗余。
- 因此右侧结果区保留自定义 `Card` 结构，仅移除 `glass` 类。
- 空状态保留为 `Card`（移除 `glass`）。

### 4. 布局切换

- 从 `grid grid-cols-1 lg:grid-cols-3 gap-6` 切换为 `flex flex-col lg:flex-row gap-6`，与模板组件体系保持一致。
- 左侧 `AnalysisConfigPanel`（基于 `SidePanel`，固定宽度）+ 右侧 `flex-1 space-y-6 min-w-0`。

### 5. 移除 glass 类

- 从所有 `Card` 组件中移除 `glass` 毛玻璃类（7 处替换）。

### 6. 导入调整

- 新增：`AnalysisPageShell`、`AnalysisConfigPanel` from `@/components/analysis`。
- 移除：`ChevronUp`、`ChevronDown` from `lucide-react`（不再使用）。

## 约束遵守

- 所有业务逻辑（数据集加载、Prophet/LightGBM/SARIMA 模型选择、批量预测、大促日历、What-if 分析、营销日历导入、localStorage 写入、CSV 导出、gsap 动画）零改动。
- 零原生 `<select>` 替换（留在 Phase 4A-5）。
- 无 `SelectItem value=""`。

## 验证

```bash
cd app && npx tsc --noEmit    # 0 errors ✅
cd app && npm run build        # built in 20.37s ✅
```

## Hotfix: Duplicate Forecast Start Button

- **Issue**: 迁移后配置面板底部出现两个相同的 "启动预测" 按钮。
- **Root cause**: 迁移时将分析按钮移至 `AnalysisConfigPanel` 的 `footer` 时，未同步移除原 `CardContent` 内的内联按钮块。
- **Fix**: 删除原内联按钮块（约 36 行），仅保留 `footer` 中的按钮。`isAnalyzing` 提示文本已包含在 `footer` 中，无需额外处理。
- **Validation**:
  - `tsc --noEmit` 0 errors ✅
  - `npm run build` built in 20.05s ✅
  - `grep "handleAnalyze()"` 仅剩 1 处（footer 内）✅
  - SelectItem empty value grep — no output ✅
- **影响**: 纯 UI 迁移残留，零业务逻辑影响。

## 风险说明

- Forecast 是分析页面中复杂度最高的页面（~1470 行），包含批量/单预测双模式、What-if 分析、大促日历、自定义导入对话框、localStorage 集成等特性。
- 本次迁移采用保守策略：右侧结果区未套用 `AnalysisResultPanel`，避免对复杂条件渲染结构产生不可预期的布局影响。
