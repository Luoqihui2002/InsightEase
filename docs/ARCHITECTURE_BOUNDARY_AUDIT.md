# InsightEase Architecture Boundary Audit

**日期**: 2026-04-27  
**范围**: 全栈（前端 `app/src/` + 后端 `insightease-backend/app/` + `docs/`）  
**原则**: 本轮只审计，不改代码，不删除代码。  
**版本**: v1.0

---

## 核心结论（TL;DR）

当前架构的主线偏差在于 **Upload、Datasets、DataWorkshop 三条路径在"安全模式"下走浏览器本地处理**。
AIWorkspace 和所有分析页面已经是正确的 Backend Processing 主线。
后端完全不知道前端模式，这是合理的（后端不应感知前端 metadata mode），但后端需要统一处理所有数据请求。
浏览器本地处理模块（DuckDB、IndexedDB、operation-executor、engine-selector）虽然代码量大，但大部分不在当前活跃调用链上，迁移成本主要是删除/隔离引用，而非重写逻辑。

---

## 一、逐功能审计（20 个模块）

| 功能/模块 | 当前真实职责 | 当前数据来源 | 当前处理位置 | 当前保存位置 | 是否符合目标架构 | 是否主链路 | 冗余/错位点 | 建议动作 | 风险 |
|---|---|---|---|---|---|---|---|---|---|
| **1. Login / Auth** | JWT 注册/登录，token 管理 | 表单输入 → `authApi.login/register` ([auth.ts](../app/src/api/auth.ts)) | 后端 `auth.py` bcrypt + JWT | MySQL `users` 表；`localStorage.access_token` | **是** | 是 | 无 | Keep as main path | Low |
| **2. Upload** | 文件上传，根据 `isLocalMode` 分支 | `File` 对象 | `isLocalMode=true`: 浏览器 `FileReader` 手工解析 ([Upload.tsx:141-209](../app/src/pages/Upload.tsx#L141)); `isLocalMode=false`: 后端 `datasets.py` pandas 解析 | local: IndexedDB; cloud: 磁盘/OSS + MySQL | **否**（local 分支走浏览器本地存储） | 是 | local 分支把数据集落入 IndexedDB，后端分析页面无法访问 | Refactor into backend-managed path | High |
| **3. Datasets** | 数据集列表/预览/删除/下载 | `isLocalMode=true`: `localStorageService.listDatasets()` ([Datasets.tsx:96-129](../app/src/pages/Datasets.tsx#L96)); `isLocalMode=false`: `datasetApi.list/preview` | local: IndexedDB 读取+fflate解压; cloud: 后端 API | local: IndexedDB; cloud: MySQL + 磁盘/OSS | **否** | 是 | local 分支的数据集无法被 SmartAnalysis/AIWorkspace 等后端分析页面使用 | Refactor into backend-managed path | High |
| **4. DataWorkshop** | 数据工坊，可视化操作数据 | `datasetApi.list` + `localStorageService.importDataset`（**无条件落入 IndexedDB**）([DataWorkshop.tsx:376](../app/src/pages/DataWorkshop.tsx#L376)) | 浏览器内存纯 JS 执行，**不调用后端** ([DataWorkshop.tsx:547-613](../app/src/pages/DataWorkshop.tsx#L547)) | 结果仅内存 state，不保存 | **否** | 是 | 未调用后端 API 执行操作链；`engine-selector`、`duckdb-service` 均未被实际调用 | Refactor into backend-managed path | High |
| **5. AIWorkspace** | AI 工作台：对话 + 分析执行 + 结果展示 | `datasetApi.list`; `intentRecognitionService.recognizeIntent` (本地 `quickMatch` + `aiApi.chatStream`); `analysisExecutionService` | 意图识别本地关键词匹配 + Kimi API; 分析任务完全后端 BackgroundTasks | MySQL `analyses`; 对话历史 `localStorage.ai_workspace_sessions` | **基本符合**（分析走 backend） | 是 | `quickMatch` 是本地硬编码规则，可作为 fallback；对话历史未同步到后端 | Keep as main path | Low |
| **6. SmartAnalysis** | 智能分析页面 | `datasetApi.getDetail/preview`; `analysisApi.create/getResult` | 完全后端 | MySQL `analyses` | **是** | 是 | 无 | Keep as main path | Low |
| **7. AnalysisResultRenderer** | 分析结果可视化渲染器 | `result` prop | 纯前端渲染（Recharts / base64 / 表格） | 不保存 | **是** | 是 | 无 | Keep as main path | Low |
| **8. Settings** | 设置页面，含模式切换 UI | `localStorage.insightease_settings` | 纯前端状态 | `localStorage.insightease_settings` + `insightease_security_mode` | **否**（当前切换的是 browser-local vs cloud，不是 metadata storage mode） | 是 | 模式概念错误，导致整个产品理解偏差 | Rename / clarify only | Medium |
| **9. SecurityBadge** | 顶部模式切换按钮/状态显示 | `localStorageService.getSecurityMode()` ([SecurityBadge.tsx:21](../app/src/components/SecurityBadge.tsx#L21)) | 纯前端 | `localStorage` | **否** | 是（[AppHeader.tsx](../app/src/components/AppHeader.tsx) 挂载） | `toggleMode` 会改变整个 Upload/Datasets 的行为分支 | Rename / clarify only | Medium |
| **10. AICompanion** | 悬浮 AI 助手 | `companionService`（规则引擎 + `mockResponses`） | 浏览器本地规则匹配 + 硬编码回复 | `localStorage` companion state | **否**（AI 调用被注释，用 mock） | 是（AppLayout 挂载） | `generateAIContent` 中 `aiApi.chat` 被注释 | Deprecate but keep | Low |
| **11. 后端 datasets API** | 数据集 CRUD、上传、预览、下载 | multipart file / MySQL | 后端 `datasets.py` pandas 解析 + `storage.save` | MySQL + 磁盘/OSS | **是** | 是 | 无 | Keep as main path | Low |
| **12. 后端 analysis API** | 分析任务创建、执行、结果查询 | MySQL Dataset / 文件系统 | 后端 `analysis.py` BackgroundTasks + pandas/Prophet/sklearn | MySQL `analyses` | **是** | 是 | 后台任务读取文件时**未处理 OSS 路径** ([analysis.py:84-96](../insightease-backend/app/api/v1/endpoints/analysis.py#L84))；`smart_process`/聚类结果未走 `storage` 抽象 | Refactor into backend-managed path | Medium |
| **13. 后端 ai API** | AI 对话/解读/建议 | 用户消息 / Kimi API | 后端 `ai_service.py` → Moonshot API | 无持久化 | **是** | 是 | 无 | Keep as main path | Low |
| **14. 后端 storage.py** | 文件存储抽象层 | datasets.py / analysis.py 等 | 后端 | `./data/uploads` 或 `oss://bucket` | **是** | 是 | OSS 下 `get_local_path` 返回 `None`（TODO）；`analysis.py` 后台任务未使用 `storage.read`；`reports.py` 硬编码 `./data/reports` | Refactor into backend-managed path | Medium |
| **15. local-storage.service.ts** | 浏览器本地数据集存储 + 安全模式管理 + 操作执行 | `FileReader` / IndexedDB | 浏览器（FileReader 解析、JS/DuckDB 执行） | IndexedDB + `localStorage` | **否** | 是（被 Upload/Datasets/SecurityBadge 调用） | 承担三重职责（模式管理、IndexedDB 存储、操作执行），全部与目标架构冲突 | Move to legacy | High |
| **16. db.ts / IndexedDB** | Dexie 封装，IndexedDB schema + 压缩存储 | `DataTable` / `OperationChain` | 浏览器 IndexedDB + fflate | IndexedDB | **否** | 是（被 `localStorageService` 调用） | `apiCache`（315-391 行）和 `storageManager`（396-455 行）模块已 **DEAD**（无调用方） | Move to legacy | Medium |
| **17. duckdb-service.ts / duckdb.worker.ts** | DuckDB-WASM 客户端 + Web Worker | Comlink 调用 | Web Worker 内 DuckDB-WASM SQL | 不保存 | **否** | **否**（DataWorkshop 未调用它，`localStorageService.executeOperations` 也未被 DataWorkshop 使用） | 已证实为 dead path | Move to legacy | Low |
| **18. engine-selector.ts** | 根据数据规模选择 JS 或 DuckDB 引擎 | `DataTable` + `Operation[]` | 浏览器本地决策 | 不保存 | **否** | **否**（[DataWorkshop.tsx:261](../app/src/pages/DataWorkshop.tsx#L261) 仅用于 UI 展示，不影响执行） | 决策与执行分离，当前不生效 | Move to legacy | Low |
| **19. operation-executor.ts** | 纯内存 JS 数据操作执行器 | `DataTable` + `Operation` | 浏览器内存 | 不保存 | **否** | **否**（仅被 `localStorageService.executeWithJS` 动态 import，而 `localStorageService.executeOperations` 未被 DataWorkshop 调用） | DataWorkshop 有独立的内联实现，未使用此文件 | Move to legacy | Low |
| **20. 所有 mock 数据和缓存逻辑** | 兜底/mock 数据 | — | — | — | — | — | `companion.service.ts:150-173` `mockResponses`；`ai_service.py:27` 未配置 key 时返回固定字符串；`schemas/auth.py:77-86` `PasswordResetRequest/Confirm` 无 endpoint；`schemas/ai.py:67-77` `AIInsight` 未使用；`schemas/report.py` `ReportResponse` / `ReportDownloadResponse` 未使用 | Deprecate but keep（companion mock 待替换）；Delete after tests（dead schema） | Low |

---

## 二、审计"模式切换"真实作用

| 页面/模块 | 是否读取模式 | 模式影响什么 | 是否符合目标架构 | 建议 |
|---|---|---|---|---|
| **Settings** | 是 | 写入 `localStorage`，切换 SecurityBadge 状态，改变 Upload/Datasets 分支 | 否 | Rename / clarify only |
| **SecurityBadge** | 是 | 读取并切换 `localStorage` 模式，同步 Settings 状态，显示"本地安全/安全模式"按钮 | 否 | Rename / clarify only |
| **Upload** | 是 | 决定走 `handleLocalUpload` (IndexedDB) 还是 `handleCloudUpload` (后端 API) | 否 | Refactor into backend-managed path |
| **Datasets** | 是 | 决定从 IndexedDB 加载还是从后端 API 加载 | 否 | Refactor into backend-managed path |
| **DataWorkshop** | **否**（不读 mode，但无条件用 IndexedDB） | 上传文件时**无条件**落入 IndexedDB；操作执行全在浏览器内存 | 否 | Refactor into backend-managed path |
| **AIWorkspace** | 否 | 始终走后端 API | 是 | Keep as main path |
| **SmartAnalysis / Visualization / Statistics / Attribution / Forecast / SmartProcess / Semantic / PathAnalysis / Clustering / GoalPlanner** | 否 | 始终走后端 API（GoalPlanner 是纯客户端工具，不处理数据集） | 是 | Keep as main path |
| **后端（全部端点）** | 否 | 完全不知道模式存在 | **是，但需要补充**（后端应统一处理所有数据，但当前 `User` 表无 `storage_preference` 字段） | 补充 `User.storage_preference` 用于 metadata 路由；Keep as main path |
| **AppHeader / AppLayout** | 否（仅挂载 SecurityBadge） | 无 | — | — |

### 关键发现

模式切换只有 **Upload** 和 **Datasets** 两个页面真正消费它，且切换的是**浏览器本地存储 vs 后端存储**，而不是"元数据存储位置"。

DataWorkshop 虽然不读模式，但**无条件把文件落入 IndexedDB**，导致实际上所有进入 DataWorkshop 的文件都走了浏览器本地路径。后端完全不知道这个模式，所以"安全模式"下的数据集无法被后端分析。

### Source of Truth 审计

当前存在**三个独立的模式状态源**，没有强一致保证：

| Key | 位置 | 用途 | 风险 |
|---|---|---|---|
| `insightease_settings` | `localStorage` JSON | 含 `storageMode: 'cloud' \| 'local'` | 与 `insightease_security_mode` 可能不同步 |
| `insightease_security_mode` | `localStorage` boolean string | `localStorageService` 内部使用 | 与 `insightease_settings` 可能不同步 |
| `_isSecurityMode` | `localStorageService` 内存变量 | 模块加载时初始化 | 页面刷新后重新初始化，可能与其他 tab 状态不一致 |

---

## 三、审计浏览器本地处理路径

| 本地处理路径 | 被谁调用 | 是否仍在主链路 | 是否符合目标架构 | 建议动作 |
|---|---|---|---|---|
| **Upload → `handleLocalUpload` → `FileReader.readAsText` + 手工 CSV/JSON 解析 → `datasetStorage.save`** | [Upload.tsx:123-209](../app/src/pages/Upload.tsx#L123) | 是（安全模式主链路） | 否 | Refactor into backend-managed path |
| **Datasets → `loadLocalDatasets` → `localStorageService.listDatasets/loadDataset` → IndexedDB** | [Datasets.tsx:96-129](../app/src/pages/Datasets.tsx#L96) | 是（安全模式） | 否 | Refactor into backend-managed path |
| **DataWorkshop → 内联 `executeOperations` → 内存 JS 计算**（filter/transform/dedup/reshape/pivot/derive/sample） | [DataWorkshop.tsx:547-613](../app/src/pages/DataWorkshop.tsx#L547) | 是 | 否 | Refactor into backend-managed path |
| **DataWorkshop → 上传文件 → `localStorageService.importDataset` → IndexedDB** | [DataWorkshop.tsx:376](../app/src/pages/DataWorkshop.tsx#L376) | 是 | 否 | Refactor into backend-managed path |
| **`localStorageService.executeOperations` → `engineSelector` → `executeWithDuckDB` / `executeWithJS`** | 仅 `localStorageService.ts:267`；DataWorkshop **未调用** | 否 | 否 | Move to legacy |
| **`operation-executor.ts` `executeOperations`** | `localStorageService.ts:338`（动态 import） | 否 | 否 | Move to legacy |
| **`duckdb-service.ts` / `duckdb.worker.ts`** | `DuckDBLoader.tsx`（可能未挂载）；`localStorageService`（未被 DataWorkshop 调用） | 否 | 否 | Move to legacy |
| **`db.ts` `apiCache` / `storageManager`** | 无调用方（DEAD） | 否 | — | Delete after tests |
| **`companion.service.ts` `mockResponses` + 规则引擎** | `AppLayout` 挂载 `AICompanion` | 是 | 否（mock 应替换为真实 AI） | Deprecate but keep |
| **GoalPlanner.tsx 纯客户端计算** | 路由 `/app/goal-planner` | 是 | **是**（纯客户端规划工具，不处理数据集） | Keep as main path |

### 重要发现：DataWorkshop 的双轨实现

`DataWorkshop` 的操作执行有**两套并行实现**：

1. **页面内联实现**（当前实际运行）：`DataWorkshop.tsx:547-613` 纯内存 JS
2. **`localStorageService` + `operation-executor.ts` 实现**（未被调用）：含 DuckDB 分支，但 DataWorkshop 页面没有调用 `localStorageService.executeOperations`，导致 `engine-selector` 和 `duckdb-service` 虽然存在但**从未在 DataWorkshop 中触发**。

这意味着 DuckDB 相关代码虽然占用了 bundle 体积和开发维护成本，但实际上是 **dead path**。

---

## 四、提出新的目标架构

停止使用 **Local-first Mode** / **Cloud Mode** 这两个模糊词。改为以下三个**正交维度**：

### 1. Metadata Storage Mode（元数据存储模式）

- **Cloud metadata**：元数据、处理记录、分析结果保存在云端 MySQL，多设备同步。
- **Local/private metadata**：元数据保存在用户私有环境（可自托管后端，或后端使用本地 SQLite/本地 MySQL），不上传到云数据库。

> 注意：无论哪种，**处理逻辑都由后端执行**。浏览器只负责上传、配置、展示、调用 API。

### 2. Processing Mode（处理模式）

- **Backend processing**：正式主线。所有数据操作（上传解析、DataWorkshop 操作链、分析计算、预测）统一由后端执行。
- **Browser processing**：仅作为 legacy / experimental 保留，不进入正式主线。

### 3. File Storage Backend（文件存储后端）

- **Local disk**：后端服务器本地磁盘（`./data/uploads`）。
- **OSS**：阿里云 OSS（或其他对象存储）。
- **Other object storage**：S3、MinIO 等。

> 注意：这只是一个 storage adapter，不是产品模式。切换方式由部署环境决定（环境变量），不需要前端用户感知。

### 各功能归属映射

| 功能 | Metadata Storage Mode | Processing Mode | File Storage Backend |
|---|---|---|---|
| Login / Auth | 均可 | Backend | N/A |
| Upload | 均可 | Backend | Local disk / OSS |
| Datasets | 均可 | Backend | Local disk / OSS |
| DataWorkshop | 均可 | **Backend**（需要后端化） | Local disk / OSS |
| AIWorkspace | 均可 | Backend | N/A |
| SmartAnalysis / 所有分析页面 | 均可 | Backend | N/A |
| AnalysisResultRenderer | 均可 | Frontend rendering | N/A |
| Settings | **Cloud metadata 下应同步到后端 User 表** | Backend | N/A |
| SecurityBadge | 应改为 Metadata Mode Indicator | N/A | N/A |
| AICompanion | 均可 | Backend（AI 通过后端） | N/A |
| 后端 datasets API | 均可 | Backend | Local disk / OSS |
| 后端 analysis API | 均可 | Backend | N/A |
| 后端 ai API | 均可 | Backend | N/A |
| 后端 storage.py | N/A | N/A | Adapter 层 |
| local-storage.service.ts | N/A | Browser legacy | N/A |
| db.ts / IndexedDB | N/A | Browser legacy | N/A |
| duckdb-service / worker | N/A | Browser legacy | N/A |
| engine-selector.ts | N/A | Browser legacy | N/A |
| operation-executor.ts | N/A | Browser legacy | N/A |

---

## 五、输出重构路线

### Phase 0: 文档修正
**目标**：先把概念对齐，防止后续开发继续走错方向。

- **修正 `PROJECT_ONBOARDING.md`**：
  - 删除"Local-first Mode"作为正式模式的描述
  - 删除"DataWorkshop 纯前端处理"的接受性描述
  - 重命名为"Cloud metadata / Local-private metadata"双模式
  - 明确"两种模式都走后端处理"
- **重写 `STORAGE_ARCHITECTURE.md`**：
  - 重新定义两种模式为 Cloud Metadata vs Local/Private Metadata
  - IndexedDB 仅作为 API 缓存或 legacy 标记
  - DataWorkshop 统一纳入后端处理主线
- **修改 `REDUNDANCY_AUDIT.md`**：
  - 调整审计结论，将本地处理相关代码标记为"待迁移至后端"而非"可删除/保留"
- **重写 `RUNTIME_PATH_AUDIT.md`**：
  - 基于"两种模式都走后端处理"目标重新审计运行路径
  - 记录当前前端处理为"需修正的偏差"
- **新增 `ARCHITECTURE_DECISIONS.md`**：
  - 记录"为什么 Backend Processing 是主线"
  - 记录"Metadata Storage Mode 与 File Storage Backend 的区别"
  - 记录"Browser processing 仅作为 legacy 的决策"

### Phase 1: 切断错误模式概念
**目标**：让用户不再以为"本地模式 = 浏览器本地处理"。

- **移除或重命名"安全模式" UI 文案**：
  - `SecurityBadge.tsx`：不再显示"安全模式/本地安全"，改为显示当前 metadata 模式（若后端支持）
  - `Settings.tsx`：模式切换不再解释为"数据不上传"，而是"元数据存储位置"
- **明确 Upload / Datasets / DataWorkshop / AIWorkspace 的真实数据路径**：
  - 在 UI 上明确标注数据流向（上传 → 后端 → 处理 → 展示）
- **同步 Source of Truth**：
  - 合并 `insightease_settings` 和 `insightease_security_mode` 为单一配置
  - 或改为从后端 `GET /users/me` 读取 `storage_preference`

### Phase 2: 主链路收敛
**目标**：所有主链路功能统一走后端处理。

- **Upload 主线改为 backend-managed upload**：
  - 删除 `Upload.tsx` 的 `handleLocalUpload` 分支
  - 所有上传统一调用 `datasetApi.upload`
  - 若用户需要"不上传 OSS"，由后端在 local disk 模式下处理，前端不感知
- **Datasets 主线改为 backend-managed dataset list**：
  - 删除 `Datasets.tsx` 的 `loadLocalDatasets` 分支
  - 所有数据集列表统一调用 `datasetApi.list`
- **AIWorkspace 主线保持 backend analysis**：
  - 当前已经是 backend analysis，保留
  - 后续把对话历史同步到后端（可选）
- **DataWorkshop 如果作为正式功能，应改为提交操作链到后端执行**：
  - 前端只负责构建操作链 UI
  - 点击"执行"时，把操作链序列化为 JSON，调用后端 API（如 `POST /api/v1/datasets/{id}/transform`）
  - 后端执行后返回新 dataset 或新 version
  - 前端展示预览

### Phase 3: Legacy 隔离
**目标**：浏览器本地处理代码不再被主链路 import，保留但不继续开发。

- **DuckDB / IndexedDB dataset storage / local browser processing 全部标记 legacy**：
  - `local-storage.service.ts` → 移动到 `src/legacy/` 或重命名为 `browser-storage.legacy.ts`
  - `db.ts` → 移动到 `src/legacy/`
  - `duckdb-service.ts` / `duckdb.worker.ts` → 移动到 `src/legacy/`
  - `engine-selector.ts` → 移动到 `src/legacy/`
  - `operation-executor.ts` → 移动到 `src/legacy/`
- **主线代码不得 import legacy 模块**：
  - `Upload.tsx`、`Datasets.tsx`、`DataWorkshop.tsx` 移除对 `localStorageService` 的引用
  - `AppLayout.tsx` 若挂载 `AICompanion`，需确保 companion 不再依赖 legacy mock
- **保留代码但不继续基于它开发**：
  - 在 legacy 目录下保留原文件，便于后续参考或实验性功能恢复

### Phase 4: 后续重构
**目标**：完善 Backend Processing 主线的高级能力。

- **DataWorkshop 后端化**：
  - 后端新增 `POST /datasets/{id}/transform` 端点，接收操作链 JSON
  - 后端实现操作链执行器（pandas 版本）
  - 支持生成 dataset version（类似 git commit）
- **操作链持久化**：
  - 新增 `dataset_versions` 表或 `operations` 表
  - 记录每次操作的历史，支持回滚
- **元数据模式切换重新设计**：
  - `User` 表新增 `metadata_storage_mode` 字段（`cloud` / `private`）
  - Settings 页面切换时，调用 `PATCH /users/me` 更新字段
  - 后端根据字段决定元数据路由（MySQL vs 本地 SQLite）

---

## 六、需要人工确认的点

以下是无法通过静态分析 100% 确认的事项，建议后续人工确认：

1. **OSS 后台任务兼容性**：`analysis.py:84-96` 后台任务直接按 `storage_path` 读文件，未像 `datasets.py:304-321` 那样先 `storage.read()` 到临时文件。若配置为 OSS，分析任务会失败。这是否是已知问题？
2. **DataWorkshop 是否曾调用 `localStorageService.executeOperations`**：当前代码中 DataWorkshop 使用页面内联逻辑，`localStorageService.executeOperations` 未被调用。这是设计遗漏还是临时实现？
3. **DuckDBLoader.tsx 是否被实际渲染**：grep 未找到具体 JSX 使用位置，可能通过动态渲染挂载。需要确认其是否对用户可见。
4. **companion-service.ts AI 调用被注释**：`generateAIContent` 中 `aiApi.chat(prompt)` 被注释，使用 `mockResponses`。这是临时降级还是设计决策？
5. **GoalPlanner 的产品定位**：当前纯客户端计算，不调用后端。它是否应继续保持纯客户端，还是也需要后端化？
