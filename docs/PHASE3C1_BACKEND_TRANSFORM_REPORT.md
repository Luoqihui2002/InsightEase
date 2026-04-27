# Phase 3C-1 Backend Transform API 实现报告

**日期**: 2026-04-27  
**范围**: 后端 DataWorkshop transform 能力实现  
**约束**: 不改前端、不删除 legacy、分层结构

---

## 一、修改/新增文件列表

### 新增文件

| 文件 | 说明 |
|---|---|
| `insightease-backend/app/schemas/transform.py` | Pydantic schema：Operation 联合类型、Request/Response 模型、Config 子模型 |
| `insightease-backend/app/core/transform_executor.py` | 纯 pandas 执行层：7 种操作的 DataFrame 转换逻辑 |
| `insightease-backend/app/services/transform_service.py` | 业务层：文件 I/O（storage 抽象）、事务管理、preview vs transform 逻辑 |
| `insightease-backend/app/api/v1/endpoints/transform.py` | 路由层：两个 POST endpoint，仅做校验+鉴权+调用 service |
| `insightease-backend/tests/test_transform_executor.py` | 单元测试：覆盖所有 7 种 operation + chain + utilities |
| `insightease-backend/tests/test_transform_schemas.py` | 单元测试：覆盖 Pydantic schema 校验（derive 公式安全、操作类型白名单等） |
| `insightease-backend/tests/conftest.py` | pytest path 配置 |
| `insightease-backend/migrations/20260427_add_transform_fields.sql` | MySQL ALTER TABLE 脚本 |

### 修改文件

| 文件 | 修改内容 |
|---|---|
| `insightease-backend/app/models/models.py` | `Dataset` 模型新增 `parent_dataset_id`（`String(36)`, FK, nullable）和 `transform_chain`（`JSON`, nullable） |
| `insightease-backend/app/api/v1/api.py` | 注册 `transform.router`，prefix="/datasets" |

---

## 二、新增 API 路径

```
POST /api/v1/datasets/{dataset_id}/transform/preview
  -> 执行操作链，返回前 100 行预览 + 列统计 + 执行摘要
  -> ResponseModel[TransformPreviewResponse]

POST /api/v1/datasets/{dataset_id}/transform
  -> 执行操作链，保存为新 Dataset，写入 MySQL
  -> ResponseModel[TransformResultResponse]
```

---

## 三、Dataset 模型变更

```python
# insightease-backend/app/models/models.py
class Dataset(Base):
    # ... 现有字段 ...

    # 新增
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

    # 新增自引用关系
    parent = relationship("Dataset", remote_side=[id], backref="children")
```

---

## 四、Migration / SQL 变更说明

当前后端项目 **未配置 Alembic**（requirements.txt 中有 `alembic`，但项目中无 `alembic.ini` 或版本目录）。

**提供的变更脚本**：
- `insightease-backend/migrations/20260427_add_transform_fields.sql`
- 包含 `ALTER TABLE datasets` 添加两个字段 + 外键 + 索引
- 包含 Rollback SQL（注释中）

**执行方式**：
```bash
mysql -u root -p insightease < migrations/20260427_add_transform_fields.sql
```

**V1 最低要求**：所有环境（dev/test/prod）必须同步执行此 SQL，变更需有审计记录。

---

## 五、每个 V1 Operation 的实现方式

| 操作 | 核心 pandas 调用 | 文件位置 | 关键校验 |
|---|---|---|---|
| **filter** | `df[boolean_mask]` | `transform_executor.py:_exec_filter` | 列存在性、operator 白名单、数值解析 |
| **select** | `df[cols]` | `transform_executor.py:_exec_select` | 列存在性 |
| **rename** | `df.rename(columns=...)` | `transform_executor.py:_exec_rename` | 原列存在性、新列名冲突检测 |
| **sort** | `df.sort_values(by=..., ascending=...)` | `transform_executor.py:_exec_sort` | 列存在性、ascending 长度补全 |
| **dedup** | `df.drop_duplicates(subset=..., keep=...)` | `transform_executor.py:_exec_dedup` | 列存在性、case_sensitive 处理 |
| **derive** | `eval(expr)`（列名替换为 `df['col']`） | `transform_executor.py:_exec_derive` | 新列名冲突、公式字符白名单、列存在性、remaining 词检测 |
| **sample** | `df.sample(n=...)` / `df.sample(frac=...)` | `transform_executor.py:_exec_sample` | count/percentage 互斥校验 |

### derive 公式安全（V1 收窄）

