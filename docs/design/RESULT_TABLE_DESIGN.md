# ResultTable Design Document

**Phase**: 4A-6-7
**Date**: 2026-05-01
**Scope**: Pure design document — no implementation
**Status**: Draft for review

---

## 1. Problem Statement

InsightEase currently has 9+ analysis pages (Semantic, Clustering, Statistics, Attribution, SmartProcess, GoalPlanner, Forecast, PathAnalysis, SmartAnalysis) that each render results in an ad-hoc way. Each page defines its own result display components, table structures, metric cards, and warning styles. This creates several problems:

1. **Inconsistent UX**: A correlation table on Statistics looks different from a coefficient table on Attribution or a funnel table on PathAnalysis.
2. **Duplicated rendering logic**: Empty states, loading states, error states, and export buttons are reimplemented on every page.
3. **Hard to add new analysis types**: Any new analysis module must reinvent result display from scratch.
4. **Export/download is page-specific**: Each page implements its own CSV/JSON export logic with different formatting rules.
5. **No standard result contract**: Backend analysis endpoints return different shapes, making it impossible to build a generic "result viewer" or "share result" feature.

A unified **ResultTable system** solves these problems by defining a single, type-safe result schema that both backend and frontend agree on. Any analysis module — current or future — can produce a result payload conforming to this schema, and the frontend can render it consistently without page-specific code.

---

## 2. Design Goals

1. **Consistent rendering across analysis types** — a correlation table and a regression coefficient table use the same table renderer.
2. **Type-safe result schema** — TypeScript interfaces that frontend and backend can share.
3. **Support for multiple result blocks** — a single analysis can produce a summary, metrics, a table, and warnings simultaneously.
4. **Support for table, metric cards, textual summary, warnings, and chart metadata** — cover the 5 most common result modalities.
5. **Frontend-friendly structure** — easy to map to React components with minimal transformation.
6. **Backend/API-friendly response format** — easy to produce from Python analysis functions.
7. **Extensible without breaking old modules** — new block types can be added without changing existing ones.
8. **Clear empty/loading/error states** — every result has a well-defined status lifecycle.
9. **Suitable for future export/download workflows** — a single `exportResult()` function can handle any conforming payload.

---

## 3. Non-Goals

This document does **not** cover:

- ❌ Component implementation — no React components will be written
- ❌ API implementation — no backend endpoints will be changed
- ❌ Backend query execution changes — no SQL or pandas logic will be modified
- ❌ Chart rendering implementation — chart blocks only carry metadata; ECharts rendering is out of scope
- ❌ Export implementation — export logic is future work
- ❌ Performance optimization work — rendering performance is not addressed
- ❌ Package changes — no new dependencies
- ❌ Migration of existing pages — existing ad-hoc result rendering stays as-is until a future phase

---

## 4. Proposed Result Response Shape

```typescript
interface AnalysisResult {
  /** Unique result identifier */
  id: string;

  /** Analysis type discriminator (e.g., "descriptive", "regression", "ab_test") */
  analysisType: string;

  /** Human-readable result title */
  title: string;

  /** Optional longer description */
  description?: string;

  /** Result status */
  status: "success" | "empty" | "warning" | "error";

  /** ISO 8601 timestamp when the result was generated */
  generatedAt: string;

  /** Optional dataset metadata */
  dataset?: ResultDatasetMeta;

  /** Ordered list of result content blocks */
  blocks: ResultBlock[];

  /** Optional diagnostics (runtime info, model stats, assumptions) */
  diagnostics?: ResultDiagnostics;
}

interface ResultDatasetMeta {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
}

interface ResultDiagnostics {
  /** Duration of the analysis in milliseconds */
  executionTimeMs?: number;

  /** Software/library versions used */
  engineVersion?: string;

  /** Model or algorithm name */
  modelName?: string;

  /** Sample size actually used (may differ from dataset rowCount after filtering) */
  sampleSize?: number;

  /** Number of observations excluded (missing values, outliers, etc.) */
  excludedCount?: number;

  /** List of assumptions checked and whether they passed */
  assumptions?: {
    name: string;
    passed: boolean;
    message?: string;
  }[];
}

type ResultBlock =
  | ResultSummaryBlock
  | ResultMetricBlock
  | ResultTableBlock
  | ResultChartBlock
  | ResultTextBlock
  | ResultWarningBlock;

/** Discriminated union discriminator */
type ResultBlockType =
  | "summary"
  | "metric"
  | "table"
  | "chart"
  | "text"
  | "warning";
```

