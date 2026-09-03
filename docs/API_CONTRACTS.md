# InsightEase API 契约

**版本**: 2026-09-03
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
| Assistant / Hermes | `app/src/api/assistant.ts` |
| Analysis Dataset Builder | `app/src/api/join.ts` |

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

## Analysis Dataset Builder

### POST /api/v1/assistant/join/preview

Runs an authenticated, bounded deterministic Join preview without storage or database writes.

**Request:** `JoinPreviewRequest { join_plan, max_preview_rows <= 50 }`

**Response:** `ResponseModel<JoinPreview>` with input/output row counts, output columns, bounded rows, per-step match/null/duplicate/cardinality metrics, row multiplier, grain, warnings, and risk level.

### POST /api/v1/assistant/join/create-dataset

Recomputes a confirmed plan and persists one derived Dataset.

**Request:** `CreateJoinedDatasetRequest { join_plan, filename, confirm_create: true, confirm_high_risk }`

**Response:** `ResponseModel<DerivedDatasetMetadata>` with the new Dataset id, source ids, source AnalysisPlan id, row/column counts, risk summary, and creation time.

Rules:

- every source is filtered by the current user and `is_deleted=false`;
- exactly 2–3 sources and 1–2 ordered steps;
- only `left` / `inner` and exact confirmed relationship snapshots;
- preview never saves;
- blocked joins cannot create; high-risk joins require extra confirmation;
- requests never contain SQL or executable expressions;
- source Datasets are never mutated.

---

## Hermes Assistant Backend API

Phase 4B-8L defined the contract, Phase 4B-8M added dry-run scaffolding, Phase 4B-11B added live result explanation, and V1.0 P0B adds live structured planning with strict context validation and deterministic fallback.

Design source:

- `docs/design/HERMES_BACKEND_API_CONTRACT.md`

Implemented endpoints:

```text
GET  /api/v1/assistant/hermes/status
POST /api/v1/assistant/hermes/explain-result
POST /api/v1/assistant/hermes/plan-analysis
```

Contract rules:

- All successful responses should use existing `ResponseModel<T>` envelope.
- The endpoints must use bounded context only.
- `explain-result` may receive `SafeResultSummary`, optional bounded `explanation_hints`, metadata-only assistant context, user question, and explicit safety flags.
- In live mode, `explain-result` may call the configured backend-only Hermes Agent through `HERMES_BASE_URL`; the browser never calls Hermes directly.
- `plan-analysis` may receive dataset metadata, active relationship-set metadata, optional safe result summary, user question, and explicit safety flags.
- In live mode, `plan-analysis` may call Hermes, but the response must pass strict Pydantic and dataset/field/relationship context validation before it reaches the UI.
- A valid multi-table plan returns `execution_readiness=needs_join`; it does not execute a Join.
- Hermes must not receive raw uploaded rows, full raw result tables, unbounded `result_data`, credentials, secrets, or storage paths.
- `explanation_hints` are derived summaries only, capped by list/string limits, and must not include raw rows, raw result payloads, secrets, file paths, SQL, or mutation instructions.
- Hermes must not auto-run analysis, auto-join datasets, generate executable SQL, create datasets, or mutate datasets.
- Frontend must fallback to `ruleBasedAssistantRuntime` and deterministic `resultFollowupResponder` when Hermes is disabled, unavailable, or fails.
- Default backend config keeps Hermes disabled; frontend runtime behavior remains deterministic by default.

Backend feature flags:

```text
HERMES_ASSISTANT_ENABLED=false
HERMES_ASSISTANT_MODE=disabled|dry_run|live
HERMES_ASSISTANT_TIMEOUT_MS=10000
HERMES_BASE_URL=
HERMES_AUTH_TOKEN=
HERMES_MODEL=hermes-agent
```

`HERMES_AUTH_TOKEN` must never be committed, logged, or returned by status responses.