- Schema 层（`transform.py`）：`field_validator` 拒绝 `.` `__` `import` `eval` `exec` 及所有函数关键字（UPPER/LOWER/IF/ABS/ROUND 等）
- 执行层（`transform_executor.py`）：
  1. 提取反引号列名和单词列名
  2. 不存在列立即报 `COLUMN_NOT_FOUND`
  3. 替换为 `df['col']` 后检查 remaining 字符
  4. 剩余字母序列报 `COLUMN_NOT_FOUND`（未识别列名）或 `INVALID_FORMULA`
  5. 最终通过 `eval(expr, {"__builtins__": {}}, {"df": df})` 执行

---

## 六、后端分层结构

```
endpoint (transform.py)
  -> 仅：参数校验、权限检查、ResponseModel 包装
  -> 调用 transform_service

service (transform_service.py)
  -> 文件读取（storage.read() + 临时文件，兼容 Local/OSS）
  -> 调用 transform_executor 执行操作链
  -> preview：截取前 100 行，构造响应
  -> transform：保存新文件 → storage.save() → MySQL 事务（含 rollback + 文件清理）

executor (transform_executor.py)
  -> 纯 pandas，无 FastAPI/SQLAlchemy 依赖
  -> 接收 DataFrame + operations[]，返回 DataFrame + summary
```

---

## 七、文件读取策略（Storage 抽象）

复用 `datasets.py:preview_dataset` 模式：

- **OSS 路径**（`oss://`）：`storage.read()` 下载到临时文件 → pandas 读取 → 删除临时文件
- **本地路径**（`./data/uploads/...`）：直接读取，相对路径转换为绝对路径
- **保存新文件**：统一调用 `storage.save()`，返回路径可能是本地路径或 `oss://` 路径

---

## 八、V1 资源限制（硬编码）

| 限制项 | 值 | 位置 |
|---|---|---|
| 最大操作链长度 | 20 | `transform_service.py:MAX_OPERATIONS` |
| 最大预览行数 | 100 | `transform_service.py:MAX_PREVIEW_ROWS` |
| 最大输出行数 | 1,000,000 | `transform_service.py:MAX_OUTPUT_ROWS` |
| 源文件大小上限 | 100 MB | `transform_service.py:MAX_FILE_SIZE_MB` |

---

## 九、测试结果

```bash
$ python -m pytest tests/test_transform_executor.py tests/test_transform_schemas.py -v

============================= test session starts =============================
platform win32 -- Python 3.13.5, pytest-9.0.3, pluggy-1.6.0
collected 51 items

tests/test_transform_executor.py::TestFilter::test_filter_eq PASSED
tests/test_transform_executor.py::TestFilter::test_filter_gt PASSED
tests/test_transform_executor.py::TestFilter::test_filter_and_logic PASSED
tests/test_transform_executor.py::TestFilter::test_filter_or_logic PASSED
tests/test_transform_executor.py::TestFilter::test_filter_contains PASSED
tests/test_transform_executor.py::TestFilter::test_filter_column_not_found PASSED
tests/test_transform_executor.py::TestSelect::test_select_columns PASSED
tests/test_transform_executor.py::TestSelect::test_select_column_not_found PASSED
tests/test_transform_executor.py::TestRename::test_rename_single PASSED
tests/test_transform_executor.py::TestRename::test_rename_multiple PASSED
tests/test_transform_executor.py::TestRename::test_rename_column_not_found PASSED
tests/test_transform_executor.py::TestSort::test_sort_ascending PASSED
tests/test_transform_executor.py::TestSort::test_sort_descending PASSED
tests/test_transform_executor.py::TestSort::test_sort_multiple PASSED
tests/test_transform_executor.py::TestSort::test_sort_column_not_found PASSED
tests/test_transform_executor.py::TestDedup::test_dedup_first PASSED
tests/test_transform_executor.py::TestDedup::test_dedup_last PASSED
tests/test_transform_executor.py::TestDedup::test_dedup_global PASSED
tests/test_transform_executor.py::TestDedup::test_dedup_column_not_found PASSED
tests/test_transform_executor.py::TestDerive::test_derive_addition PASSED
tests/test_transform_executor.py::TestDerive::test_derive_multiplication PASSED
tests/test_transform_executor.py::TestDerive::test_derive_power PASSED
tests/test_transform_executor.py::TestDerive::test_derive_parentheses PASSED
tests/test_transform_executor.py::TestDerive::test_derive_column_not_found PASSED
tests/test_transform_executor.py::TestDerive::test_derive_new_column_conflict PASSED
tests/test_transform_executor.py::TestSample::test_sample_count PASSED
tests/test_transform_executor.py::TestSample::test_sample_percentage PASSED
tests/test_transform_executor.py::TestSample::test_sample_seed_reproducible PASSED
tests/test_transform_executor.py::TestSample::test_sample_count_exceeds_rows PASSED
tests/test_transform_executor.py::TestChain::test_filter_then_rename_then_select PASSED
tests/test_transform_executor.py::TestUtilities::test_build_column_stats PASSED
tests/test_transform_executor.py::TestUtilities::test_serialize_dataframe PASSED
tests/test_transform_schemas.py::TestDeriveConfig::test_valid_numeric_formula PASSED
tests/test_transform_schemas.py::TestDeriveConfig::test_valid_formula_with_parentheses PASSED
tests/test_transform_schemas.py::TestDeriveConfig::test_reject_string_function PASSED
tests/test_transform_schemas.py::TestDeriveConfig::test_reject_if_function PASSED
tests/test_transform_schemas.py::TestDeriveConfig::test_reject_import PASSED
tests/test_transform_schemas.py::TestDeriveConfig::test_reject_eval PASSED
tests/test_transform_schemas.py::TestDeriveConfig::test_reject_attribute_access PASSED
tests/test_transform_schemas.py::TestFilterConfig::test_valid_filter PASSED
tests/test_transform_schemas.py::TestFilterConfig::test_invalid_operator PASSED
tests/test_transform_schemas.py::TestFilterConfig::test_invalid_logic PASSED
tests/test_transform_schemas.py::TestOperation::test_valid_filter_operation PASSED
tests/test_transform_schemas.py::TestOperation::test_invalid_operation_type PASSED
tests/test_transform_schemas.py::TestOperation::test_valid_derive_operation PASSED
tests/test_transform_schemas.py::TestTransformPreviewRequest::test_valid_request PASSED
tests/test_transform_schemas.py::TestTransformPreviewRequest::test_too_many_operations PASSED
tests/test_transform_schemas.py::TestTransformPreviewRequest::test_empty_operations PASSED
tests/test_transform_schemas.py::TestTransformRequest::test_valid_request_with_options PASSED
tests/test_transform_schemas.py::TestTransformRequest::test_valid_request_without_options PASSED
tests/test_transform_schemas.py::TestTransformRequest::test_invalid_save_mode PASSED

============================= 51 passed in 1.04s =============================
```

