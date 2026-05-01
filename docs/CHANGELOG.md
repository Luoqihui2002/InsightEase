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
