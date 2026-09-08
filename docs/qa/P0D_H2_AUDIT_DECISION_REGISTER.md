# P0D-H2-A — Independent Source Audit Decision Register

审计日期：2026-09-07。被审计HEAD：`a08baeae00cf41d836bab34745fc28e8bd6b7d57`；parent/H1 frozen baseline：`e11b7253821ff213699ca4113a72ba70b7ef0b78`。

**H2 FAIL / FIX REQUIRED；Q1 YES、Q2 NO、Q3 NO、Q4 YES；3 MAJOR、1 MINOR；H3 BLOCKED。**

这是新的审计登记，不改写任何历史QA/audit。完整复现与影响见[Independent Source Audit](P0D_H2_INDEPENDENT_SOURCE_AUDIT.md)。

路径缩写：`S`=`insightease-backend/app/services/`，`E`=`insightease-backend/app/schemas/evidence.py`，`C`=`insightease-backend/app/schemas/capability.py`，`A`=`insightease-backend/app/api/v1/endpoints/analysis.py`。

运行证据：`I`=独立`.venv/h2_audit_probe.py`/`.venv/h2-audit-independent.json`；`T`=本轮重跑原H2和H1/H1.1测试；`V1`=实际旧safeResultSummary函数的Node probe。I不导入T helpers，expected来自CSV/Fraction。I的26组检查有22PASS、4FAIL；程序正常结束不表示Gate通过。

## Claim decisions

