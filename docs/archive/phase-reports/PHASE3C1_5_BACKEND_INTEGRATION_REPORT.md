# Phase 3C-1.5 后端集成验证与小修补报告

**日期**: 2026-04-27  
**范围**: 后端 Transform API 集成验证、数据库 migration、集成测试补充  
**环境**: conda `insight` (Python 3.11.14), 远程 RDS MySQL, localhost:8000

---

## 一、Task 1: 数据库 Migration

### 执行结果
- **状态**: 完成
- **方式**: PyMySQL 脚本直连远程 RDS 执行 `ALTER TABLE`
- **新增字段**:
  - `parent_dataset_id` (`String(36)`, nullable, FK -> datasets.id ON DELETE SET NULL, index)
  - `transform_chain` (`JSON`, nullable)
- **验证**: 通过 `SHOW COLUMNS FROM datasets` 确认两字段已存在

### 已知问题
- 项目 **未配置 Alembic**（requirements.txt 有依赖但无 `alembic.ini` / versions 目录）
- 建议后续引入 Alembic 做版本化管理，避免手动执行 SQL

---

## 二、Task 2: 真实 API 手动验证

### 验证链路（全部通过）

| 步骤 | 操作 | 结果 |
|---|---|---|
| 1 | 注册 + 登录获取 Token | 200 |
| 2 | 上传测试 CSV | 200 |
| 3 | `POST /datasets/{id}/transform/preview` (filter+rename+derive+sample) | 200 |
| 4 | `POST /datasets/{id}/transform` (filter+select, save as new dataset) | 200 |
| 5 | 验证新数据集出现在列表 + parent_dataset_id 正确 | 通过 |
| 6 | 错误 case: 404 数据集不存在 | 通过 |
| 7 | 错误 case: 422 非法 operation type | 通过 |

### 验证脚本
- 位置: `insightease-backend/scripts/manual_api_validation.py`
- 运行方式:
  ```bash
  cd insightease-backend
  python scripts/manual_api_validation.py
  ```

### 发现 & 修补
1. **Response 字段名差异**: `TransformPreviewResponse` 使用 `data`（行数据）而非 `rows`，`column_stats` 而非 `stats`，`execution_summary` 而非 `summary`。已在验证脚本中修正断言。
2. **DatasetResponse 未暴露 `storage_path` / `transform_chain`**: 列表/详情接口的 schema 未包含这些字段，但 transform 端点的 `TransformResultResponse` 已正确返回 `parent_dataset_id` 和 `transform_chain`。
3. **登录端点**: `/auth/login` 使用 OAuth2 form-data，前端/脚本应调用 `/auth/login/json`（JSON payload）。

---

## 三、Task 3: Endpoint/Service 集成测试

### 新增测试文件
- `insightease-backend/tests/test_transform_integration.py`

### 测试覆盖（6 项，全部通过）

| 测试名 | 说明 | 状态 |
|---|---|---|
| `test_preview_success` | preview 端点返回正确结构 + 业务逻辑 | 通过 |
| `test_transform_success` | transform 端点创建新数据集，DB 记录正确 | 通过 |
| `test_preview_404_not_found` | 不存在的数据集返回 404 | 通过 |
| `test_transform_404_not_found` | 不存在的数据集返回 404 | 通过 |
| `test_preview_422_invalid_operation` | 非法 operation type 返回 422 | 通过 |
| `test_preview_column_not_found` | 列不存在返回 422（TransformError -> HTTPException） | 通过 |

### 运行方式
```bash
cd insightease-backend
python -m pytest tests/test_transform_integration.py -v -s
```

### 技术说明
- 测试基于 **运行中的后端** (`localhost:8000`)，使用同步 `httpx.Client`
- 每个 module 自动注册唯一测试用户，测试结束后数据保留在 dev DB（如需清理可扩展 fixture teardown）
- 未采用 `TestClient` + `ASGITransport` 方案：Windows + async SQLAlchemy + pytest-asyncio 存在 greenlet/event-loop 兼容性问题，实测不稳定

---

## 四、Task 4: ResponseModel 与前端契约一致性

### 当前格式

后端统一使用 `ResponseModel[T]`:
```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

### Transform 端点响应结构

**Preview** (`POST /datasets/{id}/transform/preview`):
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "columns": ["name", "years", "score", "double_score"],
    "data": [ { ... }, { ... } ],
    "total_rows": 3,
    "preview_limit": 100,
    "column_stats": [ { "name": "...", "dtype": "...", ... } ],
    "execution_summary": { "steps_executed": 4, "duration_ms": 5, "warnings": [] }
  }
}
```

**Transform** (`POST /datasets/{id}/transform`):
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "new_dataset_id": "uuid",
    "filename": "transformed_ny.csv",
    "row_count": 3,
    "col_count": 2,
    "parent_dataset_id": "source-uuid",
    "transform_chain": [ ... ],
    "execution_summary": { ... }
  }
}
```

### 一致性结论
- 格式与前端契约 `{code, data, message}` **完全一致**
- 建议在 Phase 3D 前端接入时，`workshopApi.preview()` 取 `response.data.data` 为行数组，`response.data.columns` 为列名

---

## 五、已知限制 & 后续建议

1. **集成测试依赖运行中的后端**: 未实现纯离线 `TestClient` 方案（Windows async SQLAlchemy 兼容性阻塞）
2. **DatasetResponse 未暴露 transform_chain**: 如前端需要在数据集详情页展示"操作历史"，需扩展 `DatasetResponse` schema
3. **Alembic 缺失**: 手动 SQL migration 不利于团队协作，建议补充 Alembic 配置
4. **V1 超时控制**: 未在 endpoint 层添加 30s 硬超时，依赖反向代理或文档约定

---

## 六、结论

**Phase 3C-1.5 全部任务已完成，后端可进入 Phase 3D（前端接入）。**

- 数据库字段已就位
- API 手动验证通过（preview + transform 全链路）
- 6 项集成测试覆盖 200/404/422/业务错误
- ResponseModel 格式与前端契约一致