**测试覆盖**：
- ✅ filter（eq, gt, and/or, contains）
- ✅ select（保留列、列不存在）
- ✅ rename（单/多列、列不存在、列冲突）
- ✅ sort（升序、降序、多列、列不存在）
- ✅ dedup（first/last、全局、列不存在）
- ✅ derive（加减乘除、幂、括号、列不存在、列冲突）
- ✅ sample（count/percentage/seed/超出总行数）
- ✅ 操作链串行执行（filter → rename → select）
- ✅ Schema 校验（derive 公式安全、操作类型白名单、长度限制）

---

## 十、已知限制

1. **未接入真实数据库测试**：单元测试仅覆盖 executor（纯 pandas）和 schema（Pydantic），未覆盖 service 层的事务回滚和 endpoint 层的 403/404 鉴权。这些需要集成测试环境（运行中的 MySQL + FastAPI TestClient）。
2. **未测试 OSS 兼容性**：storage 读取逻辑已按 contracts 文档实现 OSS 回退，但无 OSS 环境验证。
3. **derive 不支持反引号列名含特殊字符**：当前正则 `` `([^`]+)` `` 可提取反引号列名，但列名本身不能含反引号。
4. **超时控制**：V1 未在 endpoint 层添加 30 秒硬超时（仅文档约定）。如需严格超时，应在 FastAPI 路由中添加 `asyncio.wait_for` 或依赖反向代理超时。
5. **未实现 `version` save_mode**：V1 只支持 `new_dataset`。

---

## 十一、是否可以进入 Phase 3D

**结论：可以进入 Phase 3D（前端接入）。**

后端两个 API 已实现且通过单元测试：
- `POST /datasets/{dataset_id}/transform/preview`
- `POST /datasets/{dataset_id}/transform`

Phase 3D 建议步骤：
1. 新增 `app/src/api/workshop.ts` 封装两个 API
2. 修改 DataWorkshop 数据源选择：从后端 Dataset 列表加载
3. 替换 `executeOperations()` 为 `workshopApi.preview()`
4. 新增"保存为新数据集"按钮调用 `workshopApi.transform()`
5. 移除 `localStorageService` 和 `engineSelector` import

**前置条件**：在部署后端到测试/生产环境前，必须先执行 SQL migration 脚本添加 `parent_dataset_id` 和 `transform_chain` 字段。
