# DataWorkshop Runtime Path Audit Report

> 审计日期: 2026-04-08  
> 审计目标: 确认 DataWorkshop 在不同模式下的真实运行路径  
> 审计方法: 代码静态分析 + 调用链追踪  
> 状态: **重大发现 - 需修正文档**

---

## 执行摘要

**核心发现**: DataWorkshop 并非仅支持 Local-first，而是一个**"混合模式前端处理工具"**。

- 无论模式切换状态如何，DataWorkshop **始终同时加载云端和本地两套数据源**
- 所有数据处理**完全在浏览器内存中执行**，不调用 DuckDB，不调用后端 API
- 模式切换按钮**仅影响 Datasets 页面**，对 DataWorkshop 无实际控制作用
- **引擎选择器 (engine-selector) 仅 UI 展示**，实际执行不遵循其决策

---

## 1. 模式切换按钮的真实作用

### 1.1 修改的 localStorage Key

```
Key: insightease_security_mode
Value: true/false (字符串化)
```

代码位置:
- `app/src/services/local-storage.service.ts` L46: `localStorage.setItem('insightease_security_mode', JSON.stringify(enabled))`
- `app/src/components/SecurityBadge.tsx` L49: 调用 `localStorageService.setSecurityMode(newMode)`
- `app/src/pages/Settings.tsx` L111, L139, L174: 同步设置

### 1.2 实际影响的组件

| 组件 | 影响方式 | 实际效果 |
|------|----------|----------|
| **SecurityBadge** | 读取 `_isSecurityMode` | 仅改变徽章显示状态 |
| **Datasets.tsx** | 调用 `getSecurityMode()` | **真正影响数据源选择** |
| **Settings.tsx** | 同步存储模式设置 | 保存到 localStorage |
| **DataWorkshop.tsx** | **不读取该状态** | **无影响** |
| **AIWorkspace.tsx** | **不读取该状态** | **无影响** |
| **Upload.tsx** | 调用 `getSecurityMode()` | 决定上传到后端或 IndexedDB |

### 1.3 结论：模式切换不是全局状态

```
模式切换按钮
    ↓
修改 localStorage: insightease_security_mode
    ↓
影响范围:
    ✅ Datasets 页面 - 数据源切换
    ✅ Upload 页面 - 上传目标切换
    ✅ SecurityBadge - UI 显示
    ❌ DataWorkshop - 无影响（始终混合模式）
    ❌ AIWorkspace - 无影响（始终调用后端）
```

---

## 2. DataWorkshop 数据源分析

### 2.1 两套独立的数据源

```typescript
// DataWorkshop.tsx 内部状态
const [localDatasets, setLocalDatasets] = useState(...);  // 本地数据集元数据
const [datasets, setDatasets] = useState<Dataset[]>([]);   // 云端数据集
const [tables, setTables] = useState<DataTable[]>([]);     // 已加载到内存的数据表
```

### 2.2 数据源加载逻辑

```typescript
// 1. 本地数据集加载（始终执行）
const loadLocalDatasets = async () => {
  const metadata = await localStorageService.listDatasets();  // IndexedDB
  ...
};

// 2. 云端数据集加载（始终执行）
const loadDatasets = async () => {
  const res = await datasetApi.list(1, 100);  // 后端 API
  ...
};

// useEffect - 页面加载时同时调用两者
useEffect(() => {
  loadLocalDatasets();  // 不检查模式
  loadDatasets();       // 不检查模式
}, []);
```

### 2.3 数据导入路径

| 用户操作 | 数据来源 | 加载方式 | 存储位置 |
|----------|----------|----------|----------|
| 点击"云端数据集"按钮 | 后端 MySQL | `datasetApi.preview()` | **前端内存 (tables)** |
| 点击"本地数据集"按钮 | IndexedDB | `localStorageService.loadDataset()` | **前端内存 (tables)** |
| 直接上传文件 | 用户电脑 | FileReader 解析 | **前端内存 + IndexedDB** |

**关键发现**: 无论数据来源何处，最终都转换为 `DataTable` 格式存入前端内存 (`tables` 状态)。

### 2.4 测试场景验证

| 测试场景 | UI 显示 | 数据来源 | 预期结果 |
|----------|---------|----------|----------|
| 清空 IndexedDB + 云端模式 + 打开 DataWorkshop | 显示"选择云端数据集" | 后端 API | ✅ 能看到云端数据集 |
| 清空后端数据 + 本地模式 + 打开 DataWorkshop | 显示"本地数据集" | IndexedDB | ✅ 能看到本地数据集 |
| 同时有云端和本地数据 | 显示两个按钮 | 混合 | ✅ 两套数据都能看到 |
| 断网 + 打开 DataWorkshop | 云端数据集加载失败 | IndexedDB 可用 | ⚠️ 本地数据仍可用 |

