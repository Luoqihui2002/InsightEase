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

## Phase 4A-5-3: Dynamic Column Selects with Sentinel Mapping

- **目标**: 将 6 个页面中的 16 个动态原生 `<select>` 替换为 shadcn `Select`，使用哨兵值映射保留空字符串语义。
- **修改文件**:
  - `Attribution.tsx`：5 个列选择器（`none` → `""`）
  - `Statistics.tsx`：1 个分析列选择器（`"all"` 直接透传，无哨兵）
  - `Forecast.tsx`：2 个列选择器（`auto` → `""`）
  - `PathAnalysis.tsx`：3 个列选择器（`auto` → `""`）
  - `Visualization.tsx`：4 个字段选择器（`none` → `""` / `undefined`）
  - `GoalPlanner.tsx`：1 个目标层级选择器（`none` → `""`）
- **Optgroup 迁移**: 4 个页面的原生 `<optgroup>` 替换为 `SelectGroup` + `SelectLabel`。
- **约束遵守**: 零业务逻辑变更，零 API 调用变更，零 ECharts 选项变更。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 29.80s ✅
  - SelectItem empty value grep — no output ✅
  - 6 个页面无剩余原生 `<select` ✅

## Phase 4A-5-4: ToggleGroup / Checkbox / Button Cleanup

- **目标**: 将 Forecast、PathAnalysis、GoalPlanner 中的手写 toggle / checkbox / button-like 选择器替换为 shadcn 组件。
- **修改文件**:
  - `Forecast.tsx`: 模型选择器 → `ToggleGroup`；批量/大促/辅助变量复选框 → `Checkbox`
  - `PathAnalysis.tsx`: 5 种分析类型选择器 → `ToggleGroup`；4 组复选框 → `Checkbox`
  - `GoalPlanner.tsx`: 拆解方式选择器 → `ToggleGroup`
- **保留的控件**:
  - GoalPlanner 模板按钮：action 按钮而非持久选择状态
  - GoalPlanner 月份标签：filter chips，替换风险大于收益
- **约束遵守**: 零业务逻辑变更，零 API 调用变更，零 ECharts 选项变更。
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 21.32s ✅
  - 3 个页面无剩余原生 `type="checkbox"` ✅
  - SelectItem empty value grep — no output ✅

## Phase 4A-5-5: Table & Dialog Cleanup

- **目标**: 清理低风险的原生表格和简单弹窗模式。
- **修改文件**:
  - `History.tsx`: `renderResultPreview` 详情预览表 → `DataTablePreview`（保留对象→JSON和截断逻辑）
- **保留的原生表格**:
  - `History.tsx` 主分析列表：富单元格内容（图标、按钮、条件颜色）
  - `Attribution.tsx` 模型对比表：有意义的视觉颜色编码（百分比高亮）
- **弹窗状态**:
  - `History.tsx` 详情弹窗已使用 shadcn `Dialog`，无需改动
  - `Attribution.tsx` 无弹窗
  - 全库无手写 `fixed inset-0` 模态框
- **验证**:
  - `npx tsc --noEmit` — 0 errors ✅
  - `npm run build` — built in 20.50s ✅
  - SelectItem empty value grep — no output ✅

## Phase 4A-5 交互清理正式收官

| 子阶段 | 状态 |
|---|---|
| 4A-5-1: 交互清理审计 | ✅ 完成 |
| 4A-5-2: 低风险静态选择器和开关 | ✅ 完成 |
| 4A-5-3: 动态列选择器哨兵映射 | ✅ 完成 |
| 4A-5-4: ToggleGroup / Checkbox / Button 清理 | ✅ 完成 |
| 4A-5-5: 表格和弹窗清理 | ✅ 完成 |

**明确排除项**（按审计建议推迟）:
- DataWorkshop → Phase 4C 组件提取
- SmartAnalysis / AIWorkspace → Phase 4B
- PathAnalysis / GoalPlanner / Forecast 结果表 → 复杂语义结构

## Phase 4A-5-6: Interaction Cleanup Closure

