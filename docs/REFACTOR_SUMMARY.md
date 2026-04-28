# InsightEase Phase 3 架构重构总结报告

**日期**: 2026-04-28
**范围**: Backend Processing-first 架构迁移（Browser-local → Backend）
**状态**: Phase 3 代码重构、legacy 清理、类型检查与生产构建已完成；进入 Phase 4 前建议补做完整浏览器端到端回归测试。

---

## 一、修复前的问题

### 1.1 架构层面

| 问题 | 影响 | 严重程度 |
|---|---|---|
| DataWorkshop 操作链完全在浏览器内存执行 | 大文件导致崩溃，无法处理 >10万行数据 | 🔴 P0 |
| DataWorkshop 结果不持久化 | 刷新页面即丢失，无法复用 | 🔴 P0 |
| 存在完整的 Browser-local processing 栈 | 与 Backend Processing 主线架构冲突，维护负担重 | 🟡 P1 |
| engine-selector 仅用于 UI 展示 | 用户被误导"高性能引擎"，实际从未触发 DuckDB | 🟡 P1 |
| Axios 拦截器返回 `response.data`，但代码仍按 `AxiosResponse<T>` 访问 | 类型系统大面积报错，运行时取错字段 | 🟡 P1 |
| 大量未使用的导入/变量 | `tsc --noEmit` 无法通过，构建失败 | 🟡 P1 |
| DuckDB/Dexie/Comlink/fflate 依赖占用 bundle 体积 | 3.3MB+ JS，且无运行时价值 | 🟢 P2 |

### 1.2 执行链路（修复前）

```
用户选择数据文件
  -> FileReader 读取为内存 DataTable（IndexedDB）
  -> 前端内联执行 9 种操作（纯 JS 循环）
  -> 结果写入 React state（previewData）
  -> 刷新丢失，无法进入分析链路
```

---

## 二、本轮架构决策

### AD-001: Backend Processing 是唯一正式主线

- 上传解析 → 后端 Pandas
- 数据集存储 → 后端 MySQL + 磁盘/OSS
- DataWorkshop 操作链 → 后端 pandas 执行
- 分析计算 → 后端 BackgroundTasks
- 前端职责收窄为：上传、配置、展示、调用 API

### AD-002: Browser Processing 栈已移除

- `legacy/browser-processing/` 目录已删除
- 主链路代码不再 import 任何 browser-local 模块
- 不再基于浏览器本地处理开发新功能

### AD-003: DataWorkshop 后端化

- 前端只构建操作链 UI
- `POST /datasets/{id}/transform/preview` — 预览不保存
- `POST /datasets/{id}/transform` — 执行并保存为新 Dataset
- 后端 pandas 串行执行每个 operation

### AD-004: Local / Private Mode 不等于 Browser-local Processing

- 最初本地模式是为了企业数据安全
- 当前项目主要用于简历展示和产品能力证明
- 正式主线不再实现 IndexedDB + DuckDB + browser-side processing
- 未来私有化能力应通过 self-hosted backend / private deployment 实现
- SaaS 模式下数据和元数据由后端统一管理

---

## 三、完成的 Phase 列表

