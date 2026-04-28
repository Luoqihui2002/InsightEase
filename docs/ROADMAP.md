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

### 4A-4: Analysis Pages 迁移（按风险升序）
1. **4A-4-0** — 构建 7 个分析专用共享组件
2. **4A-4-1** — Semantic + Clustering（低风险验证）
3. **4A-4-2** — Statistics + Attribution（中风险，验证 ECharts + 统计卡片）
4. **4A-4-3** — SmartProcess + GoalPlanner（中风险，验证文件下载 + 自定义布局）
5. **4A-4-4** — Forecast（高风险，验证复杂配置面板）
6. **4A-4-5** — PathAnalysis（高风险，验证多类型选择器 + 子组件）

### 4A-5: 交互一致性治理
- 原生 `<select>` → shadcn `Select`
- 手写 toggle → shadcn `Switch`
- 手写模态框 → shadcn `Dialog`
- 原生 `confirm()` / `alert()` → `AlertDialog` + `toast`

### 4A-6: 工程优化
1. **Bundle splitting** — `manualChunks` 拆分 vendor / echarts / radix，解决 3.3MB warning
2. **API 类型统一** — 修复拦截器解包导致的类型混乱，移除 `as any`
3. **Alembic 引入** — 数据库版本化管理，替代手动 SQL
4. **storage.read() 统一** — 修复 analysis.py 后台任务 OSS 兼容性问题

---

## Phase 4B: AI Assistant Upgrade / Hermes Agent Research

目标：从"意图识别 + 轮询"升级为 Agent 架构

1. **审计 AICompanion / AIWorkspace / ai_service** — 梳理当前 AI 链路边界
2. **研究 Hermes Agent 接入** — 评估 Agent 架构对现有意图识别流程的替换或增强
3. **设计 Agent Adapter Layer** — 统一 AI 服务调用接口，支持多模型切换
4. **基于数据集 schema 主动生成下一步建议** — AI 自动推荐分析路径
5. **AI 生成 transform / chart / analysis plan** — 自然语言直接生成操作链或可视化配置

---

## Phase 5: Dashboard & ECharts Upgrade

目标：从单图表升级为可保存的 Dashboard

1. **高级 ECharts 图表** — 桑基图、热力图、地理坐标、3D 图表等
2. **AI 图表推荐** — 基于数据特征自动推荐最佳图表类型
3. **Dashboard 保存** — 多图表组合布局，持久化到后端
4. **图表导出** — 支持 PNG/SVG/PDF 多格式导出

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
