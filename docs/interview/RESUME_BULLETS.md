# InsightEase Resume Bullets

Use only bullets that match the version actually demonstrated. Do not claim live-provider E2E until the P0D gate is rerun successfully.

## 中文版

- 设计并实现 AI 辅助业务分析平台 InsightEase，将 LLM 推理与确定性数据执行解耦：Hermes 仅基于有界元数据生成结构化 AnalysisPlan，后端通过 schema/语义校验与 deterministic fallback 控制幻觉，禁止自动 SQL、自动 Join 与自动分析。
- 构建 relationship-aware 多表分析链路：元数据关系推断 → 人工确认 Relationship Set → 2–3 表 JoinPlan → 基数/匹配率/空值/重复键/行膨胀/粒度风险预览 → 显式创建带 lineage 的派生数据集，全程不修改源数据。
- 建立 SafeResultSummary 结果解释边界，将完整原始结果裁剪为有界指标、预览与 caveats 后交给 Hermes，并保留 provider 失败或验证失败时的清晰 fallback 路径。
- 为旗舰“新客转化下降”场景构造固定种子公开数据集与可计算 ground truth，使用 pandas 参考与产品 Join 引擎双重验证 1:N 结果（2,000 → 2,054 行、1.027×）并补充回归测试。

## English

- Architected InsightEase, an AI-assisted business analytics platform that separates LLM reasoning from deterministic execution: Hermes produces metadata-bounded structured AnalysisPlans, while schema/semantic validation and deterministic fallback prevent hallucinated datasets, fields, relationships, and automatic execution.
- Built a relationship-aware multi-table workflow from metadata inference and human-confirmed Relationship Sets to deterministic 2–3 table JoinPlans, cardinality/match/null/duplicate/row-expansion/grain risk previews, and explicitly created derived datasets with lineage and no source mutation.
- Designed a SafeResultSummary boundary for AI explanations, exposing bounded metrics, previews, and caveats instead of raw datasets or full result payloads, with visibly labelled provider/fallback behavior.
- Created a reproducible synthetic conversion-decline benchmark with fixed ground truth and cross-validated the flagship 1:N join against pandas and the production join engine (2,000 → 2,054 rows, 1.027×), backed by automated regression tests.

## Live-gate addendum

After a recorded real-provider run passes, one bullet may add: “Validated live Hermes planning and result explanation end to end with `source=hermes_live`, `fallback_used=false`, and no LLM execution privileges.” Until then, omit that claim.
