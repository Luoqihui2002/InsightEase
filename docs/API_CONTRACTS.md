# InsightEase API 契约

**版本**: 2026-04-28
**状态**: Backend Processing-first

---

## 通用格式

后端统一返回 `ResponseModel[T]`：

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

> 注意：前端 Axios 拦截器已解包 `response.data`，因此前端代码中直接拿到的是 `ResponseModel<T>`，而非 `AxiosResponse<ResponseModel<T>>`。

---

## Auth

### POST /api/v1/auth/register

创建新用户。

**Request**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response**: `ResponseModel<User>`

### POST /api/v1/auth/login/json

登录（JSON 方式，前端推荐使用此端点）。

**Request**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**: `ResponseModel<{ access_token: string, token_type: string }>`

> `/auth/login` 使用 OAuth2 form-data，脚本/前端应调用 `/auth/login/json`。

---

## Datasets

### POST /api/v1/datasets/upload

上传 CSV/Excel 文件。

**Request**: `multipart/form-data`
- `file`: 文件

**Response**: `ResponseModel<Dataset>`

### GET /api/v1/datasets

获取当前用户的数据集列表。

**Response**: `ResponseModel<Dataset[]>`

### GET /api/v1/datasets/{dataset_id}

获取数据集详情。

**Response**: `ResponseModel<Dataset>`

### GET /api/v1/datasets/{dataset_id}/preview

预览数据集前 N 行。

**Response**: `ResponseModel<{ columns: string[], rows: any[], total_rows: number }>`

### GET /api/v1/datasets/{dataset_id}/download

下载原始文件。

**Response**: 文件流

### DELETE /api/v1/datasets/{dataset_id}

删除数据集（软删除）。

**Response**: `ResponseModel<null>`

---

## Transform（DataWorkshop 核心）

### POST /api/v1/datasets/{dataset_id}/transform/preview

预览操作链执行结果，**不保存**新数据集。

**Request**:
```json
{
  "operations": [
    { "type": "filter", "config": { ... } },
    { "type": "rename", "config": { ... } }
  ]
}
```

**Response**: `ResponseModel<TransformPreviewResponse>`

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "columns": ["name", "years", "score"],
    "data": [ { "name": "Alice", "years": 3, "score": 85 } ],
    "total_rows": 3,
    "preview_limit": 100,
    "column_stats": [
      { "name": "score", "dtype": "int64", "non_null_count": 3, "null_count": 0, "min": 70, "max": 90, "mean": 82.3 }
    ],
    "execution_summary": {
      "steps_executed": 2,
      "duration_ms": 5,
      "warnings": []
    }
  }
}
```

### POST /api/v1/datasets/{dataset_id}/transform

执行操作链并**保存为新数据集**。

**Request**:
```json
{
  "operations": [
    { "type": "filter", "config": { ... } },
    { "type": "select", "config": { ... } }
  ],
  "options": {
    "filename": "清洗后数据.csv",
    "save_mode": "new_dataset"
  }
}
```

**Response**: `ResponseModel<TransformResultResponse>`

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
    "transform_chain": [ { "type": "filter", "config": { ... } } ],
    "execution_summary": { "steps_executed": 2, "duration_ms": 5, "warnings": [] }
  }
}
```

---

## V1 支持的 Operation 类型

### filter

```json
{
  "type": "filter",
  "config": {
    "conditions": [
      { "column": "年龄", "operator": "gt", "value": "18" }
    ],
    "logic": "and"
  }
}
```

**operators**: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `startswith`, `endswith`, `isNull`, `isNotNull`

### select

```json
{
  "type": "select",
  "config": {
    "columns": ["姓名", "年龄", "城市"]
  }
}
```

### rename

```json
{
  "type": "rename",
  "config": {
    "mappings": [
      { "old": "name", "new": "姓名" }
    ]
  }
}
```

### sort

```json
{
  "type": "sort",
  "config": {
    "by": ["日期", "销售额"],
    "ascending": [false, true],
    "na_position": "last"
  }
}
```

### dedup

```json
{
  "type": "dedup",
  "config": {
    "columns": ["姓名", "手机号"],
    "keep": "first",
    "case_sensitive": true
  }
}
```

