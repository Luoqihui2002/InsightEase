# P0D-H2-A — Typed Evidence & SafeResultSummary v2 Independent Source Audit

审计日期：2026-09-07（Asia/Shanghai）。被审计提交：`a08baeae00cf41d836bab34745fc28e8bd6b7d57`。

**P0D-H2 INDEPENDENT SOURCE AUDIT: FAIL — FIX REQUIRED**

**Q1 YES；Q2 NO；Q3 NO；Q4 YES。3 MAJOR，1 MINOR，未发现本轮定义的 BLOCKER。H3 继续 BLOCKED。**

判断来自源码与独立反例，不以实现方报告或原测试通过数量替代。配套：[Audit Decision Register](P0D_H2_AUDIT_DECISION_REGISTER.md)。

## 1. Scope

本轮是新的独立 clean-room source audit，只审 H2。读取 H2 implementation/verification 为 claims to verify，并读取三份 H0 文档、H1 implementation、H1.1 independent re-audit/decision register、committed `GROUND_TRUTH.md`。核查所有 8 个 H2 production changed files、H2 测试，以及 H1 capability schema/registry/compiler/input service/execution service/pure operator、Analysis schema/model/create/execute/read/delete、旧 SafeResultSummary/resultSummary 和 Hermes explain schema/endpoint/validation/provider adapter。

未修改 production code、原测试或 expectation、prompt、UI、配置、`.env`、数据库、历史 QA/audit。未 commit/push，未调用真实 Hermes/DeepSeek/provider，未继续 browser E2E，未实施 H3/H4。前端构建仅产生正常缓存/构建文件。

独立程序 `.venv/h2_audit_probe.py` 不导入 `test_typed_evidence.py` 或其他测试 helper。Expected 由 stdlib CSV、Counter 和 Fraction 建立；H1 只生成 actual persisted-shaped result，H2 生成被检对象。HTTP 使用真实 FastAPI routes、schema、service、adapter 和 HTTPX ASGI transport；认证身份与 DB session 是内存替身。DB 替身检查实际 SQL 包含两个所有权条件，**不是实库/JWT 部署验收**。

程序初始化 Windows asyncio 内部 socketpair 后禁止外部 socket connect；独立场景记录 **0 外部网络尝试**。读路径另设 source loader、legacy operator 和 provider 调用失败哨兵。纯计算 fixtures 不写入数据库。

## 2. Git provenance

先实际执行用户要求的 `git status`、branch、HEAD、remote、log -20、完整 diff、diff --check；随后用 `git show --format=fuller --stat HEAD`、`git diff-tree --name-status -r HEAD` 和 `git rev-parse HEAD^` 独立建立范围。

| 项目 | 独立核实 |
|---|---|
| Repository | `C:\Users\cc249\InsightEase` |
| Branch | `codex/v1.0-p0d-e2e-demo-portfolio` |
| H2 commit | `a08baeae00cf41d836bab34745fc28e8bd6b7d57` — feat: add typed analysis evidence contracts |
| Parent / H1 frozen production baseline | `e11b7253821ff213699ca4113a72ba70b7ef0b78` |
| Parent history | `fbfbd50`（H1 audit docs）→ `14a116e`（H1 implementation） |
| Remote | `https://github.com/Luoqihui2002/InsightEase.git`（fetch/push 配置）；未 fetch/push |
| 初始 tracked diff | 仅 `app/src/pages/AIWorkspace.tsx` 四处 navigation detail patch |
| 初始 untracked | `P0D_FULL_BROWSER_E2E.md`、两份 H1.1 independent re-audit 文档 |
| H2 actual change count | 11 files：8 production、1 test、2 docs；1605 insertions |

真实 H2 production files：

```text
insightease-backend/app/schemas/evidence.py
insightease-backend/app/services/evidence_definitions.py
insightease-backend/app/services/evidence_common.py
insightease-backend/app/services/evidence_service.py
insightease-backend/app/services/conversion_diagnosis_evidence_adapter.py
insightease-backend/app/services/attribution_evidence_adapter.py
insightease-backend/app/services/attribution_service.py
insightease-backend/app/api/v1/endpoints/analysis.py
```

