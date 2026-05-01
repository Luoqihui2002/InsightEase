# InsightEase AI Data Assistant — Product & Architecture Design

**Version**: 1.0  
**Date**: 2026-04-28  
**Phase**: 4B-1  
**Status**: Design document — no implementation in this phase.

---

## 1. Product Problem Statement

InsightEase users often face a "cold start" problem:

1. **They upload multiple datasets but do not know how to analyze them.**
   - A CSV with 20 columns arrives; the user sees raw headers like `user_id`, `evt_ts`, `amt` but does not know which analysis page to open.
2. **They do not know which table contains which business entity.**
   - Is `orders_2024.csv` an order fact table or an order-line table? Is `users.csv` a dimension table or a slowly-changing dimension?
3. **They do not know how tables relate to each other.**
   - Can `orders` join to `users` on `user_id`? Is there a time-range relationship? Is `product_id` in `orders` a foreign key to `products`?
4. **They do not know which statistical or business analysis method is appropriate.**
   - "I want to understand why conversion dropped" → which page? Attribution? PathAnalysis? Funnel? Regression?
5. **Current analysis pages require users to manually choose fields and methods.**
   - Every page has its own configuration panel. There is no unified "what do you want to know?" entry point.

The AI Data Assistant should reduce this friction and guide users from raw data to insights.

---

## 2. Product Goals

| # | Goal | Priority |
|---|------|----------|
| G1 | Understand uploaded datasets and metadata (columns, types, nulls, samples) | P0 |
| G2 | Classify tables by likely business meaning (user, order, event, product, etc.) | P0 |
| G3 | Summarize table structure and field meanings in natural language | P0 |
| G4 | Detect possible primary keys, foreign keys, time columns, user IDs, metrics, dimensions | P0 |
| G5 | Infer possible relationships between tables (join keys, cardinality) | P1 |
| G6 | Recommend suitable analysis paths based on user intent and dataset profile | P1 |
| G7 | Help users translate natural-language questions into structured analysis plans | P1 |
| G8 | Connect to existing analysis modules and pre-fill configuration where possible | P2 |
| G9 | Explain analysis results (AnalysisResult blocks) in business language | P2 |

---

## 3. Non-Goals

This phase is **design only**. The following are explicitly out of scope for Phase 4B-1:

- **No AI model integration** — no LLM calls, no embedding models, no vector DB.
- **No chat UI implementation** — no message bubbles, no streaming, no conversation history.
- **No backend API implementation** — endpoints are proposed but not built.
- **No SQL generation or execution** — the assistant does not write or run SQL.
- **No automatic data modification** — datasets are never altered by the assistant.
- **No sensitive data upload changes** — no new upload flow, no PII detection.
- **No permission system changes** — no RBAC, no data access control changes.
- **No production-grade agent workflow** — no tool-calling loop, no planning-and-execution agent.
- **No Hermes Agent integration** — Hermes is noted as a possible future execution layer but not coupled to this design.

---

## 4. Core User Scenarios

### Scenario 1: Dataset Understanding

**User action**: Uploads `daily_sales.csv` and opens the assistant panel.

**User asks**: "这个表是干什么的？里面有哪些关键字段？"

**Assistant responds**:
- **Table purpose**: "这是一张日销售事实表，每行代表一天的业务汇总。"
- **Row meaning**: "每行是一个日期维度下的销售快照。"
- **Important fields**:
  - `date` — 日期主键，时间序列分析的必备字段
  - `sales` — 销售金额，核心指标
  - `orders` — 订单数量，辅助指标
  - `traffic` — 流量，可用于计算转化率
  - `promotion_flag` / `holiday_flag` — 分类维度，可用于解释波动
- **Possible metrics**: sales, orders, traffic, avg_discount
- **Possible dimensions**: date, promotion_flag, holiday_flag
- **Data-quality concerns**: " avg_discount 有 3% 的缺失值；sales 存在极端异常值（2024-11-11 的 spike 可能是促销）。"

### Scenario 2: Multi-table Relationship Inference

