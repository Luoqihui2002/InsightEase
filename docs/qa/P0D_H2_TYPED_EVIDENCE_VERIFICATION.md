# P0D-H2 — Typed Evidence Verification

日期：2026-09-07。实现方记录；独立源码审计尚未执行。

**P0D-H2 IMPLEMENTATION: READY FOR INDEPENDENT SOURCE AUDIT**

## 1. Git baseline / frozen dependency

- Repo：`C:\Users\cc249\InsightEase`。
- Branch：`codex/v1.0-p0d-e2e-demo-portfolio`。
- 起始 HEAD：`e11b7253821ff213699ca4113a72ba70b7ef0b78`。
- 检查 status、branch、HEAD、log20、完整原 diff、diff --check；提交前重新检查 remote/upstream。
- 旧 AIWorkspace.tsx navigation patch、Gate2 QA、H1/H1.1 audit/re-audit/probe/logs 原样保留，不 staging。
- H1 独立复审明确 FINAL FREEZE: PASS；F01/F02 CLOSED，Q1/Q2/Q3 YES。
- H2 未修改 H1 registry/compiler/ExecutionSpec/normalizer/math，未改 H1/H1.1 的110项测试。

已读三份 H0、H1 implementation/verification、H1.1 verification、原独立审计、新独立复审和
committed GROUND_TRUTH；核对 analysis/capability schemas、执行服务、纯 conversion/legacy attribution、
safeResultSummary.ts/resultSummary.ts/attributionResultAdapter.ts、Hermes explain schema/endpoint/validation、
ResultView 和 AIWorkspace handoff。旧架构提案与当前已实现范围分开。

保护文件初始 SHA-256（交付前复核一致）：

| 文件 | SHA-256 |
|---|---|
| AIWorkspace.tsx | 5AFF69E3F33EEF53E60D3E147C1DE5745246CDF297243F70BEABF8D0AC587989 |
| P0D_FULL_BROWSER_E2E.md | A6D0DE4221332A84E4C91B933F6F0C7057687D091D48F913F14960661C957C9B |
| P0D_H1_INDEPENDENT_SOURCE_AUDIT.md | 9413F8409F21621846CC720EADC4649313688853D510673766DE9D4667ECAD61 |
| P0D_H1_AUDIT_DECISION_REGISTER.md | 3F9C3D509E067462BD21C2F0D2D603A8B253470E03CCA64E20085BA1B3B4F916 |
| P0D_H1_1_INDEPENDENT_REAUDIT.md | 9063F72FEEB6369005719B1E1E585FB3D6DB1DE0DC4D0A98266152B67BD736E8 |
| P0D_H1_1_REAUDIT_DECISION_REGISTER.md | 10D8CEB1D75C625243E609A1F4F98DDEAAE58F72C3DAD2D7FA7E9E1B0697FBBF |

两份 H1.1 re-audit 文档起初未跟踪，本轮保持未跟踪，未混入 H2 提交；不改原 FAIL 历史。
没有 reset/clean/rebase/force push。配置、服务、SSH、云DB和源数据未修改。

## 2. 实现合同与文件

详细 CURRENT/LEGACY/DEFERRED/UNSUPPORTED 见
[H2 Implementation](../architecture/P0D_H2_TYPED_EVIDENCE_IMPLEMENTATION.md)。

变更清单（11个文件）：

```text
A insightease-backend/app/schemas/evidence.py
A insightease-backend/app/services/evidence_definitions.py
A insightease-backend/app/services/evidence_common.py
A insightease-backend/app/services/evidence_service.py
A insightease-backend/app/services/conversion_diagnosis_evidence_adapter.py
A insightease-backend/app/services/attribution_evidence_adapter.py
M insightease-backend/app/services/attribution_service.py
M insightease-backend/app/api/v1/endpoints/analysis.py
A insightease-backend/tests/test_typed_evidence.py
A docs/architecture/P0D_H2_TYPED_EVIDENCE_IMPLEMENTATION.md
A docs/qa/P0D_H2_TYPED_EVIDENCE_VERIFICATION.md
```

Evidence schema 使用 strict finite numeric、extra forbid/frozen、五类 discriminated union；
静态指标定义、静态两个 adapter，未知 contract 明确 unsupported。
population/grain 来自 spec 的字段、双期与已执行 scope，保留不能从 H1 证明的注册人口/日历窗口假设。
每个 RateObservation 与 share 都保留 metric definition、分子、分母及人口；比较不会拆掉 denominator。
provenance 绑定 analysis/result/spec/operator/input/fingerprint/normalization/parameters/adapter 版本或 hash。
support_scope/cannot_support 是有限 taxonomy；没有输出主因叙事或 Claim AST。