- **目标**: 正式收官 Phase 4A-5 交互一致性治理，产出 closure 文档，推荐下一Phase。
- **新文档**:
  - `docs/PHASE_4A_INTERACTION_CLEANUP_CLOSURE.md` — Phase 4A-5 正式收官文档
  - `docs/phase-logs/PHASE_4A_5_6_INTERACTION_CLEANUP_CLOSURE.md` — 本阶段日志
- **结论**:
  - Phase 4A-5 全部 5 个子阶段已完成
  - 29 个控件替换完成，零业务逻辑变更
  - 明确排除项已记录并分配至未来 Phase（4B/4C/ResultTable 设计）
  - 推荐下一Phase：4A-6 Visual System / Style Polish

## Phase 4A-6-1: Visual System / Style Audit

- **目标**: 审计前端视觉系统，产出 Phase 4A-6 具体实施计划。
- **新文档**:
  - `docs/VISUAL_SYSTEM_AUDIT.md` — 视觉系统审计（10 个章节，涵盖 shadcn 兼容性、卡片密度、按钮层级、glass、ECharts 颜色、空状态、包体积、ResultTable）
  - `docs/phase-logs/PHASE_4A_6_1_VISUAL_SYSTEM_AUDIT.md` — 本阶段日志
- **关键发现**:
  - shadcn 语义 token 与自定义暗色主题存在 101 处不匹配
  - 按钮层级倒置：主操作多用 `outline`/`ghost`，极少用 `default`
  - glass 类过度使用：30 处，普通数据卡片不应使用
  - ECharts 硬编码 137 处 hex，主题切换时图表颜色不跟随
  - JS chunk ~3.4MB，vite.config.ts 未配置 `manualChunks`
- **推荐实施顺序**: 4A-6-2 共享组件样式 → 4A-6-3 页面密度 → 4A-6-4 图表颜色 → 4A-6-5 空状态 → 4A-6-6 按钮+包体积 → 4A-6-7 ResultTable 设计文档
- **零源码变更**（纯审计阶段）

## Phase 4A-6-2: Shared Component Visual Refinement

- **目标**: 将共享反馈和布局组件的视觉 token 对齐到项目暗色主题。
- **修改**:
  - `index.css` 新增 9 个状态色 token（error=#ff0080, success=#00ff9d, warning=#ffaa00）。
  - `ErrorState.tsx`：Tailwind `red-500` 替换为 `--status-error/*` 系列 token。
  - `SuccessState.tsx`：Tailwind `emerald-500` 替换为 `--status-success/*` 系列 token。
  - `empty.tsx`：`text-muted-foreground` 替换为 `text-[var(--text-secondary)]`，标题对齐 `--text-primary`。
  - `SectionCard.tsx`：新增 `density` prop（compact/default/spacious），向后兼容。
  - `layout/index.ts`：补全 `SectionCard` 导出。
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.11s，无空 `SelectItem value=""`。

## Phase 4A-6-3: Page-Level Spacing and Density Pass

- **目标**: 移除普通数据卡片上的不当 `glass` 使用，标准化卡片背景。
- **修改**:
  - `Attribution.tsx`：移除 7 处 `glass`（汇总统计卡 ×4、对比图表、模型结果、对比表）→ `bg-[var(--bg-secondary)]`
  - `Statistics.tsx`：移除 1 处 `glass`（列统计结果卡）→ `bg-[var(--bg-secondary)]`
  - `SmartAnalysis.tsx`：移除 6 处 `glass`（配置面板、空状态、诊断、预处理、推荐、结果）→ `bg-[var(--bg-secondary)]`
  - `Profile.tsx`：移除 10 处 `glass`（标题区、头像、账户、统计 ×4、编辑表单、查看信息、安全设置）→ `bg-[var(--bg-secondary)]`
- **保留**:
  - `Dashboard.tsx`：widget 卡片保留 `glass`（故意抬高的视觉组件）
  - `GoalPlanner.tsx`：无 `glass`，已有 padding 模式合理（输入区 `p-2`、结果区 `p-3`/`p-4`）
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.30s，无空 `SelectItem value=""`，定向 glass grep 仅 Dashboard widget 保留。

## Phase 4A-6-4: Chart Color Token Foundation + Low-risk Migration

