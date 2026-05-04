# InsightEase 路线图

**版本**: 2026-04-28
**当前阶段**: Phase 4A-6-1 视觉审计已完成，进入 Phase 4A-6-2 实施

---

## Phase 4A: Engineering Stabilization

目标：夯实工程基础，解决已知阻塞项，统一页面布局体系

### 4A-1: 共享组件体系建设 ✅
- PageShell, PageHeader, ContentGrid, StatCard, ChartCard, SectionCard, LoadingState, ErrorState, Empty, DataTablePreview, SidePanel, ResultPanel

### 4A-2: 简单页面迁移 ✅
- Upload, History, Datasets, Dashboard, Visualization

### 4A-3: Analysis Pages Template Audit ✅
- 审计 9 个分析页面，产出统一模板设计

### 4A-4: Analysis Pages 迁移（按风险升序）✅
1. **4A-4-0** — 构建 7 个分析专用共享组件 ✅
2. **4A-4-1** — Semantic + Clustering（低风险验证）✅
3. **4A-4-2** — Statistics + Attribution（中风险，验证 ECharts + 统计卡片）✅
4. **4A-4-3** — SmartProcess + GoalPlanner（中风险，验证文件下载 + 自定义布局）✅
5. **4A-4-4** — Forecast（高风险，验证复杂配置面板）✅
6. **4A-4-5** — PathAnalysis（高风险，验证多类型选择器 + 子组件）✅
7. **4A-4-6** — 迁移收官 + 复杂页面规划（SmartAnalysis / AIWorkspace / DataWorkshop）✅

### 4A-5: 交互一致性治理 ✅

#### 4A-5-1: 交互清理审计 ✅
- 审计 15 个页面的 native `<select>`、手写 toggle、clickable div、native `<table>`、`alert()`/`confirm()`
- 产出 `docs/INTERACTION_CLEANUP_AUDIT.md`

#### 4A-5-2: 低风险静态 select 和 switch ✅
- SmartProcess 5 个静态 enum select → shadcn `Select`
- Dashboard 2 个 view tab → shadcn `Tabs`
- Forecast batch mode toggle → shadcn `Switch`

#### 4A-5-3: 动态列选择器替换 ✅
- Attribution (5)、Statistics (1)、Forecast (2)、PathAnalysis (3)、Visualization (4)、GoalPlanner (1)
- native `<select>` → shadcn `Select`
- sentinel value 映射：`value=""` → `none`/`auto`

#### 4A-5-4: ToggleGroup 和按钮清理 ✅
- PathAnalysis 5-type 选择器 → shadcn `ToggleGroup`
- Forecast 模型选择器 → shadcn `ToggleGroup`
- GoalPlanner 拆解方式 → shadcn `ToggleGroup`
- Forecast checkbox → shadcn `Checkbox`

#### 4A-5-5: Table 和 Dialog 清理 ✅
- History `renderResultPreview` → `DataTablePreview`
- 复杂语义表格保持 native（PathAnalysis funnel、GoalPlanner decomposition、Attribution model comparison）

#### 4A-5-6: 交互清理收官 ✅
- 产出 `docs/PHASE_4A_INTERACTION_CLEANUP_CLOSURE.md`
- 29 个控件替换完成，零业务逻辑变更
- 推荐下一Phase：4A-6 Visual System / Style Polish

### 4A-6: 视觉系统与工程优化（当前Phase）

#### 4A-6-1: 视觉系统审计 ✅
- 审计 shadcn 兼容性、卡片密度、按钮层级、glass、ECharts 颜色、空状态、包体积
- 产出 `docs/VISUAL_SYSTEM_AUDIT.md`
- 推荐实施顺序：4A-6-2 → 4A-6-3 → 4A-6-4 → 4A-6-5 → 4A-6-6 → 4A-6-7

#### 4A-6-2: 共享组件视觉精细化（下一Phase）
- Empty/ErrorState/SuccessState token 对齐（`--status-error/success`）
- Select/Checkbox/ToggleGroup 状态校验与主题匹配
- 添加 `density` prop 到 SectionCard

