# P0D-H0 — Implementation Decision Register

## H1 用户批准修订（2026-09-07，优先于下文历史提案）

H0 总体方向已批准；本次仅批准 H1 实施。下文 CURRENT/OBSERVED 是 H0 审计时点事实，PROPOSED 仍不是实现声明；H1 当前实现另记于 P0D_H1_CAPABILITY_EXECUTION_IMPLEMENTATION.md。

- **D03 APPROVED**：baseline-rate 固定公式；mix=-2.56pp、within=-2.64pp，两者接近，within 绝对值略大，流量结构仍是重要因素。禁止无指标的唯一主因。每项排名必须含 ranking_metric、ranking_universe、direction、coverage；区分 channel_cvr_delta、conversion_count_delta、within_effect_pp、mix_effect_pp。保留原始 generator/真值历史，不改公式迎合叙事。
- **D04 APPROVED WITH MODIFICATION**：conversion_decline_diagnosis@1 必需 cohort CVR、channel CVR、mix/within；funnel 为 conditional optional。缺事件证据允许 core 成功且 optional coverage 不完整，不能发布 checkout/payment/funnel claim。明确要求漏斗环节时，funnel evidence 升为该问题必需；H1 未实现则 unsupported。漏斗不再是 H1 blocker；旧 Gate 2 FAIL 不自动变 PASS。
- **D07 APPROVED WITH MODIFICATION (H4)**：Verified Claims + Bounded Narrative。Claim AST 与 deterministic grounding 校验事实；模型可调整顺序、组织语言、综合已验证 findings。Narrative 不得新增 metric、number、entity、ranking、causal statement 或 unsupported recommendation。H1 不实现解释、Claim AST 或 narrative。


日期：2026-09-07。状态：**H0 已批准（含 D03/D04/D07 修订），仅 H1 已授权实施**。本文件所有未来模块、预算、测试、阶段和验收条件均为 **PROPOSED**。当前实现与历史观测分别见[架构审查](P0D_H0_AGENT_ARCHITECTURE_REVIEW.md)中的 CURRENT / OBSERVED；详细 schema 与上下文生命周期见[合同设计](P0D_H0_CONTRACTS_AND_CONTEXT_ARCHITECTURE.md)。

## 1. 关键决策登记

每项均记录 Problem、Options、Recommended Option、阶段、Open Question。下一表补充每项推荐的 solves / does_not_solve / cost / complexity / V1.0 recommendation，避免只列最佳实践。