**User action**: Uploads `users.csv`, `products.csv`, `orders.csv`.

**User asks**: "这些表之间是什么关系？"

**Assistant responds**:
- **Likely entity types**:
  - `users` → user dimension table
  - `products` → product dimension table
  - `orders` → order fact table
- **Join keys**:
  - `orders.user_id` → `users.user_id` (高值重叠，命名一致)
  - `orders.product_id` → `products.product_id` (高值重叠，命名一致)
- **Cardinality**:
  - `users` 1:N `orders` (一个用户有多笔订单)
  - `products` 1:N `orders` (一个商品出现在多笔订单中)
- **Possible star schema**: `orders` 为中心事实表，`users` 和 `products` 为维度表
- **Confidence & evidence**:
  - `orders.user_id` 与 `users.user_id` 重叠率 94% → 高置信度
  - `orders.product_id` 在 `products.product_id` 中的存在率 87% → 中高置信度
- **Uncertainty**: "有 13% 的 product_id 未出现在 products 表中，可能是数据截断或测试商品。"

### Scenario 3: Analysis Recommendation

**User asks**: "我想分析为什么最近转化率下降，应该怎么做？"

**Assistant recommends**:
1. **Descriptive analysis** — 先确认转化率趋势是否真实下降（Statistics）
2. **Funnel / Path analysis** — 分析用户在哪个步骤流失最多（PathAnalysis → funnel）
3. **Attribution analysis** — 如果多渠道投放，检查各触点贡献是否变化（Attribution）
4. **Segmentation** — 按设备类型、地区、用户群体拆分，定位下降来源
5. **Forecast comparison** — 对比实际值与预测值，判断是否为异常波动
6. **Data checks before causal claims**:
   - 检查同期是否有促销活动结束
   - 检查是否有产品下架
   - 检查是否有流量渠道变化

### Scenario 4: Guided Analysis Setup

**User asks**: "帮我做一个归因分析。"

**Assistant guides**:
1. **Choose dataset**: "检测到 `marketing_touchpoints_attribution.csv` 包含触点数据，是否使用？"
2. **Choose target metric**: "`conversion_value` 看起来是转化金额，是否作为目标？"
3. **Choose dimensions**: "`channel` 和 `campaign` 可作为分析维度。"
4. **Choose time column**: "`touch_time` 是时间戳字段，是否作为时间列？"
5. **Choose user ID**: "`user_id` 是用户标识，是否作为用户列？"
6. **Choose analysis type**: "推荐同时使用首次触点、末次触点、线性归因三种模型进行对比。"
7. **Assumptions & warnings**: "归因分析假设用户旅程在 30 天内完成。如果实际决策周期更长，结果可能偏误。"

### Scenario 5: Result Interpretation

**User action**: Runs Attribution analysis and gets an `AnalysisResult`.

**Assistant explains**:
- **Summary**: "归因分析已完成，共分析了 2,400 条用户旅程，产生 840 次转化，整体转化率 35%。"
- **Metrics**: "平均每个旅程包含 3.2 个触点。"
- **Tables**: "首次触点模型显示 organic_search 贡献最高（32%），而时间衰减模型更强调近期触点（push_notification 占 28%）。"
- **Warnings**: "整体转化率 35% 较高，但如果分析样本仅覆盖已完成旅程的用户，可能存在 survivorship bias。"
- **Charts**: "柱状图显示各模型在不同触点上的分配差异，建议关注两种模型分歧较大的触点。"
- **Suggested next steps**: "建议结合 PathAnalysis 查看具体流失路径，或按 campaign 拆分对比不同投放策略的效果。"

---

## 5. Assistant Capability Modules

### 5.1 Dataset Profiler

**Input**:
- Dataset metadata (name, row count, column count)
- Column profiles (name, dtype, null rate, unique count, sample values)

**Output**:
- Table summary (1–2 sentences)
- Column role classification (metric, dimension, time, id, text, etc.)
- Quality warnings (high nulls, low cardinality in ID fields, extreme outliers)
- Suggested analysis fields (candidate target metrics, time columns, user IDs)

