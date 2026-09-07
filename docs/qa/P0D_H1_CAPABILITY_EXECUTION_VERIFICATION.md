# P0D-H1 — Capability & Execution Verification

日期：2026-09-07。**P0D-H1 CAPABILITY & EXECUTION GATE: PASS**。
这不是 Gate 2 / V1.0 release PASS。Gate 2 仍为 FAIL / PAUSED；未开始 H2。

## 1. Git baseline 与保护范围

- 仓库：`C:\Users\cc249\InsightEase`。
- 分支：`codex/v1.0-p0d-e2e-demo-portfolio`。
- 起始 HEAD：`4025c971e229c86ac95035d5cc2edba4401cf442`。
- origin：`https://github.com/Luoqihui2002/InsightEase.git`。
- 读取 status、branch、HEAD、最近12次提交、完整现有 diff、diff --check。
- 起始未提交：AIWorkspace.tsx 四处旧导航修复；未跟踪 Gate 2 QA；H0三份文档。
- 旧导航修改和 Gate 2 QA 原样保留，排除 H0/H1 staging；没有 reset/clean/rebase/force。
- Gate 2 QA SHA-256 保持 `A6D0DE4221332A84E4C91B933F6F0C7057687D091D48F913F14960661C957C9B`。
- 旧配置、登录、服务、SSH、数据集、云数据库未被本轮修改。

已读取三份 H0 文档、Gate 1/Gate 2 QA、GROUND_TRUTH 和 committed generator；
复核 planning schemas/validation/live service、analysis dispatcher、attribution/statistics/path、
Join lineage、frontend planning types 和现有测试。CURRENT 来自代码，OBSERVED 来自 QA，
H0 的未来阶段保持 PROPOSED。

## 2. H0 decisions adopted（代码前已写回）

- D03：固定 baseline-rate 公式；within 数值贡献绝对值略大，mix 同样重要；排名必须指明指标/空间/方向/覆盖。
- D04：cohort/channel/decomposition 三项 core 必需；funnel 为条件可选，明确要求漏斗时变成必需且 H1 unsupported。
- D07：批准未来 H4 Verified Claims + Bounded Narrative，不能新增数字/指标/实体/排名/因果/无支持建议。本轮只更新设计。

三份 H0 文档加入用户批准修订及历史时点标识；不将 H2–H6 提案写成实现。

## 3. Modules changed

新增 `schemas/capability.py`，四个 service：capability_registry、capability_compiler、
capability_execution_service、conversion_diagnosis_service；新增专项测试。
既有 `endpoints/analysis.py` 增加一个只读 preflight 和创建/后台执行分支。
详见 [CURRENT 实现说明](../architecture/P0D_H1_CAPABILITY_EXECUTION_IMPLEMENTATION.md)。

P0B schema/validator/fallback、Hermes chat/health path、旧归因数学、Join 风险与确认边界未变；
没有 H1 前端改动。旧页面导航补丁不计入本轮实现。

## 4. Registry 与 legacy declaration

`capability-registry@1` 为 InsightEase 静态只读映射，定义 frozen。
只有旗舰 enabled；legacy attribution 是 legacy_limited，最多两项目录。
完整登记版本/lifecycle、业务目标、角色、grain、Join 要求、operator、metrics/dimensions、
output contract、supported/unsupported claims、limitations/assumptions、confirmation requirements。

legacy 的 represented_record_mean 明确不是 behavioral_touchpoint_mean。
登记缺 conversion 默认 converted、存在时取最后记录 bool、缺价值默认1等既有假设。
不支持 cohort decline、mix decomposition、causal channel effect、complete journey、funnel/acquisition priority。
旧手动归因 API 保持；H1 不把该声明升级为新的 executable wrapper。

## 5. Candidate / compiler / ExecutionSpec

- CandidatePlanV2 全部关键字段必填；extra=forbid，没有 executable 字段。
- 用户审阅 typed requirements 独立于候选；registry 补齐每个 goal 必需 evidence。
- wrong capability/unknown ID、缺角色、字段不存在、粒度不符、目标缩水、缺输出全部阻断。
- 实际字段全部存在但选择 legacy decline 时：`CAPABILITY_OUTPUT_COVERAGE_MISMATCH`。
- 服务器读取当前 owned Dataset 和保存的 P0C lineage，不接受请求传入“可信 metadata”。
- 冻结 spec 含版本、capability/operator、带版本 inputs、typed bindings/provenance、population/comparison、
  output、plan hash/version、metadata hash、固定 operator parameters。context_version=null（H3尚未实现）。
- 创建前再次编译，expected spec ID 不符409；后台执行重读/复编译并比较完整 spec。
- 利用现有 Analysis.params/result_data；没有 migration。

执行覆盖保证以已审阅的 typed goals 为前提。H1 没有实现自然语言目标等价证明、
新版浏览器 Planner 接线或 session authority。旧 P0B advisory readiness 不能冒充 H1 executable。

## 6. Flagship deterministic operator

输入四角色 entity_id/conversion_flag/cohort/acquisition_channel；boolean/0/1且非空。
unique-user源表必须唯一；user-order detail 必须先验证用户属性完全一致，再投影。
保存的 LEFT Join 还须证明投影与当前 base 完整人口一致，INNER/nested/无来源拒绝。
订单 fanout 不改变分母/分子/归属。不以 first/last/max 解决冲突。