新增 GET evidence 与 safe-summary-v2 均先 ownership 查询，从服务器 Analysis 派生，不接受客户端 evidence。
按需生成，不建表、不迁移、不回填历史、不触发 provider 或 operator 重跑。

## 3. Golden / required outputs

`test_golden_population_denominators_channels_decomposition_rankings` 用 committed users；
实际指标由 H1 recipe 生成，expected 使用显式 golden 和独立 pandas groupby。

| Evidence | 验证 |
|---|---|
| Overall baseline | denominator1000 / numerator240 / value0.24 |
| Overall current | denominator1000 / numerator188 / value0.188 |
| Delta | −5.2pp，current−baseline |
| Mix / within | −2.56pp / −2.64pp，formula version1，残差≈0 |
| Channel×period | 5×2 的count/converted/CVR/share均匹配独立 groupby，含share总体分母 |
| Ranking channel_cvr_delta_pp | social_ads 最负 |
| Ranking within_effect_pp | social_ads 最负 |
| Ranking conversion_count_delta | organic 最负 |
| Ranking mix_effect_pp | organic 最负 |
| Grain | unique_registered_user，真实entity字段user_id |
| Optional funnel | not_requested，0 checkout/payment evidence |
| Summary | 12完整单元；四排名×五成员完整；无omissions；JSON schema round-trip通过 |

H2 不引用 GROUND_TRUTH 的叙事来改 H1 公式或排名。within绝对贡献略大与结构性叙事不混同。
用户群范围为已选cohort的全部输入用户；没有发明 new_user_flag 过滤或日历窗口。

## 4. Legacy / Top3 / true metric fixture

用 committed users LEFT JOIN orders 构造真实2054行，调用原 AttributionService。
新结果额外保存 represented_record_count=2054 / represented_user_count=2000；
rounded mean仍为1.03，原公式与舍入不变。

- `support_scope = [represented_record_mean]`。
- cannot_support 明确包含 complete_customer_journey、first_touch_conversion_dominance、
  funnel_bottleneck、causal_acquisition_priority，并保留其他因果/预算/提升限制。
- legacy_limited / descriptive_only，缺少历史spec/input版本明确null，不伪装成H1 flagship。
- SummaryV2中各模型Top3保留 entity/value/rank；实际为 organic150、search_ads128、social_ads64。
- 测试核对实际成员和值以及committed用户转化合计，不能只断言len=3；没有“3 items”。
- 删除新aggregate operands以模拟历史结果：1.03仍可读取，numerator=null/not_recorded，不能推算成2060或2054。

Legacy adapter只信任需要的aggregate字段；内部额外raw_rows、secret、DB地址不输出。
model_comparison中不存在的渠道、错误percentage、非法模型、负值、非finite或mean/count矛盾均拒绝。

## 5. Negative / coverage / budget

16类旗舰内部不一致：CVR、分母、delta、mix、residual、share、渠道项、rank entity/value/order/ties/universe、
coverage、funnel computed、operator、normalization records。全部 RESULT_CONTRACT_INCONSISTENT，输入对象不被修补。
7类 legacy 矛盾测试同样拒绝。

新/消失渠道使用纯H1 operator boundary输出：overall complete、channels partial、decomposition unavailable；
mix/within=null、decomposition members为空，不发布伪造0值。没有放松 H1 compiler 的 required coverage gate。
空模型、未知结果type、缺冻结规格、failed/pending/空结果都不能生成可信证据。

条数预算测试使用40渠道：包32单元，完整required decomposition仍有40项和每项两期分母；
渠道/排名省略明确记录。超过pack/summary字节预算先按优先级删除完整可选单元，
只剩required仍不满足时明确 SEMANTIC_UNIT_BUDGET_EXCEEDED。
不会按JSON深度截断。

30成员legacy排名→摘要20成员：保留c00=30/rank1至c19=11/rank20、完整global universe30；
computation complete / transport partial，omission有20/30与global_rank_prefix@1。
原EvidencePack仍含30成员，证明view裁剪不改authority。
Omission区分pack/summary层；条数与字节不同阶段可分别记录其包含/总数。

## 6. Provenance / metamorphic

