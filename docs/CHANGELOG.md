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

## Phase 4B-3: Static Dataset Understanding UI

- **目标**: 构建第一个可见的 AI Data Assistant 功能：静态数据集理解卡片。
- **新增文件**:
  - `app/src/components/assistant/DatasetUnderstandingCard.tsx` — 数据集理解主组件
- **修改文件**:
  - `app/src/pages/Datasets.tsx` — 在数据集详情对话框集成理解卡片
- **功能**:
  - 调用 `assistantApi.profileDataset(datasetId)` 获取画像
  - 表类型推断、置信度、证据、推荐分析
  - 数据质量警告、字段角色/语义类型分布
  - 关键字段分组、字段详情表格（默认 20 行，可展开）
  - 加载/错误/空状态 + 刷新按钮
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功。

## Phase 4B-2B: Dataset Profile API Contract Smoke Test & Casing Fix

- **目标**: 验证并稳定后端画像端点与前端的 API 契约，解决 snake_case / camelCase 不匹配。
- **检查内容**:
  - 后端 `ResponseModel` 包装：`{ code, message, data }`
  - 后端服务返回 snake_case 键名
  - 前端 axios 拦截器直接返回 `response.data`
  - 现有前端类型（`Dataset`, `Analysis`, `FieldSchema`）均使用 snake_case
- **决策**: `app/src/types/assistant.ts` 统一改为 snake_case，与后端输出和项目约定一致
- **修改文件**:
  - `app/src/types/assistant.ts` — 全部字段改为 snake_case
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功，后端 `compileall` 通过。

## Phase 4B-2: Dataset Profile Contract + Metadata Service

- **目标**: 实现 AI 助手第一层契约：确定性、非 LLM、元数据优先的数据集画像服务。
- **新增文件**:
  - `app/src/types/assistant.ts` — 前端契约：`ColumnRole`, `SemanticType`, `TableType`, `ColumnProfile`, `TableClassification`, `DatasetProfile`
  - `app/src/api/assistant.ts` — 前端 API 客户端：`assistantApi.profileDataset()`
  - `insightease-backend/app/services/assistant_profile_service.py` — 后端画像服务（启发式规则）
  - `insightease-backend/app/api/v1/endpoints/assistant.py` — 端点 `POST /assistant/profile-dataset`
- **修改文件**:
  - `insightease-backend/app/api/v1/api.py` — 注册 assistant router
- **实现要点**:
  - 字段角色检测：基于列名模式、dtype、唯一值率、空值率的确定性启发式
  - 表分类：基于角色组合推断业务实体类型（user/order/event_log/experiment 等）
  - 质量警告：行数/列数/缺失率/常数列/唯一值异常
  - 复用 Phase 4A-6-22 的 `normalize_missing_values` 统一识别字符串缺失 token
  - 只读：不修改源数据集、不创建新数据集
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功，后端 `compileall` 通过。

## Phase 4B-1: AI Data Assistant Design

- **目标**: 设计 InsightEase AI Data Assistant 的产品形态和架构。
- **新增文件**:
  - `docs/design/AI_DATA_ASSISTANT_DESIGN.md` — 产品问题定义、目标、用户场景、6 个能力模块、元数据契约、表分类/关系/分析计划契约、集成策略、安全隐私、Hermes Agent 定位、6 阶段实施路线图
- **设计要点**:
  - 6 个能力模块：Dataset Profiler、Table Classifier、Column Role Detector、Relationship Inference Engine、Analysis Planner、Result Explainer
  - 核心契约：`DatasetProfile`、`ColumnProfile`、`TableClassification`、`TableRelationship`、`AssistantAnalysisPlan`
  - 集成现有模块：推荐映射到 Statistics / Semantic / PathAnalysis / Forecast / Attribution / SmartProcess，支持预填充配置
  - 安全：元数据优先、样本行显式 opt-in、推断关系需确认、禁止自动修改数据
  - 路线图：4B-2 元数据服务 → 4B-3 静态 UI → 4B-4 Mock 面板 → 4B-5 Mock 计划 → 4B-6 AI 集成 → 4B-7 结果解释器
- **零代码变更**: 纯文档阶段

## Phase 4A-6-22: Critical QA Bug Triage

- **目标**: 修复手动 QA 发现的预处理自动保存缺陷和路径聚类超时问题。
- **修改文件**:
  - `insightease-backend/app/api/v1/endpoints/analysis.py` — `normalize_missing_values()` 规范化字符串缺失 token；`smart_process` 新增 `preview_only` 模式
  - `insightease-backend/app/services/path_analysis_service.py` — 路径聚类增加 `max_sessions=1000` 采样上限；修复 `combined_entropy` 计算 bug
  - `app/src/pages/SmartProcess.tsx` — 主按钮改为"预览处理"，预览后显示"保存结果"，UI 区分预览/已保存状态
- **修复要点**:
  - 缺失值 token 列表：`null`, `NULL`, `NaN`, `nan`, `N/A`, `NA`, `-`, `unknown`, `无`, `缺失` 等统一替换为 `pd.NA`
  - 预览模式：后端仅返回统计，不写文件、不创建 Dataset 记录
  - 保存模式：后端执行完整处理并持久化
  - 聚类采样：超过 1000 用户时随机采样并返回警告
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功。

## Phase 4A-6-21: Manual QA Test Dataset Pack

- **目标**: 创建稳定的手动 QA 测试数据集包，覆盖端到端功能验证。
- **新增文件**:
  - `manual-test-data/scripts/generate_manual_test_data.py` — Python 标准库生成脚本，固定随机种子，UTF-8 输出
  - `manual-test-data/README.md` — 数据集说明与推荐测试顺序
  - `manual-test-data/qa-checklist.md` — 功能域 QA 检查清单
  - `manual-test-data/csv/01_users.csv` ~ `10_data_quality_edge_cases.csv` — 10 个 CSV 数据集
- **数据集覆盖**: Statistics / Semantic / Forecast / Attribution / PathAnalysis / A/B 实验 / 回归 / 数据质量 / 多表关系
- **设计要点**: 关联表共享外键、确定性漏斗事件、~35% 归因转化率、周季节性 + 促销 + 节假日时间序列、中英文评论混合、数据质量边界场景
- **零应用代码修改**: 未修改任何前端/后端源代码，未修改 package 文件

## Phase 4A-6-20: Attribution Chart Migration

- **目标**: 将 Attribution 页面对比柱状图从页面级 ECharts 迁移进 `ResultView`。
- **修改文件**:
  - `app/src/lib/adapters/attributionResultAdapter.ts` — 添加真实 `bar` chart block，将嵌套 `models` 数据扁平化为 `{ touchpoint, [modelKey]: percentage }` 行，映射模型 key 为中文显示名
  - `app/src/pages/Attribution.tsx` — 移除 `chartRef`、`chartInstance`、`renderComparisonChart()`、图表 `useEffect`、图表 `<Card>` JSX；清理未使用导入 (`echarts`、`getChartColors`、`withAlpha`、`Card` 系列)
- **架构对齐**: Attribution 图表现在走 `ResultView → ResultChartRenderer → BaseEChart → buildChartOption("bar")`，与 Forecast line chart 迁移模式一致
- **验证**: `tsc --noEmit` 0 errors，`npm run build` 成功。

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

## Phase 4A-5-3: Dynamic Column Selects with Sentinel Mapping

