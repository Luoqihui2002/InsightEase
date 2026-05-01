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

#### 4A-6-14: ResultView 推广到 Forecast / PathAnalysis（可选后续）
- 验证时间序列和漏斗/图结果结构
- 每个页面需要独立适配器

#### 4A-6-15: ResultChartRenderer 实现（可选后续）
- 在 ResultView 内支持真实 ECharts 图表渲染
- 迁移页面级图表到 ResultView 内部

#### Phase 4B: AI Assistant Upgrade / Hermes Agent（下一主要 Phase）
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