#### 4A-6-3: 页面级间距和密度通行
- 移除 glass 过度使用（Attribution、Statistics、SmartAnalysis、Profile 普通卡片）
- 标准化卡片 padding 为 compact/default/spacious 三档

#### 4A-6-4: 图表颜色 token 审计
- `useChartColors()` hook 读取 CSS 变量
- 替换 Visualization、Dashboard、PathAnalysis、Attribution、Forecast 中 137 处硬编码 hex
- 验证主题切换时图表颜色跟随

#### 4A-6-5: 空/加载/错误状态打磨
- 定义 `--status-error/success/warning`
- 迁移 SmartAnalysis、DataWorkshop、AIWorkspace 内联空状态到 Empty 组件

#### 4A-6-6: 按钮层级 + 包体积分流

##### 4A-6-6A: Button Hierarchy Cleanup ✅
- 主操作按钮改 `variant="default"`（Forecast、PathAnalysis、SmartProcess、GoalPlanner）
- 删除操作改 `variant="destructive"`（Datasets、History、Dashboard）
- icon-only 按钮添加 `aria-label`（Dashboard widget 操作、History 操作、Dashboard modal 操作）
- `GoalPlanner.tsx` 补全缺失的 `Button` import

##### 4A-6-6B: Bundle Size Triage ✅
- `manualChunks` 拆分 echarts / radix / xlsx / animation
- 最大单 chunk: 3,396 kB → 1,561 kB (-54%)
- 主 app chunk: 3,396 kB → 1,061 kB (-69%)
- 已知限制：echarts 仍全量导入 1.56 MB；主 chunk 仍 1.06 MB

#### 4A-6-7: ResultTable 设计文档 ✅
- 产出 `docs/design/RESULT_TABLE_DESIGN.md`
- 定义 `AnalysisResult` schema、`ResultBlock` 类型系统、Column Contract、格式化规则
- 3 个示例 payload + 8 阶段实施路线图
- 零代码变更

#### 4A-6-8: Result Schema + Mock ResultView Skeleton ✅
- `app/src/types/result.ts` + `app/src/lib/resultFormatters.ts`
- `ResultView` + `ResultTableRenderer` + `ResultMetricBlock` + `ResultSummaryBlock` + `ResultWarningBlock` + `ResultTextBlock`
- 3 个 mock payload
- 图表块占位、未知块安全降级

#### 4A-6-9: ResultView 单页集成试点 ✅
- Statistics 页面接入 `ResultView`
- `statisticsResultAdapter.ts` 产出 summary + metric + table + warning blocks
- AI 解读区块保留

#### 4A-6-10: Statistics ResultView QA & Polish ✅
- 适配器安全性增强（稳定 ID、类型守卫、空值处理）
- AI 解读整合为 `ResultTextBlock`
- 空结果提示优化
- Statistics 页面作为其他页面的参考模式

#### 4A-6-11: ResultView Rollout to Semantic Page ✅
- `semanticResultAdapter.ts` 产出 summary + metric + table + text + warning blocks
- 13 列统一表格含 `top_values` 转换
- Statistics + Semantic 双页面已验证 adapter + ResultView 模式

#### 4A-6-12: ResultView Rollout to Attribution Page ✅
- `attributionResultAdapter.ts` 处理嵌套 `models` 对象扁平化
- 产出 summary + metric + 2 tables + chart placeholder + warnings
- ECharts 图表保留在页面级别（未来迁移）
- Statistics + Semantic + Attribution 三页面已验证

#### 4A-6-13: Chart Placeholder Policy & Attribution Cleanup ✅
- 移除 Attribution adapter 中的 chart placeholder block
- 定义保守策略：避免与页面级真实图表重复
- ResultView 通用 chart fallback 仍保留

#### 4A-6-14: ResultView 推广到 Forecast Page ✅
- 创建 `forecastResultAdapter.ts`（支持单预测 + 批量预测）
- `Forecast.tsx` 接入 `ResultView`
- 保留错误诊断、What-if 结果、导出按钮
- 验证时间序列结果结构

