# InsightEase Project Onboarding Doc

> 版本: 1.0  
> 更新日期: 2026-04-08  
> 项目阶段: Phase 3.0 (AI 助手功能增强 - 已完结)

---

## 1. 项目一句话介绍

InsightEase 是一个面向数据分析的 SaaS 平台，支持本地 IndexedDB 存储和云端数据存储两种模式，提供数据集管理、数据工坊（可视化处理）、AI 智能分析助手等功能。核心特色是通过自然语言对话驱动数据分析，自动生成可视化图表和分析报告。

---

## 2. 技术栈

### 前端
| 类别 | 技术 | 版本 | 用途 |
|-----|------|-----|------|
| 框架 | React | 19.2.0 | UI 框架 |
| 构建 | Vite | 7.2.4 | 构建工具 |
| 语言 | TypeScript | 5.9.3 | 类型系统 |
| 样式 | Tailwind CSS | 3.4.19 | 原子化 CSS |
| UI 组件 | Radix UI | 最新 | Headless 组件 |
| 图表 | Recharts | 2.15.4 | 数据可视化 |
| 动画 | Framer Motion | 12.34.3 | 动画效果 |
| 状态 | Zustand | 5.0.10 | 全局状态 |
| 表单 | React Hook Form | 7.70.0 | 表单处理 |
| 验证 | Zod | 4.3.5 | 数据验证 |
| 本地存储 | Dexie.js | 4.3.0 | IndexedDB 封装 |
| 大数据 | DuckDB-WASM | 1.33.1 | 浏览器内 SQL 引擎 |
| Worker | Comlink | 4.4.2 | Web Worker 通信 |
| 压缩 | fflate | 0.8.2 | LZ4 压缩 |

### 后端
| 类别 | 技术 | 版本 | 用途 |
|-----|------|-----|------|
| 框架 | FastAPI | 最新 | API 框架 |
| 数据库 | SQLAlchemy | 2.x | ORM |
| 数据库 | MySQL (RDS) | 8.0 | 主数据库 |
| 迁移 | Alembic | 最新 | 数据库迁移 |
| 数据 | Pandas | 最新 | 数据处理 |
| 预测 | Prophet | 最新 | 时间序列预测 |
| ML | scikit-learn | 最新 | 机器学习 |
| 图表 | Matplotlib | 最新 | 后端图表生成 |
| 图表 | Seaborn | 最新 | 统计图表 |
| PDF | ReportLab | 最新 | 报告导出 |
| 存储 | OSS2 | 最新 | 阿里云 OSS |
| AI | OpenAI SDK | 最新 | Kimi API 调用 |

---

## 3. 项目目录结构说明

