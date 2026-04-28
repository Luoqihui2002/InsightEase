# Phase 1-2 Fix Report

**日期**: 2026-04-27  
**范围**: 前端 UI + 主链路收敛  
**目标**: 切断错误的 browser-local 主链路，让正式功能统一回到 Backend Processing

---

## 修改了哪些文件

| 文件 | 修改内容 |
|---|---|
| `app/src/components/SecurityBadge.tsx` | 移除模式切换逻辑，改为纯静态架构状态展示（Backend / Backend DB / Server Disk） |
| `app/src/pages/Settings.tsx` | 移除 storageMode 切换 UI（云端/本地卡片、详情、弹窗），替换为"统一后端处理架构"说明文案 |
| `app/src/pages/Upload.tsx` | 删除 `getStorageMode`、`handleLocalUpload`；`handleFiles` 直接调用后端 `datasetApi.upload` |
| `app/src/pages/Datasets.tsx` | 删除 `getStorageMode`、`isLocalMode`、`localDatasets`；列表/预览/删除/下载统一走后端 API |
| `app/src/services/local-storage.service.ts` | 文件顶部添加 **LEGACY / DEPRECATED** 注释，明确说明不再纳入主链路 |
| **新增** `docs/ARCHITECTURE_DECISIONS.md` | 记录 Backend Processing 主线、Browser Processing legacy、File Storage Backend 不是用户模式等决策 |

---

## 删除/禁用了哪些旧路径

- **Upload 本地分支**：`handleLocalUpload` -> `FileReader` -> 手工 CSV 解析 -> `datasetStorage.save`（IndexedDB）**已删除**
- **Datasets 本地分支**：`loadLocalDatasets` -> `localStorageService.listDatasets/loadDataset`（IndexedDB）**已删除**
- **Datasets 本地删除**：`localStorageService.deleteDataset` **已删除**
- **Datasets 本地下载**：IndexedDB 读取 -> 内存 CSV 生成 **已删除**
- **SecurityBadge 切换**：`toggleMode` -> `localStorageService.setSecurityMode` **已删除**
- **Settings 模式切换**：`handleStorageModeChange` -> 写入 `insightease_settings.storageMode` **已删除**

---

## 当前 Upload 的真实数据路径

```
用户选择文件
  ->
Upload.tsx handleFiles
  ->
datasetApi.upload(file)  ->  POST /api/v1/datasets/upload
  ->
后端 datasets.py: pandas 解析 -> storage.save() -> 磁盘/OSS + MySQL datasets 表
  ->
前端显示后端返回的扫描报告（quality_score, schema, ai_summary）
```

---

## 当前 Datasets 的真实数据路径

```
Datasets.tsx loadDatasets
  ->
quickRequest.get('/datasets?page=1&page_size=50')
  ->
后端 datasets.py: 查询 MySQL -> 返回 Dataset 列表
  ->
前端渲染列表
```

预览、删除、下载均统一调用后端 API：
- 预览：`datasetApi.preview(datasetId)`
- 删除：`datasetApi.delete(id)`
- 下载：`fetch /datasets/{id}/download`

---

## 当前哪些 legacy 模块仍然存在

以下模块代码仍然保留，但已标记为 legacy 或确认不在主链路：

| 模块 | 状态 | 是否仍被引用 |
|---|---|---|
| `local-storage.service.ts` | deprecated 注释 | companion-service.ts, DataWorkshop.tsx, services/index.ts |
| `db.ts` | 未被主线引用 | local-storage.service.ts |
| `duckdb-service.ts` / `duckdb.worker.ts` | dead path（DataWorkshop 实际未触发） | DuckDBLoader.tsx（可能未挂载） |
| `engine-selector.ts` | dead path（仅 UI 展示，不影响执行） | DataWorkshop.tsx |
| `operation-executor.ts` | dead path（未被 DataWorkshop 调用） | local-storage.service.ts |

---

## 当前还有哪些文件仍 import local-storage.service.ts

| 文件 | 引用原因 | 是否需要本轮处理 |
|---|---|---|
| `services/companion-service.ts` | companion 状态管理（非主线数据处理） | 否 |
| `pages/DataWorkshop.tsx` | 数据工坊的 IndexedDB 导入/加载/删除 | **否**（用户明确本轮不改 DataWorkshop 核心逻辑） |
| `services/index.ts` | barrel export | 否（Phase 3 移动 legacy 目录时统一处理） |
| `services/local-storage.service.ts` | 自身 | 否 |

**结论**：Upload / Datasets / SecurityBadge / Settings 四条主线已不再 import `localStorageService`。

---

## TypeScript 编译结果

```
npx tsc --noEmit  ->  无错误通过
```

---

## 下一阶段 DataWorkshop 后端化建议

DataWorkshop 是当前主链路中**最后一个**仍走浏览器本地处理的页面。建议 Phase 3 按以下方案后端化：

1. **前端职责收窄**：只负责构建操作链 UI（拖拽/配置操作节点），不再执行计算
2. **新增后端端点**：`POST /api/v1/datasets/{id}/transform`
   - Request body：`{ operations: Operation[], params?: object }`
   - 后端用 pandas 执行操作链
   - 返回新 Dataset（或 DatasetVersion）
3. **操作链持久化**：新增 `dataset_versions` 表，记录每次 transform 的历史，支持回滚
4. **前端调用**：点击"执行"时发送操作链 JSON -> 轮询或等待后端返回 -> 展示预览
5. **legacy 隔离**：DataWorkshop 中原有的内联 `executeOperations`、IndexedDB 导入逻辑在确认后端化完成后，移至 `src/legacy/`

---

## 仍需注意的技术债

1. **OSS 后台任务兼容性**：`analysis.py:84-96` 后台任务直接按 `storage_path` 读文件，未先 `storage.read()` 到临时文件。若配置为 OSS，分析任务会失败。
2. **companion-service.ts mock**：`generateAIContent` 中 AI 调用仍被注释，使用 `mockResponses`。
3. **DataWorkshop 仍无条件落入 IndexedDB**：`DataWorkshop.tsx:376` `localStorageService.importDataset(file)` 仍在执行，这是 Phase 3 需要重点处理的。
