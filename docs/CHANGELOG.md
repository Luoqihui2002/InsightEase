# InsightEase 变更日志

## Phase 1-2：修复错误模式概念

- 修正"本地模式"与"云端模式"的概念混淆
- Upload/Datasets 统一回归后端 Dataset API
- 移除前端全局 storageMode 切换按钮
- SecurityBadge 改为纯静态架构状态展示
- `localStorageService` 标记为 legacy，主链路不再调用

## Phase 2.5：验证和封口

- 验证 Upload → Datasets → AIWorkspace 主链路完整
- 确认 DataWorkshop 在 Cloud 模式下可用但结果不保存
- 修正 MVP_SCOPE.md 中对 DataWorkshop 定位的描述
- 标记 launch blockers

## Phase 3A：Legacy 隔离

- 识别并标记所有 browser-local 代码
- 将 `browser-processing/` 模块移至 `src/legacy/` 目录
- 主链路代码不再 import legacy 模块

## Phase 3B：DataWorkshop 后端化设计

- 产出 `DATAWORKSHOP_BACKENDIZATION_PLAN.md`
- 定义 V1 支持的 7 种操作：filter、select、rename、sort、dedup、derive、sample
- 设计 preview + transform 双 API 契约
- 规划数据集版本策略（`parent_dataset_id` + `transform_chain`）

## Phase 3C：后端 Transform API

- 新增 `transform.py` endpoint
- 新增 `transform_service.py` 业务层
- 新增 `transform_executor.py` 执行层（纯 pandas）
- 新增 `schemas/transform.py` Pydantic 模型
- `Dataset` 模型新增 `parent_dataset_id` 和 `transform_chain` 字段
- 数据库 migration 执行（手动 ALTER TABLE）

## Phase 3D：DataWorkshop 前端接入

- 新增 `workshopApi.preview()` 和 `workshopApi.transform()`
- 新增 `workshop-adapter.ts` 前端操作 → 后端 Operation 映射
- `executeOperations()` 改为调用后端 preview API
- `handleSaveAsDataset()` 改为调用后端 transform API
- 移除本地数据集导入入口
- 移除引擎指示器 UI

## Phase 3E：Legacy 删除

- 删除 `DataWorkshop.tsx` 中 9 个内联 browser-side 执行函数
- 删除 `legacy/browser-processing/` 整个目录
- 删除 `DuckDBLoader.tsx`
- 移除 `@duckdb/duckdb-wasm`、`comlink`、`dexie`、`fflate` 依赖
- 清理 `vite.config.ts` 中的 DuckDB 配置

## Phase 3F：Build Gate Cleanup

- 修复 Axios 拦截器导致的类型混乱（`as any` / `as unknown as` 应急处理）
- 移除所有未使用的导入和变量
- 修复 `process.env` → `import.meta.env`
- `tsconfig.app.json` 排除测试文件
- `npx tsc --noEmit` 0 errors
- `npm run build` 生产构建成功

## Phase 3G：文档收口

- 产出 `REFACTOR_SUMMARY.md` 架构重构总结
- 完成 docs consolidation（README / CURRENT_ARCHITECTURE / CURRENT_PROGRESS / CHANGELOG / ROADMAP / API_CONTRACTS）
- 归档历史审计报告和 phase 报告
- 更新 `ARCHITECTURE_DECISIONS.md` 至 v2.0
- 浏览器端到端回归测试待人工验证

## Phase 4A-3-1 Hotfix

- **问题**: Settings 页面 shadcn `SelectItem` 传入空字符串 `value=""`，触发 Radix UI 运行时断言错误，页面崩溃。
- **修复**: `autoDeleteOptions` 中 `value: ''` 改为 `value: 'never'`，`onValueChange` 映射回 `null`，业务逻辑保持不变。
- **影响范围**: 仅 `app/src/pages/Settings.tsx`，其余页面使用原生 `<option value="">` 不受影响。
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功。

## Phase 4A-3-2: Upload 页面迁移

- `Upload.tsx` 使用 `PageShell` / `PageHeader` / `SectionCard` 重构页面骨架。
- 提取 `ScoreRing.tsx` 共享组件，替代内联 SVG 评分环。
- 简化拖拽区域视觉动画（移除持续旋转渐变）。
- 新增"清除已完成"批量操作按钮。
- 业务逻辑（上传 API、状态管理、文件解析）零改动。

