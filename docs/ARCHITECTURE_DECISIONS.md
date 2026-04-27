# InsightEase Architecture Decisions

**日期**: 2026-04-27  
**状态**: 已生效（Phase 1-2 执行中）  
**版本**: v1.0

---

## AD-001: Backend Processing 是正式主线

### 背景
项目早期曾探索浏览器本地处理（IndexedDB + DuckDB-WASM）作为"Local-first Mode"。经过边界审计确认，该路径导致：
- Upload/Datasets 在"安全模式"下落入浏览器，后端分析页面无法访问
- DataWorkshop 实际走浏览器内存 JS 执行，不调用后端
- 用户误以为"本地模式 = 浏览器本地处理"

### 决策
**所有正式数据处理统一由后端执行。**

- 上传解析 → 后端 Pandas
- 数据集存储 → 后端 MySQL + 磁盘/OSS
- DataWorkshop 操作链 → 后端执行（当前版本暂时保留前端 UI，但后端化已列入路线图）
- 分析计算 → 后端 BackgroundTasks

### 影响
- 前端职责收窄为：上传、配置、展示、调用 API
- 浏览器不再承担正式数据持久化职责
- IndexedDB 仅允许作为临时 UI 缓存或 legacy 实验代码使用

### 风险
- 后端负载增加（可控，当前分析已是后台任务）
- 网络依赖（SaaS 产品的默认假设）

---

## AD-002: Browser Processing 是 Legacy / Experimental

### 背景
`local-storage.service.ts`、`db.ts`、`duckdb-service.ts`、`engine-selector.ts`、`operation-executor.ts` 等模块构成了完整的浏览器本地处理栈。

### 决策
**上述模块全部标记为 legacy，保留代码但不再纳入正式主链路。**

- 代码移动到 `src/legacy/` 目录（Phase 3 执行）
- 主链路代码不得 import 上述模块
- 不再继续基于浏览器本地处理开发新功能
- 实验性功能若需恢复，必须从 legacy 目录显式引用

### 保留原因
- 避免一次性大重构导致不可回滚
- 某些边缘场景（断网 demo、超大文件预览）可能仍有参考价值

---

## AD-003: OSS / Local Disk 是后端 File Storage Backend，不是前端用户模式

### 背景
Storage 配置（OSS_ACCESS_KEY_ID 等环境变量）决定文件落在服务器本地磁盘还是阿里云 OSS。此前被包装为"Cloud Mode"的一部分，导致用户误以为这是与"本地模式"对立的产品模式。

### 决策
**File Storage Backend 是部署配置，不是用户可见的产品模式。**

- 切换方式：环境变量 / 后端配置
- 前端不感知、不展示、不切换
- 没有 OSS key 时自动降级到 server local disk
- 架构上仍属于 backend-managed file storage

### 当前状态
- `storage.py` 已提供 `LocalStorage` + `AliyunOSSStorage` 双实现
- 切换逻辑在进程启动时完成（`get_storage()` 单例）
- 已知问题：`analysis.py` 后台任务读取文件时未使用 `storage.read()`，OSS 下会失败（待修复）

---

## AD-004: Metadata Mode 暂不通过前端全局按钮切换

### 背景
原"安全模式/本地模式/云端模式"切换按钮（SecurityBadge + Settings）直接改变了 Upload/Datasets 的数据路径，但概念错误（把 file storage backend 和 metadata storage mode 混为一谈）。

### 决策
**前端全局模式切换按钮已移除。**

- SecurityBadge 改为纯静态架构状态展示（Backend / Backend DB / Server Disk）
- Settings 不再提供 storageMode 切换
- Metadata Storage Mode（Cloud metadata vs Local/private metadata）是后端架构概念，当前版本统一走 Cloud metadata
- 若未来支持私有化部署（Local/private metadata），应通过后端配置或管理员设置，而非前端按钮

### 过渡措施
- 保留了 `insightease_settings` localStorage key，但已移除其中的 `storageMode` 字段读写
- `localStorageService` 的安全模式管理功能仍存在于 legacy 代码中，但主链路不再调用

---

## AD-005: DataWorkshop 后端化列入 Phase 3

### 背景
DataWorkshop 当前的操作执行完全在浏览器内存中完成（纯 JS），且上传文件无条件落入 IndexedDB。它是主链路中最后一个走浏览器本地处理的功能。

### 决策
**本轮（Phase 2）不修改 DataWorkshop 核心操作逻辑，仅添加 legacy 注释。**

- Phase 2 目标：先切断 Upload/Datasets 的错误本地路径
- Phase 3 目标：DataWorkshop 操作链提交到后端执行
  - 前端只构建操作链 UI
  - `POST /datasets/{id}/transform` 接收操作链 JSON
  - 后端 pandas 执行并返回新 dataset version

### 当前处理
- DataWorkshop 页面仍引用 `localStorageService`（legacy 标记，不影响主线）
- 已确认 `engine-selector` 和 `duckdb-service` 在 DataWorkshop 中实际未被触发（dead path）

---

## 修订记录

| 日期 | 版本 | 修订内容 |
|---|---|---|
| 2026-04-27 | v1.0 | 初始版本，基于 ARCHITECTURE_BOUNDARY_AUDIT.md 执行 Phase 1-2 后写入 |