#### 4A-6-15: ResultView 推广到 PathAnalysis Page ✅
- 创建 `pathAnalysisResultAdapter.ts`（支持 5 种分析类型）
- `PathAnalysis.tsx` 接入 `ResultView`
- 保留所有 ECharts 图表和特殊 UI
- 验证漏斗/路径/聚类/关键路径/序列模式结果结构

#### 4A-6-16: PathAnalysis UI 清理 ✅
- 移除与 ResultView 重复的旧 metric cards（5 种分析类型共 15 个 cards）
- 移除重复的 HTML table：漏斗步骤、节点详情、关联规则
- 保留图表、视觉展示、交互组件、导出工具栏

#### 4A-6-17: ResultChartRenderer Design Document ✅
- 创建 `docs/design/RESULT_CHART_RENDERER_DESIGN.md`
- 盘点 6 处图表使用，定义 P0/P1/P2 优先级
- 提出渲染架构和迁移策略
- 纯文档阶段

#### 4A-6-18: ResultChartRenderer Implementation ✅
- 实现 line/bar/area 真实渲染
- graph 类型仍保持 placeholder
- ResultView 图表块由 placeholder 改为 ResultChartRenderer
- 未迁移任何页面图表

#### 4A-6-19: Forecast Chart Migration ✅
- Forecast placeholder → 真实 line chart
- 动态 yKeys（actual/forecast/lower/upper 按数据存在性）
- 第一个真实页面图表迁移

#### 4A-6-20: Attribution Chart Migration ✅
- Attribution 对比图表迁移至 ResultView
- 嵌套 `models` 数据扁平化为 bar chart rows，模型 key 映射中文名
- 移除页面级 ECharts 图表逻辑和未使用导入

#### 4A-6-21: Manual QA Test Dataset Pack ✅
- 生成 10 个确定性 CSV 测试数据集
- 覆盖 Statistics / Semantic / Forecast / Attribution / PathAnalysis / A/B / 回归 / 数据质量
- 为进入 Phase 4B 提供端到端验证基础

#### 4A-6-22: Critical QA Bug Triage ✅
- 修复 SmartProcess 自动保存缺陷：新增 preview_only 模式，预览不持久化
- 修复缺失值检测：字符串 token（`null`, `N/A`, `-`, `unknown` 等）统一替换为 NaN
- 修复路径聚类超时：增加 `max_sessions=1000` 采样上限，修复 `combined_entropy` 计算 bug

### Phase 4B: AI Data Assistant（当前阶段）

#### 4B-1: Product & Architecture Design ✅
- 产出 `docs/design/AI_DATA_ASSISTANT_DESIGN.md`
- 定义 6 个能力模块、核心契约、集成策略、安全原则、实施路线图
- 纯文档阶段，零代码变更

#### 4B-2: Dataset Profile Contract & Metadata Service ✅
- 定义 `DatasetProfile` / `ColumnProfile` / `ColumnRole` 前端契约
- 添加后端 `assistant_profile_service.py`（确定性启发式规则）
- 添加后端端点 `POST /assistant/profile-dataset`
- 前端 API 客户端 `assistantApi.profileDataset()`
- 无 AI 调用，只读，不修改数据集

#### 4B-2B: API Contract Smoke Test & Casing Fix ✅
- 验证后端 ResponseModel 包装行为和 snake_case 输出
- 确认前端现有类型约定为 snake_case
- `assistant.ts` 类型统一改为 snake_case，与后端和项目约定一致

#### 4B-3: Static Dataset Understanding UI ✅
- 基于 `DatasetProfile` 的数据集概览卡片
- 字段角色检测（非 LLM）
- 在 Datasets 页面详情对话框集成 `DatasetUnderstandingCard`
- 表类型推断、质量警告、字段分布、关键字段、详情表格

#### 4B-3C: AI Assistant Workbench UX Audit ✅
- 审计 15 个文件，产出审计报告
- 识别 7 个关键问题、6 个高优先级问题
- 零代码变更

#### 4B-3D: AI Assistant Surface Stabilization ✅
- 删除死代码 `AIAssistant.tsx`
- `window.location.href` → `companion-navigate` 自定义事件
- AIWorkspace 移除背景点击关闭、澄清非 LLM 边界

