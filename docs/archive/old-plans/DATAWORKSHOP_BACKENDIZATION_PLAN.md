# DataWorkshop 后端化设计文档

**日期**: 2026-04-27  
**阶段**: Phase 3B — 设计文档与 API 契约  
**约束**: 不改业务代码、不实现后端 API、不删除 legacy

---

## 一、当前 DataWorkshop 问题总结

### 1.1 架构层面

| 问题 | 现状 | 风险 |
|---|---|---|
| 执行位置 | 所有操作在浏览器内存中执行（`DataWorkshop.tsx:550-616`） | 大文件导致浏览器崩溃，无法处理超过 ~10万行数据 |
| 数据持久化 | 结果仅存于 React state（`previewData`），不保存到后端 | 刷新页面即丢失，无法复用 |
| 存储依赖 | 仍显式 import `@/legacy/browser-processing/local-storage.service.ts`（`DataWorkshop.tsx:44`） | 与 Backend Processing 主线架构冲突 |
| 引擎选择 | `engineSelector` 仅用于 UI 展示（`DataWorkshop.tsx:191, 262`），不影响实际执行 | 用户被误导，DuckDB 实际从未触发 |
| 数据源 | 支持从 IndexedDB 本地数据集导入（`loadLocalDatasets`，`DataWorkshop.tsx:216`） | 数据来源不统一，IndexedDB 数据不在后端 |

### 1.2 操作层面

当前 `DataWorkshop.tsx` 内联实现了 9 种操作类型（`OperationType`，`DataWorkshop.tsx:49-58`）：

```typescript
type OperationType = 
  | 'join'           // JOIN合并
  | 'filter'         // 行筛选
  | 'pivot'          // 数据透视
  | 'reshape'        // 宽长表转换
  | 'transform'      // 列处理（rename/split/merge/format/remove/reorder）
  | 'dedup'          // 去重
  | 'sample'         // 抽样
  | 'derive'         // 衍生计算（公式引擎）
  | 'output';        // 格式化输出
```

这些操作全部由前端内联函数执行：
- `executeJoin`（`DataWorkshop.tsx:619`）— 简化版 hash join，未处理列名冲突
- `executeFilter`（`DataWorkshop.tsx:659`）— 内存 filter + 字符串比较
- `executeTransform`（`DataWorkshop.tsx:687`）— 多 action 串行处理
- `executeDedup`（`DataWorkshop.tsx:814`）— Map 去重
- `executeReshape`（`DataWorkshop.tsx:865`）— melt / pivot 手动实现
- `executePivot`（`DataWorkshop.tsx:941`）— 分组聚合，列名生成逻辑复杂
- `executeDerive`（`DataWorkshop.tsx:1043`）— 基于 `new Function()` 的公式求值
- `executeSample`（`DataWorkshop.tsx:1100`）— Fisher-Yates 洗牌

> **注意**：`app/src/legacy/browser-processing/operation-executor.ts` 中存在另一套几乎相同的实现，但 `DataWorkshop.tsx` 并未调用它（死代码）。

### 1.3 执行链路

```
用户选择数据文件
  -> FileReader 读取为内存 DataTable（DataWorkshop.tsx:376 localStorageService.importDataset）
  -> 用户在 UI 上配置操作链（operations state）
  -> 点击"执行" -> executeOperations()（纯前端 JS 循环）
  -> 结果写入 previewData state
  -> 用户可导出为 CSV/JSON/SQL/Markdown（前端内存生成）
```

**问题**：链路中没有后端参与，数据集 ID 来自 IndexedDB 而非后端 MySQL。

---

## 二、目标架构

后端化后的 DataWorkshop 应纳入 Backend Processing 主线：

```
用户从后端 Dataset 列表选择数据源
  -> 前端仅负责：构建操作链 JSON、调用后端 API、展示结果
  -> POST /api/v1/datasets/{id}/transform/preview（预览，不保存）
  -> 后端读取 storage_path -> pandas 执行操作链 -> 返回预览结果
  -> POST /api/v1/datasets/{id}/transform（保存结果）
  -> 后端执行后保存为新 Dataset / DatasetVersion -> MySQL + storage
  -> 前端展示新数据集，可进入分析/下载
```

---

## 三、前端职责

