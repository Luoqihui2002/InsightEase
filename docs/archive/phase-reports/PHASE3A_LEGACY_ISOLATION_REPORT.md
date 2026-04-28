# Phase 3A Legacy Isolation Report

**日期**: 2026-04-27  
**范围**: 将 browser-local processing 代码从主服务目录隔离至 `src/legacy/browser-processing/`  
**目标**: 避免主线代码误 import legacy 模块，但本阶段不删除代码、不重构 DataWorkshop、不新增后端 API。

---

## 一、新建目录

```
app/src/legacy/browser-processing/
├── README.md
├── db.ts
├── duckdb-service.ts
├── duckdb.worker.ts
├── engine-selector.ts
├── local-storage.service.ts
└── operation-executor.ts
```

`README.md` 中明确标注边界规则：
- **Main path must NOT import from this directory.**
- 只有 DataWorkshop 等实验性页面可从此目录 import。

---

## 二、移动的文件清单

| 原路径 | 新路径 | 说明 |
|---|---|---|
| `app/src/services/local-storage.service.ts` | `legacy/browser-processing/local-storage.service.ts` | IndexedDB 数据集存储 |
| `app/src/services/db.ts` | `legacy/browser-processing/db.ts` | Dexie 封装 |
| `app/src/services/duckdb-service.ts` | `legacy/browser-processing/duckdb-service.ts` | DuckDB-WASM 主线程封装 |
| `app/src/services/engine-selector.ts` | `legacy/browser-processing/engine-selector.ts` | 引擎选择逻辑 |
| `app/src/utils/operation-executor.ts` | `legacy/browser-processing/operation-executor.ts` | 客户端操作执行器 |
| `app/src/workers/duckdb.worker.ts` | `legacy/browser-processing/duckdb.worker.ts` | DuckDB Web Worker |

---

## 三、路径调整记录

### 3.1 Legacy 文件内部相对路径

| 文件 | 原引用 | 新引用 |
|---|---|---|
| `local-storage.service.ts` | `await import('@/utils/operation-executor')` | `await import('./operation-executor')` |
| `duckdb-service.ts` | `from '@/workers/duckdb.worker'` | `from './duckdb.worker'` |
| `duckdb-service.ts` | `new URL('@/workers/duckdb.worker.ts', import.meta.url)` | `new URL('./duckdb.worker.ts', import.meta.url)` |

### 3.2 外部引用调整

| 文件 | 调整内容 |
|---|---|
| `services/companion-service.ts` | 移除未使用的 `localStorageService` import |
| `services/index.ts` | 移除所有 legacy export（engineSelector、db、localStorageService、duckdb-service）。仅保留 `companionService` 及其类型 |
| `pages/DataWorkshop.tsx` | `localStorageService`、`engineSelector`、`EngineDecision` 改为从 `@/legacy/browser-processing/...` 显式 import |
| `components/DuckDBLoader.tsx` | duckdb-service 相关 import 改为从 `@/legacy/browser-processing/duckdb-service` 显式 import |

---

## 四、grep 验证

### 4.1 主线页面无 legacy import

```bash
grep -rn "legacy/browser-processing" \
  src/pages/Upload.tsx \
  src/pages/Datasets.tsx \
  src/pages/SmartAnalysis.tsx \
  src/pages/AIWorkspace.tsx \
  src/components/SecurityBadge.tsx \
  src/pages/Settings.tsx \
  src/pages/Dashboard.tsx \
  src/pages/Attribution.tsx \
  src/pages/PathAnalysis.tsx \
  src/pages/Statistics.tsx \
  src/pages/Forecast.tsx \
  src/pages/Visualization.tsx \
  src/pages/Clustering.tsx
```

**结果**：无输出 ✅

所有主线页面（Upload、Datasets、SmartAnalysis、Dashboard 等）均未 import legacy 目录。

### 4.2 DataWorkshop / DuckDBLoader 显式 legacy import

```bash
grep -rn "legacy/browser-processing" src/pages/DataWorkshop.tsx src/components/DuckDBLoader.tsx
```

**结果**：
```
src/pages/DataWorkshop.tsx:44:import { localStorageService } from '@/legacy/browser-processing/local-storage.service';
src/pages/DataWorkshop.tsx:45:import { engineSelector } from '@/legacy/browser-processing/engine-selector';
src/pages/DataWorkshop.tsx:46:import type { EngineDecision } from '@/legacy/browser-processing/engine-selector';
src/components/DuckDBLoader.tsx:18:} from '@/legacy/browser-processing/duckdb-service';
```

✅ DataWorkshop 和 DuckDBLoader 的 legacy 依赖已改为显式路径，一目了然。

### 4.3 localStorageService 使用范围

