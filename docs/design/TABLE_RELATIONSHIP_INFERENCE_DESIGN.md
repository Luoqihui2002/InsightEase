# InsightEase 多表关系推断系统设计

**文档版本**: 1.0  
**日期**: 2026-04-28  
**阶段**: 4B-4（纯文档设计阶段）  
**状态**: Design Complete

---

## 1. 问题陈述

用户经常上传多张数据表，但并不知道它们之间如何关联。许多分析场景需要连接用户表、订单表、产品表、事件日志表、营销触点表等。错误的 join 会产生误导性结果（如笛卡尔积、数据重复、样本偏差）。

因此，InsightEase AI 数据助手需要：

- **推断**多张数据集之间可能的关联关系
- **以证据为基础**，给出置信度评分
- **让用户确认**，而非静默应用
- **呈现清晰警告**，说明不确定性和局限性

关系推断是分析规划的前置步骤。只有在用户确认了表之间的关系后，助手才能正确推荐跨表分析路径。

---

## 2. 产品目标

| 目标 | 说明 |
|------|------|
| 推断 join key | 识别可作为关联键的列对 |
| 识别 PK/FK | 判断哪一侧更可能是主键、哪一侧是外键 |
| 估算基数 | one-to-one / one-to-many / many-to-one / many-to-many / unknown |
| 置信度评分 | 每条推断给出 0–1 的量化置信度 |
| 可读证据 | 给出人类可理解的推断依据（如「列名完全匹配」「一侧接近唯一」） |
| 风险提示 | 对高 null 率、低唯一性、弱名称匹配等场景发出警告 |
| 用户确认 | 让用户确认或拒绝每条推断；仅 confirmed 的关系可用于后续分析规划 |
| 避免全表扫描 | 默认仅使用元数据推断，不扫描完整数据 |

---

## 3. 非目标

本阶段**明确不涉及**以下内容：

- ❌ 任何代码实现
- ❌ UI 实现
- ❌ 后端 endpoint 实现
- ❌ 自动 join 或 SQL 生成
- ❌ 数据修改
- ❌ LLM 集成
- ❌ Hermes Agent 集成
- ❌ 生产级数据血缘系统

---

## 4. 关系推断输入

### 4.1 必需输入

```typescript
DatasetProfile[]     // 数据集元数据概览
ColumnProfile[]      // 列级元数据（类型、角色、唯一率、null 率等）
TableClassification  // 表类型分类（用户表、订单表、产品表等）
```

### 4.2 可选输入

```typescript
sampleRows?: Record<string, any>[]   // 采样行（用于 value overlap）
uniqueValueSketches?: string[]        // 哈希化唯一值草图（隐私保护）
rowCounts?: number                    // 行数
uniqueCounts?: number                 // 唯一值数
nullRates?: number                    // null 率
confirmedRelationships?: TableRelationship[]  // 已确认的关系（避免重复推断）
```

### 4.3 默认策略

- **第一版仅使用元数据**（DatasetProfile + ColumnProfile + TableClassification）
- Value overlap 作为可选增强，后续阶段再加入
- 不读取原始数据值（除非用户明确授权采样）

---

## 5. 关系输出契约

```typescript
export type RelationshipType =
  | "one_to_one"
  | "one_to_many"
  | "many_to_one"
  | "many_to_many"
  | "unknown";

export type RelationshipStatus =
  | "suggested"
  | "confirmed"
  | "rejected";

export interface TableRelationship {
  id: string;                          // uuid
  source_dataset_id: string;
  target_dataset_id: string;
  source_dataset_name: string;
  target_dataset_name: string;
  source_column: string;
  target_column: string;
  relationship_type: RelationshipType;
  confidence: number;                  // 0.0 – 1.0
  status: RelationshipStatus;
  evidence: RelationshipEvidence[];
  warnings: string[];
  created_at?: string;                 // ISO 8601
  confirmed_at?: string;               // ISO 8601
}

export interface RelationshipEvidence {
  type:
    | "column_name_match"
    | "role_match"
    | "type_compatibility"
    | "uniqueness_signal"
    | "table_type_signal"
    | "value_overlap"
    | "null_rate_check"
    | "manual_confirmation";
  score: number;                       // 该证据贡献的分数
  message: string;                     // 人类可读描述
}
```

---

## 6. 候选对生成

### 6.1 生成规则

- 仅比较**不同数据集**之间的列对
- 仅考虑「 plausible key-like 」列：
  - 特定 role：`user_id`, `device_id`, `session_id`, `order_id`, `product_id`
  - 高唯一率标识列（unique_rate > 0.5）
  - 列名以 `_id` 结尾
  - 列名完全相同的列