---

## 3. DataWorkshop 操作计算路径

### 3.1 执行入口

```typescript
// DataWorkshop.tsx L547
const executeOperations = async () => {
  // ... 输入验证
  
  for (const operation of operations) {
    switch (operation.type) {
      case 'join':
        result = executeJoin(result, operation.config, tables);  // 纯 JS
        break;
      case 'filter':
        result = executeFilter(result, operation.config);        // 纯 JS
        break;
      case 'transform':
        result = executeTransform(result, operation.config);     // 纯 JS
        break;
      // ... 其他操作
    }
  }
};
```

### 3.2 调用链分析

```
用户点击"执行"
    ↓
DataWorkshop.tsx: executeOperations (L547)
    ↓
纯 JS 函数: executeJoin / executeFilter / executeTransform / ...
    ↓
操作结果存入 previewData 状态
    ↓
UI 显示结果
```

**未调用的服务**:
- ❌ `localStorageService.executeOperations` (L267-328) - **方法存在但未被调用**
- ❌ `executeWithDuckDB` - **未被调用**
- ❌ 任何后端 API - **处理过程不联网**

### 3.3 代码证据

```bash
# 验证 executeWithDuckDB 未被 DataWorkshop 调用
grep -n "executeWithDuckDB" app/src/pages/DataWorkshop.tsx
# 结果: 无匹配

# 验证 localStorageService.executeOperations 未被调用
grep -n "localStorageService.executeOperations\|localStorageService\.execute" app/src/pages/DataWorkshop.tsx
# 结果: 无匹配

# 验证 datasetApi 仅在加载数据时被调用
grep -n "datasetApi\." app/src/pages/DataWorkshop.tsx
# 结果: L37(import), L288(preview), L274(list)
```

---

## 4. DuckDB 真实参与情况

### 4.1 DuckDB 相关代码在 DataWorkshop 中的存在形式

```typescript
// 1. 引擎决策计算（仅 UI 展示）
useEffect(() => {
  const decision = engineSelector.chooseForChain(activeTable, operations);
  setEngineDecision(decision);  // 仅存入状态用于显示
}, [tables, activeTableId, operations]);

// 2. 显示引擎指示器（纯 UI）
{engineDecision && (
  <EngineIndicator 
    engine={engineDecision.engine}  // 'js' | 'duckdb'
    reason={engineDecision.reason}
    estimatedTime={engineDecision.estimatedTime}
  />
)}
```

### 4.2 关键发现：决策与执行分离

| 环节 | 使用引擎选择器 | 实际执行 | 一致性 |
|------|----------------|----------|--------|
| UI 显示 | ✅ 调用 `engineSelector.chooseForChain()` | - | - |
| 操作执行 | ❌ 不检查决策结果 | 纯 JS | ❌ **不一致** |

代码证据：
```typescript
// L547-613 executeOperations 函数
// 完全没有读取 engineDecision 状态
// 直接调用纯 JS 函数 executeJoin/executeFilter 等
```

### 4.3 DuckDB 触发条件（理论）

根据 `local-storage.service.ts` L267-328，DuckDB 触发条件为：
```typescript
if (decision.engine === 'duckdb') {
  const result = await executeWithDuckDB(table, operations, onProgress);
}
```

**但 DataWorkshop 不调用此方法**，所以 **DuckDB 实际上永不触发**。

### 4.4 结论

```
DataWorkshop 中的 DuckDB
    ↓
理论设计: 大数据量时自动启用
    ↓
实际状态: 代码存在但永不执行
    ↓
原因: executeOperations 自行实现纯 JS 版本
    ↓
用户体验: 无论数据大小，全部纯 JS 处理
    ↓
潜在问题: 大数据量时可能卡顿
```

---

## 5. 清空存储测试预期结果

### 5.1 清空 IndexedDB

```javascript
// 在 Console 执行
indexedDB.deleteDatabase('InsightEaseDB');
```

预期结果：
| 页面 | 行为 | 原因 |
|------|------|------|
| DataWorkshop | 本地数据集列表为空 | IndexedDB 已清空 |
| DataWorkshop | 云端数据集仍可见 | 从后端 API 加载 |
| DataWorkshop | 可正常处理云端数据 | 数据在内存中处理 |
| Datasets | 本地模式无数据 | IndexedDB 已清空 |
| Datasets | 云端模式正常 | 后端数据不受影响 |