```
InsightEase/
├── app/                              # 前端项目
│   ├── src/
│   │   ├── api/                      # API 客户端
│   │   │   ├── index.ts              # API 导出
│   │   │   ├── datasets.ts           # 数据集 API
│   │   │   ├── analysis.ts           # 分析 API
│   │   │   └── ai.ts                 # AI 对话 API
│   │   │
│   │   ├── components/               # 组件目录
│   │   │   ├── AICompanion.tsx       # AI 悬浮小圆点入口
│   │   │   ├── AIWorkspace.tsx       # ⭐ AI 工作台主面板（双布局）
│   │   │   ├── AnalysisResultRenderer.tsx  # ⭐ 分析结果可视化
│   │   │   ├── AppHeader.tsx         # 顶部导航
│   │   │   ├── AppLayout.tsx         # 页面布局
│   │   │   ├── AppSidebar.tsx        # 侧边栏
│   │   │   ├── DatasetSelector.tsx   # 数据集选择器
│   │   │   ├── DuckDBLoader.tsx      # DuckDB 加载 UI
│   │   │   ├── KimiAvatar.tsx        # Kimi 风格头像
│   │   │   └── SecurityBadge.tsx     # 安全模式徽章
│   │   │
│   │   ├── hooks/                    # 自定义 Hooks
│   │   ├── lib/                      # 工具库
│   │   │   ├── request.ts            # Axios 封装（重要！拦截器已解包）
│   │   │   └── utils.ts              # 工具函数
│   │   │
│   │   ├── pages/                    # 页面组件
│   │   │   ├── AIWorkspace.tsx       # ⭐ AI 工作台（重写版）
│   │   │   ├── Dashboard.tsx         # 仪表盘
│   │   │   ├── Datasets.tsx          # 数据集列表
│   │   │   ├── DataWorkshop.tsx      # 数据工坊
│   │   │   ├── SmartAnalysis.tsx     # 智能分析
│   │   │   └── ...                   # 其他分析页面
│   │   │
│   │   ├── services/                 # ⭐ 核心服务层
│   │   │   ├── analysis-execution.service.ts   # ⭐ 分析执行（轮询、状态管理）
│   │   │   ├── intent-recognition.service.ts   # ⭐ AI 意图识别
│   │   │   ├── companion.service.ts            # AI 助手状态
│   │   │   ├── db.ts                           # IndexedDB 封装
│   │   │   ├── duckdb-service.ts               # DuckDB 服务
│   │   │   └── local-storage.service.ts        # 本地存储服务
│   │   │
│   │   ├── types/                    # TypeScript 类型
│   │   ├── workers/                  # Web Workers
│   │   │   └── duckdb.worker.ts      # DuckDB Web Worker
│   │   │
│   │   ├── App.tsx                   # 应用入口
│   │   └── main.tsx                  # 渲染入口
│   │
│   ├── package.json
│   └── vite.config.ts                # Vite 配置（含 Worker）
│
├── insightease-backend/              # 后端项目
│   ├── app/
│   │   ├── api/v1/endpoints/         # API 端点
│   │   │   ├── datasets.py           # 数据集 CRUD
│   │   │   ├── analysis.py           # ⭐ 分析任务（后台执行）
│   │   │   ├── ai.py                 # AI 对话/解读
│   │   │   └── auth.py               # 认证
│   │   │
│   │   ├── core/                     # 核心模块
│   │   │   ├── config.py             # 配置（含 OSS、Kimi）
│   │   │   ├── database.py           # 数据库连接
│   │   │   ├── security.py           # JWT 认证
│   │   │   └── storage.py            # 存储抽象（本地/OSS）
│   │   │
│   │   ├── models/                   # 数据库模型
│   │   │   └── models.py             # User, Dataset, Analysis
│   │   │
│   │   ├── schemas/                  # Pydantic 模型
│   │   │   ├── dataset.py
│   │   │   ├── analysis.py
│   │   │   └── ai.py
│   │   │
│   │   ├── services/                 # ⭐ 业务逻辑层
│   │   │   ├── ai_service.py                 # AI 服务封装
│   │   │   ├── analysis_service.py           # 描述统计、相关性
│   │   │   ├── visualization_service.py      # ⭐ 图表生成（含中文字体）
│   │   │   ├── prediction_service.py         # 时间序列预测
│   │   │   ├── path_analysis_service.py      # 路径分析
│   │   │   ├── attribution_service.py        # 归因分析
│   │   │   └── sequence_mining_service.py    # 序列挖掘
│   │   │
│   │   └── main.py                   # FastAPI 入口
│   │
│   ├── requirements.txt
│   └── .env.example                  # 环境变量模板
│
└── docs/                             # 文档
```

---

## 4. 核心业务流程

### 4.1 数据集上传流程
```
用户上传 CSV/Excel
    ↓
Frontend → POST /api/v1/datasets/upload
    ↓
Backend: 保存文件（本地/OSS）
    ↓
Backend: Pandas 解析 → 计算质量评分 → 生成 Schema
    ↓
Backend: 保存 Dataset 记录到 MySQL
    ↓
Frontend: 显示数据集列表
```

### 4.2 AI 分析流程（核心）
```
用户输入: "帮我预测下个月的销售额"
    ↓
Frontend → intent-recognition.service.ts
    ↓
调用 Kimi API: 识别意图 → forecast
    ↓
提取参数: {value_column: "销售额", date_column: "日期"}
    ↓
Frontend → POST /api/v1/analysis/
    ↓
Backend: 创建 Analysis 记录（status=pending）
    ↓
Backend: BackgroundTasks 执行分析
    ↓
Backend: 读取数据 → Prophet 预测 → 生成图表（base64）
    ↓
Backend: 更新 Analysis（status=completed, result_data）
    ↓
Frontend: 轮询 GET /api/v1/analysis/{id}/result
    ↓
Frontend: AnalysisResultRenderer 可视化展示
```