---

## 5. Result Block Types

### 5.1 Summary Block

Used for short narrative interpretation of the result. Typically 1–3 sentences that a non-technical user can understand.

```typescript
interface ResultSummaryBlock {
  type: "summary";
  title?: string;
  content: string;

  /** Optional severity/tone hint for styling */
  tone?: "neutral" | "positive" | "negative" | "caution";

  /** Optional bullet points for key takeaways */
  bulletPoints?: string[];
}
```

### 5.2 Metric Block

Used for KPI-style outputs — single numbers that answer "what is the answer?"

```typescript
interface ResultMetricBlock {
  type: "metric";
  title?: string;

  /** Ordered list of metrics */
  metrics: ResultMetricItem[];
}

interface ResultMetricItem {
  /** Metric identifier */
  key: string;

  /** Human-readable label */
  label: string;

  /** Raw numeric value (if applicable) */
  value?: number;

  /** Pre-formatted display string (takes precedence over value + formatter) */
  formattedValue?: string;

  /** Change relative to a baseline */
  delta?: {
    value: number;
    formattedValue?: string;
    direction: "up" | "down" | "flat";
  };

  /** Unit suffix (%, $, users, etc.) */
  unit?: string;

  /** Short interpretation text */
  interpretation?: string;

  /** Whether the metric is statistically significant */
  isSignificant?: boolean;

  /** Optional color hint */
  tone?: "neutral" | "positive" | "negative" | "caution";
}
```

### 5.3 Table Block

Used for structured tabular result rendering. This is the most complex block type.

```typescript
interface ResultTableBlock {
  type: "table";
  title?: string;

  /** Column definitions */
  columns: ResultTableColumn[];

  /** Row data — array of objects keyed by column.key */
  rows: Record<string, unknown>[];

  /** Whether the table supports client-side sorting */
  sortable?: boolean;

  /** Client-side pagination hint (0 = no pagination) */
  pageSize?: number;

  /** Message shown when rows is empty */
  emptyMessage?: string;

  /** Optional footnotes for the table */
  footnotes?: string[];
}

interface ResultTableColumn {
  /** Machine-readable key, must match row object keys */
  key: string;

  /** Human-readable header label */
  label: string;

  /** Data type for formatting and alignment */
  dataType:
    | "string"
    | "number"
    | "integer"
    | "percent"
    | "currency"
    | "date"
    | "datetime"
    | "boolean";

  /** Longer explanation shown in tooltip or header info */
  description?: string;

  /** Unit suffix for display */
  unit?: string;

  /** Decimal places for number formatting */
  precision?: number;

  /** Whether this column is sortable */
  sortable?: boolean;

  /** Horizontal alignment */
  align?: "left" | "center" | "right";

  /** Semantic role — see §6 */
  semanticRole?:
    | "dimension"
    | "metric"
    | "statistic"
    | "p_value"
    | "confidence_interval"
    | "identifier"
    | "category";

  /** Whether the column should be hidden by default (expandable) */
  hiddenByDefault?: boolean;
}
```

### 5.4 Chart Block

Used to describe chart-ready data. **This block carries metadata only — actual ECharts rendering is out of scope.**

```typescript
interface ResultChartBlock {
  type: "chart";
  title?: string;

  /** Chart type hint */
  chartType:
    | "bar"
    | "line"
    | "scatter"
    | "pie"
    | "histogram"
    | "box"
    | "heatmap"
    | "funnel"
    | "sankey"
    | "custom";

  /** Data array — each object is one data point */
  data: Record<string, unknown>[];

  /** Field name for the x-axis or category axis */
  xKey?: string;

  /** Field names for y-axis series */
  yKeys?: string[];

  /** Optional series names (same length as yKeys) */
  seriesNames?: string[];

  /** Optional color key (field name that drives series color) */
  colorKey?: string;

  /** Optional group key (field name for faceting/grouping) */
  groupKey?: string;

  /** Reference to a linked table block that contains the same data */
  linkedTableBlockId?: string;

  /** Optional ECharts option overrides (advanced) */
  echartsOptions?: Record<string, unknown>;
}
```

### 5.5 Warning Block

Used for statistical or data-quality warnings that should be shown to the user but do not prevent result display.