- **目标**: 创建可复用的图表颜色 token 基础工具，将低风险页面的硬编码 ECharts 颜色迁移到 CSS 变量体系。
- **新增**:
  - `app/src/hooks/useChartColors.ts`：`getChartColors()` 纯函数 + `useChartColors()` React Hook（含 MutationObserver 主题监听），所有 token 带安全 fallback。
- **修改**:
  - `Visualization.tsx`：移除 `CHART_COLORS` 常量，替换为 `getChartColors()`；`#94a3b8` → `textSecondary`，`#e2e8f0` → `textPrimary`，`#0a0e27` → `bgPrimary`。
  - `Dashboard.tsx`：移除 `COLORS` 常量，替换为 `getChartColors()`；所有颜色引用迁移到 token。
- **保留**: `#fff`（意图性白色）、`rgba(...)` 透明度衍生值（无对应 CSS 变量）。
- **推迟**: PathAnalysis / Attribution / Forecast 图表颜色迁移 → Phase 4A-6-5。
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.49s，无空 `SelectItem value=""`，Visualization/Dashboard 无旧硬编码 neon hex。

## Phase 4A-6-5: Complex Chart Color Migration

- **目标**: 将复杂图表页面（Attribution、PathAnalysis）的 ECharts / graph 硬编码颜色迁移到共享 chart color token 工具。
- **修改**:
  - `useChartColors.ts`：新增 `withAlpha()` 辅助函数（hex → rgba）。
  - `Attribution.tsx`：`renderComparisonChart` 中 tooltip、轴线、legend、文字颜色替换为 token；保留 `ATTRIBUTION_MODELS` 语义业务色。
  - `PathAnalysis.tsx`：漏斗图、桑基图、网络图、AssociationRuleGraph 全部颜色替换为 token；JSX legend 使用 CSS 变量。
- **未修改**:
  - `Forecast.tsx` — 无 ECharts 使用，已使用 CSS 变量，零变更。
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 24.62s，无空 `SelectItem value=""`，neon hex 仅 Attribution 模型语义色保留。

## Phase 4A-6-5.1: PathAnalysis Control Layout + Checkbox Visibility Hotfix

- **目标**: 修复 PathAnalysis 手动 QA 发现的两个 UI 问题。
- **修改**:
  - `PathAnalysis.tsx`：分析类型 ToggleGroup 布局从 `grid-cols-2 gap-2` 改为 `grid-cols-2 sm:grid-cols-3 gap-3`，桌面端 3+2 排列更均衡。
  - `checkbox.tsx`：未选中状态边框从 `border-input`（暗色下几乎不可见）改为 `border-slate-400/40`，提升暗色背景可见性；选中态/聚焦态不变。
- **修复策略**: 共享复选框修复（覆盖 Forecast + PathAnalysis 全部 7 处使用），而非局部覆盖。
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.94s，无空 `SelectItem value=""`。

## Phase 4A-6-5.2: PathAnalysis Analysis Type Grid Layout Hotfix

- **目标**: 修复分析类型选择器仍拥挤在左上角的问题。
- **根因**: ToggleGroup 缺 `w-full`，ToggleGroupItem 使用 `flex flex-col items-center` 导致收缩至内容宽度，`h-auto` 高度不一致。
- **修改**:
  - `ToggleGroup`: `grid w-full grid-cols-2 gap-2`（移除 `sm:grid-cols-3`）。
  - `ToggleGroupItem`: `w-full justify-start gap-2 px-3 h-14`（移除 `flex-col items-center h-auto`）。
- **未修改**: checkbox.tsx（4A-6-5.1 修复保持不变）。
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 26.93s，无空 `SelectItem value=""`。

## Phase 4A-6-6A: Button Hierarchy Cleanup