### 3.1 保留的职责

1. **数据源选择 UI**：从后端 Dataset 列表选择输入数据集（替换当前的本地/云端导入）
2. **操作链构建器**：拖拽/添加/删除/排序操作节点，配置每个 operation 的参数
3. **操作配置面板**：`JoinConfigPanel`、`FilterConfigPanel`、`TransformConfigPanel` 等（`DataWorkshop.tsx:1767-1781`）
4. **结果展示**：预览表格、行列统计、执行耗时
5. **操作链本地草稿**：`localStorage` 保存未提交的操作链 JSON（纯 UI 状态，非数据）

### 3.2 移除的职责

1. **数据执行**：不再内联执行 `executeJoin`、`executeFilter` 等函数
2. **内存数据管理**：不再维护 `tables`、`previewData` 等内存 DataTable 状态（改为从 API 获取）
3. **本地数据集导入**：移除 `loadLocalDatasets`、`localStorageService.importDataset` 调用
4. **引擎选择 UI**：移除 `engineDecision` state 和 `EngineIndicator`（后端统一用 pandas）
5. **公式求值引擎**：`evaluateFormula` 中 `new Function()` 逻辑移至后端

### 3.3 新增的 API 调用层

```typescript
// app/src/api/workshop.ts（新增文件，Phase 3C 实现）
export const workshopApi = {
  preview: (datasetId: string, operations: Operation[]) =>
    request.post<ApiResponse<TransformPreview>>(`/datasets/${datasetId}/transform/preview`, { operations }),

  transform: (datasetId: string, operations: Operation[], options?: TransformOptions) =>
    request.post<ApiResponse<TransformResult>>(`/datasets/${datasetId}/transform`, { operations, options }),
};
```

---

## 四、后端职责

### 4.1 新增模块建议

`insightease-backend/app/api/v1/endpoints/transform.py`

职责：
1. 接收操作链 JSON，读取源数据集文件（支持 OSS/本地回退）
2. 使用 pandas 串行执行每个 operation
3. preview 模式：返回前 N 行 + 统计信息（不写入 storage）
4. transform 模式：执行后保存为新 CSV/Excel → storage.save() → MySQL 写入新 Dataset 记录
5. 错误处理：操作链中某一步失败时返回具体失败步骤和原因

### 4.2 pandas 实现策略

| 前端 Operation | pandas 等价实现 | 复杂度 |
|---|---|---|
| filter | `df.query()` 或布尔索引 | 低 |
| transform (rename) | `df.rename(columns=...)` | 低 |
| transform (remove) | `df.drop(columns=...)` | 低 |
| transform (split) | `str.split(expand=True)` + `join()` | 中 |
| transform (merge) | `df[new_col] = df[c1] + sep + df[c2]` | 低 |
| transform (format date) | `pd.to_datetime().dt.strftime()` | 中 |
| transform (format number) | `round()`, `format()` | 低 |
| dedup | `df.drop_duplicates(subset=..., keep=...)` | 低 |
| sample | `df.sample(n=...)` 或 `df.sample(frac=...)` | 低 |
| sort | `df.sort_values(by=..., ascending=...)` | 低 |
| derive | 公式解析后用 `df.eval()` 或 `apply()` | 中 |
| reshape (melt) | `pd.melt()` | 低 |
| reshape (pivot wide) | `df.pivot()` | 低 |
| pivot (aggregation) | `pd.pivot_table()` | 中 |
| join | `pd.merge()` | 高 |

### 4.3 文件 I/O 策略

复用 `datasets.py` 已有的模式（`DataWorkshop.tsx` 后端化应遵循同一 storage 抽象）：

```python
# 读取源数据
df = read_dataset_to_df(dataset.storage_path)  # 封装 storage.read() + 临时文件

# 执行操作链
result_df = execute_operations(df, operations)

# preview 模式：直接返回前 50 行
# transform 模式：保存新文件
new_storage_path = await storage.save(new_id, new_filename, file_content)
```

> **需要人工确认**：`datasets.py` 中 `get_dataset_statistics`（`datasets.py:399`）直接按 `storage_path` 读取文件，未走 `storage.read()` 回退。若部署为 OSS，统计接口会失败。此问题应在 DataWorkshop 后端化之前或同时修复。