#### 4B-3F: AI Companion Hard Reset ✅
- 严格三态模型：collapsed / notification / workspace_open
- 删除旧版 320px 气泡卡片、拖拽、第二个头像
- 新增 `AssistantAvatar.tsx` 球形头像组件

#### 4B-3G: AI Workbench Layout Polish + Companion Drag Restore + Avatar Color Harmony ✅
- 恢复拖拽 + 双击打开工作台 + localStorage 持久化
- `KimiAvatar` → `AssistantAvatar`
- AIWorkspace 快速提问芯片、无数据集空状态改善

#### 4B-3H: AI Companion Hover Bug Fix + Avatar Color Recalibration ✅
- 定位改为显式 `left/top`，修复悬停消失 bug
- tooltip / 脉冲环添加 `pointer-events-none`
- 头像颜色统一为 cyan-aqua-blue 核心调色板

#### 4B-3I: Companion Drag Intent Fix & Workbench Split Layout Correction ✅
- 新增 `pointerDownRef` 彻底杜绝悬停即拖拽
- 左右分栏方向校正：AI 工作台在左，数据预览在右
- 关闭按钮增大对比度

#### 4B-4: Multi-table Relationship Inference Design ✅
- 产出 `docs/design/TABLE_RELATIONSHIP_INFERENCE_DESIGN.md`
- 定义关系推断输出契约、评分框架、置信度分级、基数推断
- 设计用户确认模型、UI 提案、API 提案
- 定义 QA 数据集预期关系
- 纯文档阶段，零代码变更

#### 4B-5: Relationship Inference Backend Service ✅
- 实现元数据-only 候选生成和评分
- `POST /assistant/infer-relationships` endpoint
- 使用手动 QA 数据集验证准确性

#### 4B-6: Relationship Review UI ✅
- AI Workbench 新增「理清表关系」能力
- 关系列表/表格视图，支持确认/忽略

#### 4B-7: Relationship-aware Analysis Planner Mock ✅
- 使用 confirmed 关系建议分析数据需求
- 模板/关键词匹配，无真实 LLM

#### 4B-7B: Assistant Context Store + Relationship-aware Planner Bridge ✅
- 前端 `useAssistantContext` hook + localStorage 持久化
- `RelationshipReviewPanel` 受控模式
- `AnalysisPlannerMock` 消费 confirmed relationships

#### 4B-7C-A: AI Workbench Agent-compatible Shell Stabilization ✅
- 修复响应解析、导航关闭、布局滚动
- 对话输入路由到规划器，不直接调用后端分析
- 能力标签页分「通用能力」和「分析工具」

#### 4B-7C-B: AI Workbench Vertical Layout Scroll Fix ✅
- 修复 flex 滚动链：`min-h-0` + `overflow-hidden` + `flex-shrink-0`
- 生成的 AnalysisPlanCard 可完整滚动

#### 4B-8A: Assistant Runtime Adapter + Safe Tool Registry Scaffold ✅
- `AssistantRuntime` 接口抽象
- `ruleBasedAssistantRuntime` 包装现有规划器
- 安全工具注册表（8 工具，确认规则，副作用等级）
- `hermesAssistantRuntime` 占位符

#### 4B-8B: SmartAnalysis Legacy Page Audit ✅
- 审计 `SmartAnalysis` 模拟数据、4A 合规性、导航问题
- 推荐：隐藏 → 迁移 → 删除

#### 4B-8C: Hide Legacy SmartAnalysis Entry ✅
- 移除侧边栏入口和 Dashboard 快捷方式
- 添加弃用注释和页面提示

#### 4B-8D: Guided Quick Analysis in AI Workbench ✅
- 将快速分析向导迁移到 AI Workbench
- 后续修复：画像字段 casing 归一化、confirmed relationship scope 管理

#### 4B-8D-C: Relationship Set Management Redesign ✅
- 将全局 confirmed edge list 改为 Relationship Set 模型
- 本地保存多个命名关系组，支持 active set 切换、重命名、删除
- 旧 `insightease_assistant_confirmed_relationships` 自动迁移为 `旧版已确认关系`
- Planner/Chat 只使用 active relationship set
- Guided Quick Analysis 只使用 active set 中触达所选数据集的关系
- 无后端持久化、无自动 join、无 SQL 生成

