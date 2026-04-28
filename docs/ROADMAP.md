# InsightEase 路线图

**版本**: 2026-04-28
**当前阶段**: Phase 3 已完成，等待 3G 浏览器 E2E 验证后进入 Phase 4

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

### 4A-5: 交互一致性治理（下一Phase）
- 原生 `<select>` → shadcn `Select`（分析页面列选择器）
- 手写 toggle → shadcn `Switch`
- 手写模态框 → shadcn `Dialog`
- 原生 `confirm()` / `alert()` → `AlertDialog` + `toast`
- 原生 `<table>` → `DataTablePreview`（结果区表格）
- `AnalysisResultSummary` / `AnalysisPollingOverlay` 评估与推广

### 4A-6: 工程优化与视觉打磨
1. **Bundle splitting** — `manualChunks` 拆分 vendor / echarts / radix，解决 3.3MB warning
2. **API 类型统一** — 修复拦截器解包导致的类型混乱，移除 `as any`
3. **Alembic 引入** — 数据库版本化管理，替代手动 SQL
4. **storage.read() 统一** — 修复 analysis.py 后台任务 OSS 兼容性问题
5. **硬编码颜色清理** — ECharts 选项使用 CSS variable 动态获取
6. **剩余 glass 类清理** — SmartAnalysis、DataWorkshop

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
