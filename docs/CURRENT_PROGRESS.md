# InsightEase 当前进度

**更新日期**: 2026-04-28

---

## 当前阶段状态

**Phase 3 代码重构、legacy 清理、类型检查与生产构建已完成。**

- `npx tsc --noEmit` — 0 errors ✅
- `npm run build` — 生产构建成功 ✅（built in 19.47s）
- 后端 Transform API 集成测试 — 6/6 通过 ✅

---

## 已完成的 Phase

| Phase | 名称 | 状态 |
|---|---|---|
| 1-2 | 修复错误模式概念，Upload/Datasets 回归后端主线 | ✅ 完成 |
| 2.5 | 验证和封口 | ✅ 完成 |
| 3A | Legacy 隔离 | ✅ 完成 |
| 3B | DataWorkshop 后端化设计 | ✅ 完成 |
| 3C | 后端 Transform API | ✅ 完成 |
| 3D | DataWorkshop 前端接入 preview/save | ✅ 完成 |
| 3E | Legacy 删除 | ✅ 完成 |
| 3F | Build gate cleanup | ✅ 完成 |
| 3G | 文档收口 | 🟡 部分完成 |

---

## 当前稳定主链路

```
Upload CSV/Excel
  -> 后端解析 -> MySQL + 磁盘存储
  -> Datasets 列表
  -> DataWorkshop（filter/rename/dedup/derive/sample 后端执行）
     -> preview（不保存）
     -> transform（保存为新数据集）
  -> AIWorkspace / SmartAnalysis（意图识别 + 分析执行 + 可视化）
```

---

## Phase 3G 浏览器 E2E 待人工验证

以下 checklist 需在可连接后端的环境中逐项人工验证：

- [ ] 注册 / 登录
- [ ] 上传 CSV
- [ ] Datasets 列表可见
- [ ] Datasets 预览正常
- [ ] DataWorkshop 执行 filter + rename preview
- [ ] DataWorkshop 保存为新数据集
- [ ] 新数据集出现在 Datasets
- [ ] 新数据集可进入 AIWorkspace / SmartAnalysis
- [ ] 页面无 console error

---

## 当前已知阻塞项

### Blocking before public demo

| 阻塞项 | 说明 | 计划解决 |
|---|---|---|
| 完整浏览器 E2E 回归测试 | Phase 3G 尚未完成人工验证 | Phase 3G 补测 |
| analysis.py 后台任务未走 `storage.read()` | OSS 环境下读取文件失败 | Phase 4A |
| 数据库 migration / Alembic 记录 | 当前靠手动 SQL | Phase 4A |

---

## Phase 4A-3-1 Hotfix

- **问题**: Settings 页面 shadcn `SelectItem` 传入空字符串 `value=""`，触发 Radix UI 运行时断言错误，页面崩溃。
- **修复**: `autoDeleteOptions` 中 `value: ''` 改为 `value: 'never'`，`onValueChange` 映射回 `null`。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功，dev 服务器正常启动。

## Phase 4A-3-2: Upload 页面骨架替换

- **目标**: 将 Upload 页面迁移到共享组件体系（PageShell, PageHeader, SectionCard, ScoreRing）。
- **修改**:
  - `Upload.tsx` 使用 `PageShell` + `PageHeader` + `SectionCard` 替换原有手写布局。
  - 提取内联 SVG 评分环为 `ScoreRing.tsx`（`app/src/components/data-display/ScoreRing.tsx`）。
  - 简化拖拽区域动画：移除持续旋转的渐变背景，改用边框高亮反馈。
  - 新增"清除已完成"按钮（仅清除 completed/error 状态的上传项）。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 12.28s，无空 `SelectItem value=""`。

## Phase 4A-3-3: History 页面骨架替换

