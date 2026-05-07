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

## Phase 4A-6-15: ResultView Rollout to PathAnalysis Page

- **目标**: 将 `ResultView` 推广到 PathAnalysis 页面，验证路径/漏斗/旅程结果的结构化渲染。
- **新增文件**:
  - `app/src/lib/adapters/pathAnalysisResultAdapter.ts` — PathAnalysis 结果 → `AnalysisResult`（5 种分析类型）
- **修改文件**:
  - `app/src/pages/PathAnalysis.tsx` — 接入 `ResultView`，保留所有 ECharts 图表和特殊 UI
- **适配器设计**:
  - Dispatcher 按 `pathType` 路由到 5 个独立转换器：funnel、path、clustering、key_path、sequence_mining
  - 每个转换器产出：summary + metric + table(s) + warning + text (AI summary)
  - Funnel：漏斗步骤表 + 流失/转化警告
  - Path：热门路径表 + 节点统计表 + 循环/碎片化警告
  - Clustering：用户群体表 + 分布不均警告
  - Key Path：常见路径表 + 最优路径表
  - Sequence Mining：频繁模式表 + 关联规则表 + 高转化模式表 + 低数据警告
  - 防御性处理：`safeNumber`、`safeString`、`safeArray`、`formatPath`
- **保留的 UI**:
  - 漏斗 ECharts 图表、桑基图、力导向网络图、关联规则图
  - 循环路径警告（含示例详情）
  - 视觉路径展示（breadcrumb 箭头样式）
  - 最优路径卡片
  - 聚类保存按钮
  - 聚类卡片（含特征统计）
  - 导出工具栏（CSV + 图表下载）
- **图表策略**: 页面已渲染多个真实 ECharts 图表，因此适配器不 emit chart placeholder（符合 4A-6-13 政策）
- **已知限制**: 旧 metric cards 暂时与 ResultView 共存，未来 cleanup phase 移除
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 18.79s。清理了未使用导入 `ResultTableColumn`。

## Phase 4A-6-16: PathAnalysis ResultView UI Cleanup

- **目标**: 移除 PathAnalysis 页面中与 ResultView 重复的 metric cards 和基础表格。
- **修改文件**:
  - `app/src/pages/PathAnalysis.tsx` — 移除 5 种分析类型下的旧 metric cards 和重复表格
- **移除内容**:
  - Funnel：3 个 metric cards + 步骤详情 HTML table
  - Path：3 个 metric cards + 节点详情 card grid
  - Sequence Mining：4 个 metric cards + 关联规则 HTML table
  - Clustering：2 个 metric cards
  - Key Path：3 个 metric cards
- **保留内容**:
  - 所有 ECharts 图表（漏斗图、桑基图、力导向图、关联规则图）
  - 循环路径警告、视觉路径展示、最优路径卡片
  - 聚类保存按钮、聚类卡片
  - 导出工具栏
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.17s。清理了未使用导入 `Users`。

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

## Phase 4A-6-17: ResultChartRenderer Design Document

- **目标**: 创建 `ResultChartRenderer` 架构设计文档，为未来在 ResultView 内支持真实图表渲染提供路线图。
- **范围**: 纯文档阶段，未修改任何应用源代码
- **新增文件**:
  - `docs/design/RESULT_CHART_RENDERER_DESIGN.md`
- **设计要点**:
  - 盘点当前 6 处图表使用：Attribution bar、Forecast line placeholder、PathAnalysis funnel/sankey/graph/association-rule
  - 评估现有 `ResultChartBlock` schema 充足性，提出未来扩展建议
  - 定义三级优先级：P0 line/bar/area → P1 scatter/histogram/pie → P2 funnel/sankey/graph
  - 提出架构：`ResultChartRenderer` → `buildChartOption` → `BaseEChart` (生命周期包装器)
  - 定义 ECharts 生命周期安全要求：mount/update/unmount/resize/空数据处理
  - 包体积策略：复用现有 ECharts，不新增依赖
  - 迁移策略：Forecast 优先（无冲突）→ Attribution 次之 → PathAnalysis graph 延后
  - 明确非目标：本阶段不实现、不迁移、不修改 adapter、不添加依赖
- **验证**: `git status` 确认仅 docs/ 文件变动，无源代码修改

## Phase 4A-6-18: Basic ResultChartRenderer Implementation

- **目标**: 实现 `ResultChartRenderer`，支持 P0 图表类型（line、bar、area）。
- **新增文件**:
  - `app/src/components/results/ResultChartRenderer.tsx` — 主图表渲染器
  - `app/src/components/results/charts/BaseEChart.tsx` — ECharts 生命周期包装器
  - `app/src/components/results/charts/buildChartOption.ts` — line/bar/area option 构建器
  - `app/src/components/results/charts/chartTypes.ts` — 图表类型注册表
- **修改文件**:
  - `app/src/types/result.ts` — `ResultChartBlock.chartType`  union 增加 `"area"`
  - `app/src/components/results/ResultView.tsx` — 图表块由 inline placeholder 改为 `<ResultChartRenderer />`
  - `app/src/components/results/index.ts` — 导出 `ResultChartRenderer`
- **实现要点**:
  - `BaseEChart`: lazy init（容器有非零尺寸才初始化）、setOption 更新、unmount dispose、window resize 监听
  - `buildChartOption`: 从 `xKey`/`yKeys` 提取数据，应用 `getChartColors()` 主题色
  - Line: 标准折线；Bar: 标准柱状；Area: 折线 + 垂直渐变 `areaStyle`
  - 多 series 时自动显示 legend；category > 12 时 x 轴标签自动旋转
  - 支持 adapter 传入 `echartsOptions` 覆盖（浅合并）
  - 不支持的类型渲染安全 placeholder："图表类型暂未支持：{type}"
- **未迁移页面**: Forecast/Attribution/PathAnalysis 页面图表保持原样
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.52s。index chunk +~4 kB，vendor-echarts 不变。

## Phase 4A-6-19: Forecast Chart Migration

- **目标**: 将 Forecast 页面的图表块从 placeholder 转为真实 line chart。
- **修改文件**:
  - `app/src/lib/adapters/forecastResultAdapter.ts` — 更新 chart block
- **变更要点**:
  - 动态构建 `yKeys` 和 `seriesNames`：根据数据中存在性决定是否包含 `actual`/`forecast`/`lower`/`upper`
  - 预览子集从 50 行扩大到 100 行
  - 移除 "placeholder" 注释
- **数据形状**: `buildForecastTableRows` 产出的 `{ date, forecast, lower, upper, actual? }` 行直接传入 chart block
- **已知限制**: confidence interval 目前以独立 line 系列显示，非 shaded band；超长预测（>100 点）被截断
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.30s。

## Phase 4A-6-20: Attribution Chart Migration

- **目标**: 将 Attribution 页面的对比柱状图从页面级 ECharts 迁移进 `ResultView`。
- **修改文件**:
  - `app/src/lib/adapters/attributionResultAdapter.ts` — 添加真实 bar chart block
  - `app/src/pages/Attribution.tsx` — 移除页面级图表逻辑和 JSX