- **目标**: 统一迁移页面的按钮层级，将自定义 `<button>` 和错误 variant 替换为 shadcn 语义 variant。
- **修改**:
  - `Forecast.tsx`："启动预测" 主操作从自定义 `<button>` + inline style → `<Button variant="default">`
  - `PathAnalysis.tsx`："开始分析" 从 `className="bg-[var(--neon-cyan)]..."` → `variant="default"`
  - `SmartProcess.tsx`："开始处理" 和 "下载处理后数据" 显式声明 `variant="default"`
  - `GoalPlanner.tsx`："开始拆解" 从自定义 `<button>` + inline style → `<Button variant="default">`，补全 `Button` import
  - `Datasets.tsx`：批量删除从 `variant="ghost"` + neon-pink → `variant="destructive"`
  - `History.tsx`：删除记录从 `variant="ghost"` + neon-pink → `variant="destructive"`
  - `Dashboard.tsx`：删除看板从 `variant="ghost"` + neon-pink → `variant="destructive"`
  - `Dashboard.tsx` + `History.tsx`：11 个 icon-only 按钮从自定义 `<button>` → `<Button>` + `aria-label`
- **未改动（保持自定义 styled `<button>`）**:
  - Dashboard 导航快捷按钮（含可见文字）
  - Dashboard 弹窗 tab 切换按钮（含可见文字）
  - Visualization 图表类型选择网格（含可见文字）
  - PathAnalysis 聚类模式/桑基网络切换（含可见文字）
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.53s，无空 `SelectItem value=""`。

## 下一步建议

### 立即执行

1. **补做 Phase 3G 浏览器端到端回归测试** — 在可连接 RDS 的环境中跑通全部 checklist

## Phase 4A-6-6B: Bundle Size Triage

- **目标**: 通过 Vite `manualChunks` 拆分 vendor chunk，降低单个 JS chunk 体积。
- **策略**: 仅拆分不依赖 React 的大型 vendor 库（echarts、@radix-ui、xlsx、framer-motion/gsap），避免 circular chunk 警告。
- **结果**:
  - 最大单 chunk: 3,396.60 kB → 1,561.26 kB (**-54%**)
  - 主 app chunk: 3,396.60 kB → 1,061.24 kB (**-69%**)
  - JS chunk 数量: 1 → 5
  - 总 JS 体积: 3,396.60 kB → 3,381.10 kB (≈ -0.5%，符合预期——split 不减少总体积)
  - 无 circular chunk 警告
- **未改动**: 零页面代码修改、零 package 修改、未引入 dynamic import
- **已知限制**:
  - echarts chunk 仍为 1.56 MB（全量导入，未来可 tree-shake 优化）
  - 主 chunk 仍为 1.06 MB（未来可路由级 code-split）
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.12s，无 circular chunk 警告。

## 下一步建议

### 立即执行

1. **补做 Phase 3G 浏览器端到端回归测试** — 在可连接 RDS 的环境中跑通全部 checklist

## Phase 4A-6-7: ResultTable Design Document

- **目标**: 产出统一的分析结果渲染设计文档，定义前后端共享的 ResultTable 数据契约。
- **产出**:
  - `docs/design/RESULT_TABLE_DESIGN.md` — 完整设计文档
    - `AnalysisResult` 顶层接口（含状态、数据集元数据、诊断信息）
    - 6 种 ResultBlock 类型：summary、metric、table、chart、text、warning
    - Table Column Contract（含 semanticRole 语义角色系统）
    - 格式化规则（数值、百分比、p-value、置信区间、货币、日期）
    - 6 种结果状态定义（loading/empty/success/warning/error/unsupported）
    - 3 个示例 payload（描述统计、A/B 测试、回归分析）
    - 前端渲染策略（ResultView → block dispatcher → type-specific renderer）
    - 后端/API 兼容性说明（版本控制、错误 payload、导出兼容性）
    - 8 阶段实施路线图（从 TypeScript schema 到全页面 rollout）
- **未实现**: 零代码变更、零组件实现、零 API 修改
- **状态**: 设计文档已完成，待未来开发阶段实施

## Phase 4A-6-10: Statistics ResultView QA & Polish

- **目标**: 稳定化 Statistics 页面的 `ResultView` 集成，修复代码审查中发现的问题。
- **修改文件**:
  - `app/src/lib/adapters/statisticsResultAdapter.ts` — 增强安全性与健壮性
  - `app/src/pages/Statistics.tsx` — 移除独立的 AI 解读区块，简化结果容器
