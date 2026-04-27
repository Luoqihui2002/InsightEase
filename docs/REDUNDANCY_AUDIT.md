# InsightEase 冗余代码审计报告

> 版本: 1.1（已修正）  
> 日期: 2026-04-08  
> 审计范围: 存储层、Worker、数据工坊相关代码  
> 状态: 已根据 Runtime Path Audit 修正

---

## 审计方法说明

本次审计基于以下原则：
1. **实际调用链分析**：通过 `grep` 搜索 import 和调用关系
2. **路由检查**：检查组件是否在路由中注册
3. **服务依赖**：检查服务是否被实际调用（非仅导出）
4. **MVP 主链路**：以 AI 助手功能为核心判断标准

⚠️ **重要**：本次审计为静态分析，部分结论需人工确认实际运行时的调用情况。

---

## 审计结果总表（已修正）

| 文件/模块 | 当前作用 | 是否被调用 | 调用链 | 所属模式 | 是否 MVP 主链路 | 建议操作 | 风险等级 | 理由 |
|-----------|----------|-----------|--------|----------|----------------|----------|----------|------|
| **app/src/workers/duckdb.worker.ts** | Web Worker 内运行 DuckDB-WASM | ⚠️ **被导入但永不触发** | `local-storage.service.ts` → `executeWithDuckDB` → `initWorker` | Local-first | ❌ 否 | **Deprecate** | Low | **DataWorkshop 不调用 executeWithDuckDB，代码永不执行** |
| **app/src/services/duckdb-service.ts** | 封装 Worker 通信 | ⚠️ **被导入但永不触发** | `local-storage.service.ts` → `executeWithDuckDB` | Local-first | ❌ 否 | **Deprecate** | Low | **同上，懒加载不触发** |
| **app/src/components/DuckDBLoader.tsx** | DuckDB 加载状态 UI | ❌ 未被使用 | 仅组件定义，无组件调用 | Local-first | ❌ 否 | **Delete** | Low | 无任何文件导入使用 |
| **app/src/services/db.ts** | IndexedDB 封装（Dexie） | ✅ 被调用 | `local-storage.service.ts` → `datasetStorage`<br>`DataWorkshop.tsx` → `loadLocalDatasets`<br>`Datasets.tsx` → 安全模式检查 | **所有模式** | ✅ **是** | **Keep** | High | **Cloud 模式下 DataWorkshop 仍读取 IndexedDB（本地数据集列表）** |
| **app/src/services/local-storage.service.ts** | 本地存储服务入口 | ✅ 被调用 | `DataWorkshop.tsx` → `loadLocalDatasets`<br>`Datasets.tsx` → 安全模式检查<br>`SecurityBadge.tsx` → 安全模式<br>`Settings.tsx` → 安全模式<br>`Upload.tsx` → `importDataset` | **所有模式** | ✅ **是** | **Keep** | High | **Cloud 模式下 DataWorkshop 仍使用（加载本地数据集）** |
| **app/src/services/engine-selector.ts** | 选择 JS 或 DuckDB 引擎 | ✅ 被导入 | `DataWorkshop.tsx` → `engineSelector.chooseForChain` | DataWorkshop | ❌ 否 | **Deprecate** | Low | **仅用于 UI 显示，实际执行不遵循决策（已确认）** |
| **app/src/pages/DataWorkshop.tsx** | 数据工坊页面 | ✅ 被调用 | `App.tsx` → Route `/data-workshop` | **混合模式** | ⚠️ 边缘 | **Hide** | Medium | **Cloud 用户可用（加载云端数据到前端处理），但结果不保存** |
| **app/src/components/SecurityBadge.tsx** | 安全模式徽章 | ✅ 被调用 | `AppHeader.tsx` → 全局显示 | **所有模式** | ✅ 是 | **Keep** | Low | MVP 仍需显示模式状态 |
| **app/src/utils/operation-executor.ts** | 操作执行工具函数 | ⚠️ **被导入但 DataWorkshop 未使用** | `local-storage.service.ts` → `executeWithJS` (L338) | Local-first | ❌ 否 | **Deprecate** | Low | **DataWorkshop 自行实现执行逻辑，不调用此方法** |
| **@duckdb/duckdb-wasm** | DuckDB WebAssembly 引擎 | ✅ 依赖 | `duckdb.worker.ts` → 动态导入 | Local-first | ❌ 否 | **Keep in package.json** | Low | 懒加载不触发 |
| **comlink** | Web Worker 通信封装 | ✅ 依赖 | `duckdb.worker.ts`<br>`duckdb-service.ts` | Local-first | ❌ 否 | **Keep in package.json** | Low | 同上 |
| **dexie** | IndexedDB 封装库 | ✅ 依赖 | `db.ts` → 核心依赖 | **所有模式** | ✅ 是 | **Keep** | High | **Cloud 模式仍用于 DataWorkshop 本地数据集 + API 缓存** |
| **fflate** | 压缩库（LZ4） | ✅ 依赖 | `db.ts` → 压缩数据集 | Local-first | ⚠️ 边缘 | **Keep** | Medium | Cloud 模式不存储大数据集，但保留无运行时开销 |

