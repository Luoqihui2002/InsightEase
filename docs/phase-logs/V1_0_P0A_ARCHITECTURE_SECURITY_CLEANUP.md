# InsightEase V1.0 P0A：架构与安全收口

**完成日期**：2026-09-03

**状态**：代码完成并通过本地静态检查、生产构建与后端测试

**范围边界**：本轮只完成 P0A；未实现 P0B Hermes Live Planning，也未进入 P0C 多表执行。

## 本轮结果

P0A 将当前产品主链路收敛为：

```text
数据上传 / 数据集目录
  -> 数据画像与关系候选（Assistant metadata APIs）
  -> 前端确定性分析规划与人工确认
  -> 既有 Transform / Analysis 执行
  -> SafeResultSummary
  -> Hermes 结构化结果解释
```

旧 Kimi `/api/v1/ai/*`、前端旧意图识别/自动执行链和 SmartAnalysis mock 页面已退出运行时。Dataset、Transform、Analysis 以及 Hermes Result Explainer 的正式主链保持不变。

## 代码变更

### 架构清理

- 删除后端旧 `/api/v1/ai/*` 路由、Kimi service 与旧 AI schema，并移除 `openai` 依赖。
- 删除前端 `aiApi`、旧 intent recognition、旧 analysis execution、SmartAnalysis route/page、Kimi 专属组件和未引用结果渲染器。
- 删除 `Attribution.tsx.bak` 以及会重新生成旧架构和危险默认值的根目录 `setup_backend.py`。
- 移除 Vite 中未使用的 Kimi inspect 插件。
- 去掉旧 descriptive/comprehensive 分析中的 Kimi 自动总结；分析结果仍由正式 Hermes Result Explainer 链路解释。

### 产品语义校正

- 将 `Semantic` 页面改名为 `Data Overview`（数据概览），路由改为 `/app/data-overview`。
- 保留 `/app/semantic` 到新页面的兼容跳转，但不再宣称页面具备情感、主题或语义推断能力。
- 规划器中的 `semantic` 能力改为 `data_overview`；数据目录中的历史 `semantic` 标签归一为 `text_data`。
- Companion 的旧 SmartAnalysis 跳转改为 AI Workbench 入口。

### 安全与发布收口

- 修复报告生成、下载、预览未校验登录和数据所有权的问题；报告文件按用户隔离，并验证报告 UUID 与格式。
- 生产环境拒绝空/示例数据库密码、root 数据库用户、弱或占位 JWT secret。
- 非生产环境缺少 secret 时仅生成进程级临时 secret；默认关闭 debug，并显式限定本地 CORS origin。
- 生产环境即使配置 `*` 也不会开放通配 CORS；通配模式不携带凭据。
- 全局异常、数据集、转换、预测和后台分析任务不再向客户端返回内部异常文本、文件路径或堆栈信息；详细错误只写服务端日志。
- 部署文档移除个人 RDS 主机与用户名，统一使用 `.env.example` 中的占位配置。

## 本轮发现并处理的问题

1. 报告 API 可跨用户读取分析记录和生成文件：已修复为认证、所有权校验和用户级文件目录。
2. 后台分析失败会把 traceback 放进持久化结果并返回前端：已改为公开安全错误，内部保留日志。
3. 默认数据库密码、JWT secret、debug 与 CORS 配置不适合公开部署：已改为安全默认值并添加生产校验。
4. 部署文档包含个人云数据库标识：已替换为通用示例。
5. Semantic 页面名称暗示了代码并未实现的 NLP 能力：已改为 Data Overview 并修正文案/类型。
6. 根目录脚本仍可重新生成旧 Kimi 架构和危险配置：已删除。

## 验证结果

- Frontend ESLint：通过，0 error / 357 warnings；warning 主要来自遗留 `any`、未使用参数及部分 React 19 建议。
- Frontend production build：通过；存在单个主 bundle 超过 500 kB 的性能提醒。
- Backend pytest：`74 passed, 6 skipped`。
- 6 个跳过项为需要真实 MySQL 和运行中后端的 Transform 集成测试；设置 `INSIGHTEASE_RUN_INTEGRATION=1` 后可在完整环境运行。
- 新增 P0A 回归测试覆盖：旧 AI route 消失、Assistant/Hermes route 保留、安全配置、生产配置拒绝、报告用户隔离、全局异常脱敏。

## 未解决项

- 真实 MySQL + 浏览器端到端回归仍需在部署环境执行。
- 前端 bundle 仍偏大，应在非功能清理轮次做 route/chunk 拆分。
- 前端仍有一批历史 ESLint warning；本轮只修复会阻塞构建或反映真实错误的项目。
- 少数 Pydantic schema 仍使用 v1 风格 `class Config`，测试会给出迁移 warning。
- Data Overview 当前复用 comprehensive analysis；它没有独立 NLP/语义后端，这正是本轮明确后的产品边界。
- `docs/archive/` 保留历史 Kimi 记录用于追溯，但这些文档已明确标记为非当前架构。

## 下一步 P0B 入口（仅定义，未实现）

下一轮建议只建立 **Hermes Live Planning**：

1. 新增单一后端规划入口，例如 `/api/v1/assistant/hermes/plan-analysis`。
2. 请求只携带用户问题、数据集 profile 和已确认的 relationship metadata，不传原始数据行。
3. Hermes 输出必须通过严格 Analysis Plan schema 校验；失败时回退到现有确定性 planner。
4. Workbench 明确显示 live/fallback 来源并要求用户确认。
5. P0B 不自动执行分析、不生成 SQL、不做 join、不修改数据集；多表执行留给 P0C。

P0B 的完成标准是“用户问题能得到可验证、可回退、需确认的 live plan”，而不是端到端自动分析。