### 5.2 Table Classifier

Classifies tables into possible business entities:

| Type | Description | Typical Signals |
|------|-------------|-----------------|
| `user` | User dimension | `user_id`, `gender`, `age`, `signup_date` |
| `order` | Order fact | `order_id`, `order_date`, `amount`, `status` |
| `event_log` | Event / behavior log | `event_time`, `event_name`, `session_id` |
| `product` | Product dimension | `product_id`, `category`, `brand`, `price` |
| `campaign` | Marketing campaign | `campaign_id`, `channel`, `budget`, `start_date` |
| `experiment` | A/B test | `experiment_id`, `group`, `variant`, `assigned_date` |
| `transaction` | Financial transaction | `txn_id`, `amount`, `currency`, `txn_time` |
| `dimension` | Generic dimension | `region`, `date`, `category` without metrics |
| `metric_summary` | Pre-aggregated metrics | `date`, `sales`, `orders`, few dimensions |
| `review_text` | Text / review data | `review_text`, `rating`, `sentiment` |
| `unknown` | Cannot classify | Mixed or ambiguous structure |

### 5.3 Column Role Detector

Detects semantic roles:

```ts
type ColumnRole =
  | "user_id"           // 用户标识
  | "device_id"         // 设备标识
  | "session_id"        // 会话标识
  | "order_id"          // 订单标识
  | "product_id"        // 商品标识
  | "event_name"        // 事件名称
  | "timestamp"         // 时间戳
  | "date"              // 日期
  | "metric"            // 数值指标
  | "dimension"         // 分类维度
  | "category"          // 类别标签
  | "treatment_group"   // 实验分组
  | "label_target"      // 目标/标签列
  | "amount_revenue"    // 金额/收入
  | "status"            // 状态/枚举
  | "text_field"        // 文本字段
  | "unknown";          // 未知
```

**Detection heuristics** (non-LLM, rule-based):

| Signal | Rule |
|--------|------|
| Name ends with `_id` and high uniqueness | → `user_id` / `order_id` / `product_id` (disambiguate by prefix) |
| Name contains `time`, `ts`, `at`, `date` and datetime dtype | → `timestamp` / `date` |
| Name contains `amount`, `price`, `revenue`, `sales`, `gmv` and numeric | → `amount_revenue` / `metric` |
| Name contains `status`, `state`, `type` and low cardinality | → `status` / `category` |
| Name contains `group`, `variant`, `treatment` and 2–10 unique values | → `treatment_group` |
| Long strings, high cardinality, contains spaces or CJK | → `text_field` |
| Numeric, not an ID, not amount, not a timestamp | → `metric` |
| Low cardinality categorical, not an ID | → `dimension` / `category` |

### 5.4 Relationship Inference Engine

Infers relationships between tables using:

1. **Column name similarity** — exact match or suffix match (`user_id` ↔ `user_id`)
2. **Type compatibility** — same dtype or coercible dtypes
3. **Value overlap** (if sample stats available) — Jaccard similarity of unique values
4. **Naming conventions** — `orders.user_id` strongly suggests FK to `users.user_id`
5. **Entity classification** — fact table columns often reference dimension table PKs
6. **Uniqueness/cardinality signals** — PK side has high uniqueness, FK side has lower uniqueness

**Output must include confidence and evidence**:

```ts
interface TableRelationship {
  sourceDatasetId: string;
  targetDatasetId: string;
  sourceColumn: string;
  targetColumn: string;
  relationshipType:
    | "one_to_one"
    | "one_to_many"
    | "many_to_one"
    | "many_to_many"
    | "unknown";
  confidence: number; // 0.0 – 1.0
  evidence: string[]; // human-readable evidence lines
  warnings?: string[];
}
```

**Important**: Inferred relationships are **suggestions**, not guaranteed truth. The UI must present them with confidence scores and allow users to confirm or reject.

### 5.5 Analysis Planner

Converts user intent into an analysis plan:

**Input**:
- User natural-language question
- Available dataset profiles
- Existing table classifications and relationships

**Output**: `AssistantAnalysisPlan` (see Section 9)