Test：`insightease-backend/tests/test_typed_evidence.py`。Docs：`docs/qa/P0D_H2_TYPED_EVIDENCE_VERIFICATION.md`、`docs/architecture/P0D_H2_TYPED_EVIDENCE_IMPLEMENTATION.md`。

H1 schema、registry、compiler、execution service、input service、dataset reader、pure diagnosis 以及两份 H1/H1.1 tests 的 parent→HEAD diff 均为空。`attribution_service.py` 只有 `_generate_summary:301–303` 新增两个 aggregate operands 与注释；未改变既有归因公式。Analysis endpoint 只新增 imports 和两个 GET。

受保护文件初末 SHA-256 比对一致，最终 tracked diff 仍只有旧导航 patch：

| 文件 | SHA-256 |
|---|---|
| AIWorkspace.tsx | `5AFF69E3F33EEF53E60D3E147C1DE5745246CDF297243F70BEABF8D0AC587989` |
| P0D_FULL_BROWSER_E2E.md | `A6D0DE4221332A84E4C91B933F6F0C7057687D091D48F913F14960661C957C9B` |
| P0D_H1_INDEPENDENT_SOURCE_AUDIT.md | `9413F8409F21621846CC720EADC4649313688853D510673766DE9D4667ECAD61` |
| P0D_H1_AUDIT_DECISION_REGISTER.md | `3F9C3D509E067462BD21C2F0D2D603A8B253470E03CCA64E20085BA1B3B4F916` |
| P0D_H1_1_INDEPENDENT_REAUDIT.md | `9063F72FEEB6369005719B1E1E585FB3D6DB1DE0DC4D0A98266152B67BD736E8` |
| P0D_H1_1_REAUDIT_DECISION_REGISTER.md | `10D8CEB1D75C625243E609A1F4F98DDEAAE58F72C3DAD2D7FA7E9E1B0697FBBF` |

未 reset/clean/rebase/stage/覆盖既有 probe/log。新 ignored probe/result 的目标路径在复制前确认不存在。

## 3. H2 claim matrix

完整逐项登记见配套 decision register。主要结论：

| Claim | Decision | 依据 |
|---|---|---|
| 新 GET 为 server-authoritative owned read | VERIFIED | 实际 SQL、fake GET body、POST405、owner/other/absent/status 矩阵 |
| flagship adapter 不重算替换错误 CVR/delta/decomposition | VERIFIED | 12 类独立 mutation 全 reject，输入未修改 |
| 所有 adapter 都拒绝 persisted ranking 不一致 | CONTRADICTED | H2-A-F02：legacy Top3 反序被接受并重新排序 |
| typed population 不超出 H1 权威口径 | CONTRADICTED | H2-A-F01：generic selected users 被标为 new_customer / registered_user |
| 1.03 不支持旅程/首触/漏斗/因果优先级 | VERIFIED | 实际2054/2000，有限 taxonomy，历史 operands 不伪造 |
| semantic unit budget 原子性与 top20/global30 | VERIFIED | 100-byte、40-channel、30-member、optional byte drop 反例 |
| identity 完整涵盖所用 metric definition versions | CONTRADICTED | H2-A-F03：嵌套 metric 版本变而 evidence ID 不变 |
| canonical ordering 全面稳定 | PARTIALLY VERIFIED | dict 顺序稳定；无序数组变化导致 identity churn（F04） |
| 旧 Hermes 已获得 H2 grounding | NOT VERIFIED / NOT CLAIMED | 旧 Dict/v1 path 未迁移，实际仍有 Top3→3 items |

## 4. Server authority audit — Q1 YES

实际调用链（源码位置相对 `insightease-backend/app/`）：