### 4.3 双布局系统
```
上下布局 (vertical):
┌─────────────────────┐
│  数据预览 (固定200px) │
├─────────────────────┤
│                     │
│   AI 对话区域        │
│                     │
│   分析结果面板       │
│                     │
└─────────────────────┘

左右布局 (horizontal):
┌──────────┬──────────────────┐
│          │                  │
│ 数据预览  │   AI 对话区域     │
│ (38%)    │   (62%)          │
│          │                  │
│ 可滚动   │   分析结果面板    │
│          │                  │
└──────────┴──────────────────┘
```

---

## 5. 已完成功能

### Phase 1: 基础功能
- [x] 用户注册/登录（JWT）
- [x] 数据集上传（CSV/Excel）
- [x] 数据集列表/下载/删除
- [x] 数据预览（前 N 行）

### Phase 2: 数据工坊
- [x] 可视化数据操作（筛选、去重、派生列等）
- [x] 双存储模式（IndexedDB / 云端）
- [x] DuckDB-WASM 大数据处理
- [x] 本地数据压缩存储

### Phase 3: AI 助手（本次完结）
- [x] AI 意图识别（13 种分析类型）
- [x] 自然语言 → 分析操作映射
- [x] AI 对话（流式输出）
- [x] 分析结果可视化（图表、表格、指标）
- [x] 双布局系统（上下/左右）
- [x] 分析结果图片下载
- [x] 对话历史管理
- [x] 数据集预览集成

### 支持的分析类型
| 类型 | 说明 | 输出 |
|-----|------|-----|
| descriptive | 描述性统计 | 均值、标准差、分位数 |
| correlation | 相关性分析 | 相关性矩阵、热力图 |
| distribution | 分布分析 | 直方图、箱线图 |
| outlier | 异常值检测 | 异常点列表 |
| visualization | 可视化分析 | 自动图表组合 |
| forecast | 时间序列预测 | Prophet 预测图 + 指标 |
| comprehensive | 综合分析 | 统计+相关性+可视化 |
| smart_process | 智能数据处理 | 缺失值/异常值处理 |
| path | 路径分析 | 漏斗、用户路径 |
| attribution | 归因分析 | 多触点归因模型 |
| sequence_mining | 序列模式挖掘 | 频繁模式、关联规则 |
| clustering | 聚类分析 | K-means 聚类 |

---

## 6. 未完成功能

### 已知未完成（技术债）
1. **云端模式数据工坊**: 当前只支持本地数据源，云端模式下数据工坊无法使用
2. **OSS 文件下载**: 云端模式下文件下载需要 OSS 临时链接
3. **数据工坊历史记录**: 操作历史未实现云端同步

### Phase 3.1 规划中
- [ ] 意图识别结果缓存
- [ ] 分析结果 PDF 导出
- [ ] 语音输入
- [ ] 分析模板保存

---

## 7. 已知 Bug / 技术债

### 7.1 已修复的 Bug（本次）
| Bug | 原因 | 修复位置 |
|-----|------|---------|
| 数据集加载失败 | API 拦截器已解包 response.data，代码仍访问 res.data.data | AIWorkspace.tsx, analysis-execution.service.ts |
| 图表不显示 | 后端返回嵌套字典，前端期望数组 | analysis-execution.service.ts 添加数据转换 |
| 中文显示方框 | Matplotlib 未配置中文字体 | visualization_service.py 添加字体配置 |
| 结果面板折叠后无法打开 | 缺少折叠状态 UI | AIWorkspace.tsx 添加折叠条 |

### 7.2 现存技术债
| 问题 | 影响 | 建议 |
|-----|------|-----|
| API 响应结构不一致 | 部分接口直接返回数组，部分返回 {code, data} | 统一返回 ResponseModel |
| 前端类型定义不完整 | 部分 any 类型 | 补充 DatasetPreview, AnalysisResult 等类型 |
| 后端图表 base64 体积大 | 网络传输慢 | 考虑 CDN 或缩略图 |
| 轮询机制 | 实时性不够 | 可升级为 WebSocket |

---

## 8. 前后端 API 契约

### 8.1 重要说明
⚠️ **请求拦截器已解包 response.data**：
```typescript
// request.ts 拦截器
response => response.data  // 直接返回 data

// 所以前端接收的是 {code, data, message}，不是 {data: {code, data}}
const res = await datasetApi.list()  // res 直接是 ApiResponse
if (res.code === 200) { ... }        // 不是 res.data.code
```

