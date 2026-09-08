# P0D-H2.1 — Evidence Semantic Integrity Remediation Verification

日期：2026-09-09。范围仅为 H2 independent audit 的 F01–F04。

**P0D-H2.1 REMEDIATION: READY FOR INDEPENDENT RE-AUDIT**

这不是 P0D-H2 FINAL PASS。H3 保持 BLOCKED；只有原 clean-room auditor 重新关闭 F01–F04，
并确认 Q1–Q4 全部为 YES 后，才允许 H2 final freeze。

## 1. Independent findings consumed

本轮完整采用以下 defect authority，不修改其 `FAIL / FIX REQUIRED` 内容：

- `P0D_H2_INDEPENDENT_SOURCE_AUDIT.md`
- `P0D_H2_AUDIT_DECISION_REGISTER.md`

修复范围：F01 population semantic overclaim、F02 legacy Top3 silent repair、
F03 incomplete Evidence semantic identity、F04 non-semantic collection identity churn。
未将任何 finding 解释为测试过严、fixture 特殊或未来模型可以自行理解。

## 2. F01 root cause and weaker population semantics

H1 frozen `PopulationSpec` 只能证明 `all_input_users_in_selected_cohorts`，没有冻结
new-customer qualification 或 registration eligibility。H2 原先却在 typed identity 中发布
`new_customer_cvr`、`new_customer_count`、`registered_user`、`unique_registered_user`，
Evidence semantics 强于其 execution contract。

H2.1 将 flagship authoritative identity 收缩为：

```text
selected_cohort_user_count@1
selected_cohort_converted_user_count@1
selected_cohort_conversion_rate@1

population.entity_type = user
population.population_kind = selected_cohort_population
population.filter_scope = all_input_users_in_selected_cohorts
population.registration_status_verified = false
grain.entity = user
grain.row_semantics = unique_selected_user
```

人口与粒度另有 `selected-cohort-population@1`、`selected-user-grain@1` semantic refs。
`new_customer_qualification_not_verified`、`registration_population_not_verified`、
`calendar_window_not_recorded` 是限制标记，不会把 typed identity 升级。

历史 `new_customer_count/new_customer_cvr/converted_customer_count` 定义保留为
`lifecycle=reserved` catalog entries；当前 conversion adapter 不生成它们。这样保留定义兼容性，
同时保证 future H4 只能看到 selected cohort conversion，不能仅从 metric ID 生成“新客转化率”。

原始 negative fixture 已长期固化：输入只有四个 H1 bound columns，额外未绑定
`new_user_flag=0` 对每行成立；H1 仍可执行，H2 数值仍表达 selected cohort conversion，
但所有 Evidence 的 metric dependency、population 和 grain 均不发布 new-customer/registered identity。

## 3. F01 H1 contract alignment and unchanged golden math

本轮没有修改 H1 schema、registry、compiler、fingerprint、execution service 或 pure operator。
Committed demo 的 deterministic facts 保持：

| Fact | Value |
|---|---:|
| baseline selected users / converted / rate | 1000 / 240 / 0.24 |
| current selected users / converted / rate | 1000 / 188 / 0.188 |
| current − baseline | -5.2pp |
| mix contribution | -2.56pp |
| within contribution | -2.64pp |
| reconciliation residual | 0 |

H1/H1.1 核心回归：**110 passed**。

## 4. F02 legacy fail-closed producer contract

实际 legacy producer 的 model allocations 按 value descending 保存，Top3 为该 persisted order 的前三项。
H2.1 新 producer 同时持久化 Top3 的 entity、value、percentage、rank、ties，避免 adapter 重新赋义。

当 `models` 与 persisted Top3 同时存在时，adapter 验证：

- model 与 model_name；
- exact entity sequence 和 member count；
- value 与 percentage；
- rank 与 tie set/order；
- duplicate、missing、extra member；
- full model order 的 descending contract。

任何矛盾统一 `RESULT_CONTRACT_INCONSISTENT`。验证成功后只发布 persisted Top3 members，
不从 full models 重新排序、补齐或重新 assign rank。原始反例
`social_ads 64 → search_ads 128 → organic 150` 现在失败关闭，不能产生 repaired RankingEvidence。

历史 artifact 若完整保存 allocations 但未保存 Top3，不生成 authoritative ranking；
coverage 标为 unavailable/partial，并以无排名的 model + touchpoint dimensions 保留
`allocated_conversion_value` MetricEvidence。

## 5. F03 semantic dependency fingerprint

H2.1 先构造完整 frozen typed Evidence，再调用统一 `EvidenceIdentityMaterial`：

1. 递归收集每个 `MetricDefinition` 和 `Ref`；
2. 将 metric ID/version/unit/formula/lifecycle 与 Ref ID/version 纳入 dependency inventory；
3. 将 typed facts、population、grain、dimensions、comparison/decomposition/ranking semantics、
   support_scope、cannot_support、coverage 与 provenance 纳入 semantic content；
4. 排除 evidence_id 与 presentation-only label；
5. 计算稳定 canonical hash。

这不是按 evidence type 手写的特例。新增嵌套 MetricDefinition 或 Ref 会由同一递归 collector 捕获。
`evidence-support-taxonomy@1`、population/grain refs、adapter `h2-1.1` 和 normalization policy ref
均作为明确的 versioned dependencies。

Mutation matrix 覆盖 top-level metric、nested rate、numerator、denominator、channel rate/count/share、
decomposition formula、adapter、normalization policy、support taxonomy、population、grain、
support_scope 和 cannot_support。每项语义变化都改变对应 Evidence ID；非依赖单元保持原 ID。
dependency inventory regression 明确枚举 overall comparison 的全部 nested refs，防止未来新增字段漏入 identity。