```text
GET /api/v1/analyses/{id}/evidence
  api/v1/endpoints/analysis.py:get_analysis_evidence:857–865
  → get_current_active_user + get_db
  → evidence_service.read_owned_evidence:159–167
  → SELECT Analysis WHERE Analysis.id = id AND Analysis.user_id = current_user.id
  → persisted Analysis.result_data / Analysis.params.execution_spec
  → build_evidence_pack:69–120
  → status/nonempty gate → _result_contract:32–38
  → strict ConversionDiagnosisResult + ExecutionSpec, or explicit legacy aggregate adapter
  → _provenance → static ADAPTERS → consistency validation → bounded EvidencePack

GET /api/v1/analyses/{id}/safe-summary-v2
  api/v1/endpoints/analysis.py:get_analysis_safe_summary_v2:868–881
  → same read_owned_evidence → same EvidencePack
  → build_safe_result_summary_v2:123–156
  → semantic-unit selection / rank prefix → SafeResultSummaryV2
```

两个 GET 没有 body/evidence 参数。新的 API 没有接收 EvidencePack 的 POST。Analysis create 从用户 params 经 H1 `prepare_capability_run` 生成冻结规格，后台 `execute_capability_artifact` 生成并保存 result；客户端不提交可信 result_data。所有旧客户端摘要接口与 H2 没有调用连接。

独立 HTTP 场景对两个新路径均验证：

| 场景 | 实测 |
|---|---|
| owner GET，body 含 `baseline_cvr:0.99` 和 fake evidence | 200；返回 baseline 仍为0.24 |
| POST fake EvidencePack | 405 |
| other user | 404 |
| nonexistent analysis ID | 404 |
| deleted/lookup unavailable | 404 |
| pending / running / failed（即使保留有效 result） | 422 `EVIDENCE_RESULT_UNAVAILABLE` |
| completed + null result | 422 |

物理删除在 `analysis.py:916–934` 调用 `db.delete`；Analysis model 无软删除字段，因此模拟删除表现为 lookup None，未凭空假设 `is_deleted` 规则。旧 source dataset 的现状不参与历史 result evidence 再计算，这是预期边界。

Q1 的 YES 针对 H2 read authority；flagship 强制要求冻结 spec，legacy 明确缺 spec/input versions，不能被此 YES 解释为 legacy 也拥有 H1 provenance。

## 5. Adapter integrity — Q2 NO

Flagship `validate_result:18–86` 的除法、差分、fsum 和排序仅用于 require/close；`adapt_conversion:101–142` 发布的是原 result 字段。没有 raw-row groupby、文件读取、Dataset scan/join、算子重放。Legacy 对 mean/count/percentage 做 aggregate 校验并投影模型 values，也没有读取源数据。

独立12类 persisted mutation 全返回 `RESULT_CONTRACT_INCONSISTENT`，输入 deep-copy 比较保持不变：

- baseline users1000 / converted240 / cvr0.30；没有发布修正后的0.24。
- baseline0.24/current0.188 配 delta−4.0；delta−4.9 与原 mix−2.56/within−2.64。
- mix 改0、channel share改0.99、channel denominator改2000。
- ranking member、value、order、ties、rank、universe 不一致。

但 legacy Top3 反序未被拒绝；adapter 在已有矛盾时重新产生 rank/order 并发布 complete ranking。见 F02。输入对象不被写回不等于没有 silent repair in published evidence。故不能将局部通过推广为全部 adapter 的 Q2 YES。

## 6. Metric / population / grain audit — Q3 NO

`evidence_definitions.py:5–26` 是 server-static MappingProxyType，definition 对象 frozen。未知 metric 在内部 lookup 失败，不会 generic accept；client/LLM 没有注册/改 formula 的入口。实际 registry 共18项：

| Version | Metric IDs |
|---|---|
| 1 | new_customer_count；converted_customer_count；new_customer_cvr；cvr_delta_pp；channel_user_count；channel_share；channel_converted_count；channel_cvr；channel_cvr_delta_pp；conversion_count_delta；mix_effect_pp；within_effect_pp；mix_within_decomposition；input_quality |
| legacy-1 | represented_record_mean；represented_record_count；represented_user_count；allocated_conversion_value |

