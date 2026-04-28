# InsightEase 当前架构

**版本**: 2026-04-28
**状态**: Backend Processing-first，Browser-local 栈已移除

---

## 一、核心原则

### Backend Processing 是唯一正式主线

所有正式数据处理统一由后端执行：

- 上传解析 → 后端 Pandas
- 数据集存储 → 后端 MySQL + 磁盘/OSS
- DataWorkshop 操作链 → 后端 pandas 执行
- 分析计算 → 后端 BackgroundTasks
- 前端职责收窄为：上传、配置、展示、调用 API

### Local / Private Mode 不等于 Browser-local Processing

- 最初本地模式是为了企业数据安全
- 当前项目主要用于简历展示和产品能力证明
- 正式主线不再实现 IndexedDB + DuckDB + browser-side processing
- 未来私有化能力应通过 **self-hosted backend / private deployment** 实现
- SaaS 模式下数据和元数据由后端统一管理

---

## 二、当前正式主链路

### 2.1 数据上传与存储

```
用户上传 CSV/Excel
  -> POST /api/v1/datasets/upload
  -> 后端 Pandas 解析 schema
  -> 保存到 MySQL (Dataset 记录) + 磁盘/OSS (文件)
  -> Datasets 列表可查看、删除、下载
```

**涉及文件**:
- 前端: `app/src/pages/Upload.tsx`, `app/src/pages/Datasets.tsx`
- 后端: `insightease-backend/app/api/v1/endpoints/datasets.py`

### 2.2 DataWorkshop 数据清洗

```
用户进入 DataWorkshop
  -> 从后端 Dataset API 选择输入数据集
  -> 构建操作链（filter / select / rename / sort / dedup / derive / sample）
  -> 点击"执行" → POST /datasets/{id}/transform/preview
  -> 后端 pandas 执行 → 返回前 100 行预览 + 统计
  -> 点击"保存为新数据集" → POST /datasets/{id}/transform
  -> 后端保存为新 Dataset → MySQL + storage
  -> 新数据集进入 Datasets 列表，可进入 AIWorkspace 分析
```

**涉及文件**:
- 前端: `app/src/pages/DataWorkshop.tsx`, `app/src/utils/workshop-adapter.ts`, `app/src/api/workshop.ts`
- 后端: `insightease-backend/app/api/v1/endpoints/transform.py`, `transform_service.py`, `transform_executor.py`

### 2.3 AI 智能分析

```
用户进入 AIWorkspace
  -> 选择数据集 → 加载前 5 行预览
  -> 自然语言输入分析需求
  -> AI 意图识别 → 提取分析类型和参数
  -> POST /api/v1/analysis/ → 创建后台任务
  -> 轮询任务状态 (3s 间隔)
  -> 任务完成 → 展示图表/表格/指标/下载
```

**涉及文件**:
- 前端: `app/src/pages/AIWorkspace.tsx`, `app/src/services/intent-recognition.service.ts`, `app/src/services/analysis-execution.service.ts`, `app/src/components/AnalysisResultRenderer.tsx`
- 后端: `insightease-backend/app/api/v1/endpoints/analysis.py`, `ai.py`

---

## 三、当前不再支持的路径

以下路径在本轮重构后**不再作为正式功能**提供：

- **Browser-local processing** 不再作为正式路径
- **IndexedDB** 不再作为正式数据集存储
- **DuckDB-WASM** 不再作为正式处理引擎
- **前端安全模式按钮**不再切换数据路径
- **DataWorkshop 浏览器端执行**正式数据处理的功能已移除

> 这些功能对应的代码（`legacy/browser-processing/` 目录及其依赖）已删除。若未来需要私有化部署能力，应通过 self-hosted backend 实现，而非浏览器端处理。

---

## 四、技术栈

### 前端

| 层 | 技术 |
|---|---|
| 框架 | React 18 + TypeScript |
| 构建 | Vite |
| UI | Tailwind CSS + Radix UI + shadcn/ui |
| 图表 | ECharts |
| 状态 | React hooks + localStorage（仅 UI 状态）|
| HTTP | Axios（带拦截器）|

### 后端

| 层 | 技术 |
|---|---|
| 框架 | FastAPI + Python 3.11 |
| ORM | SQLAlchemy 2.0 (async) |
| 数据库 | MySQL (aiomysql) |
| 文件存储 | 本地磁盘 / 阿里云 OSS（切换）|
| 数据处理 | pandas |
| AI | OpenAI-compatible API (Kimi) |
| 任务 | BackgroundTasks |

---

## 五、部署与存储

### File Storage Backend

- **Local Disk** — 默认，文件存服务器本地 `./data/uploads/`
- **Aliyun OSS** — 配置环境变量后自动切换
- 切换方式：环境变量 / 后端配置，前端不感知

### Metadata Storage

- 统一走 **Cloud metadata**（MySQL RDS）
- 前端无全局模式切换按钮
- SecurityBadge 仅展示静态架构状态

---

## 六、已删除的 Legacy 栈

| 组件 | 状态 |
|---|---|
| `app/src/legacy/browser-processing/` | 已删除 |
| `app/src/components/DuckDBLoader.tsx` | 已删除 |
| `@duckdb/duckdb-wasm` 依赖 | 已移除 |
| `comlink` 依赖 | 已移除 |
| `dexie` 依赖 | 已移除 |
| `fflate` 依赖 | 已移除 |
| DataWorkshop 内联执行函数 | 已删除 |
| `EngineIndicator` 组件 | 已删除 |