- **变更要点**:
  - 适配器将嵌套 `models` 数据（`Record<string, Record<string, { percentage: number }>>`）扁平化为 chart rows：`{ touchpoint, [modelKey]: percentage }`
  - 模型 key 映射为中文显示名（首次触点 / 末次触点 / 线性归因 / 时间衰减 / 位置归因 / Shapley值）
  - 页面移除 `chartRef`、`chartInstance`、`renderComparisonChart()`、图表 `useEffect`、图表 `<Card>` JSX
  - 移除未使用导入：`echarts`、`getChartColors`、`withAlpha`、`Card` 系列组件
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.01s。

## Phase 4A-6-21: Manual QA Test Dataset Pack

- **目标**: 创建稳定、可复现的手动 QA 测试数据集包，供进入 Phase 4B 前做端到端验证。
- **新增文件**:
  - `manual-test-data/scripts/generate_manual_test_data.py` — 纯标准库生成脚本，固定种子 `SEED = 42`
  - `manual-test-data/README.md` — 数据集说明与推荐测试顺序
  - `manual-test-data/qa-checklist.md` — 按功能域的详细 QA 检查清单
  - `manual-test-data/csv/01_users.csv` ~ `10_data_quality_edge_cases.csv` — 10 个测试数据集
- **数据集覆盖**:
  - Statistics / Semantic / Forecast / Attribution / PathAnalysis
  - A/B 实验、回归分析、数据质量边界、多表关系
- **设计要点**:
  - 用户表与商品表先生成，再加载用于生成订单、事件、评论等关联表
  - 事件日志包含确定性漏斗结果（转化/加购流失/结账流失/跳出）
  - 归因旅程包含 1–6 个有序触点，~35% 转化率
  - 预测数据包含周季节性、促销 spike、节假日效应
  - 数据质量表包含 >60% 缺失、常数列、高基数、混合类型、异常值
- **验证**: 脚本运行成功，10 个 CSV 生成完毕，未修改任何应用源代码

## Phase 4A-6-22: Critical QA Bug Triage — Preprocessing Integrity & Path Clustering Timeout

- **目标**: 修复手动 QA 发现的两个严重问题：预处理模块自动保存缺陷 + 路径聚类超时。
- **修改文件**:
  - `insightease-backend/app/api/v1/endpoints/analysis.py` — 新增 `normalize_missing_values()` 助手；`smart_process` 支持 `preview_only` 参数；缺失值规范化在计数和填充前执行
  - `insightease-backend/app/services/path_analysis_service.py` — 路径聚类增加 `max_sessions=1000` 上限和随机采样；修复 `combined_entropy` 计算 bug；采样时返回警告
  - `app/src/pages/SmartProcess.tsx` — 主按钮改为"预览处理"；预览完成后显示"保存结果"按钮；预览不传 `output_dataset_id`，保存才持久化
- **根因分析**:
  1. **自动保存**: `smart_process` 后端在分析任务中直接写文件 + 创建 Dataset DB 记录，没有预览/保存区分
  2. **缺失值检测**: 仅使用 `df.isnull()`，字符串 token（`null`, `N/A`, `-`, `unknown`, `无`, `缺失`）未被识别为缺失
  3. **聚类超时**: 无用户数量上限；`combined_entropy` 嵌套生成器表达式存在变量遮蔽和重复 Counter 构造
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 20.22s。

## Phase 4B-1: AI Data Assistant Product & Architecture Design

- **目标**: 设计 InsightEase AI Data Assistant 的产品形态和架构。
- **新增文件**:
  - `docs/design/AI_DATA_ASSISTANT_DESIGN.md` — 主设计文档
- **设计要点**:
  - 定义产品目标：数据集理解、表分类、字段角色检测、关系推断、分析推荐、结果解释
  - 定义 6 个能力模块：Dataset Profiler、Table Classifier、Column Role Detector、Relationship Inference Engine、Analysis Planner、Result Explainer
  - 定义核心契约：`DatasetProfile`、`ColumnProfile`、`TableClassification`、`TableRelationship`、`AssistantAnalysisPlan`
  - 集成策略：助手推荐映射到现有分析页面（Statistics / Semantic / PathAnalysis / Forecast / Attribution / SmartProcess），支持配置预填充
  - ResultView 集成：助手消费 `AnalysisResult` 块进行解释，未来助手响应本身可渲染为兼容块
  - 安全与隐私：元数据优先、样本行显式 opt-in、推断关系需用户确认、禁止自动修改数据集
  - Hermes Agent 定位：仅作为未来可能的执行层，核心契约独立于任何 Agent 运行时
  - 实施路线图：4B-2 元数据服务 → 4B-3 静态理解 UI → 4B-4 面板 Mock → 4B-5 计划 Mock → 4B-6 真实 AI 集成 → 4B-7 结果解释器
- **零代码变更**: 纯文档阶段，未修改任何应用源代码或 package 文件

## Phase 4B-2: Dataset Profile Contract + On-demand Metadata Service

- **目标**: 实现 AI 助手的第一层契约：确定性、非 LLM、元数据优先的数据集画像服务。
- **新增文件**:
  - `app/src/types/assistant.ts` — 前端契约：`ColumnRole`, `SemanticType`, `TableType`, `ColumnProfile`, `TableClassification`, `DatasetProfile`
  - `app/src/api/assistant.ts` — 前端 API 客户端：`assistantApi.profileDataset(datasetId)`
  - `insightease-backend/app/services/assistant_profile_service.py` — 后端画像服务（确定性启发式规则）
  - `insightease-backend/app/api/v1/endpoints/assistant.py` — 后端端点 `POST /assistant/profile-dataset`
- **修改文件**:
  - `insightease-backend/app/api/v1/api.py` — 注册 `assistant.router`
- **实现要点**:
  - 字段角色检测：基于列名模式匹配、dtype、唯一值率、空值率的确定性启发式
  - 表分类：基于检测到的角色组合推断业务实体类型（user/order/event_log/experiment/review_text/metric_summary 等）
  - 质量警告：数据集级别（行数少、列数多、无时间列、整体缺失率高）和列级别（缺失率>50%、常数列、接近唯一值）
  - 缺失值处理：复用 Phase 4A-6-22 的 `normalize_missing_values`，统一识别字符串缺失 token
  - 只读保证：端点仅读取数据文件，不修改源数据集、不创建新数据集、不触发预处理
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` 成功，`python -m compileall app` 无语法错误

## Phase 4B-2B: Dataset Profile API Contract Smoke Test & Casing Fix

- **目标**: 验证并稳定后端画像端点与前端的 API 契约，解决潜在的 snake_case / camelCase 不匹配。
- **检查内容**:
  - 后端 `ResponseModel` 包装行为：`{ code, message, data }`
  - 后端服务返回的键名：全部为 snake_case
  - 前端 axios 拦截器：`response.data` 直接返回
  - 现有前端类型约定：`Dataset`、`Analysis`、`FieldSchema` 均使用 snake_case
- **决策**: 将 `app/src/types/assistant.ts` 从 camelCase 统一改为 snake_case，与后端输出和现有项目约定保持一致
- **修改文件**:
  - `app/src/types/assistant.ts` — 全部字段改为 snake_case（dataset_id, row_count, semantic_type, null_rate, table_type, recommended_analyses, quality_warnings, generated_at 等）
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` 成功，后端 `compileall` 通过