实际 evidence 的 overall baseline=240/1000=0.24、current=188/1000=0.188，delta−5.2pp。分子、分母、count单位、rate definition随 evidence/summary 传输，不只存在于 registry。Population 传递 entity_key、cohort_field、cohort_values、role、channel、filter_scope、time_window；Grain 传递 user、user_id、row_semantics。Channel share 同样有 channel numerator 和 overall cohort denominator。

时间只明确到 cohort label；H1 未保存 calendar window，H2 `cohort_labels_only_dates_not_recorded` 是诚实表示。Converted numerator 基于 binary flag，不能宣称已验证 paid-first-order；quality flag保留未交叉验证状态。

**身份语义超额仍成立**：H1 `PopulationSpec` 只有 `all_input_users_in_selected_cohorts`，registry display name 为“跨期用户转化诊断”，supported metrics 为通用 user_count/cvr。`ReviewedRequirements` 只审 goals/evidence，并没有新客或注册资格批准字段。H0 的新客样例是 PROPOSED，不是 frozen runtime contract。不能由 demo story 推导任意输入都为新客。

独立 fixture 仅保留四个绑定列，另加全部0的 `new_user_flag`；H1 compile/execute成功，H2依旧发布 `new_customer_cvr`、`new_customer_count`、`registered_user`、`unique_registered_user`。null/new_customer_only与字符串 quality flag没有让这些 typed identities 成为条件性/未验证值；Support/Limitation中没有新客资格未验证的 predicate。F01 为 MAJOR。这里不把未读 `new_user_flag` 当成 H1 新 bug；问题是 H2 将更弱的 H1 合同附加为更强的事实身份。

## 7. 1.03 true metric / unsupported claim — VERIFIED

独立 CSV oracle：每个 user 贡献 `max(1,该user订单行数)` 条 LEFT JOIN记录，合计2054；用户2000；2054/2000=1.027，旧公式保留两位小数为1.03。实际 legacy AttributionService 生成结果与该 oracle一致。

新 Evidence 为 `represented_record_mean@legacy-1`、unit=`records_per_user`，numerator2054、denominator2000，grain=`joined_or_source_input_records`，support_scope **仅** `represented_record_mean`。

`schemas/evidence.py:33–39` 的有限 Literal taxonomy明确不能支持：`complete_customer_journey`、`first_touch_conversion_dominance`、`funnel_bottleneck`、`causal_acquisition_priority`，另含 causal/budget/lift等限制。不是仅自由文本 warning。没有把 joined rows改名为 behavioral touchpoints；未来 H4 可按这些ID deterministic拒绝，但 **H4 verifier尚未存在，不能声称已验证自然语言输出**。

1.03专项通过不能消除 flagship population的F01，因此全局Q3仍NO。

## 8. Legacy fail-closed

保留真实models形状，删除两个新增operand模拟历史result：1.03仍可读取，`numerator.value=null`、`unavailable_reason=not_recorded`；没有乘回2060，也没有猜2054。

Legacy provenance：execution_spec_ref、input version、authoritative fingerprint、normalization refs/hash均明确null；flags含 legacy_limited、legacy_execution_spec_not_recorded、legacy_input_versions_not_recorded。固定legacy operator/adapter ref表达适配合同，不声称复原历史H1规格。

额外raw_rows/深层secret/db_url/sql仅参与内部对象hash或被忽略，未进入pack/summary。空models、未知schema、缺旗舰spec均拒绝。Legacy Top3 order fail-closed例外单列F02，不能将此节理解成所有legacy一致性检查均通过。

## 9. Evidence identity / provenance

`evidence_common.common:28–37`绑定顶层metric definition、population/dimensions、kind及provenance；result version在`evidence_service._provenance:43–44`中对persisted result和可选revision做hash。Pack对整个content做canonical hash，排除produced_at/pack_id/content_hash。

