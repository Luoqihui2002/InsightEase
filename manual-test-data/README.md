# InsightEase 手动 QA 测试数据集包

本数据集包用于 InsightEase 平台端到端手动测试，覆盖上传、预览、统计分析、归因分析、预测分析、路径分析、A/B 测试、回归分析等核心功能。

---

## 重新生成数据

所有数据由单一 Python 脚本生成，使用固定随机种子（`SEED = 42`），确保结果可复现。

```bash
python manual-test-data/scripts/generate_manual_test_data.py
```

要求：Python 3.8+，仅使用标准库，无需安装 pandas / numpy / faker 等第三方包。

生成后的 CSV 文件会写入 `manual-test-data/csv/` 目录。

---

## 数据集清单

| 序号 | 文件名 | 行数 | 用途 | 测试功能 |
|------|--------|------|------|----------|
| 01 | `01_users.csv` | 500 | 用户维度表 | Statistics、多表关系、AI 表分类 |
| 02 | `02_products.csv` | 120 | 商品维度表 | Statistics、Semantic、多表关系 |
| 03 | `03_orders.csv` | 1,500 | 订单事实表 | Statistics、业务指标分析 |
| 04 | `04_event_log_path.csv` | ~4,000 | 事件日志 | PathAnalysis、漏斗分析、事件序列 |
| 05 | `05_marketing_touchpoints_attribution.csv` | ~2,000 | 营销触点 | Attribution、模型对比图表 |
| 06 | `06_daily_sales_forecast.csv` | 365 | 日销售数据 | Forecast、时间序列、折线图 |
| 07 | `07_ab_test_experiment.csv` | 500 | A/B 实验 | 组间对比、指标差异 |
| 08 | `08_customer_ltv_regression.csv` | 1,000 | 客户 LTV | 回归分析、特征选择 |
| 09 | `09_product_reviews_semantic.csv` | 500 | 商品评论 | Semantic、文本字段处理 |
| 10 | `10_data_quality_edge_cases.csv` | 300 | 数据质量边界 | 缺失值处理、警告块、格式降级 |

---

## 推荐测试顺序

1. **10_data_quality_edge_cases.csv** → Statistics 鲁棒性测试
   - 验证高缺失率列警告
   - 验证空值渲染为 `—`
   - 验证异常值和混合类型处理

2. **09_product_reviews_semantic.csv** → Semantic 页面
   - 验证文本字段识别
   - 验证 summary / table 块渲染

3. **06_daily_sales_forecast.csv** → Forecast 页面
   - 验证时间序列预测
   - 验证折线图在 ResultView 内渲染

4. **05_marketing_touchpoints_attribution.csv** → Attribution 页面
   - 验证归因模型对比表格
   - 验证柱状图在 ResultView 内渲染
   - 确认无重复外部图表

5. **04_event_log_path.csv** → PathAnalysis 页面
   - 验证漏斗 / 路径 / 序列分析
   - 确认 ECharts 图表仍正常渲染

6. **07_ab_test_experiment.csv** → 组间对比（如有）
   - 验证 treatment / control 指标差异

7. **08_customer_ltv_regression.csv** → 回归分析（如有）
   - 验证数值/分类字段处理

8. **01_users.csv + 02_products.csv + 03_orders.csv** → 多表理解与 AI 助手测试
   - 验证表间 join 关系推断

---

## 数据说明

### 01_users.csv
- `user_id` 可与订单、事件、A/B 实验、触点数据集关联
- 包含多维度分类字段：地区、渠道、年龄段、会员等级、设备类型

### 02_products.csv
- `product_id` 可与订单、评论数据集关联
- 包含中英文品牌、品类、价格、成本、评分

### 03_orders.csv
- `user_id` → 01_users, `product_id` → 02_products
- 包含支付状态（paid / cancelled / refunded）、折扣、GMV

### 04_event_log_path.csv
- 每个 `session_id` 包含有序事件序列
- 部分会话完成转化（`payment_success`），部分中途流失
- 适合漏斗和路径分析

### 05_marketing_touchpoints_attribution.csv
- 每个 `journey_id` 包含 1–6 个有序触点
- 部分旅程转化，转化旅程附带 `conversion_value`
- 适合首次触点 / 末次触点 / 线性 / 时间衰减 / 位置归因 / Shapley 值模型对比

### 06_daily_sales_forecast.csv
- 365 天日粒度数据
- 包含周季节性（周末偏高）、促销 spike、节假日效应、长期趋势

### 07_ab_test_experiment.csv
- `group` 字段为 control / treatment
- treatment 组转化率、收入略高，用于验证组间差异检测

### 08_customer_ltv_regression.csv
- `ltv_90d` 为数值目标，受 tenure、订单数、会话数、AOV、会员等级等影响
- 包含适度随机噪声

### 09_product_reviews_semantic.csv
- 评论文本包含中英文混合
- 涵盖正面 / 中性 / 负面情感，主题包括价格、质量、物流、尺寸、包装、客服

### 10_data_quality_edge_cases.csv
- `mostly_null_col`：>60% 缺失值
- `constant_col`：单一固定值
- `high_cardinality_id`：接近唯一值
- `mixed_number_text`：数字字符串与无效文本混存
- `outlier_metric`：包含极端异常值
- `date_with_missing`：约 25% 日期缺失
- `category_with_rare_values`：类别分布极不均衡
