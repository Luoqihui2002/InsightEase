# P0D-H2 — Typed Evidence Implementation

日期：2026-09-09。**CURRENT：H2.1 Evidence Semantic Integrity Remediation；等待原 clean-room auditor 复审，不是最终冻结。**

H1 依赖是 `e11b7253821ff213699ca4113a72ba70b7ef0b78`，本机独立复审
`P0D_H1_1_INDEPENDENT_REAUDIT.md` 确认 FINAL FREEZE: PASS，F01/F02 CLOSED。
旧 H1/H1.1 文档的 BLOCKED/PASS 文字保留为历史，不在 H2 改写审计证据。

## CURRENT — H2.1 remediation

H2 独立审计的 F01–F04 是本轮 defect authority，原审计与 decision register 的
`FAIL / FIX REQUIRED` 保持不变。H2.1 只修复以下边界：

- F01：flagship population 收缩为 H1 已证明的 selected cohort users；当前 adapter 不再发布
  `new_customer_*`、`registered_user` 或 `unique_registered_user` typed identity。
- F02：legacy `models` 与 persisted Top3 必须按 producer contract 在 entity、value、percentage、
  order、rank、ties 与 member count 上一致；矛盾统一失败关闭，发布顺序直接来自已验证的 persisted Top3。
- F03：Evidence ID 在完整 typed unit 构造后生成，递归收集全部 MetricDefinition 与 Ref，
  包括嵌套 rate/count/share、formula、population、grain、support taxonomy、adapter 与 provenance 定义版本。
- F04：identity projection 集中规范化业务无序集合；ranked members、baseline/current、
  decomposition terms 与 input_refs 继续保序。

H1 deterministic math、Capability Registry 执行能力、服务器 ownership read、SummaryV2 原子预算和安全边界未重开。

## CURRENT — authority 与读取路径

```mermaid
flowchart LR
  ID[认证用户与 analysis ID] --> OWN[按 Analysis owner 查询]
  OWN --> A[已保存 result 与 ExecutionSpec]
  A --> V[静态 adapter 与一致性检查]
  V --> E[EvidencePack 1]
  E --> S[完整语义单元选择]
  S --> S2[SafeResultSummary 2]
```

新增认证 GET：

- `/api/v1/analyses/{analysis_id}/evidence` → `ResponseModel[EvidencePack]`
- `/api/v1/analyses/{analysis_id}/safe-summary-v2` → `ResponseModel[SafeResultSummaryV2]`

接口没有 evidence/request body 参数。数值来自 ownership 查询得到的 Analysis.result_data；
客户端提交的 body 不参与计算，POST 到这两个路径返回 405。
不存在/他人/已删除的 Analysis 返回404；未完成/结果不可用返回422。
Analysis 当前是物理删除，没有新增软删除规则。
已有结果读取、创建、执行、H1 fresh input 验证保持原行为。

没有新增数据库表、迁移、后台落盘或结果回填。按需从已有结果与冻结规格重建证据，
不读取当前 Dataset 内容冒充历史输入，不重新运行 operator。
这里验证的是“这份已保存结果的含义与内部一致性”，不是重新复算源文件。

## CURRENT — 模块

| 文件（后端 app 下） | 责任 |
|---|---|
| schemas/evidence.py | frozen/extra=forbid 的五类 discriminated Evidence、Population、Ratio、Provenance、Coverage、Omission、Pack、SummaryV2 |
| services/evidence_definitions.py | MappingProxyType 静态指标定义与有限 cannot_support taxonomy |
| services/evidence_common.py | 引用与 evidence ID 构造、受控一致性错误，复用 H1 canonical hash |
| services/conversion_diagnosis_evidence_adapter.py | 读取 H1 数值、校验计数/率/分解/排名/粒度/来源合同、附加语义 |
| services/attribution_evidence_adapter.py | 仅适配旧归因的 represented mean、模型分摊排名及质量限制 |
| services/evidence_service.py | 静态 output adapter mapping、owned read、pack identity、条数/字节预算、SummaryV2 投影 |
| api/v1/endpoints/analysis.py | 两个带严格 response_model 的只读入口 |
| services/attribution_service.py | 新结果仅增加两个 aggregate operands；既有模型/均值/转换公式不变 |