## Phase 4B-3: Static Dataset Understanding UI

- **目标**: 构建第一个可见的 AI Data Assistant 功能：静态、非 LLM 的数据集理解卡片。
- **新增文件**:
  - `app/src/components/assistant/DatasetUnderstandingCard.tsx` — 数据集理解主组件
- **修改文件**:
  - `app/src/pages/Datasets.tsx` — 在数据集详情对话框中集成 `DatasetUnderstandingCard`
- **组件功能**:
  - 调用 `assistantApi.profileDataset(datasetId)` 获取画像
  - 加载/错误/空状态处理 + 刷新按钮
  - 表类型推断（含置信度、证据、推荐分析）
  - 数据质量警告列表
  - 字段角色分布（带图标和颜色的徽章）
  - 语义类型分布
  - 关键字段分组（标识列、时间列、指标列、文本列、实验分组、警告列）
  - 字段详情表格（字段名、角色、类型、缺失率、唯一值、示例值、警告）
  - 表格默认展示前 20 个字段，支持展开全部
- **辅助函数**: ROLE_LABELS / SEMANTIC_LABELS / TABLE_TYPE_LABELS / getConfidenceLabel / getRoleIcon / getRoleBadgeColor / getSemanticBadgeColor / KeyColumnGroup
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.41s

## Phase 4B-3C: AI Assistant Workbench UX Audit

- **目标**: 审计当前 AI 助手/工作台交互设计，识别 UX 问题，产出审计报告、状态模型和推荐方向。
- **范围**: 15 个文件（前端组件/服务/页面 + 后端端点/服务）
- **方法**: 静态代码审查 + 交互流追踪 + 设计文档差距分析
- **关键发现**:
  - `AIAssistant.tsx` 是完全死代码（251 行，0 处引用）
  - `SmartAnalysis.tsx` 的诊断、预处理、大部分分析均为 `setTimeout` 模拟数据
  - 3 个互不共享状态的助手入口（AIWorkspace、SmartAnalysis、AICompanion）
  - 后端 5 个 `/ai/*` 端点中 4 个完全未被前端调用
  - 伙伴助手使用 `window.location.href` 导致整页刷新
  - AIWorkspace 的普通对话功能被完全注释掉
  - 设计文档要求的「预填充导航」零实现
  - 意图识别对每个用户消息都发送大提示词到 LLM（即使关键词匹配已高置信度命中）
- **产出**:
  - `docs/PHASE4B3C_AI_ASSISTANT_UX_AUDIT.md` — 完整审计报告
  - `docs/phase-logs/phase-4B-3C.md` — 阶段日志
- **推荐方向**:
  - 立即：删除死代码、修复伙伴导航、AIWorkspace 背景点击保护
  - 短期：统一助手入口、实现预填充导航、优化意图识别
  - 中期：构建 AssistantPanel、实现 Result Explainer、添加关系推断
- **零代码变更**: 纯审计阶段

## Phase 4B-3D: AI Assistant Surface Stabilization

- **目标**: 稳定当前 AI 助手表面，修复 4B-3C 审计发现的 P0 交互和架构问题。
- **删除死代码**:
  - 删除 `app/src/components/AIAssistant.tsx`（251 行，0 处引用）
- **修复伙伴导航**:
  - `companion-service.ts`: `window.location.href` → `companion-navigate` 自定义事件
  - `AppLayout.tsx`: 新增 `useNavigate()` 监听器处理导航事件
  - 7 个导航动作全部改为客户端路由，消除整页刷新
- **稳定 AICompanion**:
  - 悬停提示 `双击对话` → `双击打开工作台`
  - JSX 注释中的用户可见 `Kimi` 文本替换为 `AI 助手`
- **AIWorkspace 关闭保护**:
  - 移除背景遮罩的 `onClick={onClose}`，仅通过左上角关闭按钮关闭
- **非 LLM 边界澄清**:
  - 欢迎消息增加「当前支持规则型分析导航...自然语言智能规划将在后续阶段开放」
  - 副标题改为「规则型数据助手 · 自然语言能力即将开放」
- **SmartAnalysis 模拟标注**:
  - 数据质量诊断、预处理完成卡片增加「演示数据」Badge
  - 模拟代码段增加 `⚠️ 模拟` 注释
- **路由清理**:
  - `/app/ai-workspace` 独立路由重定向到 `/app/dashboard`
  - 移除 `App.tsx` 中未使用的 `AIWorkspace` import
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 20.23s

## Phase 4B-3F: AI Companion Hard Reset

- **目标**: 彻底重建浮动 AI 助手外壳，消除旧版变形/胶囊/输入态 UI。
- **根因分析**:
  - 旧版 `AICompanion.tsx` 在 `isVisible = true` 时渲染 320px 宽气泡卡片 + 底部第二个头像 + 拖拽行为
  - 该气泡视觉上类似长条输入框/胶囊，且可拖拽，造成「破损的输入态」观感
- **重建内容**:
  - **新状态模型**: collapsed | notification | workspace_open（三态严格限制）
  - **删除旧 UI**: 移除拖拽约束、320px 气泡、第二个头像、双击行为
  - **新增启动器**: 固定右下角球体，单击打开工作台，悬停提示「打开 AI 工作台」
  - **新增通知卡片**: 280px 紧凑卡片位于启动器上方，含消息 + 最多 3 个按钮 + 关闭按钮
  - **新头像组件** `AssistantAvatar.tsx`: 球形柔和渐变，白点双眼，顶部高光营造 3D 球体感，9 种变体
- **服务简化**:
  - 删除 `generateAIContent()` 模拟 AI、idle 追踪、4 个非核心触发器
  - 保留 `setPage()` / `recordAction()` / `updateContext()`（11 个页面依赖）
  - 保留 `companion-navigate` 事件导航（4B-3D 修复）
  - 更新上传完成文案：「查看数据理解 / 进入数据工坊 / 稍后再说」
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.34s

## Phase 4B-3G: AI Workbench Layout Polish + Companion Drag Restore + Avatar Color Harmony

- **目标**: 恢复拖拽和双击打开工作台；替换 `KimiAvatar`；打磨 AIWorkspace 布局；校准头像颜色。
- **内容**:
  - `AICompanion.tsx`: 恢复 `onPointerDown/Move/Up` 拖拽、`onDoubleClick` 打开工作台、localStorage 持久化
  - `AssistantAvatar.tsx`: 从 Tailwind 线性渐变改为 inline 径向渐变，尝试统一 cyan-aqua 调色板
  - `AIWorkspace.tsx`: `KimiAvatar` → `AssistantAvatar`；新增快速提问芯片；改善无数据集空状态
- **已知问题（后续发现）**:
  - 悬停时 `onPointerMove` 误触发拖拽（`dragStartRef` 默认 `{0,0}`，未校验 pointer down）
  - 头像颜色仍不协调，像「独立玩具球」
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.13s

## Phase 4B-3H: AI Companion Hover Bug Fix + Avatar Color Recalibration