#### 4B-8E: Hermes Backend Adapter（远期）
- 后端 Hermes API 适配层
- 前端切换 runtime 模式

#### 4B-9: Result Explainer（远期）
- 解释 `AnalysisResult` 块
- 建议下一步分析
- 后端 Hermes API 适配层
- 前端切换 runtime 模式

#### 4B-9: Result Explainer（远期）
- 解释 `AnalysisResult` 块
- 建议下一步分析
- 后端 Hermes API 适配层
- 前端切换 runtime 模式

#### 4B-9: Result Explainer（远期）
- 解释 `AnalysisResult` 块
- 建议下一步分析
- 元数据优先的 LLM 调用
- 结构化 JSON 输出

#### 4B-9: Result Explainer（远期）
- 解释 `AnalysisResult` 块
- 建议下一步分析

---

#### Phase 4C: DataWorkshop 组件拆分（后续）
- 纯研究文档，不实现
- 分析 PathAnalysis、Forecast、Attribution 结果表共性
- 规划 ResultTableShell / ResultTable / MetricComparisonTable API

#### 4A-6-8: 工程稳定化（可选，可并行为独立 phase）
- **API 类型统一** — 修复拦截器解包导致的类型混乱，移除 `as any`
- **Alembic 引入** — 数据库版本化管理，替代手动 SQL
- **storage.read() 统一** — 修复 analysis.py 后台任务 OSS 兼容性问题

---

## Phase 4B: AI Assistant Upgrade / Hermes Agent Research

目标：从"意图识别 + 轮询"升级为 Agent 架构

### 4B-0: AI 助手产品形态设计
- 定义 copilot panel vs modal 方案
- 设计分析建议卡片、工具调用确认流程
- 流式响应 vs 轮询决策

### 4B-1: Hermes Adapter 研究/设计
- 后端适配层 API 契约
- 多模型支持架构
- 前端不直接调用 Hermes，通过后端适配层

### 4B-2: AIWorkspace 重构
- 基于 4B-0/4B-1 决策实施
- 集成 Hermes 适配层

### 4B-3: SmartAnalysis  mock→real 迁移
- 将诊断、预处理、分析模拟替换为真实 API
- 保留向导流程

---

## Phase 4C: DataWorkshop 组件拆分

目标：将 2320 行的单体文件拆分为可维护组件

### 4C-0: 组件审计
- 梳理所有内联子组件和依赖关系

### 4C-1~3: 逐步提取
- `DataSourcePanel`、`OperationChain`、`OperationConfigPanel`、`PreviewPanel`、`SaveResultPanel`
- 零业务逻辑变更

### 4C-4: 视觉优化
- 移除 glass、替换 `<table>`、标准化输入控件
- 保留后端 preview/save 路径不变

---

## Phase 5: Dashboard & ECharts Upgrade

目标：从单图表升级为可保存的 Dashboard

1. **高级 ECharts 图表** — 桑基图、热力图、地理坐标、3D 图表等
2. **AI 图表推荐** — 基于数据特征自动推荐最佳图表类型
3. **Dashboard 保存** — 多图表组合布局，持久化到后端
4. **图表导出** — 支持 PNG/SVG/PDF 多格式导出
5. **ChartCard 组件推广** — 将 ECharts 页面统一纳入 ChartCard 容器

---

## Phase 6: Statistical Analysis Platform Completion

目标：补齐统计分析平台能力

1. **数据清洗** — DataWorkshop 补齐 join / pivot / reshape / sort 面板
2. **数据绘图** — 统计图表自动生成（箱线图、QQ 图、分布图）
3. **基础统计** — 假设检验、方差分析、回归诊断
4. **AB 实验分析** — 实验设计、显著性检验、效应量计算
5. **预测分析** — 时间序列、Prophet、简单机器学习模型
6. **运筹规划 / 优化** — 线性规划、资源调度
7. **报告生成** — 自动输出 Markdown / PDF 分析报告
## Phase 4B-8D-D: Relationship Set Topic Graph