- **目标**: 将 History 页面迁移到共享组件体系（PageShell, PageHeader, ContentGrid, StatCard, SectionCard, LoadingState, ErrorState）。
- **修改**:
  - `History.tsx` 使用共享布局/反馈/数据展示组件替换原有手写布局。
  - 标题从英文 `"History"` 改为中文 `"历史记录"`。
  - 统计卡片使用 `ContentGrid(cols=4)` + `StatCard`，新增 `valueClassName` 支持彩色数值。
  - 空状态使用 shadcn `<Empty>` 组件替代手写 div。
  - 下载菜单使用 `<DropdownMenu>` 替代 `group-hover` CSS 方案，提升移动端可用性。
  - 详情弹窗使用 `<Dialog>` + `<DialogContent>` 替代 `fixed inset-0` 手写模态框。
- **类型修复**:
  - 移除未使用的 `AlertCircle` 导入。
  - 将 `Dialog` 条件渲染改为 `{selectedAnalysis && (<Dialog open={true}>...)}`，消除 `possibly null` 错误。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 13.06s，无空 `SelectItem value=""`。

## Phase 4A-3-4: Datasets 页面骨架与交互一致性重构

- **目标**: 将 Datasets 页面迁移到共享组件体系，提升交互一致性。
- **修改**:
  - `Datasets.tsx` 使用 `PageShell` + `PageHeader` + `ContentGrid` + `StatCard` + `SectionCard` + `LoadingState` + `ErrorState` + `Empty` + `DataTablePreview` + `AlertDialog` 重构。
  - 标题从英文 `"Datasets"` 改为中文 `"数据集"`。
  - 统计卡片使用 `ContentGrid(cols=4)` + `StatCard` 替代手写 Card。
  - 空状态使用 shadcn `<Empty>` 组件替代表格内手写 td。
  - 预览表格使用 `DataTablePreview` 替代手写 `<table>`（展开行 + 详情弹窗）。
  - 详情弹窗缩小为 `max-w-4xl max-h-[80vh]`（原 `90vw/90vh`）。
  - 底部上传区域简化为"去上传数据"快捷按钮。
  - 表格密度优化：`py-4 px-4` → `py-3 px-3`。
- **交互改进**:
  - 原生 `confirm()` 替换为 `<AlertDialog>`（单条删除 + 批量删除）。
  - 原生 `alert()` 替换为 `toast.error()` / `toast.success()`（重命名验证、下载失败、删除反馈）。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 14.96s，无空 `SelectItem value=""`。

## Phase 4A-3-5: Dashboard 页面骨架与看板容器重构

- **目标**: 将 Dashboard 页面迁移到共享组件体系，仅改动布局/UI，不改变图表业务逻辑。
- **修改**:
  - `Dashboard.tsx` 使用 `PageShell` + `PageHeader` + `StatCard` + `ChartCard` + `SectionCard` + `LoadingState` + `ErrorState` + `Empty` + `Dialog` 重构。
  - 标题从英文 `"Dashboard"` 改为中文 `"看板"`。
  - 概览统计卡片使用共享 `StatCard` 替代本地定义组件。
  - 概览图表使用共享 `ChartCard` 替代手写 Card 包装。
  - 底部快捷操作和最近活动使用 `SectionCard` 替代手写 Card。
  - 自定义看板空状态使用 shadcn `<Empty>` 组件。
  - WidgetSelector 弹窗使用 `<Dialog>` + `<DialogContent>` 替代手写 `fixed inset-0` 模态框。
  - 移除本地 `StatCard` 组件定义。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 13.14s，无空 `SelectItem value=""`。

## Phase 4A-3-6: Visualization 页面骨架与图表容器重构