- 6 个页面的 16 个动态原生 `<select>` 替换为 shadcn `Select`
- Attribution: 5 个列选择器（userIdCol, touchpointCol, timestampCol, conversionCol, conversionValueCol），哨兵 `none` → `""`
- Statistics: 1 个分析列选择器（selectedColumn），`"all"` 直接透传，无哨兵
- Forecast: 2 个列选择器（dateColumn, valueColumn），哨兵 `auto` → `""`
- PathAnalysis: 3 个列选择器（userIdCol, eventCol, timestampCol），哨兵 `auto` → `""`
- Visualization: 4 个字段选择器（xAxis, yAxis, colorBy, aggregation），x/y 哨兵 `none` → `""`，colorBy 哨兵 `none` → `undefined`
- GoalPlanner: 1 个目标层级选择器（targetLevelId），哨兵 `none` → `""`
- 4 个页面的原生 `<optgroup>` 替换为 `SelectGroup` + `SelectLabel`
- 所有状态值、API  payload、onChange 行为完全保留
- 零业务逻辑变更
- `tsc --noEmit` 0 errors，`npm run build` built in 29.80s ✅

## Phase 4A-5-4: ToggleGroup / Checkbox / Button Cleanup

- Forecast: 模型选择器（Prophet/LightGBM/SARIMA）→ `ToggleGroup`；批量预测/大促/辅助变量复选框 → `Checkbox`
- PathAnalysis: 5 种分析类型选择器（漏斗/路径/聚类/关键路径/序列模式）→ `ToggleGroup`；4 组复选框 → `Checkbox`
- GoalPlanner: 拆解方式选择器（线性/季节性/动量/自定义）→ `ToggleGroup`
- GoalPlanner 模板按钮和月份标签：保持自定义（action 按钮 / filter chips）
- 所有状态值、onChange 行为、选项标签完全保留
- 零业务逻辑变更
- `tsc --noEmit` 0 errors，`npm run build` built in 21.32s ✅

## Phase 4A-5-5: Table & Dialog Cleanup

- History: `renderResultPreview` 详情预览原生表 → `DataTablePreview`（保留对象→JSON和50字符截断预处理器）
- History 主分析列表：保持原生（富单元格：图标、按钮、条件颜色）
- Attribution 模型对比表：保持原生（有意义的视觉颜色编码：百分比高亮）
- 全库无手写 `fixed inset-0` 模态框
- History 详情弹窗已使用 shadcn `Dialog`，无需改动
- 零业务逻辑变更
- `tsc --noEmit` 0 errors，`npm run build` built in 20.50s ✅

## Phase 4A-5-6: Interaction Cleanup Closure

- Phase 4A-5 交互一致性治理正式收官
- 5 个子阶段全部完成：审计 → 静态选择器 → 动态选择器 → ToggleGroup/Checkbox → 表格/弹窗
- 29 个控件替换完成，零业务逻辑变更
- 产出 `docs/PHASE_4A_INTERACTION_CLEANUP_CLOSURE.md`：标准化组件清单、哨兵映射规则、推迟项分配、ResultTable 设计建议、4A-6 推荐
- 明确排除项：DataWorkshop → 4C，SmartAnalysis/AIWorkspace → 4B，复杂结果表 → ResultTable 设计
- 零代码变更（纯文档阶段）

## Phase 4A-6-1: Visual System / Style Audit

- 视觉系统全面审计完成
- 产出 `docs/VISUAL_SYSTEM_AUDIT.md`：shadcn 兼容性、卡片密度、按钮层级、glass、ECharts 颜色、空状态、包体积、ResultTable
- 关键发现：
  - 101 处 shadcn 语义 token 与自定义暗色主题不匹配
  - 按钮层级倒置（主操作多用 outline/ghost）
  - glass 类过度使用（30 处）
  - ECharts 137 处硬编码 hex，主题切换不跟随
  - JS chunk ~3.4MB，无 manualChunks
- 推荐实施顺序：4A-6-2 → 4A-6-3 → 4A-6-4 → 4A-6-5 → 4A-6-6 → 4A-6-7
- 零源码变更（纯审计阶段）

## Phase 4A-6-2: Shared Component Visual Refinement

- `index.css` 新增 9 个状态色 token：`--status-error/*`、`--status-success/*`、`--status-warning/*`
- `ErrorState.tsx`：Tailwind `red-500` 替换为项目 `--status-error/*` token
- `SuccessState.tsx`：Tailwind `emerald-500` 替换为项目 `--status-success/*` token
- `empty.tsx`：`text-muted-foreground` 替换为 `text-[var(--text-secondary)]`，标题对齐 `--text-primary`
- `SectionCard.tsx` 新增 `density` prop（compact/default/spacious），默认 backward-compatible
- `layout/index.ts` 补全 `SectionCard` 导出
- 零业务逻辑变更，零 API 变更

## Phase 4A-6-4: Chart Color Token Foundation + Low-risk Migration

- 新增 `app/src/hooks/useChartColors.ts`：`getChartColors()` 纯函数 + `useChartColors()` Hook（MutationObserver 监听主题切换），所有 token 带安全 fallback
- `Visualization.tsx`：移除 `CHART_COLORS` 常量，迁移至 `getChartColors()`；替换 `#94a3b8`/`#e2e8f0`/`#0a0e27` 为对应 token
- `Dashboard.tsx`：移除 `COLORS` 常量，迁移至 `getChartColors()`；所有颜色引用替换为 token
- 保留 `#fff`（意图性白色）和 `rgba` 透明度衍生值（无对应 CSS 变量）
- PathAnalysis / Attribution / Forecast 图表颜色推迟到 4A-6-5
- 零业务逻辑变更，零 API 变更

## Phase 4A-6-5: Complex Chart Color Migration

- `useChartColors.ts` 新增 `withAlpha()` 辅助函数（hex → rgba）
- `Attribution.tsx`：图表 option 颜色（tooltip、轴线、legend）迁移至 token，保留模型语义色
- `PathAnalysis.tsx`：漏斗/桑基/网络图/关联规则图颜色全部迁移至 token
- `Forecast.tsx`：无 ECharts 使用，已使用 CSS 变量，零变更
- 零业务逻辑变更，零 API 变更

## Phase 4A-6-5.1: PathAnalysis Control Layout + Checkbox Visibility Hotfix

- `PathAnalysis.tsx`：分析类型 ToggleGroup 布局改为响应式 2-col → 3-col 网格（gap-3），解决 5 选项拥挤问题
- `checkbox.tsx`：未选中边框从 `border-input` 改为 `border-slate-400/40`，提升暗色背景可见性
- 零业务逻辑变更

## Phase 4A-6-5.2: PathAnalysis Analysis Type Grid Layout Hotfix

- `PathAnalysis.tsx`：分析类型 ToggleGroup 改为 `grid w-full grid-cols-2 gap-2`
- `ToggleGroupItem` 改为 `w-full justify-start h-14`，移除 `flex-col items-center` 收缩行为
- 零业务逻辑变更

## Phase 4A-6-19: Forecast Chart Migration

- `forecastResultAdapter.ts` 更新 chart block：
  - 动态构建 `yKeys`：根据数据存在性包含 `actual`/`forecast`/`lower`/`upper`
  - 预览子集从 50 行扩大到 100 行
  - Forecast 图表块由 placeholder 转为真实 line chart（通过 4A-6-18 的 `ResultChartRenderer`）
- 第一个真实页面图表迁移
- Attribution 和 PathAnalysis 图表保持原样
- 零后端/API 修改、零 package 修改

## Phase 4A-6-18: Basic ResultChartRenderer Implementation

- 新增 `ResultChartRenderer.tsx` — 主图表渲染器，支持 line/bar/area
- 新增 `charts/BaseEChart.tsx` — ECharts 生命周期包装器（init/setOption/dispose/resize）
- 新增 `charts/buildChartOption.ts` — line/bar/area option 构建器，应用主题色
- 新增 `charts/chartTypes.ts` — 支持的图表类型注册表
- `ResultView.tsx` 图表块由 placeholder 改为 `ResultChartRenderer`
- `types/result.ts` 增加 `"area"` 到 `chartType` union
- 不支持的类型（funnel/sankey/graph/scatter 等）渲染安全 placeholder
- 未迁移任何页面图表
- 零后端/API 修改、零 package 修改