### 5.2 清空 localStorage

```javascript
localStorage.clear();
```

预期结果：
| 页面 | 行为 | 原因 |
|------|------|------|
| DataWorkshop | **完全正常** | 不依赖 localStorage |
| Datasets | 默认显示云端模式 | `getSecurityMode()` 返回 'cloud' |
| Settings | 恢复默认设置 | 设置存储在 localStorage |

### 5.3 断网/断后端测试

| 场景 | 预期行为 | 说明 |
|------|----------|------|
| 已加载云端数据后断网 | 可继续处理 | 数据已在内存 |
| 断网后刷新页面 | 云端数据集加载失败 | 无法调用 API |
| 断网后上传文件 | 保存到 IndexedDB | 不依赖后端 |
| 断网后处理本地数据 | **完全正常** | 纯前端执行 |

---

## 6. 测试结果汇总表

| 测试场景 | UI 显示模式 | 数据来源 | 操作执行位置 | 是否读取 IndexedDB | 是否调用后端 API | 是否调用 DuckDB | 结论 |
|---|---|---|---|---|---|---|---|
| 云端模式 + 打开 DataWorkshop | 显示两套数据源按钮 | 混合：后端 API + IndexedDB | DataWorkshop.tsx 纯 JS | ✅ 读取本地元数据 | ✅ 读取云端列表 | ❌ 不调用 | **混合模式，非真云端** |
| 本地模式 + 打开 DataWorkshop | 显示两套数据源按钮 | 混合：后端 API + IndexedDB | DataWorkshop.tsx 纯 JS | ✅ 读取本地元数据 | ✅ 读取云端列表 | ❌ 不调用 | **混合模式，模式切换无效** |
| 从云端数据集导入 | 加载到内存 | 后端 API `preview` | DataWorkshop.tsx 纯 JS | ❌ 不读取 | ✅ 调用一次 | ❌ 不调用 | **数据到内存后纯前端处理** |
| 从本地数据集导入 | 加载到内存 | IndexedDB | DataWorkshop.tsx 纯 JS | ✅ 读取数据 | ❌ 不调用 | ❌ 不调用 | **纯前端处理** |
| 上传文件 | 保存到本地 | FileReader + IndexedDB | DataWorkshop.tsx 纯 JS | ✅ 写入数据 | ❌ 不调用 | ❌ 不调用 | **仅本地存储** |
| 执行操作链 | 显示引擎指示器 | 内存数据 | 纯 JS 函数 | ❌ 不访问 | ❌ 不调用 | ❌ 不调用 | **引擎指示器仅展示** |
| 大数据量 (>20万行) | 显示"高性能引擎" | 内存数据 | 纯 JS 函数 | ❌ 不访问 | ❌ 不调用 | ❌ 不调用 | **可能卡顿但未用 DuckDB** |
| 清空 IndexedDB 后 | 本地数据集为空 | 仅后端 API | - | ❌ 无数据 | ✅ 云端正常 | - | **云端数据仍可用** |
| 断网后 | 云端加载失败 | 仅 IndexedDB | 纯 JS 函数 | ✅ 本地可用 | ❌ 无法调用 | - | **本地功能完整** |

---

## 7. 真实运行路径结论

### 7.1 DataWorkshop 云端模式是真云端吗？

**答案：不是**

- 云端数据仅通过 API 加载到前端内存
- 所有处理在前端完成，不调用后端分析 API
- 结果不保存回云端，刷新即丢失
- **本质上是一个"云端数据预览 + 本地处理"工具**

### 7.2 模式切换按钮是否真的控制数据路径？

**答案：对 DataWorkshop 无效**

- 模式切换仅控制 `Datasets` 页面和 `Upload` 页面
- DataWorkshop 始终同时加载两套数据源
- 用户可自由选择使用云端或本地数据
- **模式切换是"伪全局状态"**

### 7.3 云端模式下是否仍依赖 IndexedDB？

**答案：是**

- 即使切换到"云端模式"，DataWorkshop 仍读取 IndexedDB
- 本地数据集列表始终显示
- 上传的文件仍保存到 IndexedDB
- **IndexedDB 是所有模式的依赖**

### 7.4 DuckDB 是否真的参与执行？

**答案：否**