- **目标**: 修复 4B-3G 引入的悬停消失 bug 和头像颜色不协调问题。
- **Hover Bug 修复**:
  - 定位从 `right/bottom` 偏移数学改为显式 `left/top` 像素坐标
  - 新增 `isValidPosition()` + 加载时 clamp，非法 localStorage 自动回退默认位置
  - tooltip / 脉冲环加上 `pointer-events-none`，防止偷走指针事件
  - `onMouseEnter/Leave` 移到 orb 外层独立 wrapper，与 pointer drag 隔离
- **颜色重新校准**:
  - 所有 9 个 variant 统一共享 `CORE` 品牌调色板（cyan-aqua-blue）
  - variant 只做极 subtle 的中色调偏移，不再整球换色
  - 降低饱和度、统一光晕、柔化高光
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 19.29s

## Phase 4B-3I: Companion Drag Intent Fix & Workbench Split Layout Correction

- **目标**: 修复悬停误触发拖拽的问题，校正 AI Workbench 分栏布局方向。
- **Drag Intent 修复**:
  - 新增 `pointerDownRef`：只有 pointer down 后移动超过阈值才算拖拽
  - `onPointerMove` 无 pointer down 时直接返回，彻底杜绝悬停即拖拽
  - 新增 `suppressDoubleClickRef`：拖拽结束后 250ms 内抑制双击，避免释放即打开
  - 拖拽状态全部用 ref，避免 drag 过程中不必要的 re-render
- **Workbench 布局校正**:
  - 关闭按钮：增大对比度，添加 `aria-label`，使用显式边框 + hover 背景
  - 左右分栏：AI 工作台在左(62%)，数据预览在右(38%)（原先是反的）
  - 布局切换按钮 tooltip 同步更新描述
- **验证**: `npx tsc --noEmit` 0 errors，`npm run build` built in 18.99s

## Phase 4B-4: Multi-table Relationship Inference Design

- **目标**: 设计多表关系推断系统（纯文档阶段）。
- **产出**: `docs/design/TABLE_RELATIONSHIP_INFERENCE_DESIGN.md`
- **核心设计**:
  - 输出契约：`TableRelationship` / `RelationshipEvidence`（TypeScript-style）
  - 评分框架：6 个信号（名称/角色/类型/唯一性/表类型/值重叠），总分上限 1.0
  - 置信度分级：高(>=0.85)/中(0.65-0.85)/低(0.45-0.65)/极低(<0.45)，对应不同 UI 行为
  - 基数推断：基于 unique_rate 推断 one_to_one / one_to_many / many_to_one / many_to_many
  - 用户确认模型：suggested → confirmed / rejected，仅 confirmed 可用于分析规划
  - UI 提案：数据集详情页「相关表」、AI Workbench「理清表关系」、关系列表视图
  - API 提案：`POST /assistant/infer-relationships`
  - 安全约束：默认元数据-only、零 LLM、不自动 join
  - QA 数据集预期：8 条高置信度关系 + 弱关系 + 非关系场景
  - 实施路线图：4B-5 后端服务 → 4B-6 Review UI → 4B-7 Analysis Planner Mock
- **零代码变更**: 纯文档阶段

## Phase 4B-5: Relationship Inference Backend Service

- **目标**: 实现元数据-only 关系推断后端服务。
- **后端服务** `relationship_inference_service.py`:
  - 候选生成：跨数据集比较 key-like 列，排除 metric/text/高 null/类型不兼容列
  - 评分框架：5 个已实现信号（名称 0.35 / 角色 0.25 / 类型 0.15 / 唯一性 0.15 / 表类型 0.15）
  - 值重叠信号：未实现，请求时返回警告
  - 基数推断：基于 unique_rate 阈值推断 one_to_one / one_to_many / many_to_one / many_to_many / unknown
  - 方向选择：优先事实表→维度表（order→user, event_log→user 等）
  - 去重：避免同向和反向重复
  - 证据与警告：中文可读证据 + null 率警告 + many-to-many 警告 + 元数据-only 免责声明
- **新增 endpoint**: `POST /assistant/infer-relationships`
  - 请求：`InferRelationshipsRequest`（dataset_ids, include_value_overlap, max_candidates）
  - 响应：`ResponseModel[InferRelationshipsResponse]`（relationships, generated_at, warnings）
  - 校验：>=2 数据集，<=20 数据集，跳过不可读数据集并附带警告
- **前端更新**:
  - `app/src/types/assistant.ts`: 新增 `RelationshipType`, `RelationshipStatus`, `RelationshipEvidence`, `TableRelationship`, `InferRelationshipsRequest`, `InferRelationshipsResponse`
  - `app/src/api/assistant.ts`: 新增 `assistantApi.inferRelationships()`
- **手动 QA 结果**（5 个 mock profile）:
  - `orders.user_id` → `users.user_id`: ✅ confidence=1.00, many_to_one
  - `orders.product_id` → `products.product_id`: ✅ confidence=1.00, many_to_one
  - `reviews.user_id` → `users.user_id`: ✅ confidence=1.00, many_to_one
  - `reviews.product_id` → `products.product_id`: ✅ confidence=1.00
  - `forecast` 无强关系: ✅
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 21.06s, backend compileall ✅

## Phase 4B-6: Relationship Review UI

- **目标**: 在 AI Workbench 添加多表关系推断审阅 UI。
- **新增组件** `RelationshipReviewPanel.tsx`:
  - 数据集选择：tag 按钮形式，多选，显示已选数量
  - 推断触发：「推断表关系」按钮，<2 个数据集时禁用
  - 加载状态：spinner + "正在分析表结构..."
  - 结果展示：卡片列表，每张卡片显示源表.列 → 目标表.列、置信度标签、关系类型、状态徽章
  - 展开详情：显示完整证据列表（类型/消息/分数）和警告列表
  - 本地确认/忽略：组件级 state，confirmed 变绿边框，rejected 变灰降低透明度
  - 安全文案：顶部信息栏明确说明元数据-only、不自动 join、不修改数据
- **AI Workbench 集成**:
  - 「能力」标签页新增首个卡片：理清表关系（Table2 图标）
  - 点击进入 RelationshipReviewPanel，顶部返回箭头可回到能力网格
  - 不改动「对话」标签页
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 19.44s ✅

## Phase 4B-7: Relationship-aware Analysis Planner Mock

- **目标**: 添加规则型 mock 分析规划器，将用户问题转化为结构化分析计划。
- **新增文件**:
  - `app/src/lib/assistant/analysisPlannerMock.ts`: 关键词规则匹配、字段检测、计划生成
  - `app/src/components/assistant/AnalysisPlanCard.tsx`: 结构化计划展示卡片
- **类型扩展** `app/src/types/assistant.ts`:
  - `RecommendedAnalysisType`, `AnalysisFieldRequirement`, `AssistantNextAction`, `AssistantAnalysisPlan`
- **关键词规则**:
  - 预测/趋势/未来 → forecast → /app/forecast
  - 路径/漏斗/流失 → path_analysis → /app/path
  - 归因/渠道 → attribution → /app/attribution
  - AB/实验 → ab_test → /app/statistics
  - 文本/评论/情感 → semantic → /app/semantic
  - 清洗/缺失/异常值 → smart_process → /app/data-workshop
  - 其他 → descriptive → /app/statistics