| ID | Claim / requirement | Decision | Source file / symbol | Runtime evidence | Severity |
|---|---|---|---|---|---|
| R01 | H2 SHA/parent/changed files正确 | VERIFIED | git show/diff-tree/rev-parse | 独立确认11文件：8prod/1test/2docs，parent e11b725 | — |
| R02 | H1 frozen production/tests未改 | VERIFIED | parent→HEAD针对H1文件diff | schema/registry/compiler/input/reader/operator/execution和两test无diff；187focused通过 | — |
| R03 | 保护旧导航/历史QA | VERIFIED | 初末SHA256、git diff/status | 6文件hash一致，旧navigation diff保留；仅新增本轮报告 | — |
| R04 | Evidence GET先ownership lookup | VERIFIED | A:get_analysis_evidence:857；S/evidence_service.read_owned_evidence:159 | I http：SQL含analyses.id和analyses.user_id，owner200/other404 | — |
| R05 | Summary GET同一server authority | VERIFIED | A:get_analysis_safe_summary_v2:868；S/evidence_service:123 | I两个GET均从同一persisted result，summary指回pack | — |
| R06 | Fake GET body不影响数值 | VERIFIED | 两GET无body参数 | I两个路径携baseline_cvr=.99/fake evidence仍baseline=.24 | — |
| R07 | 无POST fake evidence路径 | VERIFIED | A仅新增GET | I两个路径POST均405 | — |
| R08 | Nonexistent/deleted/unavailable拒绝 | VERIFIED | S/evidence_service:159–167；A:916–934；Analysis model | I lookup absent/deleted404；nullresult422；物理删除，无软删除字段 | — |
| R09 | pending/running/failed不能输出成功evidence | VERIFIED | S/evidence_service:71–72 | I直接builder及两HTTP路径状态矩阵422 | — |
| R10 | Unknown contract fail closed | VERIFIED | S/evidence_service._result_contract:32–38；ADAPTERS:19 | I flagship/legacy UnknownResult@999均UNSUPPORTED_CONTRACT，无flatten | — |
| R11 | Flagship强制冻结spec | VERIFIED | S/evidence_service:77–82；S/capability_execution_service | I缺spec reject；T非法/伪造执行参数通过回归 | — |
| R12 | Adapter不从source重算业务指标 | VERIFIED | 两adapter全部调用链；无reader/groupby/join | I source/operator/provider哨兵未触发；网络0次 | — |
| R13 | 错CVR不silent repair | VERIFIED | S/conversion_diagnosis_evidence_adapter.validate_result:26–31 | I 1000/240/.30→RESULT_CONTRACT_INCONSISTENT，输入不变 | — |
| R14 | Delta/decomposition不一致拒绝 | VERIFIED | 同文件:31,46–64 | I delta−4/−4.9、mix0 reject，未发布修正数 | — |
| R15 | Channel share/denominator与合计一致 | VERIFIED | 同文件:38–55 | I share=.99、denominator2000 reject；golden两期合计正确 | — |
| R16 | Flagship ranking成员/值/序/ties/rank/universe一致 | VERIFIED | 同文件:65–78 | I六类ranking mutation全部reject，输入未改 | — |
| R17 | Legacy所有persisted ranking不一致均reject | CONTRADICTED | S/attribution_evidence_adapter:55–75 | I legacy_top3_order反序被接受并重排完整ranking | MAJOR F02 |
| R18 | Adapter完全validation-only/no published repair | CONTRADICTED | 同R17 | 数值未重算、输入未写回，但published ranking排序被修正 | MAJOR F02；Q2 NO |
| R19 | Metric definition为静态server authority | VERIFIED | S/evidence_definitions:5–26；S/evidence_common:23–29 | I mapping mutation TypeError，unknown metric KeyError；18项registry | — |
| R20 | Overall分子/分母随evidence传输 | VERIFIED | E:Quantity/Ratio/RateObservation；adapter:101–115 | I240/1000、188/1000、count/fraction/pp、defs正确；summary原样保留 | — |
| R21 | Population/grain字段足够表达所选cohort | PARTIALLY VERIFIED | E:Grain/Population；adapter:89–115 | entity key/cohort/role/filter/window传输正确；注册/新客identity过强 | MAJOR F01 |
| R22 | new_customer_cvr由H1新客资格合同支持 | CONTRADICTED | C:PopulationSpec/ReviewedRequirements；S/capability_registry._flagship | I四绑定列+new_user_flag全0仍compile/execute并发布new_customer_cvr | MAJOR F01 |
| R23 | quality_flags/label足以消除新客overclaim | CONTRADICTED | adapter:92–98；E:Support/Limitation；definitions:6–8 | I flags为Text、new_customer_only=null，但typed registered_user/unique_registered_user仍发布 | MAJOR F01；Q3 NO |
| R24 | 未伪造explicit calendar window | VERIFIED | E:Population.time_window；adapter:98 | I仅cohort labels、dates_not_recorded；未写demo日期 | — |
| R25 | 1.03真实mean及operands | VERIFIED | S/attribution_service._generate_summary；S/attribution_evidence_adapter:19–40 | I独立订单行Counter2054/2000→1.03，actual一致 | — |
| R26 | 1.03有限scope/cannot_support | VERIFIED | E:33–39；legacy adapter:28–40；LIMITATIONS | I support仅represented_record_mean；4必需禁用ID均存在 | — |
| R27 | joined records未改称behavioral touchpoints | VERIFIED | legacy Grain/Population/flags | I row_semantics=joined_or_source_input_records；mean名称正确 | — |
| R28 | 历史记录数缺失不乘回猜测 | VERIFIED | legacy adapter:23–31,39–40；S/evidence_common.quantity | I删除operands→numerator null/not_recorded，未猜2060/2054 | — |
| R29 | 缺历史spec/fingerprint不伪造 | VERIFIED | S/evidence_service._provenance:61–66 | I legacy refs/version/hash均null，legacy_limited | — |
| R30 | Legacy Top3实际entity/value/rank保留 | VERIFIED | legacy adapter:70–79；summary projection | I organic150/rank1、search_ads128/rank2、social_ads64/rank3，3模型 | —，与F02反例区分 |
| R31 | 四种旗舰排名语义分离 | VERIFIED | adapter:RANK_METRICS/139–143 | I exact arithmetic：social/social/organic/organic，四metric IDs，无main_driver | — |
| R32 | Required semantic units不可拆 | VERIFIED | S/evidence_service._drop_optional_unit/builders | I两种100-byte预算明确错误，无孤立率/丢分母 | —；Q4 YES |
| R33 | Optional byte budget整单元移除 | VERIFIED | 同上:99–116,134–156 | I pack/summary预算减100，required仍相等、omissions显式 | — |
| R34 | 40-channel条数预算与decomposition完整性 | VERIFIED | adapter required-first；service:86–94 | I47→32单元；40terms保留；comparison30/41、ranking0/4 | — |
| R35 | 30-member→20 summary不改pack | VERIFIED | service:127–133 | I pack30不变，summary c00/30/rank1→c19/11/rank20，universe30 | — |
| R36 | computation/transport coverage分开 | VERIFIED | E:RankingEvidence/Coverage/Omission | I complete计算+partial传输，20/30 omission | — |
| R37 | Channel enter-exit不补0 | VERIFIED | adapter validate_result/adapt_conversion | I pure operator boundary：overall complete、channels partial、dec unavailable/mix within null | —，非成功H1run |
| R38 | Time与dict顺序不改变identity | VERIFIED | S/evidence_service:43,95–113；canonical_hash | I completed_at+9days、recursive dict reverse均稳定 | — |
| R39 | Pack content hash可独立复算 | VERIFIED | service:109–113 | I stdlib JSON+SHA256与hash相等，produced_at排除 | — |
| R40 | spec/fingerprint/normalization/result/adapter版本变化改变identity | VERIFIED | S/evidence_service._provenance | I各mutation全部ID变；policy version和definition各测 | — |
| R41 | 所有所用metric definition版本参与evidence identity | CONTRADICTED | S/evidence_common.common:28–33 | I nested cvr/count/share版本变，相关ID不变；pack变 | MAJOR F03 |
| R42 | 无序集合canonical order稳定 | PARTIALLY VERIFIED | service:_provenance；adapter:139–143 | I channel/ranking/flags/bindings反序facts相同却ID变；universe/ties也原样传递 | MINOR F04 |
| R43 | EvidencePack/Summary无raw和深层secret | VERIFIED | E:reject_forbidden_keys；legacy显式projection | I4实际对象递归扫描；16keys深层reject，nested sentinel不泄露 | — |
| R44 | bool/numeric string/NaN/Inf被拒绝 | VERIFIED | E:Number/Count；service strict JSON；legacy.number | I五类非法数值schema与两adapter入口拒绝；T原用例通过 | — |
| R45 | 敏感path/URI/assignment/SQL pattern拒绝 | VERIFIED | E:safe_text:16–24 | I9类pattern + T实际维度fixture；有限pattern范围 | — |
| R46 | General DLP / arbitrary prose grounding已经解决 | NOT VERIFIED / NOT CLAIMED | E只有限pattern，H4未实现 | 未做任意PII/文本语义证明，不能扩大R45 | 限制 |
| R47 | Golden独立复算 | VERIFIED | 纯H1actual + I CSV/Fraction oracle | 240/1000、188/1000、−26/5、−64/25、−66/25与5×2channels | — |
| R48 | 没有demo hardcode | VERIFIED | 全局backend/app + frontend/src扫描；H2diff | production匹配仅通用上限/时间换算，无demo branch | — |
| R49 | 人口×2/rates不变 | VERIFIED | I metamorphic | quality input/unique/selected=4000、计数×2、rate/delta/mix/within不变 | — |
| R50 | 两期相同不制造下降 | VERIFIED | I metamorphic | delta/mix/within=0，即使goal为decline | — |
| R51 | source行序改变facts不变 | VERIFIED | H1 fingerprint policy；I metamorphic | 全facts不变，provenance/pack按H1policy变；不是F04 | — |
| R52 | Summary是projection而非第二truth | VERIFIED | S/evidence_service.build_safe_result_summary_v2 | I默认各unit逐对象相等，refs/hash正确；budget仅整单元/prefix | — |
| R53 | Legacy v1/Hermes compatibility边界 | VERIFIED | app/src/lib/assistant/safeResultSummary.ts:toSafeCell；schemas/hermes:69–74；hermes endpoint/validator | V1实际"3 items"；旧Dict无H2authority调用连接 | —，不代表旧Gate2修复 |
| R54 | 无H3/H4功能泄漏 | VERIFIED | H2 git changed files与symbol扫描 | 没有session/state/context selector/Claim AST/verifier实现 | — |
| R55 | 本轮所有既有regression通过 | VERIFIED | h2/focused/full/lint/build日志 | 77；187；313+6skip；lint0error355warning；authorized build exit0 | — |
| R56 | 实库/JWT/云部署/浏览器/provider验收 | NOT VERIFIED / OUT OF SCOPE | 本轮约束 | DB/auth doubles；未运行live/DB/browser | 限制 |