---

## 五、第一版支持的操作类型（V1 Must-Have）

基于当前 `DataWorkshop.tsx` 审计结果，以下操作是用户最常用、后端实现最清晰的，应优先支持：

| 操作 | 前端已有面板 | 后端 pandas 实现 | 纳入 V1 理由 |
|---|---|---|---|
| **filter** | ✅ `FilterConfigPanel` | `df[...]` / `df.query()` | 最基础高频操作，零争议 |
| **select columns** | ✅ `TransformConfigPanel`（remove/reorder） | `df[cols]` | 属于 transform 的子集，用户高频使用 |
| **rename columns** | ✅ `TransformConfigPanel` | `df.rename()` | 属于 transform 的子集，实现简单 |
| **deduplicate** | ✅ `DedupConfigPanel` | `df.drop_duplicates()` | 高频清洗操作，pandas 原生支持 |
| **derive simple column** | ✅ `DeriveConfigPanel` | `df.eval()` / `apply()` | 常用，但公式引擎需要限制函数白名单 |
| **sample** | ✅ `SampleConfigPanel` | `df.sample()` | 简单直接，pandas 原生支持 |
| **sort** | ❌ 当前无独立面板 | `df.sort_values()` | 后端 V1 原生支持；前端 sort 面板为 **optional**（不阻塞 3C），可先通过 transform 的 reorder 或后端默认行为满足基础需求 |

### 5.1 V1 操作 schema 示例

```json
{
  "operations": [
    { "type": "filter", "config": { "conditions": [...], "logic": "and" } },
    { "type": "select", "config": { "columns": ["col_a", "col_b"] } },
    { "type": "rename", "config": { "mappings": [{"old": "col_a", "new": "姓名"}] } },
    { "type": "sort", "config": { "by": ["日期"], "ascending": [false] } },
    { "type": "dedup", "config": { "columns": ["姓名"], "keep": "first" } },
    { "type": "derive", "config": { "newColumn": "年龄_平方", "formula": "年龄 ** 2" } },
    { "type": "sample", "config": { "method": "percentage", "percentage": 10 } }
  ]
}
```

> **设计决策**：将前端 `transform` 操作的 5 个子 action（rename/split/merge/format/remove/reorder）拆分为后端独立的 atomic operation。原因：
> - 后端串行执行更简单，每个 operation 对应单一 pandas 调用
> - 错误定位更精确（"第 3 步 rename 失败" 而非 "transform 失败"）
> - 前端 UI 可保持现有 panel，只需在提交前将 `transform.actions[]` 拆分为多个 operation 对象

---

## 六、V1 可暂缓的操作类型

| 操作 | 前端已有面板 | 暂缓理由 |
|---|---|---|
| **join** | ✅ `JoinConfigPanel` | 需要多表输入（当前 API 基于单 dataset_id），涉及 API 契约重新设计；前端 join 实现有 bug（列名冲突未处理） |
| **pivot** | ✅ `PivotConfigPanel` | 实现较复杂（多级列名、聚合逻辑），但 pandas `pivot_table` 支持良好；可作为 V1.5 |
| **reshape (melt/pivot wide)** | ✅ `ReshapeConfigPanel` | melt 和 pivot 需求不如 filter/dedup 高频；pandas 支持好，但 UI 参数容易误配 |
| **transform (split/merge/format)** | ✅ `TransformConfigPanel` | split/merge 需求相对低频；format 涉及日期/数字格式解析，边界 case 多 |
| **complex formula** | ✅ `DeriveConfigPanel` | 当前前端公式引擎支持 UPPER/LOWER/TRIM/LEN/SUBSTR/REPLACE/CONCAT/IF/AND/OR/NOT；后端 `df.eval()` 语法不同，需要重新设计公式方言 |
| **output (csv/json/sql/md)** | ✅ 导出按钮 | output 不是数据转换操作，是格式导出；可复用现有 `/datasets/{id}/download` 接口，无需纳入 transform API |

**建议**：V1 聚焦 "数据清洗和简单变换"（filter、select、rename、sort、dedup、derive、sample），让用户能完成 80% 的日常数据准备任务。join 和 pivot 在 V2 中通过支持多输入数据集或子查询方式实现。

---

## 七、数据集版本策略