- **字段检测**: 基于列名模式匹配（time_column, user_id, event_name, target_metric 等）
- **关系感知**: 多数据集无 confirmed relationships 时发出警告
- **AI Workbench 集成**:
  - 「能力」标签页新增「生成分析计划」卡片（ClipboardList 图标）
  - 输入框 + 6 个示例问题 chip + 「生成计划」按钮
  - 生成后展示 AnalysisPlanCard（类型标签、所需字段、假设、警告、导航按钮）
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 19.28s ✅

## Phase 4B-7B: Assistant Context Store + Relationship-aware Planner Bridge

- **目标**: 建立前端 assistant context store，打通关系确认与分析计划。
- **新增文件**:
  - `app/src/hooks/useAssistantContext.ts`: React hook + localStorage 持久化
- **修改文件**:
  - `RelationshipReviewPanel.tsx`: controlled props 支持
  - `AIWorkspace.tsx`: 引入 context store，传递给 panel 和 planner
  - `analysisPlannerMock.ts`: 消费 confirmed relationships
  - `AnalysisPlanCard.tsx`: 展示 confirmed relationships
- **行为**:
  - 确认/忽略/重置关系通过 context store 持久化到 localStorage
  - 分析计划生成时自动带入相关数据集的已确认关系
  - 有计划中的已确认关系时不发多数据集缺少关系警告
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 22.76s ✅

## Phase 4B-7C-A: AI Workbench Agent-compatible Shell Stabilization

- **目标**: 修复 AI Workbench 运行时 bug，稳定为 Agent-compatible shell。
- **修复**:
  - `RelationshipReviewPanel.tsx`: 修正响应解析（拦截器已解包 `response.data`）
  - `AnalysisPlanCard.tsx`: 新增 `onNavigate` prop，导航后关闭 workbench
  - `AIWorkspace.tsx`:
    - 对话输入路由到规则型规划器，不再直接调用后端分析
    - 移除 `handleAnalysisRequest` 及关联后端调用链
    - 输入框始终可见，placeholder 根据数据集状态切换
    - 能力标签页分「通用能力」和「分析工具」两区
    - 历史标签页「新对话」自动切回对话标签页
    - 上下布局预览区域添加 `max-h-[240px]`
    - 清理死代码：分析进度、结果面板、未使用图标
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 16.50s ✅

## Phase 4B-7C-B: AI Workbench Vertical Layout Scroll Fix

- **目标**: 修复上下布局中生成的分析计划卡片无法滚动的问题。
- **根因**: flex 滚动链缺少 `min-h-0`，导致 `overflow-y-auto` 子元素无法收缩和滚动。
- **修复**: 在 `AIWorkspace.tsx` 全布局链添加 `min-h-0 overflow-hidden flex-shrink-0`：
  - AI 对话区域、内容区、对话标签页、消息列表
  - 快速 chips、输入框、能力面板头部
  - 能力网格、历史标签页、数据预览面板
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 22.38s ✅

## Phase 4B-8A: Assistant Runtime Adapter + Safe Tool Registry Scaffold

- **目标**: 引入 Assistant Runtime 抽象层，使未来 Hermes/LLM 集成无需 redesign UI。
- **新增**:
  - `assistantRuntime.ts`: 核心接口与类型
  - `ruleBasedAssistantRuntime.ts`: 包装现有规则型规划器
  - `getAssistantRuntime.ts`: 工厂函数
  - `toolRegistry.ts`: 安全工具注册表（8 个工具，确认规则，副作用等级）
  - `hermesAssistantRuntime.ts`: 占位符
  - `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`: 架构设计文档
- **修改**:
  - `AIWorkspace.tsx`: 替换直接调用为 runtime 调用，添加错误处理
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 19.34s ✅

## Phase 4B-8B: SmartAnalysis Legacy Page Audit

- **目标**: 审计 `SmartAnalysis` 遗留页面并决定未来产品定位。
- **发现**:
  - 诊断和预处理完全为模拟数据
  - 仅统计分析调用真实后端
  - 未使用 4A `ResultView`（唯一不使用的分析页面）
  - 导航使用 `window.location.href` 硬刷新
  - 聚类分析推荐不存在的独立页面
- **推荐**: 短期隐藏侧边栏 → 中期迁移到 AI Workbench → 长期删除
- **产出**: `docs/reviews/SMART_ANALYSIS_LEGACY_PAGE_AUDIT.md`
- **无源码修改**

## Phase 4B-8C: Hide Legacy SmartAnalysis Entry

- **目标**: 基于 4B-8B 审计建议，隐藏 SmartAnalysis 公共导航入口。
- **修改**:
  - `AppSidebar.tsx`: 移除 `智能分析向导` 侧边栏入口
  - `Dashboard.tsx`: 移除 SmartAnalysis 快捷按钮
  - `SmartAnalysis.tsx`: 添加 `@deprecated` 注释和页面弃用提示
- **保留**: `/app/smart-analysis` 路由和源码文件（直接访问兼容 + 迁移参考）
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 16.41s ✅

## Phase 4B-8D: Guided Quick Analysis in AI Workbench

- **目标**: 将 SmartAnalysis 遗留页面中有用的"引导式快速分析"概念迁移到 AI Workbench。
- **新增组件** `GuidedQuickAnalysisPanel.tsx`:
  - 3 步引导流：选择数据集 → 理解数据结构 → 生成分析计划
  - Step 1: 数据集卡片选择，支持 `defaultDatasetId` 预选中
  - Step 2: 调用 `assistantApi.profileDataset()` 获取真实画像，渲染紧凑摘要（表类型、关键字段、推荐分析、质量警告）
  - Step 3: 6 个目标 chip + 自定义问题输入，调用 `getAssistantRuntime().generateAnalysisPlan()` 生成计划，渲染 `AnalysisPlanCard`
- **AI Workbench 集成**:
  - 「能力」标签页「通用能力」区新增「快速分析向导」卡片（Zap 图标）
  - 无需预先选择数据集，向导内部完成数据集选择
  - 导航行为与现有 `AnalysisPlanCard` 一致：dispatch `companion-navigate` + 关闭 workbench
- **安全边界**:
  - 仅使用真实 `profileDataset` API，无模拟诊断数据
  - 仅使用 `AssistantRuntime` 生成计划，不自动执行分析
  - 无 join/SQL/数据集创建/Hermes/LLM 调用
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 16.72s ✅

## Phase 4B-8D-A: Guided Quick Analysis Runtime Crash Hotfix

- **问题**: 点击「下一步：理解数据」后 workbench 白屏，`Cannot read properties of undefined (reading 'toLocaleString')`
- **根因**: 后端 `assistant_profile_service.py` 返回 camelCase 键名（`rowCount`, `columnCount` 等），前端 `DatasetProfile` 类型为 snake_case，`profile.row_count` 为 `undefined`
- **修复** `GuidedQuickAnalysisPanel.tsx`:
  - 新增 `safeNumber()` / `safePercent()` 安全格式化辅助函数
  - 新增 `normalizeProfile(raw)` 归一化函数，同时处理 camelCase 和 snake_case 输入
  - 所有数组字段使用 `Array.isArray` 守卫
  - 所有嵌套字段使用安全访问 + 默认值
  - 错误状态增加「重新理解」和「返回选择数据」恢复按钮
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 16.64s ✅