两期必须不同且非空；实际 enum previous_month/recent_month；current_month 不做别名映射。
使用唯一用户计算总体及每渠道×期的计数/CVR/share，固定 baseline-rate mix + current-share within。
内部未舍入；delta≈mix+within，容差1e-10pp。算子无需 provider。

## 7. Golden results（独立 oracle）

Fixture：committed users.csv/orders.csv，未修改 generator 或 GROUND_TRUTH。
Expected 使用冻结算术与独立 pandas groupby，不调用 production service 生成。

| 指标 | 实际 / 断言 |
|---|---|
| baseline users / conversions / CVR | 1000 / 240 / 0.24 |
| current users / conversions / CVR | 1000 / 188 / 0.188 |
| CVR delta | −5.2pp |
| mix | −2.56pp |
| within | −2.64pp |
| reconciliation | PASS，浮点残差绝对值≤1e-10pp |
| 5渠道×2期计数/CVR/share | 全部匹配独立 groupby |
| LEFT Join 行数 / 用户数 | 2054 / 2000 |
| 排名 channel CVR / within | 最大负值 social_ads |
| 排名 conversion count / mix | 最大负值 organic |

两个总贡献接近、within 略大。deterministic result 不包含自由叙事或主因字段。
这些数值仅在测试 fixture，生产代码无 social_ads 特判。

## 8. Metamorphic tests

| 变形 | 结果 |
|---|---|
| 随机重排行 | 完整结果不变 |
| LEFT Join 后增加已有用户订单记录 | 人口、计数、率、渠道归属、分解不变；只输入行数变化 |
| 全人口复制并赋新ID | counts×2，rates/delta/decomposition不变 |
| 两期人口构成与转化完全相同 | delta/mix/within=0，排名并列 |
| 另一个渠道转化恶化最大 | organic 成为 CVR/within 最负项 |
| social_ads 重命名 | 数学不变、排名引用新名称 |

## 9. Negative / boundary tests

- 同用户conversion/cohort/channel分别冲突，全部 data_invalid。
- baseline空/current空/全空（零分母）→INSUFFICIENT_POPULATION，不输出0%、NaN或Inf。
- conversion空、2、−1、字符串1/true、Inf均拒绝；boolean接受。
- 缺entity/cohort/channel拒绝；unique_user重复实体拒绝。
- 新出现/消失渠道：保留总体比較，缺期cell及CVR为null，decomposition unavailable；
  channel/ranking partial，完整旗舰编译拒绝并列missing mix evidence。
- 候选缺conversion/cohort等角色→needs_clarification；不存在column、错grain、旧version、
  current_month别名、同一期比较、自定义formula/SQL/code/module路径/executable均拒绝。
- typed funnel/causal需求不受支持；不能缩为只有aggregate CVR并宣称成功。
- 缺derived来源、少了base用户、base属性变化都阻断。
- owned adapter 使用 user_id + is_deleted 查询，不存在/他人数据返回404。
- 无效创建请求在任何 add/commit/background schedule 之前拒绝。
- 模拟既有真实 create→BackgroundTasks→dispatcher，成功存入新版result；排队后数据变化→failed/stale。
- 已冻结嵌套模型不可修改；往创建 params 注入 server spec 拒绝。

## 10. Regression

验证日期2026-09-07。运行根目录，PYTHONPATH=insightease-backend；未加载后端旧.env，
没有为了收集测试放宽 settings。所有新增用例用本地CSV、纯内存数据、模拟存储/数据库。

| 检查 | 结果 |
|---|---|
| H1 focused | **52 passed**，5条既有模型配置警告（最终6.33s） |
| Backend full | **178 passed, 6 skipped, 5 warnings**（8.68s） |
| Frontend lint | **PASS**，0 errors / 355既有warnings |
| Frontend build | **PASS**（19.30s），既有large chunk警告 |
| git diff --check | **PASS** |

六项跳过均为 test_transform_integration.py，需要显式启用运行中服务集成；本轮未启用。
实际运行命令：root `.venv/Scripts/python.exe -m pytest -q -rs insightease-backend/tests`；
app `npm run lint`、`npm run build`。本机日志保留 ignored .venv/h1-*.log。
没有本轮真实 Hermes/DeepSeek 调用，不用一次模型选对能力作为验收依据。

## 11. Limitations 与 handoff

H1未实现funnel、paid-first-order cross-check（显式请求拒绝而非假成功）；
结果的core complete不表示funnel coverage。新/消失渠道分解需未来政策。
不支持任意DAG、任意过滤/SQL/code、一般transform/nested population lineage。
输入业务完整性、相同转化窗口/追踪口径仍需用户审阅。
H1 registry/spec是确定性authority，未实现H2 EvidencePack、H3会话/批准、H4解释verifier。
旧浏览器仍使用P0B advisory/旧手动分析；后续需显式迁移，不算本轮新provider/E2E验收。

提交按路径分组：A仅H0三文档（批准修订）；B为H1源码、专项测试和两份H1文档。
旧导航和Gate2 QA不纳入。最终SHA及push确认见任务完成消息，避免提交文档自引用hash。

**P0D-H1 CAPABILITY & EXECUTION GATE: PASS**。
下一阶段仅交接 **P0D-H2 — Typed Evidence & SafeResultSummary v2**：
以 ConversionDiagnosisResult@1 和冻结规格为输入，建立 provenance、population、denominator、
support_scope、cannot_support。本轮不实施。