## Findings / required audit disposition

| Finding | Severity | Status | Gate consequence |
|---|---|---|---|
| H2-A-F01 新客/注册人口identity超出frozen selected-cohort合同 | MAJOR | OPEN；仅记录 | Q3 NO |
| H2-A-F02 legacy Top3次序矛盾被接受并重新发布正确排序 | MAJOR | OPEN；仅记录 | Q2 NO |
| H2-A-F03 嵌套metric definition版本不改变evidence ID | MAJOR | OPEN；仅记录 | 独立阻止H2final PASS |
| H2-A-F04 无序数组导致非语义identity churn | MINOR | OPEN；仅记录 | 不单独构成重大数值/权限问题 |

后续修复的验收依据应包含上述原反例，不能通过删除probe检查或修改现有expectation宣称关闭。本轮没有授权或实施这些修复。

## Final gate

| Question | Answer |
|---|---|
| Q1 Server-authoritative EvidencePack? | **YES** |
| Q2 Adapter validation-only, no silent recomputation/repair? | **NO** |
| Q3 Typed semantic scope sufficient? | **NO** |
| Q4 Summary semantic-unit preservation under budget/transport projection? | **YES** |

**P0D-H2 INDEPENDENT SOURCE AUDIT: FAIL — FIX REQUIRED。H3 BLOCKED。**

H1 FINAL FREEZE: PASS的既有历史不变。1.03及新Summary预算通过不意味着旧Hermes已grounded，也不改变旧Gate2 FAIL/PAUSED。