## Phase 4B-8D-B: Confirmed Relationship Scope & Management Fix

- **问题**: 已确认关系全局持久化但无法管理；规划器可能传递无关关系；新对话行为不明确
- **修复**:
  - `useAssistantContext.ts`: 新增 `clearConfirmedRelationships`/`clearRejectedRelationships`/`clearAllRelationshipState`；收紧 `getConfirmedForDatasets` 过滤规则（0→[] / 1→OR / 2+→AND）
  - `RelationshipReviewPanel.tsx`: 新增「已确认关系」可展开管理区，支持单条取消确认和全部清空
  - `AIWorkspace.tsx`: 向面板传递完整已确认关系数组和清空回调；「新对话」按钮增加 tooltip 说明
  - `GuidedQuickAnalysisPanel.tsx`: 生成计划前过滤为仅与选中数据集相关的关系
  - `AnalysisPlanCard.tsx`: 标题改为「本计划使用的已确认表关系」
- **安全边界**: 无后端持久化、无自动 join、无 SQL 生成
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 21.56s ✅

## Hotfix 4B-8D-B.1: Confirmed Relationship Management UI Visibility

- **问题**: 「已确认关系」管理区被条件隐藏导致不可见；行徽章与顶部统计不同步
- **根因**: 管理区 gate 为 `confirmedRelationships.length > 0`，但本地模式确认只写 `localStatus`；`totalConfirmed` 只数 controlled OR local 之一
- **修复** `RelationshipReviewPanel.tsx`:
  - 管理区无条件渲染，空状态显示「暂无已确认关系」
  - `totalConfirmed` 统计当前结果所有 effective confirmed 状态（与行徽章同源）
  - 管理区列表合并 controlled + local 已确认关系并去重
- **验证**: `tsc --noEmit` 0 errors, `npm run build` 16.64s ✅

## Phase 4B-8D-C: Relationship Set Management Redesign

- **目标**: 将 AI Workbench 表关系确认从全局扁平 confirmed edge list 改为一等公民 Relationship Set 模型。
- **新增类型** `app/src/types/assistant.ts`:
  - `RelationshipSet`
  - `RelationshipSetSummary`
  - `RelationshipRiskLevel`
  - `TableRelationship.risk_level` / `is_custom`
- **状态模型** `app/src/hooks/useAssistantContext.ts`:
  - 新增 `relationshipSets` / `activeRelationshipSetId`
  - 新增 `createRelationshipSet`, `updateRelationshipSet`, `deleteRelationshipSet`, `setActiveRelationshipSet`, `getActiveRelationshipSet`, `getRelationshipsForActiveSet`
  - 新 localStorage keys: `insightease_assistant_relationship_sets`, `insightease_assistant_active_relationship_set_id`
  - 旧 `insightease_assistant_confirmed_relationships` 自动迁移为 `旧版已确认关系`
  - 不再写入旧 confirmed relationship 格式
- **UI** `RelationshipReviewPanel.tsx`:
  - 关系组管理区打开面板即显示
  - 候选关系按 key family 分组
  - 行级确认改为 checkbox 选择 + 保存为命名关系组
  - 支持当前关系组切换、重命名、删除、清除当前
  - 高风险关系需要显式确认后才能加入本次关系组
- **Planner / Runtime**:
  - `AIWorkspace.tsx` 新增紧凑关系组 selector
  - chat planner / 生成分析计划只传 active relationship set，不传全部保存关系组
  - `GuidedQuickAnalysisPanel.tsx` 仅使用 active set 中触达所选数据集的关系
- **约束**: 未新增 backend persistence、自动 join、SQL 生成、Hermes 或 LLM。
- **验证**: `npx.cmd tsc --noEmit` 0 errors；`npm.cmd run build` built in 20.39s（保留既有 large chunk warning）。

## 下一步建议

### 立即执行

1. **补做 Phase 3G 浏览器端到端回归测试** — 在可连接 RDS 的环境中跑通全部 checklist

### 随后进入

1. **预填充导航** — 将计划中的数据集 ID 和建议字段映射通过 URL query 或共享状态传递给目标分析页面
2. **Hermes runtime 集成** — 实现 `hermesAssistantRuntime`，替换规则型 planner
3. **SmartAnalysis 删除** — 确认引导流稳定后，删除遗留页面

### 远期规划（不变）

- Phase 4B: AI Data Assistant
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
## Phase 4B-8D-D: Relationship Set Topic Graph

- Relationship Sets now model a topic-scoped dataset graph: connected dataset nodes, confirmed relationship edges, and optional isolated/reference nodes.
- AI Workbench relationship review can keep unmatched selected tables as isolated context instead of silently dropping them.
- Planner/runtime context now receives the active relationship set as an allowed graph, while `required_datasets` remains a question-specific subset.
- Guided Quick Analysis scopes active relationship context to the selected dataset only.
- Validation: `cd app && npx tsc --noEmit` passed; `cd app && npm run build` passed.

## Phase 4B-8E: Prefill Navigation Payload from AI Workbench

- Added frontend-only `AnalysisPrefillPayload` and `sessionStorage` transfer helpers.
- AI Workbench plan next actions now open target pages with a prefill key and do not auto-run analysis.
- Forecast, PathAnalysis, and Attribution can read valid prefill payloads, preselect the suggested dataset, and show/apply exact field suggestions.
- Route mapping documented for forecast, path analysis, attribution, statistics, semantic, and data-workshop.
- Safety contract preserved: no backend persistence, no auto-join, no SQL generation, no Hermes/LLM call, and SmartAnalysis unchanged.

## Phase 4B-8E-A: AI Workbench Continuity & Prefill Gap Fix

- AI Workbench now preserves the active conversation, selected dataset, active relationship set, generated plan, active tab, and preview layout across close/reopen.
- `新对话` is the intentional reset path for conversation state.
- Statistics now consumes AI Workbench prefill payloads for descriptive/statistics-family plans without auto-running analysis.
- Dataset and relationship-set selectors now support lightweight client-side search with empty states.
- Safety contract preserved: no backend changes, no auto-run, no auto-join, no SQL generation, no Hermes/LLM call, and SmartAnalysis unchanged.

## Phase 4B-8F: AI Workbench Context Panel Redesign

- Added reusable `AIWorkbenchContextPanel` for dataset and relationship-set context.
- Replaced the Workbench right-side preview-only area with a context panel in horizontal layout.
- Vertical layout now uses the same panel as a compact top context area.
- The panel shows empty, dataset, relationship-set, and combined context states.
- Relationship-set table previews are lazy-loaded per table and cached only in component state.
- Added design note for future analysis history context.

## Phase 4B-8G: Analysis History Context and Collapsible Sections

- Added collapsible modules to `AIWorkbenchContextPanel` for dataset summary, sample rows, field summary, relationship set summary, connected tables, isolated/reference tables, confirmed edges, and high-risk edges.
- Added session-only collapse state under `insightease_ai_workbench_context_panel_sections`; no preview rows or raw result tables are persisted.
- Added initial analysis history context selection in the Context Panel using the existing `analysisApi.list()` frontend API.
- AI Workbench active-session persistence now stores `selected_analysis_history_id` only, preserving context across close/reopen without storing raw analysis output.
- Preserved safety constraints: no Hermes/LLM, no auto-run analysis, no auto-join, no SQL generation, no backend persistence, and no SmartAnalysis changes.