- **排除**以下列：
  - metric 列（revenue, sales, price, ltv 等）
  - 纯文本/评论列（review, comment, description）
  - null 率 > 0.3 的列（除非名称匹配极强）
  - 类型不兼容的列
  - 连续数值度量

### 6.2 性能限制

- 最多比较 `N * (N-1) / 2` 对数据集（N = 数据集数量）
- 每对数据集最多生成 **20** 个候选列对
- 总候选数上限：**200**（超出时按名称匹配强度截断）

---

## 7. 评分框架

总分 = 各证据分数之和，上限 1.0。

### 7.1 列名相似度

| 匹配类型 | 示例 | 分数 |
|----------|------|------|
| 完全匹配 | `user_id` ↔ `user_id` | +0.35 |
| 规范化匹配 | `userId` ↔ `user_id` | +0.30 |
| 后缀匹配 | `buyer_user_id` ↔ `user_id` | +0.25 |
| 同义 token | `uid` ↔ `user_id` | +0.25 |
| 弱部分匹配 | `usr` ↔ `user_id` | +0.10 |
| 不匹配 | `price` ↔ `user_id` | 0 |

### 7.2 列角色兼容性

| 场景 | 分数 |
|------|------|
| 相同 specific role（如都是 `user_id`） | +0.25 |
| 兼容 ID role（如 `customer_id` ↔ `user_id`） | +0.15 |
| metric ↔ ID 不匹配 | 拒绝或 -0.30 |
| text ↔ ID 不匹配 | 拒绝或 -0.20 |

### 7.3 类型兼容性

| 场景 | 分数 |
|------|------|
| 相同 dtype 家族（string ↔ string） | +0.15 |
| 可安全强制转换（string ID ↔ integer ID） | +0.10 |
| datetime ↔ numeric metric | 拒绝 |
| boolean ↔ string | 拒绝 |

### 7.4 唯一性 / 基数信号

使用 `unique_rate = unique_count / row_count`。

| 场景 | 推断 | 分数 |
|------|------|------|
| source unique_rate > 0.9, target unique_rate < 0.9 | one_to_many（source → target） | +0.15 |
| 两侧 unique_rate > 0.9 | one_to_one 候选 | +0.10 |
| 两侧 unique_rate < 0.3 | many_to_many 或弱关系 | +0.03 + warning |
| 一侧 unique_rate = 1.0（完全唯一） | 强 PK 信号 | +0.15 |

### 7.5 表类型信号

| 场景 | 分数 |
|------|------|
| `orders.user_id` → `users.user_id` | +0.15 |
| `orders.product_id` → `products.product_id` | +0.15 |
| `event_log.user_id` → `users.user_id` | +0.12 |
| `marketing_touchpoints.user_id` → `users.user_id` | +0.12 |
| `ab_test_experiment.user_id` → `users.user_id` | +0.12 |
| `customer_ltv.user_id` → `users.user_id` | +0.12 |
| `product_reviews.user_id` → `users.user_id` | +0.12 |
| `product_reviews.product_id` → `products.product_id` | +0.15 |

### 7.6 值重叠信号（可选未来阶段）

若可用采样值或哈希草图：

| 重叠率 | 分数 |
|--------|------|
| > 0.80 | +0.20 |
| 0.50 – 0.80 | +0.12 |
| 0.20 – 0.50 | +0.06 |
| < 0.20 | warning 或 -0.10 |

方向定义：
- **FK coverage** = `|source_values ∩ target_values| / |source_values|`
- **PK coverage** = `|source_values ∩ target_values| / |target_values|`

---

## 8. 置信度分级

| 置信度 | 标签 | UI 行为 |
|--------|------|---------|
| >= 0.85 | 高置信度 | 默认展示，可直接建议用户使用 |
| 0.65 – 0.85 | 中置信度 | 默认展示，附证据说明 |
| 0.45 – 0.65 | 低置信度 | 折叠在「可能的关系」中 |
| < 0.45 | 极低 | 默认隐藏 |

**使用规则**：
- 仅 `status === "confirmed"` 的关系可用于后续分析规划
- 或 `confidence >= 0.85` 且用户在流程中明确接受

---

## 9. 基数推断

基数由 `source_column` 指向 `target_column` 的方向决定。