| Phase | 名称 | 状态 | 关键产出 |
|---|---|---|---|
| 3A | Legacy Isolation | ✅ | 识别并标记所有 browser-local 代码 |
| 3B | 设计文档与 API 契约 | ✅ | `DATAWORKSHOP_BACKENDIZATION_PLAN.md` |
| 3C | 后端 Transform API 实现 | ✅ | `transform.py`, `transform_executor.py`, `transform_service.py` |
| 3C1 | 后端 Transform API 报告 | ✅ | `PHASE3C1_BACKEND_TRANSFORM_REPORT.md` |
| 3C1.5 | 后端集成验证 | ✅ | `PHASE3C1_5_BACKEND_INTEGRATION_REPORT.md` |
| 3D-2 | Preview 后端集成 | ✅ | DataWorkshop `executeOperations` 调用 `workshopApi.preview` |
| 3D-3 | Save as new dataset | ✅ | `handleSaveAsDataset` 调用 `workshopApi.transform` |
| 3D-4 | Legacy 依赖清理 | ✅ | 移除 `localStorageService`、`engineSelector`、`EngineIndicator` import 和 state |
| 3E-1 | 废弃执行函数清理 | ✅ | 删除 9 个内联 browser-side 执行函数 |
| 3E-2A | Legacy 审计 | ✅ | 确认 `legacy/browser-processing/` 无任何外部引用 |
| 3E-2B | 删除 dead legacy 代码和无用依赖 | ✅ | 删除目录 + 4 个 npm 依赖 + `DuckDBLoader.tsx` |
| 3F | Build Gate Cleanup | ✅ | `tsc --noEmit` 0 errors, `npm run build` 成功 |
| 3G | 最终回归测试与文档收口 | 🟡 部分完成：build 已通过，文档已生成；浏览器 E2E 待人工验证。 | 本报告 + build 验证 |

---

## 四、当前不再支持的路径

以下路径在本轮重构后**不再作为正式功能**提供：

- **Browser-local processing** 不再作为正式路径
- **IndexedDB** 不再作为正式数据集存储
- **DuckDB-WASM** 不再作为正式处理引擎
- **前端安全模式按钮**不再切换数据路径
- **DataWorkshop 浏览器端执行**正式数据处理的功能已移除

> 说明：这些功能对应的代码（`legacy/browser-processing/` 目录及其依赖）已删除。若未来需要私有化部署能力，应通过 self-hosted backend 实现，而非浏览器端处理。

---

## 五、当前正式主链路

### 5.1 数据上传与存储

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

### 5.2 DataWorkshop 数据清洗

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

### 5.3 AI 智能分析

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

## 六、已删除的 Legacy 栈

### 6.1 删除的文件

| 文件/目录 | 说明 |
|---|---|
| `app/src/legacy/browser-processing/` | 整个目录（README.md, db.ts, duckdb-service.ts, duckdb.worker.ts, engine-selector.ts, local-storage.service.ts, operation-executor.ts） |
| `app/src/components/DuckDBLoader.tsx` | DuckDB WASM 加载状态 UI |
| `app/src/pages/DataWorkshop.tsx` 内联函数 | `executeJoin`, `executeFilter`, `executeTransform`, `executeDedup`, `executeReshape`, `executePivot`, `executeDerive`, `executeSample` |
| `app/src/components/SecurityBadge.tsx` | `EngineIndicator` 组件定义 |

### 6.2 移除的 npm 依赖

| 依赖 | 说明 |
|---|---|
| `@duckdb/duckdb-wasm` | DuckDB WebAssembly 引擎 |
| `comlink` | Web Worker 通信封装 |
| `dexie` | IndexedDB 封装 |
| `fflate` | 数据压缩 |

### 6.3 移除的前端 State / UI

- `engineDecision` state（引擎选择决策）
- `localDatasets` state（本地数据集列表）
- `showLocalDatasets` state（本地数据集弹窗）
- `storageStats` state（本地存储统计）
- "从本地导入"按钮
- 引擎指示器 UI（显示 JS/DuckDB 引擎类型）

---

## 七、Build 验证结果

### 7.1 TypeScript 编译

```bash
cd app && npx tsc --noEmit
```

**结果**: 0 errors ✅

### 7.2 生产构建

```bash
cd app && npm run build
```

**结果**: ✅ built in 19.47s
- `dist/assets/index-r8seU2qn.css` — 113.22 kB (gzip: 18.70 kB)
- `dist/assets/index-B59V8C6n.js` — 3,365.55 kB (gzip: 1,000.55 kB)

**警告**: chunk size > 500 kB（已知，待 Phase 4 优化 code-splitting）

### 7.3 后端测试

```bash
cd insightease-backend
python -m pytest tests/test_transform_integration.py -v -s
```

**结果**: 6 项全部通过（Phase 3C1.5 已验证）

---

## 八、手动回归测试状态