## Phase 4B-8H: Safe Result Summary Contract

- Added `SafeResultSummary` types and `buildSafeResultSummary`.
- AI Workbench history result preview now uses the shared bounded summary helper.
- History result dialog now shows a compact safe summary while preserving existing detailed result access.
- Added optional `AssistantContext.analysis_history_summary` for future runtime/Hermes use.
- Preserved safety constraints: no Hermes/LLM, no auto-run analysis, no raw result sessionStorage persistence, and no SmartAnalysis changes.

## Phase 4B-8I: Analysis Result to AI Workbench Handoff

- Added temporary AI Workbench handoff payload and open events.
- History result dialog now has `让 AI 解读这个结果`.
- Statistics result page now has `带到 AI 工作台`.
- AI Workbench consumes handoff payloads, attaches safe result context, and shows result follow-up prompt chips.
- Preserved safety constraints: no Hermes/LLM, no automatic explanation, no analysis rerun, and no raw result persistence.

## Phase 4B-8J: Result Follow-up Mode and Default Horizontal Layout

- AI Workbench now defaults to horizontal layout when no valid saved preference exists.
- Added deterministic `resultFollowupResponder` using only `SafeResultSummary`.
- Result follow-up prompt chips now produce local responses for explanation, risks, next steps, and report drafting.
- Unsupported result-context prompts continue through the existing planner.
- Preserved safety constraints: no Hermes/LLM, no auto-run analysis, no SQL, and no raw result persistence.

## Phase 4B-8K: Hermes Result Explainer Boundary Design

- Added `docs/design/HERMES_RESULT_EXPLAINER_BOUNDARY.md`.
- Defined future Hermes result explanation request/response contracts.
- Restricted Hermes input to `SafeResultSummary`, metadata-only dataset/relationship context, user question, and safety flags.
- Documented fallback to deterministic `resultFollowupResponder`.
- No runtime code, backend endpoint, Hermes/LLM call, or app behavior change was added.

## Phase 4B-8L: Hermes Backend API Endpoint Contract

- Added `docs/design/HERMES_BACKEND_API_CONTRACT.md`.
- Defined future Hermes assistant endpoints for status, result explanation, and analysis planning.
- Preserved existing API conventions: `/api/v1`, `/assistant` router prefix, `ResponseModel<T>` envelope, and authenticated backend endpoints.
- Defined request/response contracts, safety validation, size/privacy limits, normalized errors, feature flags, fallback behavior, and tool action confirmation rules.
- No backend endpoint, frontend runtime change, Hermes/LLM call, auto-run analysis, SQL generation, auto-join, or SmartAnalysis change was added.

## Phase 4B-8M: Hermes Dry-run Backend Scaffold

- Added dry-run backend endpoints under `/api/v1/assistant/hermes`.
- Added Hermes config flags with safe disabled defaults.
- Added Pydantic schemas and validation helpers for bounded result explanation and planning payloads.
- Added frontend `assistantApi` wrapper methods and Hermes types for contract testing.
- Frontend runtime behavior remains deterministic by default; `getAssistantRuntime()` still returns the rule-based runtime.
- No real Hermes/LLM provider, provider credentials, auto-run analysis, SQL generation, auto-join, dataset mutation, or SmartAnalysis change was added.

## Phase 4B-8N: Hermes Runtime Status Probe and Developer Diagnostics

- Added a non-invasive frontend Hermes status hook with 5-minute sessionStorage cache.
- AI Workbench now probes `/assistant/hermes/status` lazily when opened.
- Added a subtle header diagnostic that reports local rule mode plus Hermes disabled/dry-run/unavailable status.
- Runtime selection remains rule-based; AI Workbench does not call Hermes explain-result or plan-analysis endpoints.
- No backend changes, Hermes/LLM call, auto-run analysis, SQL generation, auto-join, dataset mutation, or SmartAnalysis change was added.

## Phase 4B-8O: HermesAssistantRuntime Dry-run Mode

- Added `assistantRuntimeConfig` with default `rule_based` provider and opt-in `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run`.
- Implemented `hermesAssistantRuntime.generateAnalysisPlan()` against the backend dry-run plan endpoint.
- Dry-run runtime sends only bounded metadata context and explicit safety flags.
- Dry-run failures or invalid responses fallback to `ruleBasedAssistantRuntime`.
- AI Workbench diagnostic now shows when Hermes dry-run runtime is explicitly selected.
- Result follow-up remains deterministic; no live Hermes/LLM call, auto-run analysis, SQL generation, auto-join, dataset mutation, or SmartAnalysis change was added.

## Phase 4B-9A: Dataset Catalog Classification & Grouped Views

- Added deterministic frontend-only dataset catalog metadata helpers.
- Datasets page now supports search across dataset names, schema fields, catalog labels, analysis tags, and upload day.
- Datasets page can group by upload day, upload week, business topic, data type, and analysis usage.
- Dataset rows show business category, data type, and analysis-use badges.
- The catalog layer is exported for future AI-safe dataset candidate narrowing.
- No Hermes/LLM call, backend persistence, dataset mutation, runtime behavior change, package change, or SmartAnalysis change was added.

## Phase 4B-9B: Dataset Catalog Planner Candidate Search

- AI Workbench now passes deterministic frontend-only Dataset Catalog metadata into assistant runtime context.
- The rule-based planner ranks dataset candidates by selected dataset, active Relationship Set scope, catalog analysis tags, business category, data type, and name/schema keywords.
- `required_datasets` now includes only selected datasets or high-confidence query-specific catalog matches.
- Lower-confidence catalog matches render as distinct candidate datasets, warnings, or assumptions.
- Descriptive/statistics prompts without a selected dataset ask the user to choose one dataset instead of requiring the whole library.
- No Hermes/LLM call, backend persistence, dataset mutation, auto-run analysis, auto-join, SQL generation, package change, or SmartAnalysis change was added.

## Phase 4B-9C: AI Workbench End-to-End QA & Polish

- Audited the full AI Workbench flow from Dataset Catalog and Relationship Sets through planner narrowing, plan cards, prefill navigation, result handoff, safe summaries, deterministic follow-up, and Hermes dry-run opt-in safety.
- Hardened plan navigation so plans with no confirmed required dataset no longer create empty prefill navigation.
- Added plan-card copy clarifying required datasets vs candidate datasets.
- Added a selected-dataset mismatch warning when a specific analysis question does not match the selected dataset's catalog signals.
- Documented known limitations and manual QA coverage in the Phase 4B-9C log.
- No Hermes/LLM call, backend persistence, dataset mutation, auto-run analysis, auto-join, SQL generation, package change, or SmartAnalysis change was added.

## Phase 4B-9D: Workbench QA Recipes & Demo Scenario Seeds