```typescript
interface ResultWarningBlock {
  type: "warning";
  title?: string;

  /** Warning severity */
  severity: "info" | "caution" | "critical";

  /** Human-readable message */
  message: string;

  /** Optional longer explanation */
  detail?: string;

  /** Optional remediation suggestion */
  suggestion?: string;

  /** Optional field or column the warning relates to */
  relatedField?: string;
}
```

### 5.6 Text Block

Used for explanatory text that does not fit the summary or warning categories (e.g., methodology notes, assumptions, references).

```typescript
interface ResultTextBlock {
  type: "text";
  title?: string;

  /** Content — plain text or Markdown (to be decided in implementation phase) */
  content: string;

  /** Optional hint for collapsible display */
  collapsible?: boolean;

  /** Default collapsed state if collapsible */
  defaultCollapsed?: boolean;
}
```

---

## 6. Table Column Contract

### 6.1 Semantic Roles

The `semanticRole` field tells the renderer how to treat a column beyond its data type:

| Role | Meaning | Example Use |
|------|---------|-------------|
| `dimension` | A categorical or grouping variable | "Channel", "Region", "Product Category" |
| `metric` | A measured quantity | "Revenue", "Sessions", "Conversion Rate" |
| `statistic` | A computed statistical value | "Mean", "Std Dev", "R²" |
| `p_value` | A statistical significance test result | "p-value" for t-test, ANOVA |
| `confidence_interval` | A range estimate | "95% CI: [1.2, 3.4]" |
| `identifier` | A unique row identifier | "User ID", "Experiment ID" |
| `category` | A nominal label without ordering | "Pass/Fail", "High/Medium/Low" |

**Why semantic roles matter**: Statistical analysis outputs often have columns that are technically `number` but conceptually very different. A p-value of `0.03` and a revenue of `0.03` should be formatted and styled differently. Semantic roles enable:
- Automatic p-value highlighting (e.g., bold if < 0.05)
- Confidence interval formatting
- Smart alignment (identifiers left, metrics right)
- Conditional formatting rules

### 6.2 Column Data Types

| Type | Display Rules |
|------|--------------|
| `string` | Plain text, left-aligned |
| `number` | Right-aligned, uses `precision` |
| `integer` | Right-aligned, no decimal places |
| `percent` | Right-aligned, multiplied by 100, suffixed with `%`, uses `precision` |
| `currency` | Right-aligned, prefixed with currency symbol |
| `date` | Center-aligned, ISO date → localized date |
| `datetime` | Center-aligned, ISO datetime → localized datetime |
| `boolean` | Center-aligned, rendered as checkmark / cross or Yes/No |

---

## 7. Formatting Rules

### 7.1 Default Formatting Behavior

| Data Type | Default Precision | Null Display | Example |
|-----------|-------------------|--------------|---------|
| `number` | 2 decimal places | "—" | `1,234.56` |
| `integer` | 0 decimal places | "—" | `1,234` |
| `percent` | 1 decimal place | "—" | `45.3%` |
| `currency` | 2 decimal places | "—" | `$1,234.56` |
| `p_value` (via semanticRole) | 3 decimal places, scientific if < 0.001 | "—" | `0.032` or `< 0.001` |
| `boolean` | N/A | "—" | `Yes` / `No` |
| `date` | N/A | "—" | `2026-04-28` |

### 7.2 Special Rules

**P-values**
- If `semanticRole === "p_value"`, apply statistical formatting:
  - `p < 0.001` → display as `< 0.001`
  - `p < 0.05` → highlight (e.g., green/positive tone)
  - `p >= 0.05` → neutral tone

**Confidence Intervals**
- If `semanticRole === "confidence_interval"`, display as `[lower, upper]`
- Format both bounds with the same precision as the associated metric

**Very Large / Very Small Numbers**
- Absolute value ≥ 1,000,000 → use compact notation (`1.2M`, `3.4B`)
- Absolute value < 0.001 and not a p-value → use scientific notation (`1.23e-4`)

**Missing / Null Values**
- Always render as `"—"` (em dash) or `"N/A"` — never `"null"` or `"undefined"`

---

## 8. Empty, Loading, Warning, and Error States

### 8.1 Loading State

- **Trigger**: Analysis is running, result has not been generated yet.
- **Frontend behavior**: Show `<LoadingState>` with a progress indicator if progress data is available. Do not show any blocks.
- **Result shape**: No `AnalysisResult` exists yet; the loading state is handled by the analysis shell component.

### 8.2 Empty Result State