- **目标**: 将 Visualization 页面迁移到共享组件体系，统一配置面板和图表容器体验。
- **修改**:
  - `Visualization.tsx` 使用 `PageShell` + `PageHeader` + `SidePanel` + `ResultPanel` + `ChartCard` + `SectionCard` + `LoadingState` + `Empty` 重构。
  - 根布局从手写 `space-y-6` div 替换为 `PageShell`。
  - 标题区使用 `PageHeader`，标题为中文 `"可视化分析"`。
  - 左侧配置面板使用 `SidePanel`（移动端 `w-full`，桌面端固定 `384px`）。
  - 右侧图表区域使用 `ResultPanel` + `ChartCard`。
  - 空状态使用 shadcn `<Empty>` 组件替代手写 div（未选数据集、字段未配置）。
  - 数据加载状态使用 `<LoadingState>` 替代手写 spinner。
  - 底部智能推荐和字段概览使用 `SectionCard` 替代 `Card className="glass"`。
  - 按钮层级调整：`保存到看板` 改为 `variant="default"`（主操作），`下载图表` 保持 `variant="outline"`（次操作）。
  - 图表类型选择网格增加响应式：`grid-cols-3` → `grid-cols-2 sm:grid-cols-3`。
  - 移除未使用的 `Palette` 导入和 `Card` 组件导入。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 13.30s，无空 `SelectItem value=""`。

### Hotfix: 聚类分析 toggle 旋钮溢出