### 5.6 Result Explainer

Explains existing `AnalysisResult` outputs:

- Reads `AnalysisResult.blocks[]`
- For each block type (summary, metric, table, warning, chart, text), generates a natural-language explanation
- Highlights warnings and caveats
- Suggests next steps based on result content
- Does NOT bypass the result schema — it consumes `AnalysisResult`, it does not replace it

---

## 6. Metadata Contract

### DatasetProfile

```ts
interface DatasetProfile {
  datasetId: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  sampleRows?: Record<string, unknown>[];
  createdAt?: string;
  updatedAt?: string;
}
```

### ColumnProfile

```ts
interface ColumnProfile {
  name: string;
  dtype: string;           // pandas dtype string
  semanticType?: string;   // e.g. "categorical", "numeric", "datetime", "text"
  role?: ColumnRole;       // see Section 5.3
  nullCount?: number;
  nullRate?: number;       // 0.0 – 1.0
  uniqueCount?: number;
  uniqueRate?: number;     // uniqueCount / rowCount
  examples?: unknown[];    // up to 5 sample non-null values
  min?: number | string;
  max?: number | string;
  mean?: number;           // numeric only
  std?: number;            // numeric only
}
```

### ColumnRole

```ts
type ColumnRole =
  | "user_id"
  | "device_id"
  | "session_id"
  | "order_id"
  | "product_id"
  | "event_name"
  | "timestamp"
  | "date"
  | "metric"
  | "dimension"
  | "category"
  | "treatment_group"
  | "label_target"
  | "amount_revenue"
  | "status"
  | "text_field"
  | "unknown";
```

---

## 7. Table Classification Contract

```ts
interface TableClassification {
  datasetId: string;
  tableType:
    | "user"
    | "order"
    | "event_log"
    | "product"
    | "campaign"
    | "experiment"
    | "transaction"
    | "dimension"
    | "metric_summary"
    | "review_text"
    | "unknown";
  confidence: number;        // 0.0 – 1.0
  evidence: string[];        // human-readable reasoning
  recommendedAnalyses: string[]; // e.g. ["attribution", "path_analysis"]
  warnings?: string[];
}
```

---

## 8. Table Relationship Contract

```ts
interface TableRelationship {
  sourceDatasetId: string;
  targetDatasetId: string;
  sourceColumn: string;
  targetColumn: string;
  relationshipType:
    | "one_to_one"
    | "one_to_many"
    | "many_to_one"
    | "many_to_many"
    | "unknown";
  confidence: number;   // 0.0 – 1.0
  evidence: string[];   // e.g. "Column names match exactly"
  warnings?: string[];  // e.g. "Only 60% value overlap; may be partial join"
}
```

**Presentation rule**: Relationships with `confidence < 0.5` should be hidden by default or shown in a "low confidence" section. Users must explicitly confirm a relationship before it is used in analysis planning.

---

## 9. Analysis Plan Contract

```ts
interface AssistantAnalysisPlan {
  id: string;
  userQuestion: string;
  interpretedGoal: string;
  recommendedAnalysisType:
    | "descriptive"
    | "semantic"
    | "attribution"
    | "forecast"
    | "path_analysis"
    | "ab_test"
    | "regression"
    | "custom_query";
  requiredDatasets: string[];
  requiredFields: AnalysisFieldRequirement[];
  filters?: string[];
  assumptions: string[];
  warnings: string[];
  nextActions: AssistantNextAction[];
}

interface AnalysisFieldRequirement {
  role:
    | "target_metric"
    | "time_column"
    | "user_id"
    | "group_column"
    | "event_name"
    | "dimension"
    | "feature"
    | "text_column";
  required: boolean;
  candidateColumns: string[]; // columns that match this role, sorted by confidence
  reason: string;             // why these columns were chosen
}

interface AssistantNextAction {
  type: "navigate" | "confirm" | "explain" | "warning";
  label: string;              // button label or link text
  target?: string;            // e.g. "/analysis/attribution"
  payload?: Record<string, unknown>; // pre-fill config for target page
}
```