- **Trigger**: Analysis completed successfully but produced no data (e.g., filter returned zero rows).
- **Result shape**: `status: "empty"`, `blocks: []`.
- **Frontend behavior**: Show `<Empty>` component with a message like "分析完成，但没有匹配的数据"。

### 8.3 Successful Result State

- **Trigger**: Analysis completed with at least one block.
- **Result shape**: `status: "success"`, `blocks.length > 0`.
- **Frontend behavior**: Render blocks in order. Show summary first, then metrics, then tables/charts, then text, then warnings.

### 8.4 Partial Success with Warnings

- **Trigger**: Analysis completed but with caveats (e.g., small sample size, missing values imputed, model assumptions violated).
- **Result shape**: `status: "warning"`, `blocks` contains data + one or more `ResultWarningBlock`.
- **Frontend behavior**: Render all blocks. Display warnings prominently (banner or alert style) **above** the result blocks so users see them before interpreting data.

### 8.5 Error State

- **Trigger**: Analysis failed (exception, timeout, invalid configuration).
- **Result shape**: `status: "error"`, `blocks: []`, optional `description` with error message.
- **Frontend behavior**: Show `<ErrorState>` with the error message. If diagnostics contain `assumptions`, show which ones failed.

### 8.6 Unsupported Result Type State

- **Trigger**: Frontend receives a block type it does not know how to render.
- **Frontend behavior**: Skip the unknown block and render a small inline placeholder: "Unsupported result block: `{type}`". Continue rendering other blocks. Log a console warning.

---

## 9. Example Result Payloads

### 9.1 Descriptive Statistics Result

```json
{
  "id": "desc-2026-04-28-001",
  "analysisType": "descriptive",
  "title": "订单金额描述统计",
  "status": "success",
  "generatedAt": "2026-04-28T10:30:00Z",
  "dataset": {
    "id": "ds-42",
    "name": "orders_2026_q1.csv",
    "rowCount": 12500,
    "columnCount": 8
  },
  "blocks": [
    {
      "type": "summary",
      "content": "订单金额呈右偏分布，平均订单金额为 ￥342.50，中位数为 ￥280.00。存在少量高价值异常订单（最大值 ￥12,800）。",
      "tone": "neutral",
      "bulletPoints": [
        "75% 的订单金额低于 ￥450",
        "标准差较大，建议分组分析"
      ]
    },
    {
      "type": "metric",
      "metrics": [
        { "key": "mean", "label": "平均值", "value": 342.5, "unit": "￥", "formattedValue": "￥342.50" },
        { "key": "median", "label": "中位数", "value": 280.0, "unit": "￥", "formattedValue": "￥280.00" },
        { "key": "std", "label": "标准差", "value": 410.2, "unit": "￥", "formattedValue": "￥410.20" },
        { "key": "count", "label": "样本量", "value": 12500, "formattedValue": "12,500" }
      ]
    },
    {
      "type": "table",
      "title": "分位数统计",
      "columns": [
        { "key": "quantile", "label": "分位数", "dataType": "string", "semanticRole": "category" },
        { "key": "value", "label": "金额", "dataType": "currency", "unit": "￥", "align": "right" }
      ],
      "rows": [
        { "quantile": "最小值", "value": 12.0 },
        { "quantile": "25%", "value": 150.0 },
        { "quantile": "中位数", "value": 280.0 },
        { "quantile": "75%", "value": 450.0 },
        { "quantile": "最大值", "value": 12800.0 }
      ]
    }
  ]
}
```

### 9.2 A/B Test Result