| source_unique_rate | target_unique_rate | 推断类型 | 说明 |
|--------------------|--------------------|----------|------|
| 高 (>0.9) | 高 (>0.9) | one_to_one | 两侧都接近唯一 |
| 低 (<0.5) | 高 (>0.9) | many_to_one | source 重复，target 唯一 |
| 高 (>0.9) | 低 (<0.5) | one_to_many | source 唯一，target 重复 |
| 低 (<0.5) | 低 (<0.5) | many_to_many / unknown | 两侧都重复，关系不确定 |

**方向示例**：

```
orders.user_id -> users.user_id
  source (orders.user_id): unique_rate ≈ 0.3  (低)
  target (users.user_id):  unique_rate ≈ 1.0  (高)
  推断: many_to_one

反向视角:
users.user_id -> orders.user_id
  推断: one_to_many
```

UI 展示时应固定一个方向（如从事实表指向维度表），并在证据中说明方向性。

---

## 10. 证据与警告

### 10.1 证据示例

```
✓ 列名完全匹配: user_id
✓ 两侧列均被检测为 user_id 角色
✓ orders 被识别为订单表，users 被识别为用户表
✓ users.user_id 接近唯一 (unique_rate=0.98)，orders.user_id 存在重复 (unique_rate=0.32)
✓ 采样值重叠率为 94%
```

### 10.2 警告示例

```
⚠ 列的 null 率较高 (18%)，join 时可能丢失数据
⚠ 两侧列唯一性均较低，关系可能是 many-to-many，需谨慎
⚠ 无采样值重叠数据，仅凭元数据推断
⚠ 名称相似度较弱，请人工验证后再使用
⚠ 该 ID 可能跨不相关域冲突（如不同系统的 user_id）
⚠ 列类型为数值，可能代表度量而非标识符
```

---

## 11. 用户确认模型

### 11.1 状态机

```
suggested
  ├── 用户点击「确认」──→ confirmed
  │                         └── 可用于分析规划
  │
  └── 用户点击「忽略」──→ rejected
                            └── 不再展示（除非用户重置过滤）
```

### 11.2 确认数据

确认时应记录：

- relationship id
- 用户 ID（若已登录）
- 确认时间戳
- source/target dataset + column
- relationship type
- 可选用户备注

**当前阶段**：确认状态可暂存前端内存或 localStorage。持久化到后端数据库可推迟到实现阶段。

---

## 12. UI 提案（未来实现）

### 12.1 数据集详情页

在 `DatasetUnderstandingCard` 下方新增「相关表」区域：

- 展示 top 3 建议关系
- 每条关系显示：目标表、目标列、关系类型、置信度
- 确认 / 忽略 按钮

### 12.2 AI Workbench

新增能力卡片：「理清表关系」

交互流程：
1. 用户选择 2+ 数据集
2. 系统展示关系列表/图
3. 每条边显示置信度和证据
4. 用户可逐条确认或忽略

### 12.3 关系列表视图（MVP）

优先使用列表/表格视图，图可视化后续再做。

| 源表 | 源列 | 目标表 | 目标列 | 关系类型 | 置信度 | 证据 | 状态 | 操作 |
|------|------|--------|--------|----------|--------|------|------|------|
| orders | user_id | users | user_id | many_to_one | 0.94 | 5条 | 待确认 | ✓ ✕ |
| orders | product_id | products | product_id | many_to_one | 0.92 | 4条 | 已确认 | ✕ |

---

## 13. API 提案（未来实现）

### 13.1 推断接口

```typescript
// POST /api/v1/assistant/infer-relationships

interface InferRelationshipsRequest {
  dataset_ids: string[];
  include_value_overlap?: boolean;   // 默认 false
  max_candidates?: number;            // 默认 200
}

interface InferRelationshipsResponse {
  relationships: TableRelationship[];
  generated_at: string;
  warnings: string[];
}
```

### 13.2 确认/拒绝接口

```typescript
// POST /api/v1/assistant/relationships/{relationship_id}/confirm
// POST /api/v1/assistant/relationships/{relationship_id}/reject

interface ConfirmRelationshipRequest {
  note?: string;
}

interface ConfirmRelationshipResponse {
  relationship: TableRelationship;
}
```

**早期实现**：确认状态可保持前端本地。后端持久化可后续阶段加入。

---

## 14. 安全与隐私

| 原则 | 说明 |
|------|------|
| 默认仅使用元数据 | 不读取原始数据值 |
| 不发送原始值给 LLM | 本系统为确定性启发式，零 LLM 调用 |
| 值重叠使用采样/哈希 | 若未来加入 value overlap，使用采样或哈希草图，避免暴露全量数据 |
| 不自动 join | 所有 join 建议需用户确认后才可用 |
| 不自动创建数据集 | 不产生新的数据集文件 |
| 用户确认必填 | 关系必须 confirmed 后才能进入分析规划 |
| 不确定性显性化 | 低置信度关系明确标注，不误导用户 |
| 避免幻觉 join | 无强证据时不生成关系建议 |