---

## 10. Integration With Existing InsightEase Modules

### Analysis page mapping

| User Intent | Suggested Module | Pre-fillable Fields |
|-------------|------------------|---------------------|
| Understand dataset structure | Statistics / Semantic | dataset_id, selected columns |
| Analyze event flow / funnel | PathAnalysis | dataset_id, user_id_col, event_col, timestamp_col |
| Forecast future metric | Forecast | dataset_id, date_col, value_col |
| Explain channel contribution | Attribution | dataset_id, user_id_col, touchpoint_col, timestamp_col |
| Compare treatment vs control | A/B test / regression | dataset_id, group_col, target_col |
| Analyze text / category fields | Semantic | dataset_id, text columns |
| Explore raw fields | Statistics | dataset_id |
| Clean messy data | SmartProcess | dataset_id |

### Pre-fill strategy

When the assistant recommends an analysis page, it should generate a `payload` that can be used to pre-fill the page's configuration state:

```ts
// Example: pre-fill Attribution page
{
  target: "/analysis/attribution",
  payload: {
    dataset_id: "ds_123",
    user_id_col: "user_id",
    touchpoint_col: "touchpoint",
    timestamp_col: "touch_time",
    conversion_col: "converted",
    models: ["first_touch", "last_touch", "linear", "time_decay"]
  }
}
```

The target page should accept optional `initialConfig` via navigation state or query params and hydrate its form fields accordingly.

---

## 11. Integration With ResultView / AnalysisResult

### How the assistant consumes results

1. **Assistant reads `AnalysisResult.blocks`** — it does not read raw API responses directly.
2. **For each block type**, the assistant generates a contextual explanation:
   - `summary` → restate in simpler language
   - `metric` → highlight the most important KPIs and their trends
   - `table` → describe the top rows and what they mean
   - `warning` → explain why the warning matters and what to do
   - `chart` → describe what the chart shows and what patterns to look for
   - `text` → summarize or expand on the text block
3. **The assistant suggests next analyses** based on result content:
   - If Attribution shows high `first_touch` vs low `last_touch` → suggest PathAnalysis
   - If Forecast shows large residuals → suggest checking for missing promotions
   - If Statistics shows high null rate → suggest SmartProcess

### Future: assistant responses as structured blocks

In later phases, the assistant's own explanations can be rendered as `AnalysisResult`-compatible blocks:

```ts
{
  type: "text",
  title: "AI 解读",
  content: "..."
}
```

This allows the assistant panel to reuse `ResultTextBlock`, `ResultWarningBlock`, etc.

---

## 12. Frontend UX Proposal (High-Level)

### Proposed component structure

```text
app/src/components/assistant/
  AssistantPanel.tsx           // 右侧面板容器
  DatasetUnderstandingCard.tsx // 数据集概览卡片
  TableRelationshipGraph.tsx   // 表关系可视化（简化）
  AnalysisPlanCard.tsx         // 分析计划卡片
  AssistantMessageList.tsx     // 消息列表（未来聊天模式）
  ColumnRoleBadge.tsx          // 字段角色标签
  ConfidenceScore.tsx          // 置信度指示器
```

### Suggested UX flow

1. **Right-side assistant panel**
   - Collapsible, default open on Dataset / Analysis pages
   - Shows current dataset context
2. **Dataset context selector**
   - Dropdown to switch which dataset the assistant is "looking at"
   - Multi-select for relationship inference
3. **"Understand this dataset" button**
   - Triggers Dataset Profiler + Table Classifier
   - Shows summary card with column roles and quality warnings
4. **"Recommend analysis" button**
   - Opens input for natural-language question
   - Returns Analysis Plan Card with recommended module and pre-fill payload
5. **Analysis plan card with CTA**
   - Clear title, description, required fields
   - "Open in [Module]" button navigates to target page with pre-filled config
   - Assumptions and warnings shown inline
6. **Safe explanation of limitations**
   - Every inference has a confidence score
   - Every recommendation has assumptions
   - Uncertain relationships are marked "待确认"