## Phase 4A-6-17: ResultChartRenderer Design Document

- 创建 `docs/design/RESULT_CHART_RENDERER_DESIGN.md`
- 盘点 6 处现有图表使用：Attribution bar、Forecast line placeholder、PathAnalysis funnel/sankey/graph/association-rule
- 评估 `ResultChartBlock` schema 充足性，提出 `encoding`/`axes`/`rendererHint` 等扩展建议
- 定义三级图表优先级：P0 line/bar/area → P1 scatter/histogram/pie → P2 funnel/sankey/graph
- 提出渲染架构：`ResultChartRenderer` → `buildChartOption` → `BaseEChart`
- 定义 ECharts 生命周期安全要求
- 包体积策略：复用现有 ECharts (`vendor-echarts` ~1,561 kB)，不新增依赖
- 迁移策略：Forecast 优先 → Attribution 次之 → PathAnalysis graph 延后
- 纯文档阶段，未修改任何源代码、adapter、package 文件

## Phase 4A-6-16: PathAnalysis ResultView UI Cleanup

- `PathAnalysis.tsx` 清理重复 UI：
  - 移除 Funnel 旧 metric cards（3 个）+ 步骤详情 HTML table
  - 移除 Path 旧 metric cards（3 个）+ 节点详情 card grid
  - 移除 Sequence Mining 旧 metric cards（4 个）+ 关联规则 HTML table
  - 移除 Clustering 旧 metric cards（2 个）
  - 移除 Key Path 旧 metric cards（3 个）
- 保留所有 ECharts 图表、循环警告、视觉路径展示、最优路径卡片、聚类保存按钮、聚类卡片、导出工具栏
- 清理未使用导入 `Users`
- 零后端/API 修改、零 package 修改

## Phase 4A-6-15: ResultView Rollout to PathAnalysis Page

- 新增 `app/src/lib/adapters/pathAnalysisResultAdapter.ts` — PathAnalysis 结果 → `AnalysisResult`
- `PathAnalysis.tsx` 接入 `ResultView`：
  - ResultView 渲染在结果区顶部
  - 保留所有 ECharts 图表：漏斗图、桑基图、力导向网络图、关联规则图
  - 保留特殊 UI：循环警告、视觉路径展示、最优路径卡片、聚类保存按钮、聚类卡片
  - 保留导出工具栏（CSV + 图表下载）
- 适配器支持 5 种分析类型：funnel、path、clustering、key_path、sequence_mining
- 每个类型独立转换器：summary + metric + table(s) + warning + AI text
- 路径数组通过 `formatPath` 转换为 " → " 分隔字符串用于表格显示
- 图表占位：不 emit（页面已存在多个真实 ECharts 图表）
- 防御性处理：safeNumber、safeString、safeArray、formatPath
- 零后端/API 修改、零 package 修改

## Phase 4A-6-14: ResultView Rollout to Forecast Page

- 新增 `app/src/lib/adapters/forecastResultAdapter.ts` — Forecast 结果 → `AnalysisResult`
- `Forecast.tsx` 接入 `ResultView`：
  - 替换 single forecast 的 metric cards、decomposition card、promotion impact card、AI summary
  - 替换 batch forecast 的汇总统计和 SKU 列表
  - 保留错误诊断显示（rich diagnostics + sample data collapsibles）
  - 保留 What-if 分析结果（交互性强，暂不适合 AnalysisResult）
  - 保留导出 CSV 按钮
- 适配器支持单预测 + 批量预测自动检测
- 支持两种 forecast 数据格式：并行数组和点对象数组
- 图表占位：emit line chart placeholder（Forecast 页面原本无真实 ECharts 图表）
- 防御性处理：safeNumber、safeString、Array.isArray、typeof 守卫
- 零后端/API 修改、零 package 修改

## Phase 4A-6-13: Chart Placeholder Policy & Attribution Cleanup

- 从 `attributionResultAdapter.ts` 移除 chart placeholder block
- 避免 Attribution 页面同时显示图表占位卡片和真实 ECharts 图表
- 定义保守策略：页面已在 ResultView 外渲染真实图表时，适配器不再 emit chart placeholder
- ResultView 通用 chart placeholder fallback 仍保留供未来页面使用
- 零后端/API 修改、零 package 修改

## Phase 4A-6-12: ResultView Rollout to Attribution Page

- 新增 `app/src/lib/adapters/attributionResultAdapter.ts` — Attribution 结果 → `AnalysisResult`
- `Attribution.tsx` 接入 `ResultView`：
  - 替换 metric cards + model cards + comparison table
  - 保留 ECharts 对比图表（页面级渲染，未来迁移至 ResultView）
- 适配器产出：summary + metric + 2 个 table + ~~chart placeholder~~ + warning blocks
- 嵌套 `models` 对象扁平化为表格行（模型 × 触点 × 占比）
- `summary.model_comparison` 转换为 Top3 对比表
- 防御性处理：typeof 守卫、Object.keys 校验、稳定 ID
- 导出行为保持不变 (`handleExportCSV` 仍读取原始 `analysisResult`)
- 零后端/API 修改、零 package 修改

## Phase 4A-6-11: ResultView Rollout to Semantic Page

- 新增 `app/src/lib/adapters/semanticResultAdapter.ts` — Semantic (comprehensive) 结果 → `AnalysisResult`
- `Semantic.tsx` 接入 `ResultView`：
  - 替换原有的字段语义卡片列表（含 per-column badges、数值/分类统计内联卡片）
  - 移除 `Tag` 和 `Sparkles` 图标导入
- 适配器产出：summary + metric + table + text + warning blocks
- 表格包含 13 列，支持 `top_values` (string[]) → "常见值" 字符串转换
- 防御性处理：Array.isArray、typeof 守卫、稳定 ID
- 导出行为保持不变 (`handleExportJSON` 仍读取原始 `analysisResult`)
- 零后端/API 修改、零 package 修改

## Phase 4A-6-10: Statistics ResultView QA & Polish

- 增强 `statisticsResultAdapter.ts` 安全性：
  - 稳定 ID: `Date.now()` → `datasetInfo.id + selectedColumn`
  - 所有数值字段增加 `typeof` 类型守卫
  - `column_stats` 增加 `Array.isArray` 校验
  - `highNullColumns` 过滤增加数值类型检查
- AI 解读从 `Statistics.tsx` 独立 JSX 移入适配器，作为 `ResultTextBlock` 统一渲染
- 空结果提示优化: "无法解析分析结果" → "分析完成，但未返回统计数据"
- 移除未使用的 `Sparkles` 导入
- 导出行为保持不变 (`handleExportCSV` 仍读取原始 `column_stats`)
- 零后端/API 修改、零 package 修改

## Phase 4A-6-9: Integrate ResultView with Statistics Page

- 新增 `app/src/lib/adapters/statisticsResultAdapter.ts` — Statistics 结果 → `AnalysisResult` 适配器
- `Statistics.tsx` 接入 `ResultView`：
  - 替换原有的 `renderStatsResult()` 卡片渲染
  - 保留 AI 解读区块
  - 移除已弃用的 `Card` 导入和 `BarChart3` 图标
- 适配器产出：summary + metric + table + warning blocks
- 空值率 > 10% 自动生成 warning block，> 50% 升级为 critical
- 零后端/API 修改、零 package 修改

## Phase 4A-6-8: Result Schema + Mock ResultView Skeleton