- **修复内容**:
  - 不稳定 ID: `Date.now()` → `datasetInfo.id + selectedColumn`
  - 空值安全: 所有数值字段增加 `typeof` 类型守卫
  - `column_stats` 增加 `Array.isArray` 校验
  - `highNullColumns` 过滤增加数值类型检查
  - `totalNulls` reduce 增加类型守卫
  - 空结果提示: "无法解析分析结果" → "分析完成，但未返回统计数据"
  - 移除未使用的 `Sparkles` 导入
- **AI 解读整合**: 从 `Statistics.tsx` 独立 JSX 移入适配器，作为 `ResultTextBlock` 统一渲染
- **导出行为**: `handleExportCSV` 继续使用 `analysisResult.column_stats`，未迁移到 `AnalysisResult`
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 18.44s。

## Phase 4A-6-9: Integrate ResultView with Statistics Page

- **目标**: 将 `ResultView` 接入 Statistics 分析页面，验证统一结果系统在产品流中的可用性。
- **新增文件**:
  - `app/src/lib/adapters/statisticsResultAdapter.ts` — 将 Statistics 后端结果转换为 `AnalysisResult`
- **修改文件**:
  - `app/src/pages/Statistics.tsx` — 用 `ResultView` 替换原有的 `renderStatsResult()` 卡片渲染，保留 AI 解读区块
- **适配器设计**:
  - Summary block: 整体分析概况（字段数、类型分布、空值提醒）
  - Metric block: 4 个 KPI（分析字段数、数据行数、数值型字段数、总空值数）
  - Table block: 统一表格展示所有字段的统计指标（12 列）
  - Warning block: 空值率 > 10% 的字段自动生成警告
  - Status: 正常 → `success`，空值率 > 50% → `warning`
- **已知限制**:
  - AI 解读仍独立于 `ResultView` 之外
  - 其他分析页面仍使用各自的 ad-hoc 渲染
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 18.67s。

## Phase 4A-6-8: Result Schema + Mock ResultView Skeleton

- **目标**: 实现 Phase 4A-6-7 设计文档的第一个代码层。
- **新增文件**:
  - `app/src/types/result.ts` — `AnalysisResult` 共享 schema + 6 种 `ResultBlock` + Column Contract
  - `app/src/lib/resultFormatters.ts` — 格式化工具（数值/百分比/p-value/货币/日期/布尔/null）
  - `app/src/mocks/mockAnalysisResults.ts` — 3 个 mock payload（描述统计、A/B 测试、回归分析）
  - `app/src/components/results/` — 7 个组件
    - `ResultView.tsx` — 主编排器（header + status banner + block dispatcher + diagnostics footer）
    - `ResultTableRenderer.tsx` — 表格渲染（含 p-value 高亮、空状态）
    - `ResultMetricBlock.tsx` — 指标卡片网格
    - `ResultSummaryBlock.tsx` — 摘要文本 + bullet points
    - `ResultWarningBlock.tsx` — 警告横幅（info/caution/critical）
    - `ResultTextBlock.tsx` — 文本块（支持 collapsible）
    - `index.ts` — barrel export
- **设计要点**:
  - `ResultView` 通过 `block.type` switch 分发到各子渲染器
  - 图表块仅渲染占位卡片（"未来阶段实现"）
  - 未知块类型安全降级，不 crash
  - 所有样式使用项目 CSS 变量，零新增 Tailwind 类
- **已知限制**:
  - 未接入真实分析页面（独立组件）
  - 表格未实现分页/排序（schema 已支持，渲染器未实现）
  - 货币符号硬编码为 ¥
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 21.64s，无空 `SelectItem value=""`。

## Phase 4A-6-14: ResultView Rollout to Forecast Page

- **目标**: 将 `ResultView` 推广到 Forecast 页面，验证时间序列预测结果的结构化渲染。
- **新增文件**:
  - `app/src/lib/adapters/forecastResultAdapter.ts` — Forecast 结果 → `AnalysisResult`（支持单预测 + 批量预测）
- **修改文件**:
  - `app/src/pages/Forecast.tsx` — 接入 `ResultView`，替换 metric cards、decomposition card、promotion impact card、AI summary