独立重算 JSON sort_keys、固定separators、UTF-8 SHA256，与content_hash一致。重读、completed_at改9天、嵌套dict key反序均保持evidence IDs和pack identity；produced_at实际来自completed_at，否则created_at，不是读取时间。无tzinfo时按UTC附加，未独立审计历史DB时间区解释。

分别改变 execution_spec_id、authoritative fingerprint、normalization policy version、policy definition（strip_whitespace）、result revision、adapter version，pack与全部evidence IDs均改变。Adapter version使用纯内存测试替身改变provenance ref，不修改生产文件。

两个缺口：

1. **F03 MAJOR**：嵌套 `new_customer_cvr` / denominator `new_customer_count` / `channel_share` definition version变化，相关evidence内容改变，**evidence ID不变**。Pack hash确实改变；这个缓解不满足单项evidence identity合同。
2. **F04 MINOR**：dictionary canonicalization不等于collection canonicalization。只反转channel_comparison、ranking collection、quality flags、field_bindings即可改变身份，即使投影facts完全相同。

Canonical order分类：

| 结构 | 实际行为 / 判断 |
|---|---|
| Evidence list | required overall→decomposition→quality，然后channel名字序、ranking metric序；固定选择优先级 |
| Ranked members | 有语义的升/降序；flagship顺序错误应拒绝，不能无条件排序来修复 |
| ranking_universe / ties | 语义上集合；flagship只核对set再原样传递，反序造成pack变动 |
| omissions | 按固定选取序列的Counter first-seen order生成；无外部任意omissions输入 |
| dimensions | 当前adapter只产生0或1个dimension；未声称测试不可达的双dimension排列 |
| provenance input_refs | 第一项是主输入，第二项为base，位置在H1有语义，不能盲目排序 |
| field_bindings / quality flag集合 | 不决定业务计算顺序；没有全面canonical处理，见F04 |
| source frame行顺序 | H1明确作为fingerprint的一部分；改变source行序导致provenance变动是预期，和F04不同 |

## 10. Budget / omissions / semantic atomicity — Q4 YES

`evidence_service:24–29,86–116,123–156`：pack最多32单元/512KiB；summary最多256KiB、ranking最多20成员。先保留required三单元，裁optional排名/渠道比较；required单元仍超预算则明确失败，无随机JSON截断。

独立结果：

| 场景 | 实际结果 |
|---|---|
| MAX_PACK_BYTES=100 | `EVIDENCE_SEMANTIC_UNIT_BUDGET_EXCEEDED` |
| MAX_SUMMARY_BYTES=100 | 同上；未返回孤立0.24或无分母CVR |
| 默认包字节数减100 / 默认摘要字节数减100 | 删除完整optional单元；required comparison/decomposition完全相等；omissions显式 |
| 40 channels | 原47单元→32；required decomposition保留40terms，每项两期denominator=2 |
| 40-channel unit omissions | comparison included30/total41（含overall1，所以channel为29/40）；ranking0/4；transport partial |
| required decomposition自身装不下 | 明确预算错误；未发布少terms却标complete的分解 |
| 30-member legacy ranking→summary | pack仍30，summary20；c00/value30/rank1至c19/value11/rank20；universe30 |
| computation vs transport | ranking computation complete、transport partial；omission20/30、policy global_rank_prefix@1 |

每个ratio的numerator/denominator、比较baseline/current、分解total/mix/within/formula/全terms，以及provenance/support_scope均与所在semantic unit一起保留。Ranking prefix保留完整member entity/value/rank/ties与原全局universe；不会把20条视图变为20条计算总体。

## 11. Top3 / ranking regression

独立从committed用户converted合计得出，first_touch/last_touch/linear三个模型均：

| Rank | Entity | Value | Metric |
|---|---|---:|---|
| 1 | organic | 150 | allocated_conversion_value@legacy-1 |
| 2 | search_ads | 128 | 同上 |
| 3 | social_ads | 64 | 同上 |

新Summary实际有model dimension、entity/value/rank、ranking_metric、universe5、included5/total5、direction和coverage，不只assert len=3。