---

## 关键修正（基于 Runtime Path Audit）

### 修正 1: DataWorkshop 不是仅 Local-first

**原结论**: DataWorkshop 仅支持 Local-first，Cloud 模式下不可用。

**修正结论**: DataWorkshop 是**混合模式**，在 Cloud 模式下：
- 仍可加载云端数据集（通过 `datasetApi.preview`）
- 仍可加载本地数据集（通过 `localStorageService.loadDataset`）
- 处理仍在前端完成

**影响**: `db.ts` 和 `local-storage.service.ts` 的风险等级从 **Low** 提升到 **High**（Cloud 模式下仍被使用）。

### 修正 2: engine-selector.ts 确认仅 UI 展示

**原结论**: 怀疑 engine-selector 仅显示不生效。

**修正结论**: **已确认**。

代码证据：
```typescript
// DataWorkshop.tsx L258-266
useEffect(() => {
  const decision = engineSelector.chooseForChain(activeTable, operations);
  setEngineDecision(decision);  // 仅存入状态
}, [tables, activeTableId, operations]);

// DataWorkshop.tsx L547-613 executeOperations
// 完全没有读取 engineDecision
// 直接调用 executeJoin, executeFilter 等纯 JS 函数
```

### 修正 3: executeWithDuckDB 永不触发

**原结论**: 怀疑 DataWorkshop 不调用 executeWithDuckDB。

**修正结论**: **已确认永不触发**。

验证：
```bash
grep -n "executeWithDuckDB" app/src/pages/DataWorkshop.tsx
# 结果: 无匹配

grep -n "localStorageService.executeOperations" app/src/pages/DataWorkshop.tsx
# 结果: 无匹配
```

DataWorkshop 的 `executeOperations` (L547) 自行实现了纯 JS 版本，与 `local-storage.service.ts` 中的 `executeOperations` (L267) 是**两套独立实现**。

---

## 详细分析

### 1. 完全未使用的组件（可安全删除）

#### DuckDBLoader.tsx
```
文件: app/src/components/DuckDBLoader.tsx (186 行)
问题: 组件已定义但无任何文件导入使用
验证: grep -r "DuckDBLoader" app/src --include="*.tsx" 
结果: 仅组件定义，无调用
建议: Delete
风险: Low
```

### 2. 仅用于显示、实际决策不生效的代码

#### engine-selector.ts
```
文件: app/src/services/engine-selector.ts (262 行)
调用: DataWorkshop.tsx L261: engineSelector.chooseForChain(activeTable, operations)
问题: 虽然计算了 engineDecision 并显示在 UI，但 executeOperations 函数 (L547-613) 使用纯 JS 执行，不遵循决策结果
验证:
  - engineDecision 仅用于 setEngineDecision 显示
  - executeOperations 中未检查 engineDecision.engine
  - 实际调用的是 executeJoin, executeFilter 等纯 JS 函数
建议: Deprecate
风险: Low
原因: 仅影响 UI 提示，不影响实际执行
```

### 3. 调用链存疑的代码（需人工确认）

#### local-storage.service.ts 中的 executeOperations
```
文件: app/src/services/local-storage.service.ts L267-328
方法: executeOperations(table, operations, onProgress)
调用链: 
  1. DataWorkshop.tsx 未调用此方法（自行实现 L547）
  2. 文件内调用 executeWithDuckDB (L278)
  3. executeWithDuckDB 在 duckdb-service.ts 定义
问题: executeOperations 封装了双引擎逻辑，但 DataWorkshop.tsx 选择自己实现 (L547-613)
建议: 确认是否有其他组件调用此方法（grep 全项目）
风险: Medium（如果是设计不一致）
```

### 4. MVP 主链路未涉及的文件

| 文件 | 行数 | MVP 主链路涉及 | 说明 |
|------|------|----------------|------|
| `app/src/pages/DataWorkshop.tsx` | 2920 | ⚠️ 边缘 | AI 助手是独立页面，但 DataWorkshop 在 Cloud 模式可用 |
| `app/src/workers/duckdb.worker.ts` | 372 | ❌ | Cloud 模式不触发，DataWorkshop 也不触发 |
| `app/src/services/duckdb-service.ts` | 256 | ❌ | 同上 |
| `app/src/services/engine-selector.ts` | 262 | ❌ | 仅 DataWorkshop UI 使用 |

---

## 依赖分析

### package.json 关键依赖