- **适配器设计**:
  - 自动检测 batch vs single：通过 `forecasts` 数组字段存在性判断
  - Single：summary + metric + forecast table + decomposition table + promotion impact table + AI text + line chart placeholder + warnings
  - Batch：summary + metric + SKU table + warnings
  - 支持两种 forecast 数据格式：并行数组 `{ds, yhat, yhat_lower, yhat_upper}` 和 点对象数组
  - 防御性处理：`safeNumber`、`safeString`、Array.isArray、typeof 守卫
- **保留的 UI**:
  - 错误诊断显示（含 collapsible diagnostics + sample data）— ResultView 错误状态较简单，保留 richer display
  - What-if 分析结果 — 交互性强，暂不适合 AnalysisResult
  - 导出 CSV 按钮 — 直接读取 `analysisResult`
  - 调试信息 — 无 forecast 数据时显示原始数据结构
- **图表策略**: Forecast 页面原本无真实 ECharts 图表，因此适配器 emit line chart placeholder（符合 4A-6-13 政策）
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 18.88s。清理了未使用变量 `metrics`、`Calendar`、`BarChart3`。

## Phase 4A-6-13: Chart Placeholder Policy & Attribution Cleanup

- **目标**: 消除 Attribution 页面中图表占位卡片与真实 ECharts 图表的重复 UI。
- **问题**: Phase 4A-6-12 的适配器同时 emit 了 chart placeholder block，而 `Attribution.tsx` 页面级别仍保留了真实的 ECharts 对比图表。
- **策略**:
  - 保守策略：当页面已在 `ResultView` 外部渲染真实图表时，适配器不再 emit chart placeholder block
  - `ResultView` 的通用 chart placeholder fallback 仍然保留，供未来页面使用
- **修改文件**:
  - `app/src/lib/adapters/attributionResultAdapter.ts` — 移除 chart placeholder block，添加说明注释
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 18.10s。

## Phase 4A-6-12: ResultView Rollout to Attribution Page

- **目标**: 将 `ResultView` 推广到 Attribution 页面，验证 schema 对复杂分析结果（嵌套模型数据、对比表、图表元数据）的支持能力。
- **新增文件**:
  - `app/src/lib/adapters/attributionResultAdapter.ts` — Attribution 结果 → `AnalysisResult`
- **修改文件**:
  - `app/src/pages/Attribution.tsx` — 替换 metric cards + model cards + comparison table 为 `ResultView`
- **适配器设计**:
  - Summary block: 归因分析概况（旅程数、转化数、转化率、平均触点数）
  - Metric block: 4 KPIs
  - Table block 1: "各模型触点归因" — 将嵌套 `models` 对象扁平化为行（模型 × 触点 × 占比）
  - Table block 2: "各模型 Top3 触点对比" — 来自 `summary.model_comparison`
  - ~~Chart placeholder~~ — 已在 4A-6-13 移除
  - Warning block: 转化率 < 1% 或平均触点数 > 10 时自动触发
- **保留的 UI**:
  - ECharts 对比图表 — 保留在页面级别，未来迁移至 ResultView
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 18.85s。

## 下一步建议

### 立即执行

1. **补做 Phase 3G 浏览器端到端回归测试** — 在可连接 RDS 的环境中跑通全部 checklist

### 随后进入

1. **ResultView 推广到 Forecast / PathAnalysis 页面** — 验证时间序列和漏斗/图结果结构
2. **或实现 ResultChartRenderer** — 在 ResultView 内支持真实图表渲染
3. **或转入 Phase 4B**（AI Assistant / Hermes Agent）— 根据产品优先级调整

### 远期规划（不变）

- Phase 4B: AI Assistant Upgrade / Hermes Agent
- Phase 4C: DataWorkshop 组件拆分
- Phase 5: Dashboard & ECharts Upgrade

---

## Build 验证结果

```bash
cd app && npx tsc --noEmit    # 0 errors ✅
cd app && npm run build        # built in 20.50s ✅
```

> 最近构建: built in 19.94s，JS chunk 3,397 KB。

> 警告: JS chunk 3,395 KB，待 Phase 4A-6-6 拆分优化。