> **环境限制说明**: 本地 MySQL 未运行（后端配置为远程 RDS），因此完整端到端浏览器测试无法在本机执行。以下测试状态基于代码层面验证 + 历史验证报告。

| 测试项 | 状态 | 依据 |
|---|---|---|
| 注册 / 登录 | ⚠️ 未本地验证 | 后端 `auth.py` 未改动，JWT 机制稳定 |
| 上传 CSV | ⚠️ 未本地验证 | 后端 `datasets.py` 未改动，Upload.tsx 类型已修复 |
| Datasets 列表和预览 | ⚠️ 未本地验证 | `datasetApi` 未改动，AIWorkspace.tsx 预览逻辑已修复 |
| DataWorkshop 后端 preview | ✅ 代码链路完整 | `DataWorkshop.tsx:479` 调用 `workshopApi.preview` |
| DataWorkshop 保存为新数据集 | ✅ 代码链路完整 | `DataWorkshop.tsx:531` 调用 `workshopApi.transform` |
| 新数据集进入 Datasets | ✅ 后端验证通过 | Phase 3C1.5 集成测试确认 `parent_dataset_id` 正确 |
| 新数据集进入 AIWorkspace | ⚠️ 未本地验证 | `datasetApi.list` 未改动，新 Dataset 数据结构兼容 |
| 页面无 console error | ✅ 代码审查通过 | 无遗留 legacy 引用，无未捕获异常路径 |

**建议**: 在进入 Phase 4 前，在可连接 RDS 的环境中补做一次完整浏览器端到端测试。

---

## Phase 3G Manual Regression Checklist

以下 checklist 需在可连接后端的环境中逐项人工验证：

- [ ] 注册 / 登录
- [ ] 上传 CSV
- [ ] Datasets 列表可见
- [ ] Datasets 预览正常
- [ ] DataWorkshop 执行 filter + rename preview
- [ ] DataWorkshop 保存为新数据集
- [ ] 新数据集出现在 Datasets
- [ ] 新数据集可进入 AIWorkspace / SmartAnalysis
- [ ] 页面无 console error

---

## 九、当前技术债

### Blocking before public demo

以下债务必须在对外演示前解决：

| 债务 | 影响 | 方案 |
|---|---|---|
| 完整浏览器 E2E 回归测试 | Phase 3G 尚未完成人工验证 | 在可连接 RDS 的环境中跑通全部 checklist |
| analysis.py 后台任务未走 `storage.read()` | OSS 环境下读取文件失败 | 统一使用 `storage.read()` + 临时文件模式 |
| 数据库 migration / Alembic 记录 | 当前靠手动 SQL，不利于团队协作 | 引入 Alembic，管理 `parent_dataset_id` 等后续字段 |

### Engineering quality

| 债务 | 影响 | 建议处理时间 | 方案 |
|---|---|---|---|
| API 响应类型混乱（拦截器解包） | 前端大量使用 `as any` / `as unknown as` | Phase 4A | 统一 API 层返回类型，移除拦截器解包或全面适配 |
| JS bundle 3.3MB | 首屏加载慢 | Phase 4A | `manualChunks` code-splitting，拆分 vendor / echarts / radix |
| 测试覆盖率不足 | 回归靠手动 | 持续 | 补充前端单元测试（vitest）和后端单元测试 |

### Product backlog

| 债务 | 说明 | 计划阶段 |
|---|---|---|
| DataWorkshop join / pivot / reshape | 后端 executor 已预留扩展，需补前端面板 | Phase 4B 或更晚 |
| sort 独立前端面板 | 当前可通过 transform reorder 满足基础需求 | Phase 4B 可选 |
| Hermes Agent 接入 | AI Agent 架构升级 | Phase 4B |
| ECharts Dashboard | 高级图表与 Dashboard 保存 | Phase 5 |
| AB 实验分析 | 统计分析平台能力 | Phase 6 |

---

## 十、下一阶段路线

### Phase 4A: Engineering Stabilization

