# Browser-local Processing (Legacy / Experimental)

**警告：此目录下的所有模块均为 legacy / experimental，不属于正式主链路。**

## 边界规则

- **Main path must NOT import from this directory.**
- 只有 DataWorkshop 等明确标记为实验性的页面可以从这里 import。
- Upload / Datasets / AIWorkspace / SmartAnalysis 等主链路严禁依赖此目录中的任何模块。

## 模块清单

| 文件 | 说明 |
|---|---|
| `local-storage.service.ts` | IndexedDB 数据集存储、操作链执行（legacy） |
| `db.ts` | Dexie IndexedDB 封装、压缩、存储管理（legacy） |
| `duckdb-service.ts` | DuckDB-WASM 主线程封装（legacy） |
| `duckdb.worker.ts` | DuckDB-WASM Web Worker（legacy） |
| `engine-selector.ts` | 处理引擎选择逻辑（JS vs DuckDB）（legacy） |
| `operation-executor.ts` | 客户端操作链执行器（legacy） |

## 迁移状态

- Phase 3A：已将文件从 `services/`、`utils/`、`workers/` 移入此目录，避免主线代码误 import。
- Phase 3B（未来）：DataWorkshop 后端化完成后，可进一步评估是否完全移除这些模块。