### 7.1 方案对比

| 方案 | 说明 | 优缺点 |
|---|---|---|
| **A: 新 Dataset** | transform 结果作为全新 Dataset 记录插入 `datasets` 表 | 简单，与现有 Dataset CRUD 完全兼容；缺点是历史关系丢失 |
| **B: DatasetVersion 表** | 新增 `dataset_versions` 表，记录父子关系 | 支持版本回溯、diff、血缘追踪；缺点是schema和API复杂度上升 |
| **推荐：A + 预留 B** | V1 用方案 A，但在 `Dataset` 表预留 `parent_dataset_id` 和 `transform_chain` 字段 | 兼顾简单实现和未来扩展 |

### 7.2 推荐方案（V1）

在 `datasets` 表新增两个字段：

```python
# insightease-backend/app/models/models.py
parent_dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True)
transform_chain = Column(JSON, nullable=True)  # 保存原始操作链 JSON
```

- `transform` API 创建的新 Dataset，`parent_dataset_id` 指向源数据集
- `transform_chain` 记录用户提交的操作链（用于审计和复现）
- V2 再考虑是否升级为独立的 `dataset_versions` 表

### 7.3 版本命名

```json
{
  "filename": "销售数据_清洗后.csv",
  "auto_name": "销售数据_清洗后",  // 后端可基于原文件名 + 操作类型生成
  "parent_dataset_id": "uuid-of-source"
}
```

---

## 八、错误处理策略

### 8.1 后端错误分类

| 错误类型 | HTTP 状态码 | 示例 |
|---|---|---|
| 数据集不存在 | 404 | `{"message": "数据集不存在"}` |
| 权限不足 | 403 | `{"message": "无权访问此数据集"}` |
| 操作参数无效 | 422 | `{"message": "第 2 步 filter 中列 '销售额' 不存在"}` |
| 操作执行失败 | 422 | `{"message": "第 4 步 derive 公式语法错误: 意外的运算符 '++'"}` |
| 文件读取失败 | 500 | `{"message": "无法读取数据集文件: storage.read() 失败"}` |
| 结果过大 | 413 | `{"message": "结果行数超过 100万行限制"}` |

### 8.2 前端错误展示

- 后端返回的 `message` 直接通过 `toast.error()` 展示
- 如果后端返回 `failed_step_index`，前端可以高亮对应的操作节点
- preview 模式下，即使某一步出错，也不应影响原始数据集

### 8.3 事务性保证

- **preview**：无副作用，失败时不修改任何数据
- **transform**：失败时确保不创建脏 Dataset 记录。使用数据库事务 + 文件清理：
  ```python
  try:
      # 1. 执行操作链
      # 2. 保存文件
      # 3. 写入 MySQL
      await db.commit()
  except:
      await db.rollback()
      await storage.delete(new_storage_path)  # 清理已上传的文件
  ```

---

## 九、权限和安全策略

### 9.1 基础权限

复用现有 `get_current_active_user` 机制：
- 用户只能对自己的 Dataset 调用 transform
- `dataset.user_id == current_user.id` 校验（与 `datasets.py` 一致）

### 9.2 公式安全（derive 操作）

前端当前使用 `new Function()` 执行用户公式（`DataWorkshop.tsx:1059`），存在严重安全隐患。后端化必须解决：

| 策略 | 说明 |
|---|---|
| 白名单函数 | 只允许 `+ - * / ** > < == != >= <= & \| ~` 和命名函数（UPPER/LOWER/IF 等） |
| 禁止属性访问 | 禁止 `.` 操作符，防止 `__import__('os').system(...)` |
| pandas eval | 使用 `pd.eval(..., engine='python', local_dict=safe_dict)` 并限制 local_dict |
| 超时控制 | 公式求值设置最大执行时间（如 5 秒），防止复杂递归 |

**建议 V1 实现**：后端 derive 操作只支持纯数值算术表达式（`+ - * / ** %` 和括号），不支持任何函数调用、字符串操作、条件判断或逻辑表达式。所有非数值处理应通过独立的 filter / rename / select 操作完成。

### 9.3 资源限制