adapter registry 只支持 `ConversionDiagnosisResult@1` 和 `LegacyAttributionResult@1`。
legacy 兼容判别要求 Analysis.type=attribution 且无未知 schema_version，随后验证所需 shape。
未知 output contract 返回 `EVIDENCE_UNAVAILABLE_UNSUPPORTED_CONTRACT`，不做 generic flatten。

## CURRENT — Evidence 合同

`MetricEvidence / ComparisonEvidence / RankingEvidence / DecompositionEvidence / QualityEvidence`
通过 evidence_type discriminated union 区分。每项都携带 schema_version/evidence_id、
metric ID/version/服务器 label/unit/definition、grain、population、dimensions、provenance、
support_scope、cannot_support、quality_flags、computation_coverage。

source_analysis_ref、capability_ref、operator_ref、execution_spec_ref、input_refs 和 fingerprint
位于每项与包共享形状的 `provenance` 中，避免存在另一套互相矛盾的顶层副本。
这些是有界引用/内容 hash，不包含整份内部 fingerprint 或原始行。
数值为 strict finite float/int；bool 或数字字符串不能冒充数值。未知字段递归拒绝。

静态定义包括：

```text
selected_cohort_user_count@1
selected_cohort_converted_user_count@1
selected_cohort_conversion_rate@1
cvr_delta_pp@1
channel_user_count@1           channel_share@1
channel_converted_count@1      channel_cvr@1
channel_cvr_delta_pp@1          conversion_count_delta@1
mix_effect_pp@1                within_effect_pp@1
mix_within_decomposition@1     input_quality@1
represented_record_mean@legacy-1
represented_record_count@legacy-1
represented_user_count@legacy-1
allocated_conversion_value@legacy-1
```

历史 `new_customer_count@1`、`converted_customer_count@1`、`new_customer_cvr@1`
保留为 `reserved` catalog entries，只用于兼容定义目录；当前 conversion adapter 无权生成这些 Evidence。

每个 rate observation 与 share 都携带对应 definition_ref，分子/分母 Quantity 也含定义及单位。
不是只在 registry 中登记而在传输时丢失引用。比较整体 delta 用 percentage_point；率/share 用 fraction。

### Population 与 Grain 的真实边界

H1 冻结的口径是 `all_input_users_in_selected_cohorts`，字段来自 entity/cohort binding，
baseline/current 标签来自 ComparisonSpec。H2 携带 entity_type/entity_key/cohort_field/cohort_values、
filter_scope/population_role/channel 与 time_window。

H1 并未保存明确日历起止日期，也未验证 new_user_flag 或注册资格，因此 H2 不把 demo 日期写死成所有数据的窗口：
`entity_type=user`、`population_kind=selected_cohort_population`、
`filter_scope=all_input_users_in_selected_cohorts`、`new_customer_only=null`、
`registration_status_verified=false`、`time_window=cohort_labels_only_dates_not_recorded`。
`new_customer_qualification_not_verified`、`registration_population_not_verified` 与
`calendar_window_not_recorded` 只是限制标记，不提升 typed identity。

Flagship grain 为 user / 实际绑定的 entity key / unique_selected_user；derived fanout 的来源
由 H1 frozen fingerprint hash 与 QualityEvidence 的 input_record_count、unique_user_count、projection 保留。
legacy grain 为 represented_user / 原 user_id_col / joined_or_source_input_records，
不在没有保存来源证明时断言必然是行为事件或特定 Join。

### Provenance / identity

- source_analysis_ref.version = canonical hash(adapter 使用的 persisted semantic fields + 可选归档 revision)。
  legacy 的额外 raw/secret/presentation 字段不成为证据身份；conversion 的无序集合先 canonicalize。