### derive

```json
{
  "type": "derive",
  "config": {
    "newColumn": "年龄_平方",
    "formula": "年龄 ** 2"
  }
}
```

> V1 仅支持数值算术表达式（`+ - * / ** %` 和括号），不支持函数调用。

### sample

```json
{
  "type": "sample",
  "config": {
    "method": "percentage",
    "percentage": 10,
    "seed": 42
  }
}
```

或：

```json
{
  "type": "sample",
  "config": {
    "method": "count",
    "count": 100
  }
}
```

---

## Analysis

### POST /api/v1/analysis/

创建分析任务。

**Request**:
```json
{
  "dataset_id": "uuid",
  "analysis_type": "descriptive",
  "params": {}
}
```

**Response**: `ResponseModel<{ id: string, status: "pending" }>`

### GET /api/v1/analysis/{analysis_id}

查询分析任务状态和结果。

**Response**: `ResponseModel<Analysis>`

```json
{
  "id": "uuid",
  "type": "descriptive",
  "status": "completed",
  "result_data": { ... },
  "completed_at": "2026-04-28T10:00:00Z"
}
```

**status 枚举**: `pending`, `running`, `completed`, `failed`

---

## AI Chat

### POST /api/v1/ai/chat

AI 对话（非流式）。

**Request**:
```json
{
  "message": "帮我预测下个月的销售额",
  "dataset_id": "uuid",
  "history": []
}
```

**Response**: `ResponseModel<{ response: string, intent?: IntentResult }>`

### POST /api/v1/ai/chat/stream

AI 对话（流式 SSE）。

**Request**: 同 `/ai/chat`

**Response**: SSE stream

---

## 前端封装

前端 API 层位于 `app/src/api/`：

| 模块 | 路径 |
|---|---|
| Auth | `app/src/api/auth.ts` |
| Datasets | `app/src/api/datasets.ts` |
| Transform | `app/src/api/workshop.ts` |
| Analysis | `app/src/api/analysis.ts` |
| AI | `app/src/api/ai.ts` |

通用 request 实例: `app/src/lib/request.ts`
---

## Frontend Navigation Contract: AI Workbench Prefill

Phase 4B-8E adds a frontend-only navigation payload for AI Workbench handoff.

There is no backend API change.

- Storage: `sessionStorage`
- Key prefix: `insightease_analysis_prefill_`
- Route query: `?prefill=<sessionStorageKey>`
- Payload type: `AnalysisPrefillPayload` in `app/src/types/assistant.ts`
- Helper: `app/src/lib/assistant/prefillNavigation.ts`
- TTL: 24 hours

The payload carries dataset IDs and suggested field names only. It does not store raw dataset values, does not create backend analysis tasks, and does not auto-run analysis.

---

## Future Contract: Hermes Assistant Backend API

Phase 4B-8L defines a documentation-only contract for future Hermes assistant endpoints.

No backend endpoint is implemented yet.

Design source:

- `docs/design/HERMES_BACKEND_API_CONTRACT.md`

Future endpoints:

```text
GET  /api/v1/assistant/hermes/status
POST /api/v1/assistant/hermes/explain-result
POST /api/v1/assistant/hermes/plan-analysis
```

Contract rules:

- All successful responses should use existing `ResponseModel<T>` envelope.
- The endpoints must use bounded context only.
- `explain-result` may receive `SafeResultSummary`, metadata-only assistant context, user question, and explicit safety flags.
- `plan-analysis` may receive dataset metadata, active relationship-set metadata, optional safe result summary, user question, and explicit safety flags.
- Hermes must not receive raw uploaded rows, full raw result tables, unbounded `result_data`, credentials, secrets, or storage paths.
- Hermes must not auto-run analysis, auto-join datasets, generate executable SQL, create datasets, or mutate datasets.
- Frontend must fallback to `ruleBasedAssistantRuntime` and deterministic `resultFollowupResponder` when Hermes is disabled, unavailable, or fails.

Feature flags planned for future backend implementation:

```text
HERMES_ASSISTANT_ENABLED=false
HERMES_ASSISTANT_MODE=disabled|dry_run|live
HERMES_ASSISTANT_TIMEOUT_MS=10000
```