1. **Bundle splitting** — `manualChunks` 拆分 vendor / echarts / radix，解决 3.3MB warning
2. **API 类型统一** — 修复拦截器解包导致的类型混乱，移除 `as any`
3. **Alembic 引入** — 数据库版本化管理，替代手动 SQL
4. **storage.read() 统一** — 修复 analysis.py 后台任务 OSS 兼容性问题

### Phase 4B: AI Assistant Upgrade / Hermes Agent Research

1. **审计 AICompanion / AIWorkspace / ai_service** — 梳理当前 AI 链路边界
2. **研究 Hermes Agent 接入** — 评估 Agent 架构对现有意图识别流程的替换或增强
3. **设计 Agent Adapter Layer** — 统一 AI 服务调用接口，支持多模型切换
4. **基于数据集 schema 主动生成下一步建议** — AI 自动推荐分析路径
5. **AI 生成 transform / chart / analysis plan** — 自然语言直接生成操作链或可视化配置

### Phase 5: Dashboard & ECharts Upgrade

1. **高级 ECharts 图表** — 桑基图、热力图、地理坐标、3D 图表等
2. **AI 图表推荐** — 基于数据特征自动推荐最佳图表类型
3. **Dashboard 保存** — 多图表组合布局，持久化到后端
4. **图表导出** — 支持 PNG/SVG/PDF 多格式导出

### Phase 6: Statistical Analysis Platform Completion

1. **数据清洗** — DataWorkshop 补齐 join / pivot / reshape / sort 面板
2. **数据绘图** — 统计图表自动生成（箱线图、QQ 图、分布图）
3. **基础统计** — 假设检验、方差分析、回归诊断
4. **AB 实验分析** — 实验设计、显著性检验、效应量计算
5. **预测分析** — 时间序列、 Prophet、简单机器学习模型
6. **运筹规划 / 优化** — 线性规划、资源调度
7. **报告生成** — 自动输出 Markdown / PDF 分析报告

---

## 十一、关键文件清单（Phase 3 新增/修改）

### 前端

```
app/src/
├── pages/
│   └── DataWorkshop.tsx              # 重写执行链路，移除 legacy
├── api/
│   └── workshop.ts                   # 新增 transform API 封装
├── utils/
│   └── workshop-adapter.ts           # 新增 frontend operation → backend WorkshopOperation 映射
├── types/
│   └── workshop.ts                   # 新增 WorkshopOperation 联合类型、TransformPreview、TransformResult
├── components/
│   └── SecurityBadge.tsx             # 移除 EngineIndicator
├── services/
│   ├── index.ts                      # 移除 legacy 导出
│   ├── analysis-execution.service.ts # 修复 API 响应类型
│   └── companion-service.ts          # 修复 process.env → import.meta.env
└── vite.config.ts                    # 移除 DuckDB optimizeDeps
```

### 后端

```
insightease-backend/app/
├── api/v1/endpoints/
│   └── transform.py                  # 新增 preview + transform 路由
├── services/
│   └── transform_service.py          # 新增业务层（文件 I/O、事务管理）
├── core/
│   └── transform_executor.py         # 新增执行层（纯 pandas，无 HTTP/DB 依赖）
├── schemas/
│   └── transform.py                  # 新增 Pydantic schema
└── models/models.py                  # 新增 parent_dataset_id, transform_chain
```

---

## 十二、结论

**Phase 3 代码重构、legacy 清理、类型检查与生产构建已完成。**

- ✅ DataWorkshop 从浏览器本地处理迁移至后端 pandas 执行
- ✅ preview + transform 双 API 稳定运行，集成测试 6/6 通过
- ✅ 所有 browser-local processing 代码和依赖已清理
- ✅ TypeScript 编译 0 errors，生产构建成功
- ✅ 前端正式主链路明确：Upload → Datasets → DataWorkshop → AIWorkspace
- 🟡 Phase 3G 浏览器端到端回归测试待人工验证

**进入 Phase 4 前建议补做完整浏览器端到端回归测试。**

建议 Phase 4A 优先处理：Bundle splitting、API 类型统一、Alembic 引入。