| Decision ID | Problem | Options | Recommended Option | V1.0 / V1.1 | Open Question |
|---|---|---|---|---|---|
| D01 | 业务 Agent 合同由谁拥有 | Hermes内部；InsightEase；Hybrid | InsightEase拥有，Hermes为provider/runtime adapter | V1.0；Hybrid只读工具以后评估 | Gateway能否使用可审计且禁业务写工具的固定profile？ |
| D02 | Planner知道字段却不知道执行能力 | 增加prompt说明；静态registry+compiler；动态tool discovery | 静态capability/output/claim合同与compiler | V1.0 | 首批enabled能力只旗舰+诚实legacy wrapper，还是扩大到其他模块？建议前者 |
| D03 | 旗舰如何执行及“主因”怎样定义 | composite固定recipe；Planner自由DAG；继续用pooled attribution | composite，内部算子复用；沿用生成器baseline公式 | V1.0；自由DAG V1.1 | 已批准：mix/within贡献接近、within略大；所有排名显式metric/universe/direction/coverage |
| D04 | 完整Gate要求checkout，但event当前isolated | 无funnel即部分答案；正式引入可验证funnel输入；偷用候选表 | core 必需三项比较/分解；funnel 按问题条件必需 | V1.0完整Gate前 | 保持完整Gate还是单独批准缩小验收？已批准 conditional branch；H1 不因缺 funnel 阻塞 |
| D05 | Join后user grain与行为grain混淆 | 仅警告；自动去重；验证后显式user projection | 一致性验证后投影；行为触点要求独立事件语义 | V1.0 | conversion窗口、缺失与冲突策略由谁确认？默认冲突阻断，不自动取max |
| D06 | 结果摘要丢Top3且无分母 | 扩大通用摘要；raw result；typed server evidence | 有版本EvidencePack，保留完整支持单元 | V1.0 | 先支持哪些输出adapter？建议旗舰+legacy归因，不宣称全部模块已迁移 |
| D07 | LLM结论看似合理但越界 | strict prompt；第二LLM；Verified Claims + Bounded Narrative | 有限claim taxonomy、grounding验证事实，受限叙事组织已验证findings | V1.0 | 已批准 Verified Claims + Bounded Narrative，H4 实施 |
| D08 | Handoff/state失效 | 修若干effect；前端reducer持久化；服务端单一session+CAS | backend权威，frontend发命令/展示，取消双结果权威 | V1.0 | 多设备恢复是否必须？方案支持ID恢复，不迁移所有旧聊天 |
| D09 | Context越积越多且过期 | 全量history；按关键词裁剪；按mode/artifact依赖选择 | L0–L7选择器+版本+预算+卸载 | V1.0 | Gateway实际overhead无法计量时接受声明estimated还是阻断上线？建议上线前可计量 |
| D10 | 确认可被future tool绕过 | 前端bool；服务端批准绑定；复杂审批平台 | 批准记录+hash/version+幂等，无审批平台 | V1.0 | 关系localStorage迁移需逐条用户再确认还是批量导入待审？建议导入待审 |
| D11 | 审计与敏感信息保留冲突 | 全部原文日志；只存hash；受控bundle分层保存 | 红线日志不含原文，私有脱敏bundle+明确保留期 | V1.0 | 默认30天、删除策略、谁可查看bundle，需用户决定 |
| D12 | provider慢、失败与fallback不透明 | 加长timeout；bounded retry+deadline；model router | 一次协调器、最多2attempt、明确fallback原因 | V1.0；router V1.1 | 时延预算150s/90s是否符合演示体验？是初始上限不是SLA |
| D13 | 信息不足被当错误或被迫硬答 | 强答；统一error；正式insufficient_evidence | 区分计算状态/答案状态/provider状态 | V1.0 | 部分回答如何计入Gate？不能替代完整问题通过 |
| D14 | 是否引入critic Agent | 无；附加启发式；LLM作为最终validator | V1无critic；未来启发式不能覆盖deterministic reject | V1.1可评估 | 是否有真实错误集证明额外收益大于成本？ |
| D15 | 通用归因Skill尚未完成 | 立即依赖；新建通用框架；保留稳定接口候选 | InsightEase自足，定义可比较context抽象 | V1.0接口；集成后置 | 另一个Skill的schema/version/权限模型，当前未知 |
| D16 | UI成功与业务成功混为一谈 | 维持绿色成功；单一confidence；分离computed/grounded/coverage | 三状态与evidence引用、active artifact提示 | V1.0行为需求 | 业务用户能理解的术语要后续审阅，本轮不设计样式 |
| D17 | 如何验证而不把demo写死 | 只重跑demo；golden+metamorphic+negative+liveE2E | 分层测试，真实事实/错误结论必须fail | V1.0 | live样本次数与token费用上限后续批准；不在本轮调用 |

### 1.1 推荐的成本与能力边界

成本是相对工程量估计，未经排期；L低/M中/H高，不是人日承诺。

