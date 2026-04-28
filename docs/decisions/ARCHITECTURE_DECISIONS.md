# InsightEase Architecture Decisions

**日期**: 2026-04-28
**状态**: 已生效（Phase 3 完成后更新）
**版本**: v2.0

---

## AD-001: Backend Processing 是正式主线

### 决策

**所有正式数据处理统一由后端执行。**

- 上传解析 → 后端 Pandas
- 数据集存储 → 后端 MySQL + 磁盘/OSS
- DataWorkshop 操作链 → 后端 pandas 执行
- 分析计算 → 后端 BackgroundTasks
- 前端职责收窄为：上传、配置、展示、调用 API

### 当前状态

✅ 已完全生效。所有主链路代码不再在浏览器端执行数据处理。

---

## AD-002: Browser Processing 栈已删除

### 决策

**Browser-local processing 代码已全部删除，不再保留。**

- `legacy/browser-processing/` 目录已删除
- 主链路代码不再 import 任何 browser-local 模块
- 不再基于浏览器本地处理开发新功能

### 当前状态

✅ 已完全生效。删除文件清单：
- `app/src/legacy/browser-processing/`（整个目录）
- `app/src/components/DuckDBLoader.tsx`
- `@duckdb/duckdb-wasm`、`comlink`、`dexie`、`fflate` 依赖

---

## AD-003: OSS / Local Disk 是后端 File Storage Backend，不是前端用户模式

### 决策

**File Storage Backend 是部署配置，不是用户可见的产品模式。**

- 切换方式：环境变量 / 后端配置
- 前端不感知、不展示、不切换
- 没有 OSS key 时自动降级到 server local disk
- 架构上仍属于 backend-managed file storage

### 当前状态

✅ 已生效。`storage.py` 提供 `LocalStorage` + `AliyunOSSStorage` 双实现。

> 已知问题：`analysis.py` 后台任务读取文件时未使用 `storage.read()`，OSS 下会失败（待 Phase 4A 修复）。

---

## AD-004: Metadata Mode 暂不通过前端全局按钮切换

### 决策

**前端全局模式切换按钮已移除。**

- SecurityBadge 改为纯静态架构状态展示（Backend / Backend DB / Server Disk）
- Settings 不再提供 storageMode 切换
- Metadata Storage Mode（Cloud metadata vs Local/private metadata）是后端架构概念，当前版本统一走 Cloud metadata
- 若未来支持私有化部署（Local/private metadata），应通过后端配置或管理员设置，而非前端按钮

### 当前状态

✅ 已生效。`insightease_settings` localStorage key 中的 `storageMode` 字段读写已移除。

---

## AD-005: DataWorkshop 后端化

### 决策

**DataWorkshop 操作链提交到后端执行。**

- 前端只构建操作链 UI
- `POST /datasets/{id}/transform/preview` 接收操作链 JSON，预览不保存
- `POST /datasets/{id}/transform` 执行并保存为新 Dataset
- 后端 pandas 串行执行每个 operation

### 当前状态

✅ 已完全生效。前端 `executeOperations()` 和 `handleSaveAsDataset()` 已分别调用 `workshopApi.preview()` 和 `workshopApi.transform()`。

---

## AD-006: Local / Private Mode 不等于 Browser-local Processing

### 背景

最初"本地模式"概念将 browser-local processing（IndexedDB + DuckDB-WASM）与数据安全混为一谈。

### 决策

**Local / Private Mode 未来应理解为 private deployment / self-hosted backend，而不是浏览器本地计算。**

- 当前项目主要用于简历展示和产品能力证明
- 正式主线不再实现 IndexedDB + DuckDB + browser-side processing
- 未来私有化能力应通过 self-hosted backend / private deployment 实现
- SaaS 模式下数据和元数据由后端统一管理

### 当前状态

✅ 已生效。所有 browser-local processing 代码和依赖已清理。

---

## 修订记录

| 日期 | 版本 | 修订内容 |
|---|---|---|
| 2026-04-27 | v1.0 | 初始版本，基于 ARCHITECTURE_BOUNDARY_AUDIT.md 执行 Phase 1-2 后写入 |
| 2026-04-28 | v2.0 | Phase 3 完成后更新：Browser Processing 从"legacy 保留"演进为"已删除"；新增 AD-005 DataWorkshop 后端化、AD-006 Local/Private Mode 定义 |