- frozen capability/operator/spec/input dataset versions、完整 authoritative fingerprint hash。
- normalization policy ID/version/定义 hash、normalization records hash。
- 参数 hash 绑定 operator parameters、population、comparison 与 field bindings；comparison 标签另有显式字段。
- adapter_ref 固定 output contract + h2-1.1；每项 metric definition/version 单独携带。
- legacy 缺 ExecutionSpec、输入版本与 normalization 时返回 null，并带 legacy quality flags；绝不伪造。

Evidence ID 从最终 typed Evidence 的 `EvidenceIdentityMaterial` 产生：排除 evidence_id 和 presentation label，
递归纳入所有 MetricDefinition/Ref 与完整事实、population/grain、scope/limitations、coverage 和 provenance。
因此任何被引用的 nested definition version 改变都会改变依赖单元 ID；纯文案 label 改变不会 churn。
Pack content_hash 对 semantic projection 做 canonical hash，并对无序 Evidence 集规范化。
pack_id 使用该 hash；produced_at 来源于 Analysis 完成时间（否则创建时间），排除在内容 hash 外。
相同 artifact 重读内容与引用稳定；result/spec/fingerprint/policy 改变会改变身份。
H1 row-order policy 保留：数值相同但输入行序不同可以得到不同 provenance/pack hash。

H2.1 canonical collection policy：

| Collection | Order semantics | Identity policy |
|---|---|---|
| ranking members | 有；producer/rank contract | 保序，错误顺序 reject |
| baseline/current | 有；比较方向 | 保序 |
| decomposition members | 有；formula terms | 保序 |
| provenance input_refs | 有；primary/base | 保序 |
| quality flags / support / limitations | 无 | canonical sort |
| field bindings | 无；role → dataset/column mapping | 仅在 H2 provenance projection 按 semantic key 排序 |
| ranking universe / ties | 无；集合 | canonical sort |
| channel comparisons / ranking collection | 无；独立事实集合 | source identity 与 pack identity canonical sort |
| Evidence / omissions / evidence refs | 无；view order另行保留 | pack identity canonical sort |

同一 transport/display 顺序仍可保留业务友好排列；它不再冒充事实身份。H1 ExecutionSpec 本身的冻结策略未改变。

### Scope / coverage

support_scope 为有限 predicate IDs：population_rate、period_rate_difference、segment_rate、
segment_rate_difference、segment_share_difference、accounting_decomposition、descriptive_contribution、
represented_record_mean、model_allocation、quality_assessment 等。
cannot_support 统一显式覆盖 causal_effect、causal_channel_effect、complete_customer_journey、
first_touch_conversion_dominance、funnel_bottleneck、budget_optimization、guaranteed_conversion_lift、
user_quality_causal_change、causal_acquisition_priority。
这里只提供 H4 将来判定 scope 所需的元数据，没有实现自然语言判定器。

coverage 区分 core/overall/channels/decomposition/funnel/transport。
无事件输入时没有 computed funnel evidence；只有独立 optional branch 状态。
新/消失渠道保留 overall；channels partial、decomposition unavailable，mix/within=null。
H1 compiler 当前会拒绝该场景的完整旗舰执行；H2 adapter 的 partial fixture 直接来自纯 operator，
不声称创建了一份 H1 已成功编译的 partial run，不放松 H1 gate。

### 一致性检查

Adapter 不从原始数据计算 CVR，也不以算出的校验值替换结果。它校验：
计数范围、分子/分母与已存 CVR 一致、渠道计数合计与整体一致、share 与分母一致、
delta/current/baseline 一致、分解项与已存公式/总项/残差一致、ranking universe/成员/排序/ties/rank 一致，
以及 operator、comparison、normalization records 与 spec 一致。legacy 还严格核对 persisted Top3 的
entity sequence、value、percentage、rank、ties、member count 与 producer-recorded model order。
不一致统一 `RESULT_CONTRACT_INCONSISTENT`；不修补、不降级成可信 Evidence。
H1 未舍入数值检查绝对容差1e-10；legacy 4dp 数值和2dp percentage 按已知舍入误差界检查。

## CURRENT — 有界选择与 SummaryV2