| ID | solves | does_not_solve | cost | complexity | V1.0 recommendation |
|---|---|---|---|---|---|
| D01 | 权限/版本/审计归属清楚、便于替换provider | Gateway内部工具隔离自动成立 | M | M，adapter与runtime配置分开 | 采用B，业务写工具不下放 |
| D02 | 计划输出覆盖可验证、禁止未实现能力 | 任意自然语言需求理解总是正确 | M | M，有限目录与编译规则 | 必须，明确口径审阅仍存在 |
| D03 | 固定问题可执行与可复算 | 任意分析组合、因果归因 | M–H | 固定流程M，自由DAG H | 固定recipe优先，内部算子不直接暴露 |
| D04 | checkout诊断有真实事件依据 | 缺失追踪补全、支付故障因果证明 | M | M，额外数据口径和条件分支 | 仅问题明确要求 funnel 时作为必需证据；H1 core 独立验收 |
| D05 | 防止fanout污染分母/触点语义 | 自动判断所有业务定义 | M | M，精确数据检查 | 必须，不能仅靠提示框 |
| D06 | 信息完整而有界；保留来源/分母 | 数据本身真实、无限结果压缩 | M | M，逐输出contract adapter | 必须；不增加raw通道 |
| D07 | 引用/数值/受支持谓词可确定性校验 | 任意自由prose逻辑蕴含、零幻觉 | M–H | 有限模板M，通用语义H | 有限版本必须；自由文本不直接verified |
| D08 | 结果绑定原子性、stale响应隔离 | 数据pipeline长期工作流可靠性 | M | 单record+CAS M；完整event sourcing不需 | 必须，不建重型状态平台 |
| D09 | 信息优先级、过期卸载、可审计budget | 隐藏Gateway上下文自动透明 | M | M，按版本cache与必需依赖 | 必须，实际token与估算分开 |
| D10 | 确认与具体参数绑定、重复请求不重复写 | 合同内容正确、完全消除存储失败 | M | M，现有DB即可 | 必须，现有写API旁路需审查 |
| D11 | 解释为什么得出结论、可复验 | 已删除原文的完全复算 | L–M | M，私有artifact与权限 | 必须；不建全量日志湖 |
| D12 | 暂态失败可控、成本和延迟可计量 | 模型质量保证、能力缺口 | M | M，无模型选择器 | 必须；自动重试共享次数上限 |
| D13 | 证据不足可被正常表达 | 满足原本缺失的业务目标 | L | L，typed state | 必须；不得将abstention当技术故障 |
| D14 | 未来发现部分遗漏 | 事实权威、独立安全证明 | H运行成本 | 额外LLM状态与不一致处理H | 现在不建 |
| D15 | 未来复用接口可对齐 | 另一个项目立即可用 | L | 先接口低，框架高 | 不依赖外部未完成Skill |
| D16 | 用户看清当前上下文与证据范围 | 分析计算和事实校验本身 | M | M，既有页面适配 | 要行为合同，本轮零UI修改 |
| D17 | 可量化合同错误与回归 | 有限样本证明全局成功率 | M | 分层M，组合爆炸需范围限制 | 必须，负例权重高于单次演示 |

## 2. 用户需决定的事项

D01–D05 总体方向及本文件顶部 D03/D04/D07 修订已由用户批准，H1 已单独授权。以下原问题保留为历史决策背景；不要求重复确认，也不授权自动实施 H2–H6。

1. **架构与范围（D01–D03）**：是否批准 InsightEase 拥有合同、一个固定旗舰诊断 capability 的方案？推荐批准该方向，另行启动H1。
2. **“主因”与排名口径（D03）**：保留demo现有真值，明确 numerical contribution ranking 与结构性叙事分别验收；不能要求“mix数值绝对最大”因为现有真值不是这样。推荐在H1冻结每个排名metric及措辞。
3. **Funnel 条件分支（D04，已批准）**：H1 core为cohort/channel/decomposition，缺funnel不阻塞H1；问题明确要求漏斗时才成为该问题required evidence。旧Gate2仍FAIL。
4. **表达自由度（D07，已批准，H4实施）**：Verified Claims + Bounded Narrative；允许表达顺序、语言组织、已验证findings synthesis，禁止新增指标/数字/实体/排名/因果/无支持建议。
5. **状态迁移与审计（D08/D10/D11）**：推荐后端会话/批准记录、旧关系导入待审；需要决定私有审计保留期与访问权限。不会因本轮设计擅自迁移数据库。
6. **可靠性预算（D09/D12/D17）**：确认后续可接受时延、实测样本与费用上限，再执行provider smoke。当前的样例预算全部是拟议值。

## 3. H1–H6 实施路线

下面的新增文件名都是候选模块边界，可在阶段设计审阅后调整；不是当前已存在的模块。阶段完成须独立审阅，不自动继续下一阶段。