## Phase 4A-3-3: History 页面迁移

- `History.tsx` 使用共享组件体系重构页面骨架（PageShell, PageHeader, ContentGrid, StatCard, SectionCard, LoadingState, ErrorState）。
- `StatCard` 新增 `valueClassName` 属性，支持自定义数值颜色。
- 空状态替换为 shadcn `<Empty>` 组件。
- 下载菜单替换为 `<DropdownMenu>`，提升移动端可用性。
- 详情弹窗替换为 `<Dialog>` + `<DialogContent>`，移除手写模态框。
- 标题国际化：`History` -> `历史记录`。
- 业务逻辑（API 调用、导出函数、状态管理）零改动。

## Phase 4A-3-4: Datasets 页面迁移

- `Datasets.tsx` 使用共享组件体系重构页面骨架（PageShell, PageHeader, ContentGrid, StatCard, SectionCard, LoadingState, ErrorState, Empty, DataTablePreview）。
- 预览表格替换为 `DataTablePreview`（展开行 + 详情弹窗）。
- 空状态替换为 shadcn `<Empty>` 组件。
- 原生 `confirm()` / `alert()` 替换为 `<AlertDialog>` + `toast`。
- 详情弹窗缩小为 `max-w-4xl max-h-[80vh]`。
- 底部上传区域简化为"去上传数据"快捷按钮。
- 表格密度优化为 `py-3 px-3`。
- 标题国际化：`Datasets` -> `数据集`。
- 业务逻辑（API 调用、删除、重命名、下载、预览）零改动。

## Phase 4A-3-5: Dashboard 页面迁移

- `Dashboard.tsx` 使用共享组件体系重构页面骨架（PageShell, PageHeader, StatCard, ChartCard, SectionCard, LoadingState, ErrorState, Empty, Dialog）。
- 概览统计卡片使用共享 `StatCard` 替代本地组件。
- 概览图表使用共享 `ChartCard` 替代手写 Card 包装。
- 底部快捷操作和最近活动使用 `SectionCard` 替代手写 Card。
- 自定义看板空状态替换为 shadcn `<Empty>` 组件。
- WidgetSelector 弹窗替换为 `<Dialog>` + `<DialogContent>`。
- 标题国际化：`Dashboard` -> `看板`。
- 图表业务逻辑、ECharts 配置、gsap 动画、看板状态管理零改动。

## Phase 4A-3-6: Visualization 页面迁移

- `Visualization.tsx` 使用共享组件体系重构页面骨架（PageShell, PageHeader, SidePanel, ResultPanel, ChartCard, SectionCard, LoadingState, Empty）。
- 左侧配置面板替换为 `SidePanel`，右侧图表区域替换为 `ResultPanel` + `ChartCard`。
- 空状态替换为 shadcn `<Empty>` 组件（未选数据集、字段未配置）。
- 数据加载状态替换为 `<LoadingState>`。
- 底部推荐和字段概览替换为 `SectionCard`。
- 按钮层级调整：`保存到看板` 为主操作，`下载图表` 为次操作。
- 图表类型网格增加响应式：`grid-cols-2 sm:grid-cols-3`。
- 标题国际化：`Visualization` -> `可视化分析`。
- 图表业务逻辑、ECharts 配置、字段推断、智能推荐、聚类分析零改动。

## Phase 4A-3-7: Analysis Pages Template Audit

- 审计 9 个分析页面，识别统一布局模式（标题栏 → 数据集选择器 → 2-col 网格 → 底部区块）。
- 设计 7 个分析专用共享组件（AnalysisPageShell, AnalysisConfigPanel, AnalysisResultPanel, AnalysisActionBar, AnalysisEmptyState, AnalysisResultSummary, AnalysisPollingOverlay）。
- 制定按风险升序的页面迁移计划：Low (Semantic, Clustering) → Medium (Statistics, Attribution, SmartProcess, GoalPlanner) → High (Forecast, PathAnalysis, SmartAnalysis)。
- SmartAnalysis 为向导模式，不套用标准 2-col 模板，计划 Phase 4A-5 独立重构。
- 产出 `docs/ANALYSIS_PAGES_TEMPLATE.md` 和阶段日志。本阶段未修改代码。