Status: implemented.

- Relationship Sets are now topic-scoped dataset graphs rather than flat confirmed-edge lists.
- Isolated selected datasets can be retained as reference context.
- Planner integration distinguishes relationship-set context from query-specific required datasets.
- Remaining future work: backend persistence, richer graph relevance, and optional join preview remain out of scope.

## Phase 4B-8E: Prefill Navigation Payload from AI Workbench

Status: implemented.

- AI Workbench plan cards can open target analysis pages with a safe `sessionStorage` prefill payload.
- Forecast, PathAnalysis, and Attribution consume the payload as suggestions only.
- Target pages require the user to confirm configuration and click run; no analysis auto-runs.
- Remaining future work: extend the same contract to Statistics, Semantic, and DataWorkshop.

## Phase 4B-8E-A: AI Workbench Continuity & Prefill Gap Fix

Status: implemented.

- AI Workbench active session now survives close/reopen.
- Statistics consumes AI Workbench prefill payloads safely and does not auto-run analysis.
- Dataset and relationship-set selectors now support search for larger workspaces.
- Remaining future work: Semantic/DataWorkshop prefill and reusable prefill UI extraction.

## Phase 4B-8F: AI Workbench Context Panel Redesign

Status: implemented.

- AI Workbench now has a reusable Context Panel instead of a preview-only side area.
- Dataset context shows metadata, field summary, and sample rows.
- Relationship set context shows connected tables, isolated/reference tables, confirmed edges, and high-risk edges.
- Related table previews are lazy-loaded per table.
- Remaining future work: analysis history context and optional relationship graph visualization.

## Phase 4B-8G: Analysis History Context and Collapsible Sections

Status: implemented.

- Context Panel modules are now collapsible to keep the right-side Workbench area usable as context grows.
- Collapse state is session-only and stores no raw data.
- Initial analysis history context is available in the Context Panel with recent-history search and safe summaries.
- AI Workbench restores the selected history context id across close/reopen.
- Remaining future work: reusable result-summary contract and future AI result explanation.

## Phase 4B-8H: Safe Result Summary Contract

Status: implemented.

- Added a reusable bounded result summary contract for History, AI Workbench, ResultView, and future Hermes/LLM result explanation.
- Centralized summary extraction in `buildSafeResultSummary`.
- AI Workbench and History now render compatible safe summaries.
- Remaining future work: feed `SafeResultSummary` into a future result explainer boundary.

## Phase 4B-8I: Analysis Result to AI Workbench Handoff

Status: implemented.

- History and Statistics can hand off a safe result summary into AI Workbench.
- AI Workbench opens programmatically and attaches selected result context.
- Result follow-up prompt chips are available without auto-generating explanations.
- Remaining future work: add handoff actions to Forecast, PathAnalysis, and Attribution.

## Phase 4B-8J: Result Follow-up Mode and Default Horizontal Layout

Status: implemented.

- Fresh AI Workbench sessions default to horizontal side-by-side layout.
- Attached result context supports deterministic follow-up answers from `SafeResultSummary`.
- Supported prompts cover explanation, risks, next steps, and report drafting.
- Remaining future work: optional Hermes-backed deeper result explanation.

## Phase 4B-8K: Hermes Result Explainer Boundary Design

Status: design complete.

- Defined the future Hermes result explanation boundary.
- Hermes input is limited to `SafeResultSummary`, bounded metadata context, user question, and safety flags.
- Deterministic result follow-up remains fallback.
- Remaining future work: backend endpoint contract and opt-in Hermes runtime implementation.

## Phase 4B-8L: Hermes Backend API Endpoint Contract

Status: design complete.

- Defined future backend API contract for Hermes assistant integration.
- Endpoint contract covers status, result explanation, and analysis planning.
- Contract requires bounded context only, explicit safety flags, strict size/privacy limits, deterministic fallback, and confirmation before any execute/write action.
- Remaining future work: optional dry-run backend scaffold, frontend Hermes API wrapper, and opt-in runtime selection after explicit approval.