| 阶段 | Goal / deliverables | 影响文件与模块 | Dependencies | Migration risk | Tests | Acceptance criteria |
|---|---|---|---|---|---|---|
| **H1 Capability & Execution** | 冻结业务口径；静态registry；Plan v2 compiler；旗舰固定recipe；legacy attribution诚实声明；user grain验证 | 现有 `schemas/assistant.py`, `hermes_validation_service.py`, `endpoints/analysis.py`, `attribution_service.py`, `path_analysis_service.py`；拟新增 `schemas/capability.py`, `services/capability_registry.py`, `services/conversion_diagnosis_service.py` | 用户批准D01–D05；确认真实period与rank语义 | 新analysis_type和params版本；旧分析保持只读legacy；不能拿legacy结果冒充v2；必要funnel输入需单独批准 | 能力输出覆盖、未知operator拒绝、粒度冲突、分母0、空cohort、新/消失channel、日期窗口、实际demo以及变形数据 | 没有capability时正式unsupported；不能将pooled attribution编译成decline diagnosis；新operator恒等式与golden一致；未确认关系不可执行 |
| **H2 Typed Evidence** | 服务端output adapter、EvidencePack、不可分支持单元；legacy摘要兼容视图 | 现有 `models/models.py`, `schemas/analysis.py`, `safeResultSummary.ts`, `types/resultSummary.ts`, `adapters/attributionResultAdapter.ts`；拟新增 `schemas/evidence.py`, `services/evidence_service.py` | H1 output contract冻结 | 新增结果/evidence版本存储；不回填伪造provenance；旧结果标legacy/no_grounding；敏感字段保留策略 | golden evidence、Top3不丢、无raw keys、单元/分母/coverage、输入hash、重算一致 | 5渠道×2期证据可完整表达；support_scope/cannot_support、人口和版本齐全；当前旧1.03只能标represented records |
| **H3 Context / State / Routing** | 后端session+CAS、atomic handoff、ContextSelector、hydrate/unload；批准绑定与幂等接入 | 现有 `AIWorkspace.tsx`, `AIWorkbenchContextPanel.tsx`, `aiWorkbenchHandoff.ts`, `prefillNavigation.ts`, `useAssistantContext.ts`, `endpoints/join.py`, `schemas/join.py`, `endpoints/analysis.py`；拟新增 `schemas/agent_session.py`, `services/context_service.py`, `services/approval_service.py` | H1/H2 artifacts/versions；D08–D11批准 | 关系组localStorage导入待审；旧snapshot按ID重新hydrate；不能共享账号缓存；DB变更须单独审批 | 新会话/刷新/切结果、双tab CAS、late response、撤权、approval stale、doubleclick幂等、手动run | 点击handoff后active_result与mode原子一致；同样问题无需加解释关键词；未hydrate不可回落planning；创建/运行不绕过人工动作 |
| **H4 Explanation & Grounding** | 严格candidate schema、claim AST、服务器verifier、可信renderer、abstention | 现有 `schemas/hermes.py`, `hermes_live_service.py`, `hermes_validation_service.py`, `resultFollowupResponder.ts`, `AIWorkspace.tsx`；拟新增 `schemas/explanation.py`, `services/grounding_service.py` | H2证据/H3活动上下文；D07表达决策 | 旧free-text不自动升级verified；malformed JSON拒绝发布；输出类型变更影响UI | 数值/单位/实体/ref mismatch、不能支持的因果、推荐证据门槛、1.03真数假结论、fence/malformed | 所有发布finding都有有效ref及scope；invalid output不fallback=false冒充可信；三类不足/技术失败/数据错误区分 |
| **H5 Reliability & Observability** | 单一deadline/attempt budget、fallback原因、breaker、trace/replay、隐私规则；核实Gatewayprofile | 现有 `hermes_live_service.py`, `endpoints/hermes.py`, `api/assistant.ts`, `useHermesStatus.ts`；拟新增 `services/agent_trace_service.py`, `services/provider_call_policy.py`，受控artifact存储 | H1–H4版本与错误码；D09/D11/D12 | 防止双层retry翻倍；日志脱敏；provider输出有TTL；Gateway配置变更需单独授权 | fake-clock retry/deadline、HTTP错误分类、取消late结果、跨版本replay、脱敏、budget overflow | 最多2attempt且共享总预算；无重复写；能够从bundle复验已发布结论；明确actual/estimated token；不建router |
| **H6 Re-run Gate 1 + Gate 2** | 在已批准合同上重新验收，不用旧PASS替代新验证 | QA文档、fixtures、真实浏览器现有流程；不在该阶段夹带新能力 | H1–H5达到acceptance；手动确认与费用授权；澄清D03/D04 | 数据fixture状态隔离，重复流程不污染旧数据；不要删除用户数据 | 全部离线合同测试+provider smoke+完整UI与fresh repeat | 真实计划选对capability、执行/证据/解释grounding通过；独立pandas和既有真值匹配；明确人工create/run；完整截图与第二轮通过；如不足/错结论则FAIL |

建议在H1前冻结具体AcceptanceSpec，尤其 distinction：`capability supported`、`execution preconditions satisfied`、`evidence coverage complete`、`grounding verified`。自然语言问题的真实意图仍需用户确认，不能声称形式化compiler“绝不会误解任何业务问题”；它能保证的是已确认类型化目标的覆盖。