## Phase 4A-4-0: Analysis Template Components

- 在 `app/src/components/analysis/` 下新建 7 个分析页面模板共享组件 + `index.ts` 轻量 re-export。
- `AnalysisPageShell`: 封装 `PageShell` + `PageHeader`，提供分析页面标准标题区。
- `AnalysisConfigPanel`: 基于 `SidePanel`，左侧配置面板，支持标题、图标、底部操作区。
- `AnalysisResultPanel`: 基于 `ResultPanel`，通用结果面板，支持 chart/table/JSON/download/empty/loading/polling 及自定义操作。
- `AnalysisActionBar`: 导出按钮组（CSV/JSON/Excel/Download），纯回调，无业务逻辑。
- `AnalysisEmptyState`: 基于 shadcn `<Empty>`，提供 `no-dataset` / `no-result` / `no-config` / `custom` 四种预设。
- `AnalysisResultSummary`: 基于 `ContentGrid` + `StatCard`，数值摘要卡片网格（2/3/4 列）。
- `AnalysisPollingOverlay`: 轮询状态指示器，支持 pending/running/completed/failed + 可选进度条。
- 零页面修改、零后端修改、零新依赖。`tsc --noEmit` 0 errors，`npm run build` 成功。

## Phase 4A-4-1: Semantic + Clustering Pages Migration

- `Semantic.tsx` 和 `Clustering.tsx` 迁移到分析模板组件体系。
- 根布局替换为 `AnalysisPageShell`（标准标题区）。
- 左侧配置面板替换为 `AnalysisConfigPanel`（基于 `SidePanel`），分析按钮移至 footer。
- 右侧结果面板替换为 `AnalysisResultPanel`（基于 `ResultPanel`），支持 loading/empty/result 状态自动切换。
- 导出按钮替换为 `AnalysisActionBar`。
- 所有业务逻辑（数据集选择、特征列选择、K 值、API 调用、轮询、gsap 动画）零改动。
- 零原生 `<select>` 替换。无 `SelectItem value=""`。

## Phase 4A-4-2: Statistics + Attribution Pages Migration

- `Statistics.tsx` 和 `Attribution.tsx` 迁移到分析模板组件体系。
- 根布局替换为 `AnalysisPageShell`。
- 左侧配置面板替换为 `AnalysisConfigPanel`，分析按钮移至 footer。
- 右侧结果面板替换为 `AnalysisResultPanel`，支持 loading/empty/result 状态自动切换。
- 导出按钮替换为 `AnalysisActionBar`。
- Attribution 的 ECharts 图表生命周期（`chartRef`、`chartInstance`、`renderComparisonChart`）零改动。
- 汇总统计卡片、模型结果卡片、对比表格等结果内容零改动。
- 所有业务逻辑（数据集选择、列选择、归因模型配置、API 调用、轮询、gsap 动画、CSV 导出）零改动。

## Phase 4A-4-3: SmartProcess + GoalPlanner Pages Migration

- `SmartProcess.tsx` 迁移到分析模板组件体系（`AnalysisPageShell` + `AnalysisConfigPanel` + `AnalysisResultPanel` + `AnalysisActionBar`）。
- `GoalPlanner.tsx` 使用 `AnalysisPageShell` 替换标题栏，保留自定义 `grid grid-cols-1 lg:grid-cols-3` 布局，不强制套用 2-col 模板。
- 移除所有 `glass` 毛玻璃类，替换为标准 `bg-[var(--bg-secondary)]`。
- 移除可折叠配置面板行为。
- 所有业务逻辑（预处理配置、漏斗模板、目标拆解、localStorage、预测对比、gsap 动画）零改动。

## Phase 4A-4-4: Forecast Page Migration

- `Forecast.tsx` 迁移到分析模板组件体系。
- 根布局替换为 `AnalysisPageShell`（标准标题区）。
- 左侧配置面板替换为 `AnalysisConfigPanel`，分析按钮移至 footer。
- 右侧结果区保留自定义 `Card` 结构（预测结果 / 批量预测结果 / 预测分解 / 大促影响 / What-if / AI 解读），不强制套用 `AnalysisResultPanel` 以避免双层标题冗余。
- 移除所有 `glass` 毛玻璃类。
- 移除可折叠配置面板行为（`isConfigOpen` 状态、`ChevronUp`/`ChevronDown`）。
- 布局从 `grid grid-cols-3` 切换为 `flex flex-col lg:flex-row gap-6`，与模板组件体系保持一致。
- 所有业务逻辑（数据集加载、 Prophet/LightGBM/SARIMA 模型选择、批量预测、大促日历、What-if 分析、营销日历导入、localStorage 写入、CSV 导出、gsap 动画）零改动。