```json
{
  "id": "ab-2026-04-28-002",
  "analysisType": "ab_test",
  "title": "首页改版 A/B 测试：转化率",
  "status": "warning",
  "generatedAt": "2026-04-28T11:00:00Z",
  "dataset": { "id": "ds-43", "name": "ab_test_homepage.csv", "rowCount": 5000, "columnCount": 5 },
  "blocks": [
    {
      "type": "warning",
      "severity": "caution",
      "message": "实验组样本量偏小（n=1,200），检验力可能不足。",
      "suggestion": "建议将实验继续运行至每组至少 2,000 样本。"
    },
    {
      "type": "metric",
      "metrics": [
        {
          "key": "conversion_delta",
          "label": "转化率提升",
          "value": 0.023,
          "formattedValue": "+2.3%",
          "unit": "%",
          "delta": { "value": 0.023, "direction": "up" },
          "isSignificant": true,
          "tone": "positive"
        },
        {
          "key": "p_value",
          "label": "P 值",
          "value": 0.032,
          "formattedValue": "0.032",
          "isSignificant": true
        }
      ]
    },
    {
      "type": "table",
      "title": "组间对比",
      "columns": [
        { "key": "group", "label": "分组", "dataType": "string", "semanticRole": "dimension" },
        { "key": "users", "label": "用户数", "dataType": "integer", "align": "right" },
        { "key": "conversions", "label": "转化数", "dataType": "integer", "align": "right" },
        { "key": "rate", "label": "转化率", "dataType": "percent", "precision": 2, "align": "right" },
        { "key": "ci", "label": "95% 置信区间", "dataType": "string", "semanticRole": "confidence_interval" }
      ],
      "rows": [
        { "group": "对照组 (A)", "users": 3800, "conversions": 456, "rate": 0.12, "ci": "[10.9%, 13.1%]" },
        { "group": "实验组 (B)", "users": 1200, "conversions": 168, "rate": 0.14, "ci": "[12.1%, 15.9%]" }
      ]
    }
  ]
}
```

### 9.3 Regression Result

```json
{
  "id": "reg-2026-04-28-003",
  "analysisType": "regression",
  "title": "线性回归：销售额预测模型",
  "status": "success",
  "generatedAt": "2026-04-28T11:30:00Z",
  "dataset": { "id": "ds-44", "name": "sales_features.csv", "rowCount": 360, "columnCount": 6 },
  "blocks": [
    {
      "type": "summary",
      "content": "模型解释了销售额变异的 78.5%（R² = 0.785）。广告投入和促销力度是最显著的预测因子。",
      "tone": "positive"
    },
    {
      "type": "metric",
      "metrics": [
        { "key": "r_squared", "label": "R²", "value": 0.785, "formattedValue": "0.785" },
        { "key": "adj_r_squared", "label": "调整 R²", "value": 0.780, "formattedValue": "0.780" },
        { "key": "rmse", "label": "RMSE", "value": 1250.5, "unit": "￥", "formattedValue": "￥1,250.50" }
      ]
    },
    {
      "type": "table",
      "title": "回归系数",
      "columns": [
        { "key": "variable", "label": "变量", "dataType": "string", "semanticRole": "dimension" },
        { "key": "coefficient", "label": "系数", "dataType": "number", "precision": 3, "align": "right" },
        { "key": "std_error", "label": "标准误", "dataType": "number", "precision": 3, "align": "right" },
        { "key": "t_stat", "label": "t 统计量", "dataType": "number", "precision": 2, "align": "right" },
        { "key": "p_value", "label": "P 值", "dataType": "number", "precision": 3, "semanticRole": "p_value", "align": "right" }
      ],
      "rows": [
        { "variable": "截距", "coefficient": 5000.0, "std_error": 320.5, "t_stat": 15.6, "p_value": 0.0 },
        { "variable": "广告投入", "coefficient": 2.45, "std_error": 0.32, "t_stat": 7.66, "p_value": 0.001 },
        { "variable": "促销力度", "coefficient": 150.2, "std_error": 45.3, "t_stat": 3.32, "p_value": 0.032 },
        { "variable": "季节性指数", "coefficient": 80.5, "std_error": 60.1, "t_stat": 1.34, "p_value": 0.182 }
      ]
    },
    {
      "type": "warning",
      "severity": "info",
      "message": "季节性指数的 p 值为 0.182，未达到常规显著性水平（α = 0.05）。",
      "relatedField": "季节性指数"
    }
  ],
  "diagnostics": {
    "modelName": "Ordinary Least Squares",
    "sampleSize": 360,
    "assumptions": [
      { "name": "线性关系", "passed": true },
      { "name": "残差正态性", "passed": true },
      { "name": "同方差性", "passed": false, "message": "Breusch-Pagan 检验 p = 0.028，存在轻微异方差" }
    ]
  }
}
```

---

## 10. Frontend Rendering Strategy

### 10.1 Top-Level Result Shell

A future `ResultView` component would accept an `AnalysisResult` and orchestrate rendering:

```typescript
// Conceptual API — not implemented in this phase
interface ResultViewProps {
  result: AnalysisResult;
  onExport?: (format: "csv" | "json" | "excel") => void;
}
```