包最多32个 Evidence 单元、512KiB。旗舰12个单元：overall1、decomposition1、quality1、channel5、ranking4，
完整保留5渠道×2期的 count/converted/CVR/share。
超条数时保留 overall/decomposition/quality，再按渠道名选比较，最后保留可选排名；省略均记录。
required decomposition 的完整 per-channel terms 不截断；必需单元过大明确预算错误。

SummaryV2 最多256KiB；每项 ranking 最多20成员（demo4排名×5成员全部保留）。
其余所选 Evidence 原样携带语义字段及 evidence_id，不重定义公式/人口/支持范围。
保留 global rank、universe、direction、ties、included/total_count，区分计算覆盖和传输覆盖。
partial ranking 的 total_count 指全集；member omission 的 total_count 指实际可传输的已计算成员。

超摘要字节预算按反优先级丢完整可选 ranking/channel comparison；不拆分子分母，不切 required decomposition。
Omission 包含 reason、transport_layer(pack/summary)、type/ref、included/total 与 selection_policy。
若只剩 required 单元仍超预算，返回 `EVIDENCE_SEMANTIC_UNIT_BUDGET_EXCEEDED`，不输出残缺摘要。
summary.pack_ref/content_hash 指回权威包；evidence_refs 仅含实际携带单元。

## LEGACY — 最小兼容

新归因结果在 summary 额外保存 represented_record_count / represented_user_count，
来自既有 user_journeys 的聚合计数。均值和各模型公式、舍入、原字段全部不变。
历史结果只有 rounded mean 时 numerator.value=null/not_recorded；不能从1.03×2000补造记录数。

2054/2000 四舍五入后1.03：support_scope 只有 represented_record_mean。
它不能证明完整旅程、首触转化优势、漏斗瓶颈或渠道优化优先级。
新 producer 的 persisted Top3 保存每个 model dimension、entity/value/percentage/rank/ties；adapter 只发布
这份通过校验的 persisted prefix，不从 full models 重新排序或补造完整 ranking。历史结果若没有 Top3，
ranking 不可用，同时保留按 model/touchpoint 维度表达的 allocation MetricEvidence。
所有 legacy evidence 为 descriptive_only/legacy_limited，
不声称有 H1 conversion decline 的冻结执行来源或完整业务人口。

## Security 与兼容性

结构只允许 aggregate facts、有限定义、bounded dimension/ranking 元数据与版本引用。
递归拒绝 raw_rows/rows/preview_rows/result_data、路径、连接、凭据、SQL/bytes 等敏感字段；
所有数据文字受长度限制，拒绝显式路径/URI、secret assignment 和已知 SQL 形式。
legacy 使用显式字段投影，额外 raw/secret 字段不输出；完整内部对象只参与 hash，不作为 payload。
这些规则不是通用 DLP，不证明任意渠道名中没有个人信息或指令文本；元数据仍是数据，不成为模型指令。

现有 frontend v1 SafeResultSummary、ResultView、AIWorkspace handoff、Hermes explain schemas/endpoint 均未迁移。
新 GET 提供未来解释链的服务器输入；旧 Hermes 任意 Dict 摘要入口仍是 legacy advisory，
不能因为 H2 新路径存在而称旧解释已安全/已 grounded。没有 TS/UI 改动。

## DEFERRED / UNSUPPORTED

- DEFERRED：H3 session/active_result/context selector/approval；H4 Claim AST、验证器、受限叙事；H5可靠性；Gate2 E2E。
- UNSUPPORTED：未知结果合同、缺冻结规格的旗舰历史结果、未计算漏斗、任意指标或插件、超预算的必需语义单元。
- 未证明云部署/真实DB/存储并发或 source replay；不重新核验线下业务人群、因果或追踪完整性。
- Legacy 输入版本缺失仍是历史事实；H2 没有新增结果版本表或伪造旧 provenance。

**P0D-H2.1 REMEDIATION: READY FOR INDEPENDENT RE-AUDIT**

验证结果与交接清单见 [H2 QA](../qa/P0D_H2_TYPED_EVIDENCE_VERIFICATION.md)。等待独立审计，不进入 H3。