- 同一结果与spec重复读取：evidence与content hash稳定；只改变completed_at，produced_at不同但content hash不变。
- 独立重算pack canonical内容hash与content_hash相等。
- 分别更改execution_spec_id、authoritative fingerprint、normalization policy version、归档result version：
  pack身份及evidence IDs改变。
- 随机行序：business facts相同，H1 fingerprint/provenance/hash如实变化。
- 全人口复制并赋新ID：分子/分母×2、CVR/delta/mix/within不变。
- 两期相同：delta/mix/within=0，不因请求措辞创造“下降”。

这些是persisted artifact adapter行为测试，不重新设计 H1 fingerprint，也不声称对任意DB篡改作密码学认证。

## 7. Security / server authority

真实FastAPI路由、response_model、HTTPX ASGI transport；仅DB会话和认证身份使用替身，
服务/adapter/schema/summary真实运行。检查SQL确实带Analysis.id与user_id条件。

| 场景 | 结果 |
|---|---|
| owner GET evidence | 200，严格EvidencePack |
| owner GET summary携带fake evidence body | 数值仍为服务器0.24，body没有参与authority |
| POST fake evidence | 405 |
| 他人analysis ID | 404 |
| deleted Analysis / absent result | 404 / 422 |
| provider callable哨兵 | 未调用 |
| forbidden字段放在深层population | 逐项递归拒绝 |
| NaN/+Inf/−Inf/bool/数字字符串 | numeric字段拒绝 |
| 路径/URI/key assignment/已知SQL/敏感字段名作为dimension值 | 拒绝 |
| legacy结果中raw/secret额外字段 | 显式排除；递归输出扫描无原始行和sentinel |

没有新增接收ResultSummary并信任客户端数值的POST。现有Hermes v1 Dict入口未迁移；
它不因为能接收JSON而获得H2 authority，本轮不调用、不宣称已安全grounded。

## 8. Regression

仓库根设置进程PYTHONPATH=insightease-backend；使用根.venv，未改.env/settings。
先 H2/H1/H1.1 focused，再 full backend；前端 app lint/build。日志为本机ignored `.venv/h2-*.log`。

| 验证 | 最终记录 |
|---|---|
| H2 + H1/H1.1 focused | 187 passed（H2 77 + H1/H1.1 110），5既有warnings，38.59s |
| Backend full | 313 passed / 6 skipped，5既有warnings，41.06s |
| Frontend lint | PASS，0 errors / 355既有warnings |
| Frontend build | PASS，19.44s；既有large chunk warning |
| git diff --check / staged check | PASS（含新文件 staged 检查） |

6项 skipped 仍为需要显式启用运行中backend的transform integration，本轮未启用。
H1/H1.1原110项未改：legacy decline coverage mismatch、unknown capability、grain/fanout、
no silent goal shrinking、注入拒绝、stale input与normalization invariants均保持。

开发过程：首轮修复新测试日期列引用错误；更正新Top3 fixture对第三名的手算错误（CSV合计social64>affiliate54）；
完善summary与pack字节预算的完整单元裁剪，补充回归。没有改旧测试expected换取通过。
前端代码未变，最终仅后端预算调整后重跑专项/full；不重复无关frontend构建。

## 9. Limitations / handoff

- 没有H3上下文状态/活动结果、H4 Claim AST或自然语言verifier；Typed Evidence不等于Verified prose。
- 保留旧frontend/SafeResultSummary v1/ResultView/AIWorkspace/Hermes流程，不声称旧Gate2失败已修复。
- schema/metadata检查不是通用DLP或任意自由文本语义证明；维持bounded元数据边界，不发送raw rows。
- 人口/窗口/追踪完整性沿用H1假设；不凭标签或demo日期补造业务过滤器。
- Legacy旧结果没有输入版本/精确记录总数时仍缺失；新aggregate字段不回写历史。
- 不验证真实云部署、数据库事务或源数据归档；read接口从已授权persisted artifact派生。
- 受预算限制的必需语义单元无法完整承载时返回明确不可用，不伪装完整覆盖。
- 未运行provider/live/browserE2E，没有模型算术、migration或新capability。

最终修复commit SHA在交付消息提供；以上源码与测试交给clean-room auditor独立核对。

**P0D-H2 IMPLEMENTATION: READY FOR INDEPENDENT SOURCE AUDIT**

不是H2最终冻结。停止于H2，等待独立审计，不进入H3。