旗舰四排名独立算术验证：channel_cvr_delta_pp与within_effect_pp最负均为social_ads；conversion_count_delta与mix_effect_pp最负均为organic。分别为−6pp、−2.4pp、−30人、−3pp。不存在无metric ID的main_driver/largest_driver合并。

另用实际旧`safeResultSummary.ts`在Node中转译执行相同aggregate fixture：`summary.model_comparison.top3`仍变成 **"3 items"**，表的truncated甚至为false。该行为是旧路径保留事实，不是H2新projection的回退；本轮不修复旧UI/Hermes。

## 12. Security / no raw rows

独立递归扫描实际flagship/legacy pack和summary，无raw_rows、rows、preview_rows、full result_data、source bytes、路径、DB URL、connection_string、credentials/secret、raw SQL。深层sentinel在legacy extras与params中不会输出。直接把16类敏感key插入深层population，EvidencePack schema全部拒绝。

Evidence Number/Count拒绝True、numeric string、NaN、Inf、−Inf；两类persisted result的数值入口同样拒绝这些样本。不会以Pydantic coercion把"0.24"变为权威值。

独立9类metadata pattern检查覆盖Windows/Unix绝对路径、URI、secret assignment、SELECT/FROM、DROP TABLE、INSERT INTO及敏感字段名。原H2维度fixture测试也重跑通过。**这里只是有限pattern validation；不证明通用DLP、任意PII识别、任何SQL句式或自然语言prompt injection都被解决。**

## 13. Golden independent verification / no hardcode

Expected完全由committed CSV计数与Fraction生成：

```text
baseline = 240 / 1000 = 0.24
current  = 188 / 1000 = 0.188
delta    = -26/5 pp = -5.2 pp
mix      = -64/25 pp = -2.56 pp
within   = -66/25 pp = -2.64 pp
```

五渠道×两期count、converted、rate、share、分母、population角色、definition/units和四类排名均与oracle一致。没有使用H2 adapter产出expected。

全局扫描 `insightease-backend/app` 和 `app/src` 的 social_ads、organic、24.0、18.8、−5.2、−2.56、−2.64、240、188、1000、2054、2000、1.03；未发现demo-specific production分支。匹配仅1000/2000的时间换算、轮询/TTL、sample/preview/文本上限等既有用途；H2 evidence production没有demo数字或渠道硬编码。

## 14. Metamorphic / channel enter-exit

全人口复制并赋新ID：分子480/376、分母2000/2000，quality input/unique/selected都4000；所有channel分子分母×2，rates/delta/mix/within保持不变。

复制previous cohort作为current并赋新ID：delta/mix/within全为0，不因question/business goal出现decline而制造负值。

随机重排行：所有facts（排除identity/provenance）相同，H1 fingerprint与pack改变，符合H1的source row-order policy。

Channel仅一期间出现：直接取H1 pure operator的partial result，overall complete、channels partial、decomposition unavailable；mix/within/residual=null，members为空；两个channel comparisons partial。**这不是一个成功完成full H1 production run的声明**：H1 compiler当前会拒绝缺完整分解的旗舰请求。

## 15. Regression and runtime evidence

| 验证 | 本轮实测 |
|---|---|
| H2 focused | 77 passed，5 warnings，29.47s |
| H1/H1.1 + H2 focused | 187 passed，5 warnings，34.82s |
| Full backend | 313 passed，6 skipped，5 warnings，65.48s |
| Frontend lint | exit0；0 errors，355 warnings |
| Frontend build | 首轮TS5033/EPERM（sandbox禁止写tsbuildinfo）；授权执行重跑exit0，Vite27.87s |
| Independent Python audit | 26 grouped checks：22 PASS，4 FAIL，四项对应F01–F04；非偶然运行异常 |
| Legacy v1 probe | 实际旧函数返回Top3="3 items" |
| git diff --check | PASS（初始与交付前）；新报告另做whitespace检查 |