### 8.2 数据集 API

#### 上传数据集
```http
POST /api/v1/datasets/upload
Content-Type: multipart/form-data

Request:
- file: File (CSV/Excel)

Response: 
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "filename": "data.csv",
    "row_count": 1000,
    "schema": [{"name": "col", "dtype": "int64"}],
    "quality_score": 85
  }
}
```

#### 获取数据集列表
```http
GET /api/v1/datasets?page=1&page_size=10

Response:
{
  "code": 200,
  "data": {
    "total": 100,
    "items": [Dataset]
  }
}
```

#### 预览数据集
```http
GET /api/v1/datasets/{id}/preview?rows=20

Response:
{
  "code": 200,
  "data": {
    "columns": ["col1", "col2"],
    "data": [{"col1": 1, "col2": 2}],
    "total_rows": 1000
  }
}
```

### 8.3 分析 API

#### 创建分析任务
```http
POST /api/v1/analysis/
Content-Type: application/json

Request:
{
  "dataset_id": "uuid",
  "analysis_type": "forecast",
  "params": {
    "value_column": "销售额",
    "date_column": "日期",
    "periods": 30
  }
}

Response (202 Accepted):
{
  "code": 202,
  "message": "分析任务已创建并开始执行",
  "data": {
    "id": "analysis-uuid",
    "status": "running"
  }
}
```

#### 获取分析结果（轮询）
```http
GET /api/v1/analysis/{id}/result

Response (running):
{
  "code": 200,
  "data": {
    "status": "running",  // pending/running/completed/failed
    "result_data": null
  }
}

Response (completed):
{
  "code": 200,
  "data": {
    "status": "completed",
    "result_data": {
      "charts": [{
        "type": "correlation_heatmap",
        "title": "相关性热力图",
        "image_base64": "base64...",
        "correlation_matrix": {...}
      }],
      "summary": "分析完成"
    }
  }
}
```

### 8.4 AI API

#### 流式对话
```http
POST /api/v1/ai/chat
Content-Type: application/json

Request:
{
  "message": "帮我分析这份数据",
  "chat_history": [{"role": "user", "content": "..."}]
}

Response: text/event-stream

data: {"chunk": "好的", "finished": false}
data: {"chunk": "，", "finished": false}
data: {"chunk": "我来帮您", "finished": false}
data: {"chunk": "", "finished": true, "full_text": "好的，我来帮您"}
```

---

## 9. 数据库表结构说明