| 限制项 | 建议值 | 说明 |
|---|---|---|
| 最大操作链长度 | 20 步 | 防止滥用 |
| 最大输出行数 | 1,000,000 行 | 防止生成超大文件 |
| 最大预览行数 | 100 行 | preview API 返回限制 |
| 单次请求超时 | 30 秒 | V1 同步执行，防止阻塞 worker；V2 再引入后台任务模式 |
| 源文件大小限制 | 100 MB | V1 同步执行的安全上限；V2 再支持大文件+后台任务 |

---

## 十、分阶段迁移步骤

### Phase 3B（当前）— 设计完成 ✅
- 产出本文档和 API 契约
- 不改代码

### Phase 3C — 后端 API 实现

**分层结构（禁止把 pandas 逻辑全部写入 endpoint）**：

```
insightease-backend/
├── app/
│   ├── api/v1/endpoints/transform.py      # 路由层：参数校验、权限检查、调用 service
│   ├── services/transform_service.py      # 业务层：操作链编排、文件 I/O、事务管理
│   ├── schemas/transform.py               # Pydantic schema：Request/Response/Operation 模型
│   └── core/
│       └── transform_executor.py          # 执行层：纯 pandas 操作执行，无 HTTP/DB 依赖
```

**实现步骤**：

1. **检查当前 `models.py`**：确认 `Dataset` 模型当前字段清单，确保新增字段不与现有字段冲突
2. **修改 `models.py`**：在 `Dataset` 模型新增 `parent_dataset_id`（`String(36)`，`ForeignKey`，`nullable=True`）和 `transform_chain`（`JSON`，`nullable=True`）
3. **数据库迁移前置检查**：
   - 当前后端 **没有 Alembic 或其他 migration 工具**（需要人工确认）
   - 如果已在使用 Alembic：执行 `alembic revision --autogenerate -m "add transform fields to datasets"`，**禁止手动绕过 migration** 直接改表
   - 如果未使用 Alembic：需先评估是否引入 Alembic，或在 `Base.metadata.create_all()` 策略下手动执行 `ALTER TABLE` 并记录变更脚本
   - **V1 最低要求**：新增字段必须在所有环境（开发/测试/生产）的 MySQL 中同步生效，且有可审计的变更记录
4. **新增 `schemas/transform.py`**：定义 `Operation`、`TransformPreviewRequest`、`TransformPreviewResponse`、`TransformRequest`、`TransformResponse`、`TransformOptions` 等 Pydantic 模型
5. **新增 `core/transform_executor.py`**：纯函数实现，接收 `pd.DataFrame` + `Operation[]`，返回 `pd.DataFrame`。禁止 import FastAPI/SQLAlchemy
6. **新增 `services/transform_service.py`**：
   - `preview_transform(dataset_id, operations)`：读取文件 → 调用 executor → 返回前 100 行 + 统计
   - `execute_transform(dataset_id, operations, options)`：读取文件 → 调用 executor → 保存新文件 → 写入 MySQL（含事务回滚和文件清理）
7. **新增 `api/v1/endpoints/transform.py`**：两个 POST 路由，只做参数校验、权限校验、调用 service、返回 ResponseModel
8. **在 `api/v1/api.py` 注册 transform 路由**
9. **编写单元测试**：至少覆盖 filter、rename、dedup、derive（纯数值）、sample、sort

**执行模式（V1 冻结）**：
- `preview`：同步执行，内存处理，不保存文件
- `transform`：同步执行，源文件 ≤ 100 MB，超时 30 秒
- **后台任务模式和大文件支持（>100 MB）明确放到 V2**

### Phase 3D — 前端接入（分文件替换）
**策略：避免一次性重写 3000 行 DataWorkshop.tsx**

1. **新增 `app/src/api/workshop.ts`**：封装两个 transform API
2. **新增 `app/src/hooks/useWorkshop.ts`**：管理操作链 state + API 调用逻辑
3. **修改数据源选择区域**：移除本地数据集导入，改为从后端 API 加载 Dataset 列表（复用 Datasets 页面已有的 `datasetApi.list`）
4. **替换执行按钮逻辑**：`executeOperations()` 改为调用 `workshopApi.preview()`，结果写入 previewData
5. **新增"保存为新数据集"按钮**：调用 `workshopApi.transform()`
6. **保留现有操作配置面板**：`FilterConfigPanel`、`DedupConfigPanel`、`DeriveConfigPanel`、`SampleConfigPanel`、`TransformConfigPanel`（用于 rename/select）暂不改动
7. **sort 面板（optional，不阻塞 3C）**：后端 V1 已支持 sort 操作，但前端当前无独立 sort 面板。Phase 3D 可选择：
   - 方案 A：新增 `SortConfigPanel`（简单，1-2 天工作量）
   - 方案 B：暂不新增，V1 前端不暴露 sort 操作（用户可先通过后端 API 测试 sort 功能，V1.1 补 UI）
   - **推荐方案 B**：避免阻塞 3C 后端开发，sort UI 作为独立小迭代