Backend命令在仓库根，用`.venv\Scripts\python.exe -m pytest -q -rs`；组合文件为`test_capability_execution.py`、`test_execution_integrity.py`、`test_typed_evidence.py`。本轮附加`-p no:cacheprovider`和进程级`PYTHONDONTWRITEBYTECODE=1`避免无关缓存写入，未修改settings或测试。6 skipped是原`INSIGHTEASE_RUN_INTEGRATION` opt-in外部backend测试，未开启。Frontend是原`npm run lint`、`npm run build`；未更新依赖/Browserslist以抹去warning。构建仍提示large chunks和Browserslist数据过旧。

运行证据：ignored `.venv/h2_audit_probe.py`、`.venv/h2-audit-independent.json`；输出副本`h2-audit-independent.json`包含每个check、反例observations、SQL条件、原/新identity及网络尝试计数。配套日志保存在本轮交付的evidence archive。Probe记录完全部检查可正常结束，**exit0代表审计收集完成，JSON的4个FAIL必须读入gate决策**。

## 16. Findings

### H2-A-F01 — MAJOR — Population / grain / metric identity exceeds frozen H1 contract

**File / symbols / lines**：`services/conversion_diagnosis_evidence_adapter.py:89–115`（adapt_conversion/population/observation）；`services/evidence_definitions.py:6–8`；`schemas/evidence.py:73–91`。依据：`schemas/capability.py:62–66,118–125`（PopulationSpec/ReviewedRequirements）、`services/capability_registry.py:26–41`。

**Reproduction**：独立`population_overclaim`：CSV仅保留四绑定列，去掉register_date等业务上下文，增加`new_user_flag=0`；经真实H1compile/execute再build_evidence_pack。

**Expected**：证据身份只能表达已验证selected cohort users；新客/注册口径需存在明确authoritative合同/审阅依据，不能仅借demo样例附加。

**Actual**：2000用户全被纳入；baseline仍0.24；`metric_id=new_customer_cvr`、denominator=new_customer_count、entity_type=registered_user、row_semantics=unique_registered_user。new_customer_only=null；registration_population_assumed是Text质量标记；scope允许population_rate但没有typed新客资格限制。

**Impact**：未来消费者按metric/grain ID生成“新客/注册用户转化率”时，会获得比frozen population更强的事实身份。label="Selected cohort conversion rate"较弱，但label不能修复typed identity矛盾。本轮未运行H4，也不声称实际发生了模型误答。

### H2-A-F02 — MAJOR — Inconsistent legacy Top3 order accepted and silently replaced

**File / symbol / lines**：`services/attribution_evidence_adapter.py:55–75`（adapt_attribution）；producer语义证据：`services/attribution_service.py:287–325`（_normalize_attribution/_generate_summary）。

**Reproduction**：对真实legacy result，反转第一个model_comparison.top3数组，其他model values/percentages不变。Persisted顺序变为social_ads(64)→search_ads(128)→organic(150)。

**Expected**：作为有顺序的Top3，和model值的descending顺序矛盾，应返回`RESULT_CONTRACT_INCONSISTENT`，不能发布一份修正排序作为可信完整ranking。

**Actual**：仅检查member存在、percentage相同、value达到第三名门槛；没有核对Top3次序。随后从models重新排序/赋rank，输出organic150/rank1、search_ads128/rank2、social_ads64/rank3，computation_coverage=complete，未记录矛盾。Input object未修改。

**Impact**：异常persisted artifact被悄然规范成可信输出；“所有ranking inconsistencies都reject”的claim不成立。这不是从source重算CVR，也没有更改allocation values；严重性针对明确要求的adapter fail-closed和published ordering repair，故列MAJOR而非无限扩大为全部计算引擎失效。

### H2-A-F03 — MAJOR — Nested metric definition versions missing from evidence identity

**File / symbol / lines**：`services/evidence_common.py:28–33`（common）；嵌套附加点`conversion_diagnosis_evidence_adapter.py:105–115,133–138`。