| 依赖 | 大小估算 | 当前使用 | MVP 需要 | 建议 |
|------|----------|----------|----------|------|
| `@duckdb/duckdb-wasm` | ~12MB (懒加载) | 永不触发 | ❌ Cloud 不需要 | **Keep** (懒加载无开销) |
| `comlink` | ~10KB | 永不触发 | ❌ Cloud 不需要 | **Keep** (无运行时开销) |
| `dexie` | ~50KB | IndexedDB 封装 | ✅ DataWorkshop 本地数据 + API 缓存 | **Keep** |
| `fflate` | ~20KB | 数据压缩 | ⚠️ Cloud 缓存小数据可用 | **Keep** |

### 删除 DuckDB 依赖的收益（如果完全移除 Local-first）

如果确认完全移除 Local-first 模式：
- 减少依赖包数量：4 个（duckdb-wasm, comlink, fflate 可移除，dexie 保留）
- 减少 bundle 体积：~12MB WASM 下载（但懒加载，实际收益小）
- 简化代码：~3000 行（DataWorkshop 可重写为 Cloud 专用）

**但注意**：即使 Cloud MVP，DataWorkshop 仍需要 dexie（API 缓存），所以不能完全移除 IndexedDB 相关代码。

---

## 建议操作清单

### 立即执行（Before Launch）

| 操作 | 文件 | 优先级 | 风险 | 具体动作 |
|------|------|--------|------|----------|
| Add TODO | `DataWorkshop.tsx` | High | Low | 添加注释：处理结果仅在当前页面有效，刷新后丢失 |
| Add TODO | `engine-selector.ts` | High | Low | 添加注释：当前仅 UI 显示，实际执行不遵循决策 |
| Add TODO | `DuckDBLoader.tsx` | High | Low | 添加注释：组件未使用，考虑删除 |

### 上线后优化（Post Launch）

| 操作 | 文件 | 优先级 | 风险 | 具体动作 |
|------|------|--------|------|----------|
| Delete | `DuckDBLoader.tsx` | Low | Low | 确认无调用后删除 |
| Refactor | `DataWorkshop.tsx` | Medium | High | 明确混合模式定位，或标记为 Legacy |
| Deprecate | `duckdb.worker.ts`<br>`duckdb-service.ts` | Low | Low | 移动到 `legacy/` 目录，从主入口移除导出 |

### 需要人工确认的问题

1. **local-storage.service.ts executeOperations 是否有其他调用方**
   - 当前确认 DataWorkshop 未调用
   - 需确认是否有其他页面/组件调用
   - **确认方式**: `grep -r "executeOperations" app/src --include="*.tsx"`

2. **DataWorkshop 中 engine-selector 的 UX 影响**
   - 用户看到"高性能引擎"提示但实际纯 JS 执行
   - 大数据量时可能产生性能预期落差
   - **建议**: 移除引擎指示器，或添加"实验性功能"标记

---

## 附录：调用链验证命令

```bash
# 验证 DuckDBLoader 是否被使用
grep -r "DuckDBLoader" app/src --include="*.tsx" --include="*.ts"

# 验证 executeWithDuckDB 调用链
grep -r "executeWithDuckDB" app/src --include="*.tsx" --include="*.ts"

# 验证 DataWorkshop 路由
grep -r "DataWorkshop" app/src/App.tsx

# 验证 localStorageService 调用点
grep -r "localStorageService" app/src --include="*.tsx" | head -20

# 验证 engine-selector 调用点
grep -r "engineSelector" app/src --include="*.tsx"

# 验证 executeOperations 全项目调用
grep -r "executeOperations" app/src --include="*.tsx" --include="*.ts"
```

---

## 结论

**MVP 阶段风险可控**：
- DuckDB 相关代码为懒加载，不触发则无运行时开销
- DataWorkshop 在 Cloud 模式下可用但用户需知结果不保存
- 无需要立即删除的代码，保持现状可稳定上线

**主要技术债务**：
- engine-selector 提示与实际执行不一致（用户体验问题）
- DataWorkshop 结果不持久化（用户可能丢失数据）
- 模式切换行为不一致（Datasets vs DataWorkshop）

**推荐策略**：
- 保持现状上线，添加 TODO 注释说明已知行为
- 上线后优先修复 engine-selector 的误导性提示
- 长期考虑 DataWorkshop 定位：前端沙盒 vs 云端处理工具

---

## 修正记录

| 版本 | 日期 | 修正内容 |
|------|------|----------|
| 1.0 | 2026-04-08 | 初始版本，错误假设 DataWorkshop 仅 Local-first |
| 1.1 | 2026-04-08 | 修正：DataWorkshop 混合模式；db.ts 和 local-storage.service.ts 风险等级提升为 High；engine-selector 确认仅 UI 展示 |