### User 表
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  nickname VARCHAR(50),
  avatar VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  is_superuser BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  last_login DATETIME
);
```

### Dataset 表
```sql
CREATE TABLE datasets (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,  -- 本地路径或 oss://bucket/key
  file_size INT DEFAULT 0,
  row_count INT DEFAULT 0,
  col_count INT DEFAULT 0,
  schema JSON,                         -- [{name, dtype, sample_values}]
  quality_score INT,
  ai_summary TEXT,
  status VARCHAR(20) DEFAULT 'uploaded',
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Analysis 表
```sql
CREATE TABLE analyses (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  dataset_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,           -- descriptive/correlation/forecast/...
  status VARCHAR(20) DEFAULT 'pending', -- pending/running/completed/failed
  params JSON,                         -- 分析参数
  result_data JSON,                    -- 分析结果（图表数据）
  ai_interpretation TEXT,              -- AI 解读
  ai_recommendations JSON,
  export_files JSON,
  error_msg TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);
```

---

## 10. 编码规范

### 前端规范
1. **类型定义**: 优先使用 TypeScript 严格类型，避免 `any`
2. **组件命名**: PascalCase，如 `AIWorkspace.tsx`
3. ** hooks 命名**: use 前缀，如 `useDataset()`
4. **API 调用**: 统一通过 services 层，禁止在组件直接调用 axios
5. **状态管理**: 本地状态用 useState，全局用 Zustand
6. **样式**: Tailwind CSS，禁止内联 style（动态值除外）

### 后端规范
1. **API 响应**: 统一返回 `ResponseModel`:
   ```python
   return ResponseModel(code=200, data=..., message="success")
   ```
2. **异常处理**: HTTPException 统一在 endpoints 层抛出
3. **数据库**: 使用 AsyncSession，注意 await
4. **日志**: 使用 logging.getLogger(__name__)
5. **类型**: Pydantic 模型定义在 schemas/ 目录

### 重要约定
1. **列名处理**: 所有列名必须转为字符串 `str(col)`，避免数字列名导致的问题
2. **JSON 序列化**: 后端返回前必须清理 NaN/Inf：`clean_json_data()`
3. **文件路径**: 支持本地路径和 `oss://` 协议路径

---

## 11. 当前开发进度

### Phase 3.0 完成度: 100%

| 功能模块 | 状态 | 备注 |
|---------|------|-----|
| AI 意图识别 | ✅ | 支持 13 种类型 |
| AI 对话 | ✅ | 流式输出 |
| 分析执行 | ✅ | 后台任务 + 轮询 |
| 结果可视化 | ✅ | 图表 + 表格 + 指标 |
| 双布局系统 | ✅ | 上下/左右切换 |
| 结果下载 | ✅ | base64 图片 |
| 对话历史 | ✅ | localStorage |

### 测试状态
- [x] 本地开发环境测试通过
- [ ] 生产环境部署测试（待进行）
- [ ] OSS 配置测试（待进行）

---

## 12. 下一步任务建议

### 高优先级
1. **生产环境部署**: 按照 deploy-init.sh 脚本部署到阿里云
2. **OSS 配置**: 配置阿里云 OSS，解决云端文件存储问题
3. **域名配置**: Nginx + SSL 证书

### 中优先级
4. **性能优化**: 大数据集预览分页加载
5. **错误监控**: Sentry 或类似工具接入
6. **用户反馈**: 添加分析结果反馈机制

### 低优先级
7. **意图缓存**: 相同问题直接返回缓存结果
8. **PDF 导出**: 分析结果导出 PDF 报告

---

## 13. 新 AI 接手时需要重点阅读的文件列表

### 必读的 10 个核心文件

#### 前端（6个）
1. **`app/src/pages/AIWorkspace.tsx`** ⭐⭐⭐
   - AI 工作台主组件，双布局系统实现
   - 数据集选择、预览、对话、结果展示一体化

2. **`app/src/services/analysis-execution.service.ts`** ⭐⭐⭐
   - 分析执行核心逻辑：创建任务、轮询状态、结果转换
   - 包含 correlation_matrix / bar_chart 数据格式转换

3. **`app/src/services/intent-recognition.service.ts`** ⭐⭐⭐
   - AI 意图识别服务
   - 自然语言 → 分析类型映射逻辑

4. **`app/src/components/AnalysisResultRenderer.tsx`** ⭐⭐
   - 分析结果可视化渲染器
   - 支持图表、表格、指标、base64 图片

5. **`app/src/lib/request.ts`** ⭐⭐
   - Axios 封装，注意拦截器已解包 response.data
   - 错误处理、token 注入

6. **`app/src/api/datasets.ts`** ⭐
   - 数据集 API 定义

#### 后端（4个）
7. **`insightease-backend/app/api/v1/endpoints/analysis.py`** ⭐⭐⭐
   - 分析任务 API，后台任务执行逻辑
   - 包含所有分析类型的执行分支

8. **`insightease-backend/app/services/visualization_service.py`** ⭐⭐
   - 图表生成服务
   - 注意中文字体配置（已修复）

9. **`insightease-backend/app/models/models.py`** ⭐⭐
   - 数据库模型定义

10. **`insightease-backend/app/core/storage.py`** ⭐
    - 存储抽象层，支持本地/OSS

### 推荐的阅读顺序
```
1. 先看 models.py 了解数据结构
2. 再看 request.ts 了解 API 调用方式
3. 然后看 analysis-execution.service.ts 了解分析流程
4. 最后看 AIWorkspace.tsx 了解页面整合
```

### 调试技巧
1. **前端控制台**: 查看 `console.log('数据集列表响应:', res)` 等日志
2. **后端日志**: 查看 analysis.py 中的 `logger.info()` 日志
3. **网络面板**: 检查 `/api/v1/analysis/` 和 `/api/v1/datasets` 请求

---

## 附录：快速启动命令

```bash
# 前端
npm run dev          # http://localhost:5173
npm run build        # 生产构建

# 后端
uvicorn app.main:app --reload --port 8000

# 数据库迁移（后端）
alembic revision --autogenerate -m "xxx"
alembic upgrade head
```

---

**祝开发顺利！如有问题，先检查 API 响应结构和拦截器解包逻辑。** 🔥