7. **Optional "Apply to analysis page" CTA**
   - One-click navigation with pre-filled fields
   - User can still modify before running

---

## 13. Backend / API Proposal

### Proposed endpoints (future implementation)

#### `POST /api/assistant/profile-dataset`

**Input**:
```json
{ "dataset_id": "ds_123" }
```

**Output**: `DatasetProfile`

**Safety**: Uses metadata only (schema, sample values from existing dataset record). No raw data read unless `include_sample_rows=true`.

#### `POST /api/assistant/classify-tables`

**Input**:
```json
{ "dataset_ids": ["ds_123", "ds_456"] }
```

**Output**: `TableClassification[]`

**Safety**: Metadata only.

#### `POST /api/assistant/infer-relationships`

**Input**:
```json
{ "dataset_ids": ["ds_123", "ds_456", "ds_789"] }
```

**Output**: `TableRelationship[]`

**Safety**: Uses column names, dtypes, and optionally sampled unique-value hashes (not raw values). No full table scan.

#### `POST /api/assistant/plan-analysis`

**Input**:
```json
{
  "question": "为什么最近转化率下降了？",
  "dataset_ids": ["ds_123", "ds_456"],
  "context": { /* optional prior analysis results */ }
}
```

**Output**: `AssistantAnalysisPlan`

**Safety**: Metadata-first prompt. If raw data is needed, use aggregated stats only (mean, count, correlation). Never send full rows to external LLM.

#### `POST /api/assistant/explain-result`

**Input**:
```json
{
  "analysis_result": { /* AnalysisResult JSON */ },
  "user_question": "这个结果说明什么？"
}
```

**Output**: Natural-language explanation + suggested next steps.

**Safety**: `AnalysisResult` is already aggregated/summarized. No raw data exposure.

---

## 14. Data Safety and Privacy

### Principles

1. **Metadata-first assistant behavior**
   - The assistant should prefer schema, column names, dtypes, and aggregated stats over raw data.
   - Column profiles (`ColumnProfile`) are sufficient for 80% of inference tasks.

2. **Avoid sending full raw data**
   - Never send entire CSV contents to an external LLM API.
   - If sample rows are needed, limit to 5–10 rows and strip PII-like columns.

3. **Sample rows only when needed**
   - Sample rows should be explicitly requested (`include_sample_rows=true`).
   - Default behavior excludes sample rows.

4. **Avoid storing sensitive raw values in assistant memory**
   - Assistant context / memory should store `DatasetProfile`, not raw data.
   - If conversation history is persisted, redact sample values.

5. **Clearly distinguish inferred relationships from confirmed relationships**
   - UI must show confidence scores.
   - User must explicitly confirm before an inferred relationship is used in analysis planning.
   - Confirmed relationships can be stored in a `user_confirmed_relationships` table.

6. **Warn when analysis is unreliable**
   - Low sample size (< 100 rows)
   - High missing-value rate (> 50%)
   - Low confidence relationships
   - Unsupported analysis type for given data shape

7. **Never automatically modify datasets**
   - Assistant can recommend SmartProcess, but cannot trigger it.
   - All data modifications require explicit user action.

8. **Never execute generated SQL without user confirmation**
   - If SQL generation is added in future phases, it must be shown to the user before execution.
   - Read-only queries only.

---

## 15. Hermes Agent Positioning

### Current stance

Phase 4B-1 **only designs assistant architecture**. Hermes Agent is **not integrated**.

### Possible future role for Hermes Agent

Hermes Agent (or another agent runtime) can later serve as the **execution and planning layer**:

| Assistant Layer | Hermes Agent Layer |
|-----------------|-------------------|
| Dataset Profiler | Hermes calls profiling tool |
| Table Classifier | Hermes calls classification tool |
| Relationship Inference | Hermes calls join-key detection tool |
| Analysis Planner | Hermes plans multi-step workflow |
| Result Explainer | Hermes calls explanation tool |

### Design principle: clean internal contract

The assistant's core contracts (`DatasetProfile`, `TableClassification`, `TableRelationship`, `AssistantAnalysisPlan`) are **independent of Hermes**.