- 新增 `app/src/types/result.ts` — `AnalysisResult` 共享 schema + 6 种 `ResultBlock` + Column Contract + `ResultDiagnostics`
- 新增 `app/src/lib/resultFormatters.ts` — 格式化工具：数值、百分比、p-value、货币、日期、布尔、null 值
- 新增 `app/src/mocks/mockAnalysisResults.ts` — 3 个 mock payload（描述统计、A/B 测试、回归分析）
- 新增 `app/src/components/results/` 组件套件：
  - `ResultView` — 主编排器（header + status + block dispatcher + diagnostics）
  - `ResultTableRenderer` — 表格渲染（含 p-value 高亮、空状态、footnotes）
  - `ResultMetricBlock` — 指标卡片网格
  - `ResultSummaryBlock` — 摘要文本
  - `ResultWarningBlock` — 警告横幅
  - `ResultTextBlock` — 文本块（支持 collapsible）
- 图表块仅渲染占位卡片，未知块类型安全降级
- 零后端/API 修改、零 package 修改

## Phase 4A-6-7: ResultTable Design Document

- 产出 `docs/design/RESULT_TABLE_DESIGN.md` — 分析结果统一渲染设计文档
- 定义 `AnalysisResult` 顶层 schema 与 6 种 `ResultBlock` 类型（summary / metric / table / chart / text / warning）
- 定义 Table Column Contract，含 `semanticRole` 语义角色（dimension / metric / p_value / confidence_interval 等）
- 定义格式化规则（数值、百分比、p-value、货币、日期、null 值）
- 提供 3 个示例 payload：描述统计、A/B 测试、回归分析
- 定义 8 阶段实施路线图（schema → ResultView → ResultTable → mock → 单页集成 → 全 rollout）
- 零代码变更、零组件实现、零 API 修改

## Phase 4A-6-6B: Bundle Size Triage