```bash
grep -rn "localStorageService" src/ --include="*.ts" --include="*.tsx" | grep -v "legacy/browser-processing"
```

**结果**：仅出现在 `src/pages/DataWorkshop.tsx`（7 处调用）。

✅ 主线页面零引用。

### 4.4 duckdb-service 使用范围

```bash
grep -rn "duckdb-service" src/ --include="*.ts" --include="*.tsx" | grep -v "legacy/browser-processing"
```

**结果**：无输出。

✅ 主线零引用。

### 4.5 engine-selector 使用范围

```bash
grep -rn "engineSelector\|engine-selector" src/ --include="*.ts" --include="*.tsx" | grep -v "legacy/browser-processing"
```

**结果**：仅出现在 `src/pages/DataWorkshop.tsx`（1 处调用）。

✅ 主线零引用。

### 4.6 @/services 全部 import 为 companionService

```bash
grep -rn "from '@/services'" src/ --include="*.ts" --include="*.tsx" | grep -v companionService
```

**结果**：无输出。

✅ `services/index.ts` 不再暴露任何 legacy 类型，所有 `@/services` import 均为 `companionService`。

---

## 五、TypeScript 编译验证

```bash
cd app && npx tsc --noEmit
```

**结果**：无错误通过 ✅

---

## 六、修改文件清单（本轮）

| 文件 | 修改类型 |
|---|---|
| `app/src/legacy/browser-processing/README.md` | 新增 |
| `app/src/legacy/browser-processing/local-storage.service.ts` | 移动 + 更新内部 import 路径 |
| `app/src/legacy/browser-processing/db.ts` | 移动 + 添加 LEGACY 注释 |
| `app/src/legacy/browser-processing/duckdb-service.ts` | 移动 + 更新 worker 路径 |
| `app/src/legacy/browser-processing/engine-selector.ts` | 移动 + 添加 LEGACY 注释 |
| `app/src/legacy/browser-processing/operation-executor.ts` | 移动 |
| `app/src/legacy/browser-processing/duckdb.worker.ts` | 移动 |
| `app/src/services/index.ts` | 删除所有 legacy export，仅保留 companionService |
| `app/src/services/companion-service.ts` | 移除未使用的 localStorageService import |
| `app/src/pages/DataWorkshop.tsx` | 拆分 import：companionService 仍从 @/services，其余显式从 legacy 目录 import |
| `app/src/components/DuckDBLoader.tsx` | duckdb-service import 改为显式 legacy 路径 |

---

## 七、风险点与注意事项

1. **services/index.ts 的 barrel export 变化**  
   如果后续有新代码尝试 `import { engineSelector } from '@/services'`，会立刻编译失败，起到物理隔离效果。

2. **DuckDBLoader 仍引用 legacy**  
   DuckDBLoader 组件本身未挂载到主链路（DataWorkshop 中 DuckDB 实际未触发），但组件文件仍存在。若未来需要移除 DuckDB-WASM，可直接删除 DuckDBLoader.tsx 和 legacy 目录中的 duckdb 相关文件。

3. **DataWorkshop 仍是唯一 legacy 消费者**  
   当前 DataWorkshop 是 src/ 中唯一 import legacy 目录的文件。Phase 3B 后端化时，目标就是将其改为调用后端 transform API，从而彻底解除对 legacy 目录的依赖。

4. **companion-service.ts 与 legacy 解耦**  
   companion-service.ts 此前虽然 import 了 localStorageService，但并未实际调用。本轮已清理该 import，companion 服务与 browser-local processing 已完全解耦。

---

## 八、验收结论

| 检查项 | 状态 | 说明 |
|---|---|---|
| `npx tsc --noEmit` 通过 | ✅ | 零错误 |
| Upload 不 import legacy 目录 | ✅ | grep 无输出 |
| Datasets 不 import legacy 目录 | ✅ | grep 无输出 |
| AIWorkspace / SmartAnalysis 不 import legacy 目录 | ✅ | grep 无输出 |
| DataWorkshop 显式从 legacy 目录 import | ✅ | 3 处 `@/legacy/browser-processing/...` |
| services/index.ts 不再暴露 localStorageService | ✅ | barrel 仅保留 companionService |
| services/index.ts 不再暴露 engineSelector / db / duckdb-service | ✅ | 已删除 |
| 主线 zero localStorageService 引用 | ✅ | 仅 DataWorkshop 有 |
| 主线 zero duckdb-service 引用 | ✅ | grep 无输出 |
| 主线 zero engine-selector 引用 | ✅ | 仅 DataWorkshop 有 |

**结论：Phase 3A Legacy 隔离完成，可以进入 Phase 3B（DataWorkshop 后端化）或后续工作。**