---

## 15. 手动 QA 数据集预期关系

### 15.1 高置信度预期关系

| 源数据集 | 源列 | 目标数据集 | 目标列 | 预期类型 | 预期置信度 |
|----------|------|------------|--------|----------|------------|
| 03_orders | user_id | 01_users | user_id | many_to_one | >= 0.90 |
| 03_orders | product_id | 02_products | product_id | many_to_one | >= 0.90 |
| 04_event_log_path | user_id | 01_users | user_id | many_to_one | >= 0.85 |
| 05_marketing_touchpoints | user_id | 01_users | user_id | many_to_one | >= 0.85 |
| 07_ab_test_experiment | user_id | 01_users | user_id | many_to_one | >= 0.85 |
| 08_customer_ltv_regression | user_id | 01_users | user_id | many_to_one | >= 0.85 |
| 09_product_reviews_semantic | user_id | 01_users | user_id | many_to_one | >= 0.85 |
| 09_product_reviews_semantic | product_id | 02_products | product_id | many_to_one | >= 0.88 |

### 15.2 弱/模糊关系

| 场景 | 说明 |
|------|------|
| 05_marketing_touchpoints.journey_id → 03_orders.order_id | 可能相关，但字段语义不同，应为中低置信度 |
| 04_event_log_path.session_id | 无匹配表，不应产生关系 |
| campaign 相关字段 | 若无独立 campaign 维度表，不产生强关系 |

### 15.3 预期无强关系

| 数据集 | 原因 |
|--------|------|
| 06_daily_sales_forecast | 时间序列聚合表，无 user_id / order_id 等关联键 |
| 10_data_quality_edge_cases | 测试数据，列名和角色不应与其他表产生强匹配 |

---

## 16. 实施路线图建议

### Phase 4B-5: Relationship Inference Backend Service

- 实现基于元数据的候选生成和评分（Python 后端服务）
- 实现 `POST /assistant/infer-relationships` endpoint
- 仅 API，无 UI
- 使用手动 QA 数据集验证推断准确性

### Phase 4B-6: Relationship Review UI

- 在 AI Workbench 新增「理清表关系」能力卡片
- 展示关系列表表格（源表/源列/目标表/目标列/类型/置信度/证据/状态）
- 支持确认 / 忽略操作
- 无自动 join

### Phase 4B-7: Relationship-aware Analysis Planner Mock

- 使用已确认的关系来建议分析所需的数据范围
- 例如：用户问「各渠道转化率」，系统识别需要 `marketing_touchpoints` + `orders` + `users`，并确认已有关联
- 仍无真实 LLM，使用模板/关键词匹配

### 远期

- 添加采样值重叠信号
- 持久化 confirmed relationships 到数据库
- 关系图可视化（DAG / 力导向图）
- 受控 join 预览（展示 join 后的行数变化）
- 数据血缘追踪

---

## 附录 A: 评分快速参考

```
总分 = min(1.0, column_name + role + type + uniqueness + table_type + value_overlap)

column_name:
  exact          = 0.35
  normalized     = 0.30
  suffix         = 0.25
  synonym        = 0.25
  weak_partial   = 0.10

role:
  same_specific  = 0.25
  compatible_id  = 0.15
  mismatch       = -0.30 (或拒绝)

type:
  same_family    = 0.15
  coercible      = 0.10
  incompatible   = 拒绝

uniqueness:
  strong_pk_fk   = 0.15
  both_high      = 0.10
  both_low       = 0.03 + warning

table_type:
  strong_semantic= 0.15
  moderate       = 0.12

value_overlap (optional):
  > 0.80         = 0.20
  0.50–0.80      = 0.12
  0.20–0.50      = 0.06
  < 0.20         = -0.10 + warning
```

---

## 附录 B: 同义词映射

```
user_id:     ["user_id", "userid", "uid", "customer_id", "buyer_id", "member_id"]
product_id:  ["product_id", "productid", "pid", "sku", "item_id", "goods_id"]
order_id:    ["order_id", "orderid", "oid", "transaction_id", "purchase_id"]
session_id:  ["session_id", "sessionid", "sid", "visit_id"]
device_id:   ["device_id", "deviceid", "did", "machine_id"]
campaign_id: ["campaign_id", "campaignid", "cid", "ad_id", "promotion_id"]
```