- `vite.config.ts`: 新增 `build.rollupOptions.output.manualChunks`，拆分 vendor chunk
  - `vendor-echarts`: echarts + zrender (~1,561 kB)
  - `vendor-radix`: @radix-ui/* (~133 kB)
  - `vendor-export`: xlsx (~424 kB)
  - `vendor-animation`: framer-motion + gsap (~202 kB)
- 最大单 chunk: 3,396.60 kB → 1,561.26 kB (-54%)
- 主 app chunk: 3,396.60 kB → 1,061.24 kB (-69%)
- 总 JS 体积基本不变 (~3,381 kB)，仅重新分配
- 零页面代码修改、零 package 修改、无 circular chunk 警告

## Phase 4A-6-3: Page-Level Spacing and Density Pass

- `Attribution.tsx`：移除 7 处 `glass`（汇总统计、对比图表、模型结果、对比表）→ `bg-[var(--bg-secondary)]`
- `Statistics.tsx`：移除 1 处 `glass`（列统计结果卡）→ `bg-[var(--bg-secondary)]`
- `SmartAnalysis.tsx`：移除 6 处 `glass`（配置、空状态、诊断、预处理、推荐、结果）→ `bg-[var(--bg-secondary)]`
- `Profile.tsx`：移除 10 处 `glass`（标题、头像、账户、统计、表单、安全）→ `bg-[var(--bg-secondary)]`
- `Dashboard.tsx`：保留 widget 卡片 `glass`（故意抬高的视觉组件）
- `GoalPlanner.tsx`：无 glass，padding 模式已合理，未改动
- 零业务逻辑变更，零 API 变更

## Phase 4A-6-6A: Button Hierarchy Cleanup

- `Forecast.tsx` / `PathAnalysis.tsx` / `SmartProcess.tsx` / `GoalPlanner.tsx`：4 个主操作按钮从自定义 `<button>` 或自定义 className → `<Button variant="default">`
- `Datasets.tsx` / `History.tsx` / `Dashboard.tsx`：3 个删除操作从 `variant="ghost"` + neon-pink → `variant="destructive"`
- `Dashboard.tsx` / `History.tsx`：11 个 icon-only 按钮从自定义 `<button>` → `<Button variant="ghost" size="icon">` + `aria-label`
- `GoalPlanner.tsx`：补全缺失的 `import { Button } from "@/components/ui/button"`
- 零业务逻辑变更，零 API 变更

## Phase 4B-1: AI Data Assistant Design Document

- 产出 `docs/design/AI_DATA_ASSISTANT_DESIGN.md`
- 定义 6 个能力模块：Dataset Profiler、Table Classifier、Column Role Detector、Relationship Inference Engine、Analysis Planner、Result Explainer
- 定义核心契约：`DatasetProfile`、`TableClassification`、`TableRelationship`、`AssistantAnalysisPlan`
- 设计 5 个核心用户场景：数据集理解、多表关系推断、分析推荐、引导分析配置、结果解释
- 安全原则：元数据优先、样本行显式 opt-in、推断关系需用户确认、禁止自动修改数据集
- 实施路线图：4B-2 → 4B-3 → 4B-4 → 4B-5 → 4B-6 → 4B-7
- 零代码变更

## Phase 4B-2: Dataset Profile Contract + Metadata Service

- 新增 `app/src/types/assistant.ts` — 前端 TypeScript 契约（snake_case）
- 新增 `app/src/api/assistant.ts` — API 客户端 `assistantApi.profileDataset()`
- 新增 `insightease-backend/app/services/assistant_profile_service.py` — 确定性启发式画像服务
- 新增 `insightease-backend/app/api/v1/endpoints/assistant.py` — `POST /assistant/profile-dataset`
- 字段角色检测：17 种角色，基于列名模式 + dtype + 唯一值率 + 空值率
- 表分类：11 种业务实体类型
- 只读保证：不修改源数据集、不创建新数据集、不触发预处理

## Phase 4B-2B: API Contract Casing Fix

- 将 `app/src/types/assistant.ts` 从 camelCase 统一改为 snake_case
- 与后端输出和现有项目约定（Dataset、Analysis、FieldSchema 均 snake_case）保持一致
- 无需映射层，前端直接消费后端返回的 snake_case 数据

## Phase 4B-3: Static Dataset Understanding UI

- 新增 `app/src/components/assistant/DatasetUnderstandingCard.tsx`
- 集成到 `app/src/pages/Datasets.tsx` 数据集详情对话框
- 功能：表类型推断、质量警告、字段角色/语义分布、关键字段分组、字段详情表格
- 后端：纯确定性启发式，零 LLM 调用

## Phase 4B-3C: AI Assistant Workbench UX Audit

- 审计 15 个文件，产出 `docs/PHASE4B3C_AI_ASSISTANT_UX_AUDIT.md`
- 发现 7 个关键问题、6 个高优先级问题、5 个中优先级问题
- 关键发现：`AIAssistant.tsx` 死代码；`SmartAnalysis` 大量模拟数据；3 个不共享状态的助手入口；4/5 后端 `/ai` 端点未被调用
- 推荐方向：统一助手入口、删除死代码、实现预填充导航、优化意图识别
- 零代码变更

## Phase 4B-3D: AI Assistant Surface Stabilization

- 删除 `app/src/components/AIAssistant.tsx`（死代码，251 行，0 处引用）
- `companion-service.ts`: `window.location.href` → `companion-navigate` 自定义事件
- `AppLayout.tsx`: 新增 `useNavigate()` 监听器，消除伙伴导航整页刷新
- `AICompanion.tsx`: 悬停提示 `双击对话` → `双击打开工作台`；用户可见 `Kimi` 文本替换为 `AI 助手`
- `AIWorkspace.tsx`: 移除背景遮罩点击关闭；欢迎消息和副标题澄清非 LLM 边界
- `SmartAnalysis.tsx`: 诊断/预处理卡片增加「演示数据」Badge；模拟代码段加注释
- `App.tsx`: `/app/ai-workspace` 独立路由重定向到 `/app/dashboard`
- 验证: `tsc --noEmit` 0 errors, `npm run build` built in 20.23s

## Phase 4B-3F: AI Companion Hard Reset

- 重写 `app/src/components/AICompanion.tsx` — 严格三态模型：collapsed / notification / workspace_open
- 删除旧版 320px 气泡卡片、拖拽行为、底部第二个头像、双击打开
- 新增 `app/src/components/assistant/AssistantAvatar.tsx` — 球形柔和头像，9 种变体，纯 CSS/div
- 新增 `app/src/components/assistant/index.ts` — barrel export
- 简化 `app/src/services/companion-service.ts`:
  - 删除 `generateAIContent()` 模拟 AI、idle 追踪、4 个非核心触发器
  - 保留 `setPage()` / `recordAction()` / `updateContext()`（11 个页面依赖）
  - 保留 `companion-navigate` 事件导航（4B-3D 修复不回归）
  - 上传完成通知文案改为「查看数据理解 / 进入数据工坊 / 稍后再说」
- 验证: `tsc --noEmit` 0 errors, `npm run build` built in 19.34s

## Phase 4B-3G: AI Workbench Layout Polish + Companion Drag Restore + Avatar Color Harmony

- `AICompanion.tsx`: 恢复拖拽 + 双击打开工作台 + localStorage 持久化
- `AssistantAvatar.tsx`: Tailwind 线性渐变 → inline 径向渐变，尝试统一 cyan-aqua 调色板
- `AIWorkspace.tsx`: `KimiAvatar` → `AssistantAvatar`；新增快速提问芯片；改善无数据集空状态
- 验证: `tsc --noEmit` 0 errors, `npm run build` built in 19.13s

## Phase 4B-3H: AI Companion Hover Bug Fix + Avatar Color Recalibration

- `AICompanion.tsx`:
  - 定位改为显式 `left/top` 像素坐标，新增 `isValidPosition()` + 加载时 clamp
  - tooltip / 脉冲环添加 `pointer-events-none`
  - `onMouseEnter/Leave` 与 pointer drag 事件隔离
- `AssistantAvatar.tsx`: 所有 variant 统一共享 `CORE` 品牌调色板，降低饱和度，统一光晕
- 验证: `tsc --noEmit` 0 errors, `npm run build` built in 19.29s

## Phase 4B-3I: Companion Drag Intent Fix & Workbench Split Layout Correction

- `AICompanion.tsx`:
  - 新增 `pointerDownRef`：只有 pointer down 后移动超过阈值才算拖拽，彻底杜绝悬停即拖拽
  - 新增 `suppressDoubleClickRef`：拖拽结束后 250ms 内抑制双击
  - 拖拽状态全部改用 ref，避免 drag 过程中不必要的 re-render
- `AIWorkspace.tsx`:
  - 关闭按钮增大对比度，添加 `aria-label`，显式边框 + hover 背景
  - 左右分栏方向校正：AI 工作台在左(62%)，数据预览在右(38%)
  - 布局切换按钮 tooltip 同步更新
- 验证: `tsc --noEmit` 0 errors, `npm run build` built in 18.99s

## Phase 4B-4: Multi-table Relationship Inference Design

- 产出 `docs/design/TABLE_RELATIONSHIP_INFERENCE_DESIGN.md`
- 定义 `TableRelationship` / `RelationshipEvidence` 输出契约（TypeScript-style，snake_case）
- 设计 6 信号启发式评分框架：列名相似度(0.35)、角色兼容性(0.25)、类型兼容(0.15)、唯一性信号(0.15)、表类型语义(0.15)、值重叠(0.20)
- 定义置信度四级：高(>=0.85)/中(0.65-0.85)/低(0.45-0.65)/极低(<0.45)
- 设计基数推断逻辑：基于 unique_rate 推断 one_to_one / one_to_many / many_to_one / many_to_many
- 设计用户确认模型：suggested → confirmed / rejected，仅 confirmed 可用于分析规划
- UI 提案：数据集详情页「相关表」、AI Workbench「理清表关系」、关系列表视图
- API 提案：`POST /assistant/infer-relationships`
- 安全约束：默认元数据-only、零 LLM 调用、不自动 join、不确定性显性化
- 手动 QA 数据集预期关系：8 条高置信度 + 弱关系 + 非关系场景
- 实施路线图：4B-5 后端服务 → 4B-6 Review UI → 4B-7 Analysis Planner Mock
- 零代码变更

## Phase 4B-5: Relationship Inference Backend Service

- 新增 `insightease-backend/app/services/relationship_inference_service.py`
  - 候选生成：跨数据集比较 key-like 列，排除 metric/text/高 null/类型不兼容列
  - 评分框架：5 个信号（名称 0.35 / 角色 0.25 / 类型 0.15 / 唯一性 0.15 / 表类型 0.15）
  - 基数推断：基于 unique_rate 阈值推断 one_to_one / one_to_many / many_to_one / many_to_many / unknown
  - 方向选择：优先事实表→维度表
  - 去重：避免同向和反向重复
  - 中文证据与警告消息
- 新增 endpoint `POST /assistant/infer-relationships`
  - 请求：`InferRelationshipsRequest`（dataset_ids, include_value_overlap, max_candidates）
  - 响应：`ResponseModel[InferRelationshipsResponse]`（relationships, generated_at, warnings）
- 更新 Pydantic schemas: `RelationshipEvidence`, `TableRelationship`, `InferRelationshipsRequest`, `InferRelationshipsResponse`
- 前端类型更新: `app/src/types/assistant.ts` 新增关系推断类型
- 前端 API 更新: `app/src/api/assistant.ts` 新增 `assistantApi.inferRelationships()`
- 验证: `tsc --noEmit` 0 errors, `npm run build` 21.06s, backend compileall ✅

## Phase 4B-6: Relationship Review UI

- 新增 `app/src/components/assistant/RelationshipReviewPanel.tsx`
  - 数据集多选 tag 按钮
  - 调用 `assistantApi.inferRelationships()` 获取关系建议
  - 卡片列表展示：源表.列 → 目标表.列、置信度标签、关系类型、状态徽章
  - 展开详情：完整证据列表和警告列表
  - 本地确认/忽略状态（组件级 state）
  - 安全文案：明确说明元数据-only、不自动 join、不修改数据
- AI Workbench 「能力」标签页新增「理清表关系」入口卡片
- 验证: `tsc --noEmit` 0 errors, `npm run build` 19.44s ✅

## Phase 4B-7: Relationship-aware Analysis Planner Mock

- 新增 `app/src/lib/assistant/analysisPlannerMock.ts`
  - 关键词规则匹配：8 类分析类型（forecast/path/attribution/ab/semantic/process/regression/descriptive）
  - 字段检测：基于列名模式匹配候选列
  - 关系感知：多数据集无 confirmed relationships 时发出警告
- 新增 `app/src/components/assistant/AnalysisPlanCard.tsx`
  - 分析类型彩色徽章、所需字段卡片、假设/警告列表、导航操作按钮
- 扩展 `app/src/types/assistant.ts`：RecommendedAnalysisType, AnalysisFieldRequirement, AssistantNextAction, AssistantAnalysisPlan
- AI Workbench 「能力」标签页新增「生成分析计划」入口
  - 输入框 + 6 个示例问题 chip + 生成按钮
  - 展示结构化分析计划卡片，支持导航到对应分析页面
- 验证: `tsc --noEmit` 0 errors, `npm run build` 19.28s ✅

## Phase 4B-7B: Assistant Context Store + Relationship-aware Planner Bridge

- 新增 `app/src/hooks/useAssistantContext.ts`
  - React hook 管理 confirmed/rejected relationships 状态
  - localStorage 持久化（仅关系元数据，不存储原始数据值）
  - 方法：`confirmRelationship`, `rejectRelationship`, `resetRelationship`, `getConfirmedForDatasets`, `isConfirmed`, `isRejected`
- 修改 `RelationshipReviewPanel.tsx`
  - 新增 controlled props: `confirmedRelationshipIds`, `rejectedRelationshipIds`, `onConfirmRelationship`, `onRejectRelationship`, `onResetRelationship`
  - 优先使用外部状态，无回调时 fallback 到本地 `localStatus`
- 修改 `AIWorkspace.tsx`
  - 引入 `useAssistantContext()` 在 workbench 层级管理关系状态
  - 关系状态传递给 RelationshipReviewPanel（受控模式）
  - 调用 `generateMockAnalysisPlan` 时传入 `confirmedRelationships`
- 修改 `analysisPlannerMock.ts`
  - 接收 `confirmedRelationships` 参数
  - 填充 `required_relationships` 和 assumptions
  - 有 confirmed relationships 时抑制多数据集缺少关系警告
- 修改 `AnalysisPlanCard.tsx`
  - 展示已确认关系列表（关系类型、方向、关键字段）
  - 无已确认关系时显示提示文案
- 验证: `tsc --noEmit` 0 errors, `npm run build` 22.76s ✅

## Phase 4B-7C-A: AI Workbench Agent-compatible Shell Stabilization

- 修复 `RelationshipReviewPanel.tsx` 响应解析
  - 拦截器返回 `response.data` 直接为 `{ code, message, data }`，修正嵌套访问
- 修复 `AnalysisPlanCard.tsx` 导航行为
  - 新增 `onNavigate` prop，支持导航后关闭 AI Workbench
- 重构 `AIWorkspace.tsx`
  - 对话输入路由到规则型规划器（`generateMockAnalysisPlan`），不再直接调用后端分析
  - 移除 `handleAnalysisRequest` 及关联的意图识别/分析执行服务调用
  - 输入框始终可见，无数据集时显示上下文提示
  - 快速 chips 始终可见
  - 能力标签页分为「通用能力」（始终可用）和「分析工具」（需数据集）
  - 历史标签页「新对话」自动切回对话标签页
  - 修复上下布局预览区域无限高度问题，添加 `max-h-[240px]`
  - 清理死代码：分析进度、结果面板、`AnalysisResultRenderer`、未使用图标
- 验证: `tsc --noEmit` 0 errors, `npm run build` 16.50s ✅

## Phase 4B-7C-B: AI Workbench Vertical Layout Scroll Fix

- 修复 `AIWorkspace.tsx` 上下布局滚动链
  - AI 对话区域: 添加 `min-h-0 overflow-hidden`
  - 内容区: `flex-1 min-h-0 overflow-hidden flex flex-col`
  - 对话标签页: `flex-1 min-h-0 flex flex-col overflow-hidden`（替代不可靠的 `h-full`）
  - 消息列表: `flex-1 min-h-0 overflow-y-auto`
  - 快速 chips / 输入框: 添加 `flex-shrink-0`
  - 能力标签页面板（理清表关系 / 生成分析计划）: 统一 `flex-1 min-h-0` 模式
  - 能力网格 / 历史标签页: `flex-1 min-h-0 overflow-y-auto`
  - 数据预览（左右布局）: 添加 `min-h-0 overflow-hidden`
- 根因: flex 滚动链缺少 `min-h-0`，导致 `overflow-y-auto` 子元素无法正确收缩和滚动
- 验证: `tsc --noEmit` 0 errors, `npm run build` 22.38s ✅

## Phase 4B-8A: Assistant Runtime Adapter + Safe Tool Registry Scaffold

- 新增 `app/src/lib/assistant/assistantRuntime.ts`
  - `AssistantRuntime` 接口、`AssistantContext`、`AssistantPlanRequest/Response`
  - `AssistantMessage`、错误/结果解释请求/响应类型
- 新增 `app/src/lib/assistant/ruleBasedAssistantRuntime.ts`
  - 包装现有 `generateMockAnalysisPlan()`，实现 `AssistantRuntime` 接口
- 新增 `app/src/lib/assistant/getAssistantRuntime.ts`
  - 工厂函数，当前返回 `ruleBasedAssistantRuntime`
- 新增 `app/src/lib/assistant/toolRegistry.ts`
  - 8 个工具定义、确认规则、副作用等级
  - `getSafeTools()` / `getImplementedTools()` 辅助函数
- 新增 `app/src/lib/assistant/hermesAssistantRuntime.ts`
  - 占位符，未来 Hermes 集成时使用
- 修改 `app/src/pages/AIWorkspace.tsx`
  - 替换直接调用 `generateMockAnalysisPlan` 为 `getAssistantRuntime().generateAnalysisPlan()`
  - 添加 try/catch 错误处理
- 新增 `docs/design/ASSISTANT_RUNTIME_ADAPTER_DESIGN.md`
  - 运行时架构设计文档
- 验证: `tsc --noEmit` 0 errors, `npm run build` 19.34s ✅

## Phase 4B-8B: SmartAnalysis Legacy Page Audit

- 审计 `SmartAnalysis.tsx` (906 行) 及其导航链路
- 发现诊断和预处理完全为模拟数据（`setTimeout` + 假数据 + `演示数据` badge）
- 发现仅统计分析调用真实后端，其余类型均为模拟
- 发现结果是自定义内联渲染，未使用 4A `ResultView`（唯一不使用的分析页面）
- 发现导航使用 `window.location.href` 硬刷新
- 发现聚类分析推荐独立页面，但不存在独立路由
- 产出 `docs/reviews/SMART_ANALYSIS_LEGACY_PAGE_AUDIT.md`（11 节完整审计）
- 推荐：短期隐藏侧边栏入口 → 中期迁移到 AI Workbench → 长期删除
- 无源码修改

## Phase 4B-8D: Guided Quick Analysis in AI Workbench

- 新增 `app/src/components/assistant/GuidedQuickAnalysisPanel.tsx`
  - 3 步引导流：选择数据集 → 理解数据结构 → 生成分析计划
  - Step 1: 数据集卡片列表，支持预选中 `defaultDatasetId`
  - Step 2: 调用真实 `assistantApi.profileDataset()`，渲染紧凑画像摘要（表类型、关键字段、推荐分析、质量警告）
  - Step 3: 6 个目标 chip + 自定义问题，调用 `getAssistantRuntime().generateAnalysisPlan()`，渲染 `AnalysisPlanCard`
- 修改 `app/src/pages/AIWorkspace.tsx`
  - 「通用能力」区新增「快速分析向导」卡片（Zap 图标）
  - 新增 `showQuickAnalysisPanel` 状态与面板渲染分支
  - 导航行为复用现有 `companion-navigate` + `onClose()` 模式
- 安全边界：无模拟诊断/预处理数据、无自动分析执行、无 join/SQL/数据集创建、无 Hermes/LLM 调用
- 验证: `tsc --noEmit` 0 errors, `npm run build` 16.72s ✅

## Hotfix 4B-8D-A: Guided Quick Analysis Runtime Crash

- **问题**: 点击「下一步：理解数据」后白屏，`Cannot read properties of undefined (reading 'toLocaleString')`
- **根因**: 后端 `assistant_profile_service.py` 返回 camelCase 键名，前端 `DatasetProfile` 类型为 snake_case，`profile.row_count` 实际为 `undefined`
- **修复** `GuidedQuickAnalysisPanel.tsx`:
  - 新增 `safeNumber()` / `safePercent()` 安全格式化辅助函数
  - 新增 `normalizeProfile(raw)` 归一化函数，同时兼容 camelCase 和 snake_case 输入
  - 所有数组字段 `Array.isArray` 守卫，所有嵌套字段安全访问 + 默认值
  - 错误状态增加「重新理解」和「返回选择数据」恢复按钮
- 验证: `tsc --noEmit` 0 errors, `npm run build` 16.64s ✅

## Phase 4B-8D-B: Confirmed Relationship Scope & Management Fix

- `useAssistantContext.ts`: 新增 `clearConfirmedRelationships`/`clearRejectedRelationships`/`clearAllRelationshipState`；收紧 `getConfirmedForDatasets` 过滤规则（0 个→[] / 1 个→OR / 2+个→AND）；添加 JSDoc 语义说明
- `RelationshipReviewPanel.tsx`: 新增 `confirmedRelationships`/`onClearAllConfirmed` props；新增「已确认关系」可展开管理区，支持单条取消确认和全部清空
- `AIWorkspace.tsx`: 向 `RelationshipReviewPanel` 传递完整已确认关系数组和清空回调；「新对话」按钮增加 tooltip「新对话只会清空当前对话，不会清空你已确认的表关系」
- `GuidedQuickAnalysisPanel.tsx`: Step 3 生成计划前，将 `confirmedRelationships` 过滤为仅与选中数据集相关的范围
- `AnalysisPlanCard.tsx`: 关系展示标题改为「本计划使用的已确认表关系」
- 安全边界：无后端持久化、无自动 join、无 SQL 生成
- 验证: `tsc --noEmit` 0 errors, `npm run build` 21.56s ✅

## Hotfix 4B-8D-B.1: Confirmed Relationship Management UI Visibility

- `RelationshipReviewPanel.tsx`: 管理区改为无条件渲染（始终可见），空状态显示「暂无已确认关系」
- `RelationshipReviewPanel.tsx`: `totalConfirmed`/`totalRejected` 改为统计当前结果所有 effective confirmed/rejected 状态，与行徽章同源
- `RelationshipReviewPanel.tsx`: 管理区列表合并 controlled + local 已确认关系并按 id 去重
- 验证: `tsc --noEmit` 0 errors, `npm run build` 16.64s ✅

## Phase 4B-8D-C: Relationship Set Management Redesign

- 新增 Relationship Set 类型模型：
  - `RelationshipSet`
  - `RelationshipSetSummary`
  - `RelationshipRiskLevel`
  - `TableRelationship.risk_level` / `is_custom`
- 重构 `useAssistantContext.ts`
  - 关系状态主模型改为 `relationshipSets` + `activeRelationshipSetId`
  - 新增 CRUD 和 active set API
  - 新增 localStorage keys: `insightease_assistant_relationship_sets`, `insightease_assistant_active_relationship_set_id`
  - 自动将旧 `insightease_assistant_confirmed_relationships` 迁移为 `旧版已确认关系`
  - 不再写入旧 flat confirmed relationship 格式
- 重构 `RelationshipReviewPanel.tsx`
  - 关系组管理区在推断前即可见
  - 候选关系按 key family 分组
  - checkbox 选择候选关系，保存为命名关系组
  - 支持 active set 切换、重命名、删除、清除当前
  - 高风险语义不一致关系需显式确认后才能加入
- 修改 `AIWorkspace.tsx`
  - 新增紧凑关系组 selector
  - chat planner / 生成分析计划只传 active relationship set
- 修改 `GuidedQuickAnalysisPanel.tsx`
  - 只消费 active relationship set
  - 生成计划前过滤为触达所选数据集的关系
- 安全边界：无后端持久化、无自动 join、无 SQL 生成、无 Hermes/LLM 调用
- 验证: `npx.cmd tsc --noEmit` 0 errors；`npm.cmd run build` built in 20.39s（保留既有 large chunk warning）

## Phase 4B-8C: Hide Legacy SmartAnalysis Entry

- 修改 `AppSidebar.tsx`
  - 移除 `智能分析向导` 侧边栏入口，保留注释说明弃用原因
  - 移除未使用的 `Brain` icon import
- 修改 `Dashboard.tsx`
  - 移除 SmartAnalysis 快捷按钮
  - 移除未使用的 `Sparkles` icon import
- 修改 `SmartAnalysis.tsx`
  - 添加文件级 `@deprecated` JSDoc 注释
  - 添加页面顶部 amber 弃用提示横幅
- 保留 `/app/smart-analysis` 路由和源码文件
  - 直接 URL 访问不中断
  - 作为未来迁移参考保留
- 验证: `tsc --noEmit` 0 errors, `npm run build` 16.41s ✅
## Phase 4B-8D-D: Relationship Set as Topic Dataset Graph

- Added `dataset_nodes` to Relationship Sets so saved relationship contexts can include connected tables and isolated/reference tables.
- Migrated old edge-only localStorage relationship sets into graph-shaped sets without dropping existing confirmed relationships.
- Updated Relationship Review UI to keep unmatched selected datasets as isolated reference nodes.
- Updated planner/runtime semantics so active Relationship Set is allowed context, not a source for all `required_datasets`.
- Updated Guided Quick Analysis and Analysis Plan display to scope and label relationship-set context safely.
# Phase 4B-8E: Prefill Navigation Payload from AI Workbench

- Added `AnalysisPrefillPayload` for safe AI Workbench to analysis-page handoff.
- Added `app/src/lib/assistant/prefillNavigation.ts` with sessionStorage save/read/clear helpers and 24-hour TTL validation.
- Analysis plan next actions now store a prefill payload and navigate with `?prefill=<key>`.
- Forecast, PathAnalysis, and Attribution show AI Workbench prefill banners and use exact field suggestions only.
- No backend API, Hermes/LLM, SQL generation, auto-run, auto-join, or SmartAnalysis changes.

# Phase 4B-8E-A: AI Workbench Continuity & Prefill Gap Fix

- Preserved AI Workbench active session state across close/reopen using sessionStorage.
- Removed the unintended new-session creation on every Workbench open.
- Added safe Statistics prefill support for descriptive/statistics-family plans.
- Added searchable dataset and relationship-set selectors in AI Workbench and relationship review.
- No backend API, Hermes/LLM, SQL generation, auto-run, auto-join, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8F: AI Workbench Context Panel Redesign

- Added `AIWorkbenchContextPanel` as the reusable context surface for AI Workbench.
- Replaced the old preview-only right-side area with dataset and relationship-set context.
- Added relationship set sections for connected tables, isolated/reference tables, confirmed edges, and high-risk edges.
- Added lazy per-table preview loading for relationship-set table cards.
- Added design documentation for the Context Panel contract and future analysis history context.
- No backend API, Hermes/LLM, SQL generation, auto-run, auto-join, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8G: Analysis History Context and Collapsible Sections

- Added collapsible Context Panel modules with accessible expand/collapse headers.
- Persisted section open/closed state in sessionStorage without storing preview rows or raw result data.
- Added an initial analysis history context section that lists recent analyses, supports search, and displays compact safe summaries.
- AI Workbench session snapshots now retain only `selected_analysis_history_id` for close/reopen continuity.
- No backend API, Hermes/LLM, SQL generation, auto-run, auto-join, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8H: Safe Result Summary Contract

- Added shared `SafeResultSummary` frontend contract and deterministic summary builder.
- Centralized result key, metric, table, chart/config, and warning extraction with strict caps.
- Refactored AI Workbench inline history result preview to use the shared helper.
- Added a shared safe summary block to History result dialogs.
- No backend API, Hermes/LLM, SQL generation, auto-run, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8I: Analysis Result to AI Workbench Handoff

- Added `aiWorkbenchHandoff` helper with a bounded temporary sessionStorage payload.
- Added programmatic AI Workbench open and handoff events.
- Added `让 AI 解读这个结果` action to History result dialogs.
- Added `带到 AI 工作台` action to Statistics results.
- AI Workbench now attaches safe result context and shows result follow-up prompt chips without auto-generating explanations.
- No backend API, Hermes/LLM, SQL generation, auto-run, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8J: Result Follow-up Mode and Default Horizontal Layout

- Changed AI Workbench missing/invalid layout fallback to horizontal while preserving saved user layout choices.
- Added deterministic result follow-up responder for explanation, risks, next steps, and report-style summaries.
- Wired result-context chat prompts to respond from `SafeResultSummary` before falling back to planner.
- No backend API, Hermes/LLM, SQL generation, auto-run, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8K: Hermes Result Explainer Boundary Design

- Added design contract for future Hermes result explanation.
- Defined bounded request/response shape using `SafeResultSummary`.
- Documented safety flags, forbidden raw inputs, confirmation requirements, UI flow, and deterministic fallback behavior.
- No code runtime behavior, backend API, Hermes/LLM call, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8L: Hermes Backend API Endpoint Contract

- Added `docs/design/HERMES_BACKEND_API_CONTRACT.md`.
- Defined future endpoints:
  - `GET /api/v1/assistant/hermes/status`
  - `POST /api/v1/assistant/hermes/explain-result`
  - `POST /api/v1/assistant/hermes/plan-analysis`
- Documented request/response contracts, safety validation, size/privacy limits, normalized error codes, feature flags, fallback behavior, and action confirmation rules.
- Updated API/runtime/Hermes boundary docs to reference the backend contract.
- No backend endpoint, frontend runtime behavior, Hermes/LLM call, auto-run, auto-join, SQL generation, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8M: Hermes Dry-run Backend Scaffold

- Added `insightease-backend/app/api/v1/endpoints/hermes.py` with dry-run status, explain-result, and plan-analysis endpoints.
- Added `insightease-backend/app/schemas/hermes.py` for contract-shaped Pydantic schemas.
- Added `insightease-backend/app/services/hermes_validation_service.py` for safety and size validation.
- Added safe Hermes config flags with disabled defaults.
- Mounted Hermes dry-run routes at `/api/v1/assistant/hermes`.
- Added frontend Hermes request/response types and `assistantApi` wrapper methods.
- No frontend runtime switch, real Hermes/LLM call, provider credentials, auto-run analysis, auto-join, SQL generation, dataset mutation, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8N: Hermes Runtime Status Probe and Developer Diagnostics

- Added `app/src/hooks/useHermesStatus.ts` for lazy, cached Hermes status probing.
- AI Workbench probes `/assistant/hermes/status` only when opened and caches status for 5 minutes in sessionStorage.
- Added a subtle AI Workbench header diagnostic showing local rule mode plus Hermes disabled/dry-run/unavailable status.
- Runtime factory remains rule-based and AI Workbench does not call Hermes explain-result or plan-analysis endpoints.
- No backend changes, Hermes/LLM call, auto-run, auto-join, SQL generation, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-8O: HermesAssistantRuntime Dry-run Mode

- Added `app/src/lib/assistant/assistantRuntimeConfig.ts`.
- `getAssistantRuntime()` now supports explicit opt-in `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_dry_run`.
- Implemented `hermesAssistantRuntime.generateAnalysisPlan()` using `assistantApi.planAnalysisWithHermesDryRun()`.
- Added mandatory fallback to `ruleBasedAssistantRuntime` when dry-run endpoint is disabled, unavailable, fails, or returns an invalid plan.
- Updated AI Workbench diagnostic to show `Hermes dry-run runtime · fallback enabled` when selected.
- No live Hermes/LLM call, backend change, auto-run analysis, auto-join, SQL generation, dataset mutation, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-9A: Dataset Catalog Classification & Grouped Views

- Added `app/src/types/datasetCatalog.ts` and `app/src/lib/datasetCatalog.ts`.
- Added deterministic business category, data type, analysis tag, upload day, and upload week inference.
- Updated Datasets page with grouped views for upload day, upload week, business topic, data type, and analysis usage.
- Expanded Datasets page search to include schema fields and catalog labels.
- Added compact category/type/analysis badges to dataset rows.
- Added `docs/design/DATASET_CATALOG_CLASSIFICATION_DESIGN.md`.
- No Hermes/LLM call, backend persistence, dataset mutation, runtime behavior change, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-9B: Dataset Catalog Planner Candidate Search

- Extended `AssistantContext` with optional deterministic `dataset_catalog` metadata.
- AI Workbench and Guided Quick Analysis now build catalog metadata from loaded frontend dataset metadata and pass it to the assistant runtime.
- Updated the rule-based planner to rank candidates by selected dataset, active Relationship Set scope, catalog metadata, and deterministic schema/name keywords.
- Added distinct `candidate_datasets` to analysis plans and rendered them separately in `AnalysisPlanCard`.
- Prevented broad full-library fallback from becoming `required_datasets`; low-confidence matches are advisory only.
- Updated catalog and runtime adapter docs plus the Phase 4B-9B phase log.
- No Hermes/LLM call, backend persistence, dataset mutation, auto-run analysis, auto-join, SQL generation, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-9C: AI Workbench End-to-End QA & Polish

- Audited Dataset Catalog, Relationship Set, planner, plan card, prefill, result handoff, safe summary, result follow-up, and Hermes dry-run opt-in paths.
- Disabled plan-card navigation when the planner has no confirmed required dataset, preventing empty prefill payloads from descriptive/statistics prompts that need dataset confirmation.
- Added clearer plan-card copy for required datasets and candidate datasets.
- Added a selected-dataset mismatch warning when a specific analysis intent has weak catalog support in the selected dataset.
- Added `docs/phase-logs/PHASE_4B_9C_AI_WORKBENCH_E2E_QA_AND_POLISH.md`.
- No Hermes/LLM call, backend persistence, dataset mutation, auto-run analysis, auto-join, SQL generation, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-9D: Workbench QA Recipes & Demo Scenario Seeds

- Added `docs/qa/AI_WORKBENCH_QA_RECIPES.md`.
- Added `docs/qa/AI_WORKBENCH_DEMO_SCENARIOS.md`.
- Documented reusable manual QA coverage for Dataset Catalog, Relationship Set topic graphs, planner candidate narrowing, prefill navigation, Context Panel, result handoff, deterministic follow-up, and Hermes dry-run safety.
- Documented recommended demo dataset names, schema hints, and expected catalog classification targets.
- Added `docs/phase-logs/PHASE_4B_9D_WORKBENCH_QA_RECIPES_AND_DEMO_SCENARIOS.md`.
- Updated README/progress/roadmap docs to reference `docs/qa/`.
- No source code, backend fixture, runtime behavior, Hermes/LLM call, dependency, package-file, dataset mutation, or SmartAnalysis changes.

# Phase 4B-10A: Analysis History Catalog Grouped Views

- Added `app/src/types/historyCatalog.ts`.
- Added `app/src/lib/historyCatalog.ts`.
- Updated History page with search, status filter, AI-ready filter, and group modes for created day/week/type/status/dataset/AI-ready status.
- Added compact history item badges for analysis type, status, AI-readiness, and dataset.
- Added `docs/design/ANALYSIS_HISTORY_CATALOG_DESIGN.md`.
- Added `docs/phase-logs/PHASE_4B_10A_ANALYSIS_HISTORY_CATALOG_GROUPED_VIEWS.md`.
- Updated AI Workbench QA recipes and demo scenarios with History Catalog checks.
- No Hermes/LLM call, backend persistence, analysis rerun, SQL generation, dataset mutation, dependency, package-file, or SmartAnalysis changes.

# Phase 4B-10B: Workbench History Selector Alignment & Unified Searchable Selectors

- Added `app/src/components/ui/SearchableSelect.tsx`.
- Replaced split search+select controls in AI Workbench dataset and relationship set selectors.
- Replaced AI Workbench history selection with a searchable dropdown backed by Analysis History Catalog metadata.
- Updated Relationship Set management active-set selector to use the same searchable selector.
- Updated shared `DatasetSelector` so SmartProcess/preprocessing-style dataset selection uses one searchable control.
- Added `docs/phase-logs/PHASE_4B_10B_WORKBENCH_HISTORY_SELECTOR_AND_SEARCHABLE_SELECTORS.md`.
- No Hermes/LLM call, backend change, analysis auto-run, dataset mutation, dependency, package-file, or SmartAnalysis changes.