Responsibilities:
1. Read `result.status` and render the appropriate shell (loading → empty → error → success).
2. If `status === "warning"`, render a warning banner before blocks.
3. Iterate `result.blocks` and dispatch each block to a type-specific renderer.
4. Render `result.diagnostics` in a collapsible footer if present.

### 10.2 Block Rendering

Each block type maps to a dedicated renderer:

| Block Type | Renderer | Key Responsibility |
|------------|----------|-------------------|
| `summary` | `ResultSummaryRenderer` | Render text + optional bullets with tone-based styling |
| `metric` | `ResultMetricRenderer` | Render a grid of metric cards |
| `table` | `ResultTableRenderer` | Render a data table with sorting, formatting, and semantic roles |
| `chart` | `ResultChartRenderer` | Convert block metadata to ECharts option and render via `<ReactECharts>` |
| `text` | `ResultTextRenderer` | Render plain text or Markdown with optional collapse |
| `warning` | `ResultWarningRenderer` | Render alert banners with severity-based colors |

### 10.3 Table Block Rendering

The `ResultTableRenderer` is the most complex:

1. **Column setup**: Map `ResultTableColumn[]` to table headers. Use `semanticRole` for conditional formatting.
2. **Row rendering**: For each row, format cell values according to `dataType` and `precision`.
3. **Sorting**: If `sortable === true`, enable client-side column sorting.
4. **Pagination**: If `pageSize > 0`, paginate rows client-side.
5. **Empty state**: If `rows.length === 0`, show `emptyMessage`.
6. **Footnotes**: Render `footnotes` below the table in small text.

### 10.4 Fallback Behavior

- Unknown block type → skip with a placeholder message, continue rendering other blocks.
- Malformed block (missing required fields) → render an error placeholder for that block only, do not crash the entire result view.
- Missing formatter for a data type → fall back to `String(value)`.

### 10.5 Separation of Concerns

- **Data contract** (`AnalysisResult`, `ResultBlock`) lives in a shared types file.
- **UI components** (`ResultView`, `ResultTableRenderer`) live in `app/src/components/result/`.
- **Formatters** (number, percent, p-value) are pure functions, testable independently.
- **Backend** is responsible for producing valid `AnalysisResult` JSON.

---

## 11. Backend/API Implications

### 11.1 Stable Response Shape

Backend analysis endpoints should eventually return a JSON response that embeds an `AnalysisResult`:

```json
{
  "status": "completed",
  "result_data": { /* AnalysisResult object */ }
}
```

This is already the current shape used by the analysis API. The change is that `result_data` should conform to the `AnalysisResult` schema.

### 11.2 Versioning

If the schema evolves, add a `schemaVersion` field to `AnalysisResult`:

```typescript
interface AnalysisResult {
  schemaVersion?: string; // default "1.0"
  // ... other fields
}
```

Frontend can check `schemaVersion` and apply backward-compatible rendering for older payloads.

### 11.3 Error Payloads

When analysis fails, the backend should still return an `AnalysisResult` with `status: "error"`:

```json
{
  "id": "err-2026-04-28-004",
  "analysisType": "regression",
  "title": "回归分析失败",
  "status": "error",
  "generatedAt": "2026-04-28T12:00:00Z",
  "description": "输入矩阵奇异，无法求逆。请检查是否存在完全共线性变量。",
  "blocks": [],
  "diagnostics": {
    "modelName": "Ordinary Least Squares",
    "assumptions": [{ "name": "矩阵可逆", "passed": false }]
  }
}
```

### 11.4 Dataset Metadata

Always include `dataset` when available. This enables:
- Result attribution ("which dataset produced this result?")
- Row count validation ("was the full dataset used or a sample?")
- Future "re-run with same dataset" feature.

### 11.5 Export Compatibility

Because `AnalysisResult` is a plain JSON object, future export functions can:
- **CSV**: Extract all `ResultTableBlock` tables and write each to a sheet.
- **JSON**: Serialize the entire `AnalysisResult` as-is.
- **Excel**: Combine tables + metrics into an `.xlsx` workbook.
- **PDF**: Render blocks to HTML and convert.

---

## 12. Future Implementation Plan

### Phase 1: Shared TypeScript Schema
- Create `app/src/types/result.ts` with all `AnalysisResult` interfaces.
- Export types for use in both frontend components and API client typings.
- **Effort**: 1–2 hours

### Phase 2: Base ResultView Component
- Implement `ResultView` shell with status-based rendering.
- Implement block dispatch logic.
- **Effort**: 2–3 hours