- `engine-selector.ts` 计算决策但不被执行逻辑使用
- `executeOperations` 使用纯 JS 实现
- `duckdb-service.ts` 和 `duckdb.worker.ts` 在 DataWorkshop 中永不触发
- **DuckDB 是"死代码"（对 DataWorkshop 而言）**

### 7.5 当前架构应该如何重新命名？

| 当前命名 | 实际含义 | 建议命名 |
|----------|----------|----------|
| Local-first Mode | 数据存 IndexedDB，处理在本地 | **Browser-local Mode** |
| Cloud Mode | 数据存后端，但 DataWorkshop 仍本地处理 | **Cloud-Storage Mode** |
| 安全模式 | 数据不上传 | **Offline-capable Mode** |
| DataWorkshop | 前端数据处理工具，支持混合数据源 | **Data Studio** / **Workbench** |

### 7.6 哪些文档结论需要修正？

#### STORAGE_ARCHITECTURE.md 修正

| 原结论 | 修正 |
|--------|------|
| DataWorkshop 仅支持 Local-first | **DataWorkshop 支持混合数据源，与模式无关** |
| Cloud 模式不使用 IndexedDB | **DataWorkshop 在 Cloud 模式仍使用 IndexedDB** |
| 双模式数据隔离 | **DataWorkshop 中数据不隔离** |

#### REDUNDANCY_AUDIT.md 修正

| 原结论 | 修正 |
|--------|------|
| engine-selector.ts 仅显示建议 | **确认：实际执行不遵循决策** |
| local-storage.service.ts executeOperations 未被调用 | **确认：DataWorkshop 自行实现** |

#### MVP_SCOPE.md 修正

| 原结论 | 修正 |
|--------|------|
| DataWorkshop 仅 Local-first 可用 | **DataWorkshop 云端模式下可用，但处理纯前端** |
| DataWorkshop 与 AI 助手割裂 | **确认：两者独立，但 DataWorkshop 可在 Cloud 模式使用** |

---

## 8. 工程建议

### 8.1 短期（保持现状）

```
当前行为:
- DataWorkshop 是"增强版数据预览工具"
- 支持从云端或本地加载数据
- 纯前端处理，结果不保存
- 模式切换不影响 DataWorkshop

用户认知:
- "我在使用一个数据处理工具"
- "可以从云端或本地导入数据"
- "处理结果是临时的"
```

### 8.2 中期（优化体验）

1. **明确 DataWorkshop 定位**
   - 添加说明："数据工坊是一个前端数据处理工具，所有操作在浏览器中完成"

2. **修复引擎指示器**
   - 要么移除 DuckDB 相关提示
   - 要么真正实现 DuckDB 集成

3. **统一模式切换行为**
   - 选项 A: DataWorkshop 也响应模式切换，只显示对应数据源
   - 选项 B: 明确告知用户 DataWorkshop 不受模式影响

### 8.3 长期（架构重构）

```
选项 1: 保留混合模式
- 明确 DataWorkshop 是"前端数据实验室"
- 数据可从任意来源导入
- 结果可导出或保存到指定位置

选项 2: 分离功能
- DataWorkshop 仅处理本地数据
- 云端数据使用 AI 助手分析
- 明确区分使用场景

选项 3: 真正实现云端处理
- DataWorkshop 操作调用后端 API
- 支持保存处理流程和结果
- 实现真正的 Cloud 模式
```

---

## 附录：关键代码位置速查

```
DataWorkshop 数据源加载:
- L212-237: loadLocalDatasets() - IndexedDB
- L271-282: loadDatasets() - 后端 API
- L285-316: importFromDataset() - 从云端导入到内存
- L411-430: loadFromLocalStorage() - 从本地导入到内存

DataWorkshop 操作执行:
- L547-613: executeOperations() - 纯 JS 执行入口
- L616-699: executeJoin() - 纯 JS 实现
- L701-759: executeFilter() - 纯 JS 实现
- 等等...

模式切换:
- app/src/services/local-storage.service.ts L41-77: setSecurityMode/getSecurityMode
- app/src/components/SecurityBadge.tsx: UI 切换按钮
- app/src/pages/Datasets.tsx L84: 读取模式影响数据源

DuckDB（DataWorkshop 中未使用）:
- app/src/services/local-storage.service.ts L267-328: executeOperations (未被调用)
- app/src/services/duckdb-service.ts: 未被 DataWorkshop 导入
- app/src/workers/duckdb.worker.ts: 未被 DataWorkshop 导入
```

---

**审计完成日期**: 2026-04-08  
**审计人**: AI Assistant  
**状态**: 需产品决策