## 4. 完整测试策略（只设计，未运行）

### 4.1 分层用例与可观测断言

| 类别 | Fixture / action | 必须断言 |
|---|---|---|
| Schema contract | 未知字段、错误类型、NaN、超界数组、malformed JSON、fence包装 | 严格拒绝；合法fence仅按明确adapter规则去包装；绝不转换为自由answer |
| Capability contract | 正确字段但goal=decline、capability=pooled attribution | 编译拒绝/unsupported；不自动降级goal |
| Tool permission | 模型提交run/create/approve/source mutation；伪造批准/过期preview | provider角色无法批准/写入；401/403/409结构化；无副作用 |
| Golden evidence | 当前demo固定CSV和generator公式 | users去重、240/1000、188/1000、-5.2pp、-2.56/-2.64pp、渠道率/排名、funnel53.3→33.3；不使用模型当oracle |
| Planner selection | 多种措辞、不同数据集名、缺conversion、仅有marketing触点 | 选受支持capability或澄清；缺能力正式unsupported |
| Hallucinated fields/metrics | 未知column、metric_id、dataset、channel；候选表冒充必需 | 引用/owner/subset gate拒绝，不污染后续状态 |
| Claim/evidence mismatch | 正确ID错误值、fraction冒充pp、换baseline/current、Top3冒充全集 | grounding拒绝，相关摘要和推荐均不发布 |
| Unsupported causal | social CVR下降→广告降低质量 | 保留比较事实，因果claim阻断，正式说明缺证据 |
| Context stale | 切result时provider未结束；dataset/关系版本更改；撤权 | old response不能进入新会话；版本失效需rehydrate/重审 |
| Context lifecycle | new conversation、refresh、close/open、switch history、cache miss | mode+active refs一致；不继承旧attached；refresh不自动run |
| State transition | 结果页handoff；未approved直接execute；高风险确认取消 | 正确mode；禁止非法边；无自动执行；ack可查 |
| Replay | 固定bundle重放validator；原result已删除；schema升级 | 同版本结果一致；缺失时limited/unsupported_version，不静默用最新版 |
| Provider reliability | 429、503、401、schema fail、长超时、第二次失败 | retry次数≤2，总deadline受限，明确reason；不跨provider偷偷fallback |
| Privacy | 恶意metadata带指令、敏感key/值、provider异常回显 | 文本保持低信任；无DB路径/密钥/raw rows进入trace或prompt；最终动作仍受gate |
| Full E2E | 规划→预览→人工创建→人工分析→ResultView→handoff→三问→fresh repeat | 完整业务答案、claim evidence对应、无stale泄漏、每次确认仅一个派生物 |

测试 oracle 必须分层：计算以独立 pandas/已冻结公式；schema以合同；权限以记录数/副作用；语义以有限 predicate/scope；完整业务方向以经审阅的AcceptanceSpec。不得让同一个production function同时产出expected与actual。

### 4.2 不把 demo 写死的变形用例

- 任意重排输入行，cohort/channel统计不变。
- 增加第二笔订单，registered users denominator 和 converted users不变；represented row mean可变，behavioral claim权限不变。
- 一用户有互相冲突的cohort/converted：阻断，不“最后一条获胜”。
- 所有用户等比例复制并赋新user ID：计数随倍数变化，CVR/pp分解不变。
- 渠道改名或新增unknown类：按实际枚举处理，不能硬编码social_ads为最差。
- 两期相同：delta/mix/within为零；不能因用户问题说“下降”就输出下降。
- 真实改善或主要变化来自另一个渠道：方向和rank正确；不固定复述demo故事。
- 一个cohort为空、分母0、渠道仅一期出现、事件缺失/乱序：部分结果与错误状态遵循合同；不补0造结论。
- 从低转化渠道转移到高转化渠道：mix方向正确；公式恒等式保留未舍入精度。

### 4.3 True Metric / Unsupported Claim 必测 fixture