### Phase 3: ResultTable Block Renderer
- Implement `ResultTableRenderer` with sorting, formatting, pagination.
- Implement formatter functions (number, percent, p-value, currency, date).
- **Effort**: 4–6 hours

### Phase 4: Mock Result Payloads
- Create mock payloads for each analysis type.
- Use mocks in Storybook or dev environment for UI testing.
- **Effort**: 2–3 hours

### Phase 5: Integrate with One Simple Analysis Page
- Choose the simplest analysis page (e.g., Statistics) to integrate `ResultView`.
- Keep existing rendering as fallback; add `ResultView` behind a feature flag or conditional.
- **Effort**: 3–4 hours

### Phase 6: Error/Empty/Loading States
- Refine `ResultView` empty and error state visuals.
- Add loading skeleton for block-level streaming.
- **Effort**: 2–3 hours

### Phase 7: Export Support
- Implement `exportResult()` utility that handles any `AnalysisResult`.
- Support CSV (tables), JSON (full payload), and Excel (multi-sheet).
- **Effort**: 4–6 hours

### Phase 8: Roll Out to All Analysis Pages
- Gradually replace ad-hoc result rendering in each analysis page.
- Order by risk: Statistics → Semantic → Attribution → Forecast → PathAnalysis → SmartAnalysis.
- **Effort**: 2–3 hours per page

---

## 13. Appendix: TypeScript Schema Reference

For quick reference, here is the complete type hierarchy in one place:

```typescript
// === Top level ===
interface AnalysisResult {
  id: string;
  analysisType: string;
  title: string;
  description?: string;
  status: "success" | "empty" | "warning" | "error";
  generatedAt: string;
  dataset?: ResultDatasetMeta;
  blocks: ResultBlock[];
  diagnostics?: ResultDiagnostics;
}

interface ResultDatasetMeta {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
}

interface ResultDiagnostics {
  executionTimeMs?: number;
  engineVersion?: string;
  modelName?: string;
  sampleSize?: number;
  excludedCount?: number;
  assumptions?: { name: string; passed: boolean; message?: string }[];
}

// === Blocks ===
type ResultBlock =
  | ResultSummaryBlock
  | ResultMetricBlock
  | ResultTableBlock
  | ResultChartBlock
  | ResultTextBlock
  | ResultWarningBlock;

interface ResultSummaryBlock {
  type: "summary";
  title?: string;
  content: string;
  tone?: "neutral" | "positive" | "negative" | "caution";
  bulletPoints?: string[];
}

interface ResultMetricBlock {
  type: "metric";
  title?: string;
  metrics: ResultMetricItem[];
}

interface ResultMetricItem {
  key: string;
  label: string;
  value?: number;
  formattedValue?: string;
  delta?: { value: number; formattedValue?: string; direction: "up" | "down" | "flat" };
  unit?: string;
  interpretation?: string;
  isSignificant?: boolean;
  tone?: "neutral" | "positive" | "negative" | "caution";
}

interface ResultTableBlock {
  type: "table";
  title?: string;
  columns: ResultTableColumn[];
  rows: Record<string, unknown>[];
  sortable?: boolean;
  pageSize?: number;
  emptyMessage?: string;
  footnotes?: string[];
}

interface ResultTableColumn {
  key: string;
  label: string;
  dataType: "string" | "number" | "integer" | "percent" | "currency" | "date" | "datetime" | "boolean";
  description?: string;
  unit?: string;
  precision?: number;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  semanticRole?: "dimension" | "metric" | "statistic" | "p_value" | "confidence_interval" | "identifier" | "category";
  hiddenByDefault?: boolean;
}

interface ResultChartBlock {
  type: "chart";
  title?: string;
  chartType: "bar" | "line" | "scatter" | "pie" | "histogram" | "box" | "heatmap" | "funnel" | "sankey" | "custom";
  data: Record<string, unknown>[];
  xKey?: string;
  yKeys?: string[];
  seriesNames?: string[];
  colorKey?: string;
  groupKey?: string;
  linkedTableBlockId?: string;
  echartsOptions?: Record<string, unknown>;
}

interface ResultWarningBlock {
  type: "warning";
  title?: string;
  severity: "info" | "caution" | "critical";
  message: string;
  detail?: string;
  suggestion?: string;
  relatedField?: string;
}

interface ResultTextBlock {
  type: "text";
  title?: string;
  content: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}
```