## 6. F04 canonical order policy

Identity 使用集中式 collection policy，不在 adapter 各处临时决定：

| Collection | Semantic order | Reorder result |
|---|---|---|
| ranked members | YES | persisted contradiction reject |
| baseline/current | YES | comparison semantics changed/rejected |
| decomposition formula terms | YES | preserved |
| provenance input_refs | YES | preserved |
| quality flags / scope / limitations | NO | same identity |
| H2 field binding projection | NO | same identity |
| ranking universe / ties | NO | same identity |
| channel comparison collection | NO | same identity |
| ranking collection by metric | NO | same identity |
| Evidence / omission / evidence-ref sets | NO | same pack semantic identity |

Pack transport/view order仍可用于业务展示；content hash 对 semantic projection canonicalize，
不会把序列化偶然顺序当成业务含义。H1 ExecutionSpec 和 source-frame row-order policy 均未改变。

## 7. 1.03 true-metric regression

Legacy demo 继续得到：

```text
represented_record_mean = 1.03
represented_record_count = 2054
represented_user_count = 2000
```

support_scope 仅含 `represented_record_mean`；cannot_support 继续包含
`complete_customer_journey`、`first_touch_conversion_dominance`、`funnel_bottleneck`、
`causal_acquisition_priority`。F01 rename 不改变该 legacy evidence 的事实与限制。

## 8. Server authority and SummaryV2 atomicity

以下既有 Q1/Q4 保护保持：

- evidence GET 先按 analysis ID + owner 读取 persisted result，再由 server adapter 构造；
- summary-v2 使用同一 server EvidencePack；
- fake GET body 不影响，POST fake evidence 为 405，other user/nonexistent 为 404；
- pending/running/failed/null result 不产生 Evidence；unknown output contract fail closed；
- numerator/denominator、baseline/current、decomposition required terms、ranking member
  entity/value/rank/ties 与 support/provenance 始终作为完整语义单元；
- required unit 超预算返回 `EVIDENCE_SEMANTIC_UNIT_BUDGET_EXCEEDED`，不发布 partial authoritative fact；
- SummaryV2 原样携带新的 selected-cohort metric identities，不翻译为 new customer。

## 9. Security regression

Focused regression继续验证 EvidencePack/SummaryV2 不包含 raw rows、preview/full result、路径、
DB URL、credentials、raw SQL 或 source bytes。bool、numeric string、NaN、Inf 不能进入 strict numeric facts；
递归 forbidden-key 与已定义敏感 metadata pattern 继续拒绝。

## 10. Test results

| Suite | Result |
|---|---|
| H2.1 focused typed evidence | **113 passed** |
| frozen H1/H1.1 core | **110 passed** |
| full backend | **349 passed, 6 skipped**（仅需运行中 backend 的 integration cases 按既有 gate skip） |
| frontend lint | **exit 0**（0 errors；355 个既有 warnings） |
| frontend build | **exit 0**（Vite production build 完成；既有 chunk-size warning） |
| git diff --check | **pass** |

旧 H2 expectation 只在与批准的新 semantic contract 冲突处修改：

- `new_customer_*` → `selected_cohort_*`，因为原命名超出 H1 authority；
- `registered_user/unique_registered_user` → `user/unique_selected_user`；
- legacy ranking 从 adapter 重建的完整列表改为已验证 persisted Top3 prefix；
- pack hash 的独立复算改用公开 semantic identity material，排除 presentation/view order。

这些变化收缩语义、拒绝矛盾并补全身份依赖，属于 semantic strengthening，不放宽数值校验、
schema validation、fallback 或 safety boundary。原 77 项 H2 测试未删除；新增 F01–F04 regression 后为 113 项。

## 11. Limitations

- 本轮不证明 new-customer qualification、registration eligibility、paid-first-order、calendar window 或 causal claims。
- Legacy Top3 新字段只对新 producer artifacts 完整可用；旧 artifact 缺 Top3 时 ranking unavailable。
- H2 semantic identity 是应用级 canonical content identity，不是外部防篡改签名。
- 未运行真实 DB/JWT、Hermes/DeepSeek、浏览器 Gate2、H3/H4 或自然语言 grounding/recommendation verifier。
- presentation label 不参与 identity；metric/formula/ref IDs 和版本才是 authoritative semantic dependencies。

## 12. Re-audit handoff

Remediation changed-file inventory：

```text
insightease-backend/app/schemas/evidence.py
insightease-backend/app/services/evidence_definitions.py
insightease-backend/app/services/evidence_common.py
insightease-backend/app/services/evidence_service.py
insightease-backend/app/services/conversion_diagnosis_evidence_adapter.py
insightease-backend/app/services/attribution_evidence_adapter.py
insightease-backend/app/services/attribution_service.py
insightease-backend/tests/test_typed_evidence.py
docs/architecture/P0D_H2_TYPED_EVIDENCE_IMPLEMENTATION.md
docs/qa/P0D_H2_1_EVIDENCE_SEMANTIC_INTEGRITY_VERIFICATION.md
```

原 clean-room auditor 应使用 remediation commit 与 changed-file list，重新运行：

1. F01 generic selected cohort 与全 0 unbound `new_user_flag`；
2. F02 reversed/contradictory persisted Top3，并确认 0 repaired trusted ranking；
3. F03 nested rate/count/channel_share definition version mutations；
4. F04 quality_flags、field_bindings、ranking_universe、ties、channel/ranking collection reorder；
5. ranked member reversal的 fail-closed 对照；
6. Q1 server authority、Q4 atomic budget、1.03 与 security regressions。

交接前提供最终 remediation SHA、changed file list、focused/full regression 结果。
H2.1 worker 到此停止，不开始 H3。