- **问题**: 聚类分析 toggle 的白色旋钮在 enabled 状态下向右溢出 track 边界。
- **修复**: 为旋钮显式添加 `left-0.5`，disabled 状态改为 `translate-x-0`，enabled 状态保持 `translate-x-5`。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` built in 14.38s。

## Phase 4A-3-7: Analysis Pages Template Audit

- **目标**: 审计所有分析功能页面，识别共同布局模式，设计统一页面模板。
- **范围**: 审计 9 个分析页面（Semantic, Clustering, Statistics, Attribution, SmartProcess, GoalPlanner, Forecast, PathAnalysis, SmartAnalysis）。
- **产出**:
  - `docs/ANALYSIS_PAGES_TEMPLATE.md` — 统一模板设计文档
  - `docs/phase-logs/PHASE_4A_3_7_ANALYSIS_PAGES_TEMPLATE_AUDIT.md` — 阶段日志
- **关键发现**: 所有页面共享同一 2-col 骨架（配置面板 + 结果面板），仅 SmartAnalysis 为向导模式。
- **风险排序**: Low (Semantic, Clustering) → Medium (Statistics, Attribution, SmartProcess, GoalPlanner) → High (Forecast, PathAnalysis, SmartAnalysis)。
- **设计组件**: 7 个分析专用共享组件（AnalysisPageShell, AnalysisConfigPanel, AnalysisResultPanel, AnalysisActionBar, AnalysisEmptyState, AnalysisResultSummary, AnalysisPollingOverlay）。
- **验证**: 本阶段为纯设计，未修改代码。

## Phase 4A-4-0: Analysis Template Components

- **目标**: 构建 7 个分析页面模板共享组件，为后续页面迁移提供基础设施。
- **新增文件**:
  - `app/src/components/analysis/AnalysisPageShell.tsx`
  - `app/src/components/analysis/AnalysisConfigPanel.tsx`
  - `app/src/components/analysis/AnalysisResultPanel.tsx`
  - `app/src/components/analysis/AnalysisActionBar.tsx`
  - `app/src/components/analysis/AnalysisEmptyState.tsx`
  - `app/src/components/analysis/AnalysisResultSummary.tsx`
  - `app/src/components/analysis/AnalysisPollingOverlay.tsx`
  - `app/src/components/analysis/index.ts`
- **组件设计**:
  - `AnalysisPageShell`: 封装 `PageShell` + `PageHeader`，提供分析页面标准标题区。
  - `AnalysisConfigPanel`: 基于 `SidePanel`，左侧配置面板，支持标题、图标、footer。
  - `AnalysisResultPanel`: 基于 `ResultPanel`，通用结果面板，支持 loading/empty/polling/children 多种状态。
  - `AnalysisActionBar`: 导出按钮组（CSV/JSON/Excel/Download），纯回调，无业务逻辑。
  - `AnalysisEmptyState`: 基于 shadcn `<Empty>`，提供 `no-dataset` / `no-result` / `no-config` / `custom` 四种预设。
  - `AnalysisResultSummary`: 基于 `ContentGrid` + `StatCard`，数值摘要卡片网格。
  - `AnalysisPollingOverlay`: 轮询状态指示器，支持 pending/running/completed/failed + 可选进度条。
- **约束遵守**:
  - 零页面文件修改。
  - 零后端代码修改。
  - 零 API 客户端修改。
  - 零新 npm 依赖。
  - 所有组件导出 props interface，使用 `cn()`。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 19.87s ✅
  - SelectItem empty value grep — no output ✅

## Phase 4A-4-1: Semantic + Clustering Pages Migration

- **目标**: 将两个低风险分析页面迁移到分析模板组件体系，验证模板组件在真实页面中的可用性。
- **修改文件**:
  - `app/src/pages/Semantic.tsx`
  - `app/src/pages/Clustering.tsx`
- **Semantic 变更**:
  - 根布局从手写 `<div className="space-y-6">` + 标题栏替换为 `AnalysisPageShell`。
  - 左侧配置 Card 替换为 `AnalysisConfigPanel`，分析按钮移至 footer。
  - 右侧结果 Card 替换为 `AnalysisResultPanel`，支持 loading/empty/result 状态切换。
  - 导出按钮替换为 `AnalysisActionBar`（`onExportJSON`）。
  - 移除未使用的 `Settings2`、`ChevronDown`、`ChevronUp`、`Card` / `CardHeader` / `CardTitle` / `CardContent`、`Download` 导入。
- **Clustering 变更**:
  - 根布局从手写 `<div className="space-y-6">` + 标题栏替换为 `AnalysisPageShell`。
  - 左侧配置 Card 替换为 `AnalysisConfigPanel`，分析按钮移至 footer。
  - 右侧结果 Card 替换为 `AnalysisResultPanel`，支持 loading/empty/result 状态切换。
  - 导出按钮替换为 `AnalysisActionBar`（`onDownload` 占位）。
  - 移除未使用的 `Settings2`、`ChevronDown`、`ChevronUp`、`Card` / `CardHeader` / `CardTitle` / `CardContent`、`Rotate3D` 导入。
- **约束遵守**:
  - 所有业务逻辑（数据集选择、列选择、K 值、API 调用、轮询、gsap 动画）零改动。
  - 零原生 `<select>` 替换（留在 Phase 4A-5）。
  - 无 `SelectItem value=""`。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 19.65s ✅
  - SelectItem empty value grep — no output ✅

## Phase 4A-4-2: Statistics + Attribution Pages Migration

- **目标**: 将两个中风险分析页面迁移到分析模板组件体系，验证模板在含图表、表格、导出功能页面中的可用性。
- **修改文件**:
  - `app/src/pages/Statistics.tsx`
  - `app/src/pages/Attribution.tsx`
- **Statistics 变更**:
  - 根布局替换为 `AnalysisPageShell`。
  - 左侧配置 Card 替换为 `AnalysisConfigPanel`，分析按钮移至 footer。
  - 右侧结果 Card 替换为 `AnalysisResultPanel`，支持 loading/empty/result 状态切换。
  - 导出按钮替换为 `AnalysisActionBar`（`onExportCSV`）。
  - 移除未使用的 `Settings2`、`ChevronDown`、`ChevronUp` 导入。
  - 保留 `renderStatsResult` 内部统计卡片结构（结果内容不变）。
- **Attribution 变更**:
  - 根布局替换为 `AnalysisPageShell`。
  - 左侧配置 Card 替换为 `AnalysisConfigPanel`，分析按钮移至 footer。
  - 右侧结果 Card 替换为 `AnalysisResultPanel`，支持 loading/empty/result 状态切换。
  - 导出按钮替换为 `AnalysisActionBar`（`onExportCSV`）。
  - 保留 ECharts 图表生命周期（`chartRef`、`chartInstance`、`renderComparisonChart`）零改动。
  - 保留汇总统计卡片、模型结果卡片、对比表格等结果内容零改动。
  - 移除未使用的 `Settings2`、`ChevronDown`、`ChevronUp`、`PieChart`、`Download` 导入。
  - 移除未使用的 `isConfigOpen` 状态。
- **约束遵守**:
  - 所有业务逻辑（数据集选择、列选择、归因模型配置、API 调用、轮询、gsap 动画、ECharts 渲染、CSV 导出）零改动。
  - 零原生 `<select>` 替换（留在 Phase 4A-5）。
  - 无 `SelectItem value=""`。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 20.33s ✅
  - SelectItem empty value grep — no output ✅

## Phase 4A-4-3: SmartProcess + GoalPlanner Pages Migration

- **目标**: 将两个中风险分析页面迁移到共享布局组件体系，验证模板在文件下载结果和自定义布局场景中的可用性。
- **修改文件**:
  - `app/src/pages/SmartProcess.tsx`
  - `app/src/pages/GoalPlanner.tsx`
- **SmartProcess 变更**:
  - 根布局替换为 `AnalysisPageShell`。
  - 左侧配置 Card 替换为 `AnalysisConfigPanel`，处理按钮移至 footer。
  - 右侧结果 Card 替换为 `AnalysisResultPanel`，支持 loading/empty/result 状态切换。
  - 下载按钮替换为 `AnalysisActionBar`（`onDownload`）。
  - 移除未使用的 `Settings2`、`ChevronDown`、`ChevronUp`、`Sparkles`、`BarChart3`、`Download` 导入。
- **GoalPlanner 变更**:
  - 根布局替换为 `AnalysisPageShell`（不强制使用 `AnalysisConfigPanel` + `AnalysisResultPanel`，保持自定义布局）。
  - 移除标题栏 div（由 `AnalysisPageShell` 接管）。
  - 移除配置面板的 `glass` 毛玻璃效果和可折叠头部。
  - 所有结果区域 Card 的 `glass` 类替换为标准 `bg-[var(--bg-secondary)]`。
  - 移除未使用的 `isConfigOpen` 状态及 `ChevronDown`、`ChevronUp` 导入。
- **约束遵守**:
  - 所有业务逻辑（数据集选择、预处理配置、漏斗模板、目标拆解、localStorage、预测对比、gsap 动画）零改动。
  - 零原生 `<select>` 替换（留在 Phase 4A-5）。
  - 无 `SelectItem value=""`。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 24.88s ✅
  - SelectItem empty value grep — no output ✅

## Phase 4A-4-4: Forecast Page Migration

- **目标**: 将高风险 Forecast 页面迁移到共享布局组件体系，保留复杂业务逻辑和自定义结果结构。
- **修改文件**:
  - `app/src/pages/Forecast.tsx`
- **Forecast 变更**:
  - 根布局替换为 `AnalysisPageShell`。
  - 左侧配置 Card 替换为 `AnalysisConfigPanel`，分析按钮移至 footer。
  - 右侧结果区保留自定义 `Card` 结构（预测结果 / 批量预测结果 / 预测分解 / 大促影响 / What-if / AI 解读），不强制套用 `AnalysisResultPanel` 以避免双层标题冗余。
  - 移除所有 `glass` 毛玻璃类。
  - 移除可折叠配置面板行为（`isConfigOpen` 状态、`ChevronUp`/`ChevronDown`）。
  - 布局从 `grid grid-cols-3` 切换为 `flex flex-col lg:flex-row gap-6`。
- **约束遵守**:
  - 所有业务逻辑（数据集加载、模型选择、批量预测、大促日历、What-if 分析、营销日历导入、localStorage 写入、CSV 导出、gsap 动画）零改动。
  - 零原生 `<select>` 替换（留在 Phase 4A-5）。
  - 无 `SelectItem value=""`。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 20.37s ✅
  - SelectItem empty value grep — no output ✅

## Hotfix: Duplicate Forecast Start Button

- **问题**: Phase 4A-4-4 迁移后，配置面板底部出现两个相同的 "启动预测" 按钮。
- **根因**: 将按钮移至 `AnalysisConfigPanel` `footer` 时，未同步删除原 `CardContent` 内的内联按钮。
- **修复**: 删除原内联按钮块（~36 行），仅保留 footer 按钮。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 20.05s ✅
  - `grep handleAnalyze()` — 仅剩 1 处 ✅
  - SelectItem empty value grep — no output ✅

## Phase 4A-4-5: PathAnalysis Page Migration

- **目标**: 将高风险的 PathAnalysis 页面迁移到共享布局组件体系，保留 5 种分析类型切换、ECharts 图表生命周期、`AssociationRuleGraph` 子组件及复杂的条件结果渲染。
- **修改文件**:
  - `app/src/pages/PathAnalysis.tsx`
- **PathAnalysis 变更**:
  - 根布局替换为 `AnalysisPageShell`。
  - 左侧配置 Card 替换为 `AnalysisConfigPanel`，分析按钮和"重新配置"按钮移至 footer。
  - 右侧结果区保留自定义 `Card` 结构（漏斗分析、路径分析、路径聚类、关键路径、序列模式），不强制套用 `AnalysisResultPanel` 以避免双层标题冗余。
  - 移除所有 `glass` 毛玻璃类（31 处）。
  - 移除可折叠配置面板行为（`showConfig` 状态、`ChevronUp`/`ChevronDown`）。
  - 布局从 `grid grid-cols-4` 切换为 `flex flex-col lg:flex-row gap-6`。
- **约束遵守**:
  - 所有业务逻辑（5 种分析类型切换、数据集加载、列选择、ECharts 图表渲染、`AssociationRuleGraph` 子组件、CSV/图表导出、API 调用）零改动。
  - 零原生 `<select>` 替换（留在 Phase 4A-5）。
  - 无 `SelectItem value=""`。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 22.94s ✅
  - SelectItem empty value grep — no output ✅

## Phase 4A-4-6: Analysis Migration Closure & Complex Pages Plan

- **目标**: 总结 Phase 4A-4 分析页面迁移成果，规划剩余复杂页面（SmartAnalysis、AIWorkspace、DataWorkshop）。
- **范围**: 纯文档阶段，零代码修改。
- **产出**:
  - `docs/PHASE_4A_ANALYSIS_MIGRATION_CLOSURE.md` — 迁移总结、已验证组件清单、技术债分类、复杂页面分阶段计划
  - `docs/phase-logs/PHASE_4A_4_6_ANALYSIS_MIGRATION_CLOSURE.md` — 阶段日志
- **关键结论**:
  - 8 个分析页面已完成迁移（Semantic、Clustering、Statistics、Attribution、SmartProcess、GoalPlanner、Forecast、PathAnalysis）
  - 3 个复杂页面不应盲目套用标准 2-col 模板：SmartAnalysis（向导模式）、AIWorkspace（模态覆盖层）、DataWorkshop（操作链构建器）
  - `AnalysisResultSummary` 和 `AnalysisPollingOverlay` 已实现但尚未被任何页面使用
  - 建议下一Phase：4A-5 交互一致性治理（原生 select → shadcn Select 等）
- **验证**:
  - 未修改任何源码文件 ✅
  - 未修改 package.json / package-lock.json ✅

## 下一步建议

### 立即执行

1. **补做 Phase 3G 浏览器端到端回归测试** — 在可连接 RDS 的环境中跑通全部 checklist

### 随后进入 Phase 4A: Engineering Stabilization

1. **Bundle splitting** — `manualChunks` 拆分 vendor / echarts / radix
2. **API 类型统一** — 修复拦截器解包导致的类型混乱
3. **Alembic 引入** — 数据库版本化管理
4. **storage.read() 统一** — 修复 OSS 兼容性问题

---

## Build 验证结果

```bash
cd app && npx tsc --noEmit    # 0 errors ✅
cd app && npm run build        # built in 22.94s ✅
```

> 警告: JS chunk 3,385 KB，待 Phase 4A-6 拆分优化。