**Reproduction**：保持analysis/result/spec/adapter不变，只在测试替身把`new_customer_cvr.version`从1改audit-next；再分别测试new_customer_count、channel_share。通过临时替换ec/ca的静态mapping引用运行，退出自动恢复，无production patch。

**Expected**：使用该定义的语义单元内容版本变化，其evidence ID应变化。

**Actual**：overall comparison和decomposition内rate definition已变，但ID相同；denominator定义变化影响7个单元、share定义变化影响6个单元，相关ID也全部不变。顶层cvr_delta_pp定义变化则正确改变对应ID，形成对照。

**Impact**：同一evidence ID跨定义版本指向不同语义内容，影响引用/caching/replay。Pack hash正确变化是缓解，但不能替代被承诺的evidence级identity。问题不会让旧、新完整pack hash相同；不夸大成客户端伪造漏洞。

### H2-A-F04 — MINOR — Non-semantic array order causes identity churn

**File / symbol / lines**：`services/evidence_service.py:41–58`（_provenance）、`conversion_diagnosis_evidence_adapter.py:139–143`、`capability_input_service.py:22–25`（canonical_hash只sort dict keys）。

**Reproduction**：仅反转persisted channel_comparison、ranking collection、quality_flags，或spec.field_bindings数组，保留数值和frozen fingerprint；另检查universe/ties反序。

**Expected**：无序业务集合应有canonical表示，避免偶然序列化顺序改变事实身份；ranked members这种有序列表仍须按其语义处理。

**Actual**：前四例生成的fact payload完全相同（剔除ID/provenance），pack及evidence身份仍变化。Universe/ties也原样传递，无规范排序。

**Impact**：造成无意义的新artifact引用与cache/replay比对噪声；本轮没有观察到数值/权限/coverage错误，因此MINOR。F04不涉及H1明示的source frame行序fingerprint政策。

所有finding仅记录，未修复。

## 17. Limitations / compatibility / deferred scope

- 未验证实库事务、真实JWT/部署、中间代理GET body行为、对象存储或并发；HTTP结论限真实应用路由加内存DB/auth替身。
- 本轮检查server persisted result的一致性/语义；不重读当前dataset“修正”历史结果，不证明任意DB篡改的密码学真实性。
- Population时间窗口、conversion观察窗、线下追踪完整性与paid first order验证仍缺失；不由demo常量回填。
- 缺历史input version/operand时保留null，不证明可永久重放旧源数据。
- Number strictness、finite taxonomy、pattern过滤是必要约束，不等于通用DLP或自然语言grounding。
- 旧Hermes `result_summary: Dict`只做bounded/forbidden-key校验并可直接发给provider；未连接H2 owned evidence。H2存在不意味着旧Gate2已修复。
- H2 diff无active_result state、conversation_mode、ContextSelector、Claim AST、natural-language verifier、recommendation policy实现；future-ready schema/ref不作为scope creep。

## 18. Final decision

| 一级问题 | YES / NO | 决定性依据 |
|---|---|---|
| Q1 Server-authoritative EvidencePack? | **YES** | 按owner/id读取persisted Analysis；fake body无效、POST405、未知/失败结果拒绝；legacy来源限制显式 |
| Q2 Adapter validation-only, no silent recomputation/repair? | **NO** | Flagship校验通过；F02 legacy排序矛盾被接受并重新发布rank/order |
| Q3 Typed semantic scope sufficient to distinguish true metric from unsupported interpretation? | **NO** | 1.03专项通过；F01仍把未验证selected population赋予new_customer/registered身份 |
| Q4 SummaryV2 preserves semantic units under budget/transport projection? | **YES** | required超预算明确失败，optional整单元裁剪，40terms与30→20 coverage正确 |

**P0D-H2 INDEPENDENT SOURCE AUDIT: FAIL**。H2为FIX REQUIRED；H3继续BLOCKED。需要先针对F01–F03形成后续修复及独立复审证据；本轮不实施修复，也不开始H3/H4。原H1 FINAL FREEZE: PASS及旧Gate2 FAIL/PAUSED历史均保持。