## Hotfix: Duplicate Forecast Start Button

- 修复 Phase 4A-4-4 迁移残留：配置面板底部出现两个相同的 "启动预测" 按钮。
- 删除原内联按钮块，仅保留 `AnalysisConfigPanel` `footer` 中的按钮。
- 纯 UI 修复，零业务逻辑影响。

## Phase 4A-4-5: PathAnalysis Page Migration

- `PathAnalysis.tsx` 迁移到分析模板组件体系。
- 根布局替换为 `AnalysisPageShell`（标准标题区）。
- 左侧配置面板替换为 `AnalysisConfigPanel`，分析按钮和"重新配置"按钮移至 footer。
- 右侧结果区保留自定义 `Card` 结构（漏斗分析、路径分析、路径聚类、关键路径、序列模式），不强制套用 `AnalysisResultPanel` 以避免双层标题冗余。
- 移除所有 `glass` 毛玻璃类（31 处）。
- 移除可折叠配置面板行为（`showConfig` 状态、`ChevronUp`/`ChevronDown`）。
- 布局从 `grid grid-cols-4` 切换为 `flex flex-col lg:flex-row gap-6`。
- 所有业务逻辑（5 种分析类型切换、数据集加载、列选择、ECharts 图表渲染、`AssociationRuleGraph` 子组件、CSV/图表导出、API 调用）零改动。

## Phase 4A-4-6: Analysis Migration Closure & Complex Pages Plan

- Phase 4A-4 分析页面迁移正式收官。
- 8 个分析页面已完成迁移（Semantic、Clustering、Statistics、Attribution、SmartProcess、GoalPlanner、Forecast、PathAnalysis）。
- 产出 `docs/PHASE_4A_ANALYSIS_MIGRATION_CLOSURE.md`：
  - 迁移总结表
  - 已验证共享组件清单（`AnalysisPageShell`、`AnalysisConfigPanel`、`AnalysisResultPanel`、`AnalysisActionBar`、`AnalysisEmptyState` 已验证；`AnalysisResultSummary`、`AnalysisPollingOverlay` 已实现但未使用）
  - 技术债分类（Phase 4A-5 交互清理、Phase 4A-6 视觉优化、工程优化）
  - SmartAnalysis / AIWorkspace / DataWorkshop 分阶段计划
- 建议下一Phase：4A-5 交互一致性治理。
- 零代码修改。

## Phase 4A-5-2: Low-Risk Static Selects & Switches

- SmartProcess: 5 个静态 enum select（缺失值/重复值/异常值/异常值方法/标准化）→ shadcn `Select`
- Dashboard: 自定义 view tab 按钮（概览/自定义看板）→ shadcn `Tabs`
- Forecast: 批量预测模式自定义按钮 → shadcn `Switch`
- GoalPlanner: 动态 funnel level 选择器，非静态 select，推迟到 4A-5-3
- 所有状态值、onChange 行为、选项标签完全保留
- 零业务逻辑变更
- `tsc --noEmit` 0 errors，`npm run build` built in 23.85s ✅

## Phase 4A-5-1: Interaction Cleanup Audit

- 审计 15 个页面的交互不一致问题。
- 发现 42 个 native `<select>`（11 个页面）、18 个手写 toggle/button 模式、11 个 native `<table>`。
- 0 个 `alert()` / `confirm()`，0 个 `SelectItem value=""`。
- 产出 `docs/INTERACTION_CLEANUP_AUDIT.md`：
  - native select 清单（按风险分级：Low/Medium/High）
  - sentinel value 映射表（`value=""` → `none`/`auto`）
  - 手写 toggle/button 清单
  - native table 清单
  - 推荐实施顺序（4A-5-2 → 4A-5-3 → 4A-5-4 → 4A-5-5）
- DataWorkshop (17 selects) 和 AIWorkspace 推迟到各自专属阶段。
- 零代码修改。