- Added `docs/qa/AI_WORKBENCH_QA_RECIPES.md` as a reusable manual QA playbook for Dataset Catalog, Relationship Sets, planner narrowing, prefill navigation, Context Panel, result handoff, result follow-up, and Hermes dry-run safety.
- Added `docs/qa/AI_WORKBENCH_DEMO_SCENARIOS.md` with concise demo scripts for forecast planning, channel conversion planning, result follow-up, and safety regression checks.
- Documented the recommended 10-dataset demo set and expected catalog classification targets.
- Updated the docs index to make `docs/qa/` discoverable for future phases.
- No product behavior, runtime behavior, backend fixture, dependency, package-file, dataset mutation, Hermes/LLM, or SmartAnalysis change was added.

## Phase 4B-10A: Analysis History Catalog Grouped Views

- Added deterministic frontend-only Analysis History Catalog metadata helpers.
- History page now supports search over analysis metadata, dataset id/name, status labels, safe summary labels, and bounded result keys.
- History page can group loaded records by created day, created week, analysis type, status, dataset, and AI-ready status.
- History rows now show compact analysis type, status, AI-ready, and dataset badges.
- Existing result dialog, export/download, delete, deep-link opening for loaded items, and AI Workbench handoff are preserved.
- Search/grouping operate over the currently loaded backend page only; no backend persistence or schema change was added.
- No Hermes/LLM call, analysis rerun, SQL generation, dataset mutation, package-file, dependency, or SmartAnalysis change was added.

## Phase 4B-10B: Workbench History Selector Alignment & Unified Searchable Selectors

- Added a dependency-free `SearchableSelect` component for single-value searchable dropdowns.
- Replaced split search+select controls in AI Workbench dataset and relationship set selectors.
- Replaced the AI Workbench Context Panel history selector with a searchable dropdown using Analysis History Catalog metadata.
- Updated Relationship Set management's active-set selector to the same searchable dropdown pattern.
- Updated shared `DatasetSelector`, so SmartProcess/preprocessing-style dataset selection now uses one searchable control.
- Preserved Datasets and History catalog page search/filter/grouping controls.
- No Hermes/LLM call, backend behavior, analysis auto-run, dataset mutation, dependency, package-file, or SmartAnalysis change was added.

## Phase 4B-10C: SearchableSelect QA & Accessibility Polish

- Hardened the shared `SearchableSelect` with Escape close, Tab close, ArrowUp/ArrowDown highlighting, and Enter selection for the highlighted option.
- Added basic combobox/listbox ARIA semantics, accessible search labeling, and `aria-selected` option state.
- Centralized dropdown close behavior so outside click, clear, selection, Escape, Tab, and trigger close reset search/highlight state.
- Improved dropdown layering, scroll bounds, highlighted option styling, and long badge/label truncation.
- Preserved all current selector usages and kept Datasets/History catalog page search controls unchanged.
- No Hermes/LLM call, backend behavior, assistant planning logic, dataset mutation, dependency, package-file, or SmartAnalysis change was added.

## Phase 4B-10D: Forecast / Path / Attribution Result-to-Workbench Handoff

- Added a shared page-level result handoff helper that builds `SafeResultSummary` and dispatches the existing AI Workbench handoff payload.
- Forecast results now expose `带到 AI 工作台` when a completed forecast or batch forecast result exists.
- PathAnalysis results now expose `带到 AI 工作台` beside CSV export and use a local Analysis-like summary source when no backend analysis id is available.
- Attribution results now preserve completed backend analysis metadata and expose `带到 AI 工作台` beside export.
- Existing History and Statistics handoff behavior remains unchanged.
- No Hermes/LLM call, automatic explanation, analysis rerun, backend change, dataset mutation, dependency, package-file, or SmartAnalysis change was added.

## Phase 4B-10E: Multi-table Analysis Dataset Builder Design

- Added `docs/design/MULTI_TABLE_ANALYSIS_DATASET_BUILDER_DESIGN.md`.
- Defined the missing bridge between Relationship Set planning and single-dataset analysis modules.
- Introduced design concepts for `JoinPlan`, `JoinStep`, and bounded `JoinPreview`.
- Proposed AI Workbench Join Builder flow: select graph, select tables, choose join relationships, choose columns, preview, confirm temp/save output, then open target analysis page.
- Proposed future backend APIs for join preview, temporary analysis datasets, and saved derived datasets.
- Documented Hermes/tool registry implications: join preview/create/save tools require explicit confirmation and must not execute silently.
- No application source, backend source, Hermes/LLM, SQL generation, join execution, dataset creation, or analysis auto-run change was added.

## Phase 4B-10F: Roadmap Consolidation and Phase 5 Planning

- Rewrote `docs/ROADMAP.md` into a forward-looking structure aligned with current project progress.
- Marked Phase 4A as completed engineering stabilization.
- Reframed Phase 4B as AI Workbench & Hermes-ready Assistant, with remaining 4B-11 Hermes live readiness/adapters.
- Moved multi-table execution into Phase 5 as the next major product layer.
- Reorganized productization/reliability into Phase 6 and advanced analytics/dashboard/reporting into Phase 7.
- Removed duplicated/outdated roadmap sections for old AI assistant planning, repeated Result Explainer entries, and immediate Dashboard/ECharts Phase 5 priority.
- No application source, backend source, Hermes/LLM, join execution, dataset creation, or product behavior change was added.

## Phase 4B-11A: Hermes Live Readiness Review

- Added `docs/design/HERMES_LIVE_READINESS_CHECKLIST.md`.
- Added `docs/phase-logs/PHASE_4B_11A_HERMES_LIVE_READINESS_REVIEW.md`.
- Audited frontend runtime provider gating, Hermes dry-run runtime fallback, backend Hermes dry-run endpoint contracts, SafeResultSummary boundaries, AI Workbench result follow-up routing, and future plan-analysis metadata boundaries.
- Confirmed the default assistant runtime remains `rule_based` and `hermes_dry_run` still requires explicit `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run`.
- Confirmed live Hermes is schema-reserved only and is not reachable by frontend runtime selection or backend dry-run implementation.
- Documented provider gating rules, fallback/rollback expectations, required future secrets/config handling, and a Hermes live risk register.
- No application source, backend source, live Hermes/LLM, secrets, joins, SQL generation, auto-run analysis, dataset mutation, or Phase 5 Join Builder implementation was added.

## Phase 4B-11B: Hermes Result Explainer Live Adapter

- Added backend live Hermes settings for `HERMES_BASE_URL`, `HERMES_AUTH_TOKEN`, `HERMES_MODEL`, and `HERMES_ASSISTANT_TIMEOUT_MS`.
- Added a live result-explanation adapter that calls the remote Hermes Agent from the backend only.
- Extended Hermes status responses with safe live availability metadata while never exposing tokens or secrets.
- Kept dry-run planning behavior unchanged; live `plan-analysis` is not implemented in this phase.
- AI Workbench result follow-up now attempts live Hermes only after the user explicitly asks about an attached SafeResultSummary and backend status reports live explain-result support.
- Deterministic `resultFollowupResponder` remains fallback for disabled, unavailable, timeout, malformed, or fallback-shaped live responses.
- Added focused backend tests for config acceptance, forbidden raw payload validation, live response parsing, and fallback behavior.
- No browser-to-Hermes direct call, raw result_data forwarding, raw dataset row forwarding, SQL generation, auto-run analysis, joins, dataset mutation, SmartAnalysis change, or Phase 5 Join Builder implementation was added.