- If Hermes is adopted, it orchestrates calls to tools that produce these contracts.
- If Hermes is not adopted, the same tools can be called directly by backend endpoints.
- The frontend consumes the same contracts regardless of the execution layer.

**Avoid tight coupling**: Do not design the assistant around Hermes-specific concepts (e.g. `ToolMessage`, `FunctionCall`, `OrchestratorState`) at this stage.

---

## 16. Implementation Roadmap

### Phase 4B-2: Dataset Profile Contract and Metadata Service

- Define shared `DatasetProfile` / `ColumnProfile` / `ColumnRole` types in `app/src/types/assistant.ts`.
- Add backend endpoint `/api/assistant/profile-dataset` (static, no AI).
- Ensure every uploaded dataset automatically gets a profile stored in DB or computed on demand.
- **No AI call yet**.

### Phase 4B-3: Static Dataset Understanding UI

- Add `DatasetUnderstandingCard` component.
- Populate card from `DatasetProfile` (heuristic column role detection, not LLM).
- Show table classification using rule-based heuristics.
- Show quality warnings (null rate, low cardinality IDs).

### Phase 4B-4: Assistant Panel Mock UI

- Add `AssistantPanel` to Dataset and Analysis pages.
- Mock responses for "Understand this dataset" and "Recommend analysis".
- No real model integration — all responses are hardcoded or template-based.
- Validate UX flow before adding complexity.

### Phase 4B-5: Analysis Plan Generator Mock

- Add natural-language input to assistant panel.
- Convert user question into structured `AssistantAnalysisPlan` using keyword matching / templates.
- Link recommended module with pre-fill payload.
- Show assumptions and warnings.

### Phase 4B-6: Real AI Integration

- Add backend endpoint for AI-powered analysis planning (`/api/assistant/plan-analysis`).
- Use **metadata-first prompt**: send `DatasetProfile` + user question to LLM.
- LLM returns structured JSON matching `AssistantAnalysisPlan`.
- Validate JSON schema before returning to frontend.
- Add rate limiting and timeout guards.

### Phase 4B-7: Result Explainer

- Add `explain-result` endpoint.
- Consume `AnalysisResult` JSON + user question.
- Generate natural-language explanation of blocks.
- Suggest next analyses.
- Render explanation inside assistant panel using existing result components.

---

## 17. Risks and Open Questions

| # | Risk / Question | Mitigation / Proposal |
|---|-----------------|----------------------|
| 1 | How much raw data can the assistant access? | Default: metadata only. Sample rows require explicit opt-in and are limited to 5–10 rows. |
| 2 | Should the assistant work in private/local mode? | Yes. Heuristic modules (profiler, classifier) run locally without external API. LLM-powered modules require explicit backend endpoint and can be disabled. |
| 3 | How to avoid hallucinated table relationships? | Confidence scores + evidence list. Relationships below 0.5 confidence hidden by default. User must confirm before use. |
| 4 | How to verify inferred join keys? | Show value overlap percentage. Allow user to preview join result (row count, sample) before confirming. |
| 5 | How to manage large datasets? | Profile generation uses metadata only (no full scan). For value overlap, use Bloom filter or sampled hashes. |
| 6 | How to handle sensitive columns? | PII detection heuristic (name, email, phone, address patterns). Strip or mask sample values. Warn user before sending to LLM. |
| 7 | How to prevent unsafe SQL or expensive queries? | No SQL generation in Phase 4B. If added later, read-only + EXPLAIN + row-limit + user confirmation required. |
| 8 | How to present uncertainty to users? | Confidence scores, evidence lists, warning badges, "待确认" labels. |
| 9 | How to distinguish "suggested analysis" from "confirmed insight"? | Clear visual hierarchy: suggestions in assistant panel (gray/blue), confirmed insights in result view (green). |
| 10 | What if LLM returns invalid JSON? | JSON schema validation on backend. Fallback to plain-text explanation if structured output fails. |

---

*Document version: 1.0 — Phase 4B-1 design only. No implementation.*