8. **移除 legacy import**：确认 `localStorageService` 和 `engineSelector` 不再被 DataWorkshop.tsx 引用后，删除相关 import 行
9. **移除内联执行函数**：确认后端 API 稳定后，删除 `executeJoin`、`executeFilter` 等内联函数（可保留到 V2 作为 fallback）

### Phase 3E — 清理与优化
1. 删除 `DataWorkshop.tsx` 中已废弃的内联执行函数
2. 移除 `legacy/browser-processing/` 中确认不再被引用的模块（如果 DuckDBLoader 也不再需要）
3. 补充 E2E 测试：选择数据集 → 添加 filter → preview → transform → 验证新数据集存在

---

## 十一、风险点

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| **join 操作被用户高频使用但 V1 不支持** | 用户流失 | 在 UI 中明确标注 "JOIN 合并将在 V2 支持"，并提供 workaround（先在上传前用 Excel 处理） |
| **derive 公式语法与前端不一致** | 用户困惑 | 设计清晰的公式方言文档；前端公式编辑器实时校验（调用后端 validate 接口或本地规则） |
| **大文件 transform 超时** | 后端 504 | V1 限制源文件 100 MB + 30 秒超时；V2 再引入后台任务模式和大文件支持 |
| **OSS 存储读取兼容性** | `transform.py` 读取文件失败 | 统一使用 `storage.read()` + 临时文件模式，与 `datasets.py:preview_dataset` 保持一致 |
| **pandas 与前端数据类型不一致** | 日期、null 值展示差异 | 后端返回数据时统一用 JSON-safe 格式（null → null, NaN → null, datetime → ISO string） |
| **前端 state 重构引入回归** | DataWorkshop 其他功能损坏 | 分文件修改，每步修改后运行完整手动测试 |
| **操作链 JSON 结构未来变更** | 已保存的本地草稿失效 | V1 冻结 operation schema，后续变更时提供 migration |

---

## 十二、验收标准

### 12.1 后端验收

- [ ] `POST /datasets/{id}/transform/preview` 返回前 100 行 + 列统计 + 潜在错误
- [ ] `POST /datasets/{id}/transform` 创建新 Dataset，parent_dataset_id 正确
- [ ] 支持 filter、select、rename、sort、dedup、derive、sample 7 种操作
- [ ] 操作链中某一步失败时返回明确的失败步骤和原因
- [ ] 用户只能 transform 自己的数据集
- [ ] 源文件 ≤ 100 MB，同步执行，超时 30 秒
- [ ] `npx tsc --noEmit` 通过（前端 TypeScript 编译）
- [ ] 后端单元测试覆盖所有 V1 操作类型

### 12.2 前端验收

- [ ] DataWorkshop 不再 import `@/legacy/browser-processing/local-storage.service`
- [ ] 数据源仅来自后端 Dataset API（IndexedDB 导入入口已移除或明确标记为 legacy）
- [ ] 点击"执行"调用后端 preview API，结果展示在预览区
- [ ] 点击"保存为新数据集"调用后端 transform API，新数据集出现在 Datasets 列表
- [ ] `engineSelector` 和 `EngineIndicator` 已移除
- [ ] 内联 `executeJoin`、`executeFilter` 等函数已删除或标记为 @deprecated

### 12.3 产品验收

- [ ] 用户可以在 DataWorkshop 完成 "筛选 + 去重 + 新增计算列 + 抽样" 的完整工作流
- [ ] 结果可以保存为新的后端数据集，并进入 SmartAnalysis
- [ ] 操作链执行耗时 < 10 秒（10万行以内数据集）