```yaml
fixture_id: true_metric_unsupported_first_touch
input_evidence:
  evidence_id: ev_represented_records_mean
  metric_id: represented_record_mean
  value: 1.03
  unit: records_per_user
  source_semantics: registration_channel_repeated_by_order_join
  support_scope: [represented_record_mean]
  cannot_support: [first_touch_conversion_dominance, complete_journey, funnel_priority]
candidate:
  claim_type: interpretation
  predicate: first_touch_conversion_dominance
  evidence_refs: [ev_represented_records_mean]
  attempted_text: 大多数用户第一次触达就转化，因此应优先优化首触
expected_verifier:
  decision: reject_claim
  error: CLAIM_SCOPE_VIOLATION
  invalidate_recommendations_using_claim: true
expected_user_facing:
  answer_status: insufficient_evidence
  supported_fact: 当前关联结果平均每位用户有1.03条记录
  limitation: 订单关联记录数不能证明完整触达路径或首触转化占比
  next_step: 审阅真实事件或触达数据及其追踪范围
```

同时测试只引用真实metric但将predicate伪装成observation、在executive_summary自由文本塞相同结论、在recommended_actions塞“砍预算”、在label中藏因果措辞。V1可信模板不渲染这些未验证自由文本；不能只拒绝一个显眼谓词而放过其他字段。

### 4.4 Unsupported question fixture

输入：social_ads 的CVR 16%→10%，只有双期比较，没有实验或用户质量指标。问题：“social ads 是不是导致用户质量变差？”

期望：verified observation仅陈述该观察人口下CVR下降；causal claim=unsupported。说明可能涉及人口结构、追踪、产品/渠道等未验证因素，但不把任一候选当事实；建议补独立质量指标、完整协变量和适当实验/识别设计。不能回答“是”，也不能让low confidence为因果断言开通道。

### 4.5 后续验收样本建议

离线 deterministic regression 先全通过，再做一个有费用上限的小型provider矩阵（建议至少10个不同输入问题，每个记录第一次结果；只按政策允许一次重试）。这是最低开发样本，不提供统计意义的高可靠性SLA。记录首次schema通过、编译通过、grounding通过、正确abstention、重试成功、fallback以及完整deadline；不能只展示最佳一次。

真实Gateway full flow维持原prompt要求：先完整首轮PASS才fresh-state重复；两轮均记录人工create/run和独立结果核对。若callback/metadata权威状态、真值语义、funnel coverage未满足，禁止进入“为了截屏而重跑”。

## 5. 迁移与发布边界

1. 保留 legacy AnalysisPlan/SafeResultSummary 的读路径；新版本严禁用旧字段自动伪造 evidence provenance。legacy数据显示“旧结果/未验证业务语义”，仍可看完整结果。
2. 旧Relationship Set导入为待审snapshot；客户端过去的confirmed字样不是服务端用户批准记录。后续用户确认才生成新的authoritative revision。
3. 新approval/state/evidence schema采用增量表/字段；数据库变更须在未来阶段审阅具体迁移。本轮无迁移执行。
4. 先把一个capability闭环做稳，registry其他项可catalogued但disabled/legacy_limited，不让UI有入口就等同能满足任意分析目标。
5. 回滚时停止新版本执行，保留已完成artifact及bundle；不能删除用户数据。旧UI不得把新unsupported状态展示为普通成功。
6. Gate 2依旧FAIL/暂停；H0完成仅表示决策材料完整，不能转成产品release pass。portfolio和V1.0 release decision等待H6。

## 6. H0 交付核对

| 用户prompt主题 | 文档定位 |
|---|---|
| 真实实现、Gate1/2现象、六类根因、职责、风险模型 | Review §1–5、§8 |
| Capability、A/B、execution、tools、批准、Hermes A/B/C | Contracts §2–4；Review §6–7；D01–D05/D10 |
| Typed Evidence、真数假结论、推荐/因果、verifier、abstention | Contracts §5–6；本文件§4.3–4.4 |
| Context scopes、L0–L7、budget、freshness、卸载与通用Skill | Contracts §7；D08–D09/D15 |
| 状态机、模式权威、刷新/会话/切结果、routing priority | Contracts §8 |
| Reliability、critic/router、trace/replay与隐私 | Contracts §9；Review §8；D11–D14 |
| V1.0最小范围、不能现在做、H1–H6、UI影响 | Review §9；本文件§1–3、§5 |
| 每项trade-off、待用户决策、完整测试策略 | 本文件§1.1–4 |
| 2–3分钟面试解释及六个追问 | Review §10 |

本轮只形成3份设计文档。没有执行上述测试，没有开始H1，没有改prompt跑模型，没有浏览器验收，没有commit/push。原有本地导航修改与Gate 2 QA保持。

**P0D-H0 ARCHITECTURE REVIEW COMPLETE**
**IMPLEMENTATION NOT STARTED**
