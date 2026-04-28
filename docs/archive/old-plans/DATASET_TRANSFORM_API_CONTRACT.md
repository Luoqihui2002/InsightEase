# Dataset Transform API Contract

**日期**: 2026-04-27  
**版本**: V1.0  
**范围**: 定义 DataWorkshop 后端化所需的两个核心 API

---

## 一、API 概览

| API | 方法 | 路径 | 用途 |
|---|---|---|---|
| Preview | `POST` | `/api/v1/datasets/{dataset_id}/transform/preview` | 预览操作链结果，不保存 |
| Transform | `POST` | `/api/v1/datasets/{dataset_id}/transform` | 执行并保存为新数据集 |

---

## 二、API 1：Preview 操作链结果

### 2.1 请求

```http
POST /api/v1/datasets/{dataset_id}/transform/preview
Content-Type: application/json
Authorization: Bearer {token}
```

#### Request Body

```json
{
  "operations": [
    {
      "type": "filter",
      "config": {
        "conditions": [
          { "column": "年龄", "operator": "gte", "value": "18" }
        ],
        "logic": "and"
      }
    },
    {
      "type": "rename",
      "config": {
        "mappings": [
          { "old": "年龄", "new": "age" }
        ]
      }
    },
    {
      "type": "derive",
      "config": {
        "newColumn": "age_squared",
        "formula": "age ** 2"
      }
    }
  ]
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `operations` | `Operation[]` | ✅ | 操作链，按数组顺序执行 |
| `operations[].type` | `string` | ✅ | 操作类型，见下方支持列表 |
| `operations[].config` | `object` | ✅ | 操作参数，因类型而异 |

### 2.2 成功响应

```json
{
  "code": 200,
  "data": {
    "columns": ["name", "age", "age_squared"],
    "data": [
      { "name": "Alice", "age": 25, "age_squared": 625 },
      { "name": "Bob", "age": 30, "age_squared": 900 }
    ],
    "total_rows": 2,
    "preview_limit": 100,
    "column_stats": [
      {
        "name": "age",
        "dtype": "int64",
        "non_null_count": 2,
        "null_count": 0,
        "min": 25,
        "max": 30,
        "mean": 27.5
      }
    ],
    "execution_summary": {
      "steps_executed": 3,
      "duration_ms": 45,
      "warnings": []
    }
  },
  "message": "success"
}
```

#### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `columns` | `string[]` | 结果列名 |
| `data` | `object[]` | 预览数据行（最多 100 行） |
| `total_rows` | `int` | 结果总行数 |
| `preview_limit` | `int` | 本次返回的最大行数 |
| `column_stats` | `ColumnStat[]` | 各列统计信息 |
| `execution_summary.steps_executed` | `int` | 成功执行的步骤数 |
| `execution_summary.duration_ms` | `int` | 执行耗时（毫秒） |
| `execution_summary.warnings` | `string[]` | 警告信息（如自动类型转换） |

### 2.3 错误响应

```json
{
  "code": 422,
  "data": null,
  "message": "第 2 步 rename 失败: 列 '年龄' 不存在于当前数据集中"
}
```

**扩展错误信息（可选，便于前端高亮失败节点）**：

```json
{
  "code": 422,
  "data": {
    "failed_step_index": 2,
    "failed_step_type": "rename",
    "error_category": "COLUMN_NOT_FOUND",
    "available_columns": ["name", "age", "city"]
  },
  "message": "第 2 步 rename 失败: 列 '年龄' 不存在"
}
```

---

## 三、API 2：保存操作链结果

### 3.1 请求

```http
POST /api/v1/datasets/{dataset_id}/transform
Content-Type: application/json
Authorization: Bearer {token}
```

#### Request Body

```json
{
  "operations": [
    {
      "type": "filter",
      "config": {
        "conditions": [
          { "column": "age", "operator": "gte", "value": "18" }
        ],
        "logic": "and"
      }
    }
  ],
  "options": {
    "filename": "adults_filtered.csv",
    "save_mode": "new_dataset"
  }
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `operations` | `Operation[]` | ✅ | 同 Preview API |
| `options` | `TransformOptions` | ❌ | 保存选项 |
| `options.filename` | `string` | ❌ | 新数据集文件名，默认 `{原文件名}_transformed.{ext}` |
| `options.save_mode` | `"new_dataset" \| "version"` | ❌ | 保存模式，默认 `new_dataset` |

> **注意**：V1 只实现 `save_mode: "new_dataset"`。`"version"` 模式预留到 V2。

### 3.2 成功响应

```json
{
  "code": 200,
  "data": {
    "new_dataset_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "filename": "adults_filtered.csv",
    "row_count": 1250,
    "col_count": 5,
    "parent_dataset_id": "original-dataset-uuid",
    "transform_chain": [
      { "type": "filter", "config": { ... } }
    ],
    "execution_summary": {
      "steps_executed": 1,
      "duration_ms": 120,
      "input_rows": 5000,
      "output_rows": 1250
    }
  },
  "message": "数据集转换成功"
}
```

#### 字段说明

| 字段 | 类型 | 说明 |
|---|---|---|
| `new_dataset_id` | `string` | 新创建的数据集 UUID |
| `filename` | `string` | 实际保存的文件名 |
| `row_count` | `int` | 结果行数 |
| `col_count` | `int` | 结果列数 |
| `parent_dataset_id` | `string` | 源数据集 ID |
| `transform_chain` | `Operation[]` | 实际执行的操作链（审计用） |
| `execution_summary.input_rows` | `int` | 原始数据行数 |
| `execution_summary.output_rows` | `int` | 结果数据行数 |

### 3.3 错误响应

```json
{
  "code": 413,
  "data": {
    "failed_step_index": 0,
    "output_rows": 2500000,
    "max_allowed_rows": 1000000
  },
  "message": "结果行数超过限制（250万行 > 100万行上限），请添加筛选条件减少数据量"
}
```

---

## 四、Operation Schema

### 4.1 通用结构

```typescript
interface Operation {
  type: OperationType;  // 操作类型标识
  config: OperationConfig;  // 类型特定的配置对象
}
```

### 4.2 V1 支持的 OperationType

| 类型 | 说明 | 前端对应面板 |
|---|---|---|
| `filter` | 行筛选 | `FilterConfigPanel` |
| `select` | 选择/保留指定列 | `TransformConfigPanel`（remove/reorder 的反向语义） |
| `rename` | 重命名列 | `TransformConfigPanel`（rename action） |
| `sort` | 排序 | **新增面板** |
| `dedup` | 去重 | `DedupConfigPanel` |
| `derive` | 衍生计算列 | `DeriveConfigPanel` |
| `sample` | 随机抽样 | `SampleConfigPanel` |

> **V2 预留**：`join`、`pivot`、`reshape`、`transform_split`、`transform_merge`、`transform_format`

### 4.3 各类型 Config Schema

#### 4.3.1 filter

```json
{
  "type": "filter",
  "config": {
    "conditions": [
      {
        "column": "string",           // 必填，列名
        "operator": "eq|ne|gt|gte|lt|lte|contains|startswith|endswith|isNull|isNotNull",
        "value": "string|number"      // 可选（isNull/isNotNull 不需要）
      }
    ],
    "logic": "and|or"                 // 必填，多个条件的组合逻辑
  }
}
```

**参数校验规则**：
- `conditions` 至少包含 1 个条件
- `column` 必须存在于当前数据集的列中
- `operator` 为 `isNull` 或 `isNotNull` 时，`value` 必须为空或忽略
- `operator` 为 `gt|gte|lt|lte` 时，`value` 必须可解析为数值

#### 4.3.2 select

```json
{
  "type": "select",
  "config": {
    "columns": ["string"]             // 必填，要保留的列名列表
  }
}
```

**参数校验规则**：
- `columns` 至少包含 1 个元素
- 每个元素必须存在于当前数据集的列中
- 重复列名去重

#### 4.3.3 rename

```json
{
  "type": "rename",
  "config": {
    "mappings": [
      {
        "old": "string",              // 必填，原列名
        "new": "string"               // 必填，新列名
      }
    ]
  }
}
```

**参数校验规则**：
- `mappings` 至少包含 1 个映射
- `old` 必须存在于当前列中
- `new` 不能与当前其他列名冲突（除非该列也在本次 rename 中）
- `new` 不能为空字符串

#### 4.3.4 sort

```json
{
  "type": "sort",
  "config": {
    "by": ["string"],                 // 必填，排序列名列表
    "ascending": [true|false],        // 可选，默认全为 true
    "na_position": "first|last"       // 可选，默认 "last"
  }
}
```

**参数校验规则**：
- `by` 至少包含 1 个列名
- `by` 中的列名必须存在于当前数据集中
- `ascending` 长度与 `by` 不一致时，缺失值默认 `true`

#### 4.3.5 dedup

```json
{
  "type": "dedup",
  "config": {
    "columns": ["string"],            // 可选，空数组表示全局去重
    "keep": "first|last",             // 可选，默认 "first"
    "case_sensitive": true|false      // 可选，默认 true（仅对字符串列生效）
  }
}
```

**参数校验规则**：
- `columns` 为空数组时，基于所有列去重
- `columns` 非空时，每个列名必须存在
- `keep` 只能是 `"first"` 或 `"last"`

#### 4.3.6 derive

```json
{
  "type": "derive",
  "config": {
    "newColumn": "string",            // 必填，新列名
    "formula": "string"               // 必填，公式表达式
  }
}
```

**公式语法（V1 白名单）**：

| 类别 | 支持的语法 |
|---|---|
| 算术运算符 | `+`, `-`, `*`, `/`, `**`, `%` |
| 括号 | `(` `)` 用于改变运算优先级 |
| 数字常量 | 整数、浮点数，如 `100`、`3.14` |
| 列引用 | 直接使用列名，如 `年龄 + 1`。列名含空格时需用反引号：`` `客户 年龄` `` |

**V1 明确不支持（移至 V1.5/V2）**：

| 类别 | 不支持的功能 |
|---|---|
| 字符串函数 | `UPPER`、`LOWER`、`TRIM`、`LEN`、`SUBSTR`、`REPLACE`、`CONCAT` |
| 数学函数 | `ABS`、`ROUND`、`FLOOR`、`CEIL`、`SQRT`、`LOG` |
| 条件函数 | `IF(condition, true_value, false_value)` |
| 逻辑运算符 | `&` (AND)、`\|` (OR)、`~` (NOT) |
| 日期函数 | `YEAR`、`MONTH`、`DAY`、`DATEDIFF` |
| 比较表达式 | 公式中不允许出现 `>` `<` `==` 等比较运算（比较应在 filter 操作中完成） |

**参数校验规则**：
- `newColumn` 不能为空，不能与现有列名冲突
- `formula` 不能为空
- `formula` 中引用的所有列名必须存在于当前数据集
- `formula` 仅允许包含：数字、`+` `-` `*` `/` `**` `%` `(` `)`、列名、空白字符
- `formula` 不允许包含 `.`（属性访问）、`__`（双下划线）、`import`、`eval`、`exec`、字母组合函数名

> **与前端差异说明**：前端当前使用 `new Function()` 执行自定义 JS 公式（`DataWorkshop.tsx:1059`），支持 `UPPER/LOWER/TRIM/LEN/IF/AND/OR/NOT` 等函数调用。后端 V1 将 derive 严格收窄为**纯数值算术表达式**，所有字符串处理和条件判断必须通过独立的 filter / rename 操作完成。前端公式编辑器在 V1 应限制输入为数值运算符和列名，函数调用入口可灰度或隐藏。

#### 4.3.7 sample

```json
{
  "type": "sample",
  "config": {
    "method": "count|percentage",     // 必填
    "count": 100,                     // method=count 时必填
    "percentage": 10.5,               // method=percentage 时必填，范围 0-100
    "seed": 42                        // 可选，随机种子
  }
}
```

**参数校验规则**：
- `method` 只能是 `"count"` 或 `"percentage"`
- `count` 必须为正整数
- `percentage` 必须在 `(0, 100]` 范围内
- `count` 大于当前行数时，返回全部数据（不报错，可发 warning）

---

## 五、字段类型系统

### 5.1 后端 pandas dtype → 前端类型映射

| pandas dtype | 前端类型 | 示例值 |
|---|---|---|
| `int64`, `int32` | `integer` | `42` |
| `float64`, `float32` | `float` | `3.14` |
| `bool` | `boolean` | `true` |
| `object` (字符串) | `string` | `"hello"` |
| `datetime64[ns]` | `datetime` | `"2024-01-15T08:30:00"` |
| `category` | `categorical` | `"A"` |
| `NaN`, `NaT`, `None` | `null` | `null` |

### 5.2 JSON 序列化规则

后端返回 `data` 数组时，必须遵循以下规则：

```python
# 后端序列化示例
def serialize_value(v):
    if pd.isna(v):
        return None
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.isoformat()
    if isinstance(v, (np.integer, np.floating)):
        return float(v) if isinstance(v, np.floating) else int(v)
    return v

data = [
    {str(k): serialize_value(v) for k, v in row.items()}
    for row in df.where(pd.notnull(df), None).to_dict(orient="records")
]
```

---

## 六、参数校验规则汇总

| 校验项 | 规则 | 失败响应 |
|---|---|---|
| `operations` 长度 | 1 ≤ len ≤ 20 | 422 `"操作链长度必须在 1-20 之间"` |
| 操作类型白名单 | type 必须在 V1 支持列表中 | 422 `"不支持的操作类型: '{type}'"` |
| 列名存在性 | config 中引用的所有列名必须存在于当前 DataFrame | 422 `"列 '{col}' 不存在"` |
| 列名重复 | select/rename 后不能出现重复列名 | 422 `"操作会导致重复列名: '{col}'"` |
| 公式安全 | derive.formula 不允许 `.` `__` `import` `eval` | 422 `"公式包含非法字符/关键字"` |
| 输出行数上限 | transform 结果 ≤ 1,000,000 行 | 413 `"结果行数超过限制"` |
| 文件大小上限 | 源文件 ≤ 100 MB | 413 `"源文件过大"` |
| 权限 | dataset.user_id == current_user.id | 403 `"无权访问此数据集"` |
| 数据集存在性 | dataset 存在且 is_deleted == false | 404 `"数据集不存在"` |

---

## 七、幂等性考虑

### 7.1 Preview API

- **天然幂等**：无副作用，多次调用结果相同（假设源数据未变更）
- **缓存建议**：前端可在操作链未变更时复用上次 preview 结果，减少后端压力

### 7.2 Transform API

- **非幂等**：每次调用创建新 Dataset
- **防重复提交**：前端按钮添加 loading 状态；后端可通过前端传入的 `client_request_id` 做短时间（如 30 秒）去重：
  ```json
  {
    "operations": [...],
    "options": { ... },
    "client_request_id": "user-session-uuid-timestamp"
  }
  ```
- **建议 V1 不做强幂等**：由前端控制重复提交即可。若未来需要后台任务模式，再引入 `client_request_id` 机制。

---

## 八、执行模式（V1 冻结）

| API | V1 模式 | 限制 |
|---|---|---|
| Preview | **同步执行** | 内存处理，不保存文件，返回前 100 行 |
| Transform | **同步执行** | 源文件 ≤ 100 MB，超时 30 秒，超限时返回 504 |

**明确排除（V2 再做）**：
- 后台任务模式（Celery/BackgroundTask）
- 大文件支持（> 100 MB）
- 前端轮询进度条
- 异步状态回调

V1 的目标是在可控范围内提供稳定、可预测的同步响应。超过 100 MB 的文件 transform 应在前端拦截，提示用户"当前不支持大文件转换，请先用筛选减少数据量后重试"。

---

## 九、后端实现结构（V1 强制分层）

禁止将 pandas 操作执行逻辑全部写入 FastAPI endpoint。

```
insightease-backend/
├── app/
│   ├── api/v1/endpoints/transform.py      # 路由层
│   │   - 参数校验（Pydantic）
│   │   - 权限检查（get_current_active_user）
│   │   - 调用 service，返回 ResponseModel
│   │   - 禁止直接 import pandas
│   │
│   ├── services/transform_service.py      # 业务层
│   │   - 读取源文件（storage.read() + 临时文件）
│   │   - 调用 transform_executor 执行操作链
│   │   - preview：截取前 N 行，构造响应
│   │   - transform：保存新文件，事务管理（db.commit/rollback + storage.delete 清理）
│   │   - 禁止直接操作 DataFrame 转换逻辑
│   │
│   ├── schemas/transform.py               # 契约层
│   │   - TransformPreviewRequest / TransformPreviewResponse
│   │   - TransformRequest / TransformResponse
│   │   - Operation 联合类型
│   │
│   └── core/transform_executor.py         # 执行层
│       - 纯函数，接收 pd.DataFrame + Operation[]，返回 pd.DataFrame
│       - 所有 pandas 逻辑在此实现（filter、rename、dedup、derive、sample、sort、select）
│       - 无 FastAPI/SQLAlchemy/HTTP 依赖，可独立单元测试
```

**分层原则**：
- `transform_executor.py` 不感知 HTTP 请求或数据库，只处理 DataFrame
- `transform_service.py` 不感知 HTTP 细节，只处理文件 I/O 和事务
- `transform.py` endpoint 只负责协议层（校验、鉴权、序列化响应）

---

## 十、文件存储策略

### 8.1 Preview 模式

- 不写入 storage
- 从 `storage_path` 读取源文件到临时文件
- pandas 处理后在内存中生成结果
- 只返回前 100 行 + 统计信息
- 临时文件立即清理

### 8.2 Transform 模式

```
读取源文件
  -> pandas 执行操作链
  -> 结果写入临时 CSV/Excel
  -> storage.save(new_dataset_id, filename, file_content)
  -> MySQL 插入新 Dataset 记录
  -> 返回新 dataset_id
```

**文件名生成规则**：
- 用户传入 `options.filename` → 直接使用
- 未传入 → 基于原文件名生成：`{原文件名不含扩展名}_transformed.{原扩展名}`
- 扩展名保持与源文件一致（CSV 或 Excel）

**存储路径**：与上传接口一致，由 `storage.save()` 返回（本地磁盘路径或 `oss://` 路径）。

---

## 十、MySQL 表结构变更

### 10.1 在 `datasets` 表新增字段（V1）

```python
# insightease-backend/app/models/models.py

class Dataset(Base):
    # ... 现有字段 ...

    # 新增字段
    parent_dataset_id = Column(
        String(36),
        ForeignKey("datasets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
        comment="源数据集ID（transform生成时填充）"
    )
    transform_chain = Column(
        JSON,
        nullable=True,
        comment="transform操作链JSON（审计/复现用）"
    )
```

### 10.2 数据库变更脚本

> **需要人工确认**：当前后端项目未配置 Alembic。以下提供两种方案供评估：

**方案 A：引入 Alembic（推荐，若项目计划长期维护）**

```python
"""add parent_dataset_id and transform_chain to datasets

Revision ID: xxx
Revises: yyy
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'xxx'
down_revision = 'yyy'

def upgrade():
    op.add_column('datasets', sa.Column('parent_dataset_id', sa.String(36), nullable=True))
    op.create_index('ix_datasets_parent_dataset_id', 'datasets', ['parent_dataset_id'])
    op.create_foreign_key(
        'fk_datasets_parent_dataset_id',
        'datasets', 'datasets',
        ['parent_dataset_id'], ['id'],
        ondelete='SET NULL'
    )
    op.add_column('datasets', sa.Column('transform_chain', sa.JSON(), nullable=True))

def downgrade():
    op.drop_column('datasets', 'transform_chain')
    op.drop_constraint('fk_datasets_parent_dataset_id', 'datasets', type_='foreignkey')
    op.drop_index('ix_datasets_parent_dataset_id', table_name='datasets')
    op.drop_column('datasets', 'parent_dataset_id')
```

**方案 B：手动 ALTER TABLE（若暂不引入 Alembic）**

```sql
-- 开发/测试/生产环境需手动执行并记录
ALTER TABLE datasets
  ADD COLUMN parent_dataset_id VARCHAR(36) NULL AFTER status,
  ADD COLUMN transform_chain JSON NULL AFTER parent_dataset_id,
  ADD INDEX ix_datasets_parent_dataset_id (parent_dataset_id),
  ADD CONSTRAINT fk_datasets_parent_dataset_id
    FOREIGN KEY (parent_dataset_id) REFERENCES datasets(id)
    ON DELETE SET NULL;
```

**V1 最低要求**：新增字段必须在所有环境的 MySQL 中同步生效，变更过程需有审计记录（Alembic revision 或手动 SQL + 变更日志）。

### 10.3 未来扩展（V2 预留）

若 V2 需要完整的版本管理，可新增 `dataset_versions` 表：

```python
class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id = Column(String(36), primary_key=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"))
    version_number = Column(Integer, nullable=False)  # 1, 2, 3...
    storage_path = Column(String(500), nullable=False)
    row_count = Column(Integer, default=0)
    col_count = Column(Integer, default=0)
    schema = Column(JSON, default=list)
    transform_chain = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

## 十一、前端 API 封装示例

```typescript
// app/src/api/workshop.ts（Phase 3C 实现）
import { request } from '@/lib/request';
import type { ApiResponse } from '@/types/api';
import type { Operation } from '@/types/workshop';  // 需要新增或复用现有类型

export interface TransformPreview {
  columns: string[];
  data: Record<string, any>[];
  total_rows: number;
  preview_limit: number;
  column_stats: ColumnStat[];
  execution_summary: {
    steps_executed: number;
    duration_ms: number;
    warnings: string[];
  };
}

export interface TransformResult {
  new_dataset_id: string;
  filename: string;
  row_count: number;
  col_count: number;
  parent_dataset_id: string;
  transform_chain: Operation[];
  execution_summary: {
    steps_executed: number;
    duration_ms: number;
    input_rows: number;
    output_rows: number;
  };
}

export interface TransformOptions {
  filename?: string;
  save_mode?: 'new_dataset' | 'version';
}

export const workshopApi = {
  preview: (datasetId: string, operations: Operation[]) =>
    request.post<ApiResponse<TransformPreview>>(
      `/datasets/${datasetId}/transform/preview`,
      { operations }
    ),

  transform: (datasetId: string, operations: Operation[], options?: TransformOptions) =>
    request.post<ApiResponse<TransformResult>>(
      `/datasets/${datasetId}/transform`,
      { operations, options }
    ),
};
```

---

## 十二、与现有系统的兼容性

### 11.1 响应格式

复用现有 `ResponseModel` 包装器（与 `datasets.py` 一致）：
- 成功：`{ code: 200, data: T, message: "success" }`
- 失败：`{ code: 4xx/5xx, data: null | ErrorDetail, message: "错误描述" }`

前端 `request.ts` 拦截器已将 `response => response.data`，所以前端直接收到 `{code, data, message}`。

### 11.2 认证

复用 `get_current_active_user` Bearer Token 认证，与现有 `/datasets` 接口完全一致。

### 11.3 文件读取

复用 `datasets.py:preview_dataset` 中的 OSS/本地回退逻辑（`storage.read()` + 临时文件），确保部署到 OSS 时不会失败。

> **需要人工确认**：当前 `datasets.py:get_dataset_statistics`（`datasets.py:399`）和 `download_dataset` 中部分路径直接按本地路径读取，未走 `storage.read()`。transform API 实现时必须避免此问题。
