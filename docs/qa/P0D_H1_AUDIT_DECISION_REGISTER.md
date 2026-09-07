# P0D-H1-A — Audit Decision Register

日期：2026-09-07；被审计 HEAD：`14a116ee0161003cab67ba7697c00e86e62d056a`。

**最终：P0D-H1 INDEPENDENT SOURCE AUDIT: FAIL**。

Claim 来源为 `P0D_H1_CAPABILITY_EXECUTION_VERIFICATION.md` 和 `P0D_H1_CAPABILITY_EXECUTION_IMPLEMENTATION.md`；来源文档不作为事实 oracle。完整 call graph、复现与局限见 [独立源码审计](P0D_H1_INDEPENDENT_SOURCE_AUDIT.md)。

状态约定：VERIFIED=当前源码与本轮证据支持；PARTIALLY VERIFIED=仅在明确子范围成立；NOT VERIFIED=本轮无足够证据；CONTRADICTED=有直接反例。Severity `—` 表示该项未发现问题，不代表整个 H1 通过。

路径缩写：`C`=backend `services/capability_compiler.py`，`B`=`services/capability_execution_service.py`，`R`=`services/capability_registry.py`，`D`=`services/conversion_diagnosis_service.py`，`S`=`schemas/capability.py`，`A`=`api/v1/endpoints/analysis.py`。这些路径均位于 `insightease-backend/app/`。

证据缩写：`T`=`insightease-backend/tests/test_capability_execution.py`（52项通过）；`I`=独立 ignored `.venv/h1_audit_probe.py` 及 `.venv/h1-audit-independent.json`。I 从 stdlib CSV/Fraction 独立计算 golden，不复用 T helper 或生产 oracle。

## Claim decisions

| ID | Worker claim / 待核验命题 | Status | Source file / symbol | Runtime / test evidence | Severity |
|---|---|---|---|---|---|
| C01 | H0 docs 与 H1 implementation 分开，旧导航不属于 H1 | VERIFIED | git show 267aba8 / 14a116e；parents；production diff | H0仅3文档；H1共9文件无frontend；旧导航初末hash一致 | — |
| C02 | Worker 当时的起始操作、push及云环境完全未改变 | NOT VERIFIED | 历史 verification §1 | 当前git可验证提交关系/文件；不能仅凭文档证明原执行过程或远端当时状态 | —（历史证据边界） |
| C03 | Registry 静态、只读、versioned | VERIFIED | R:6–55，S Contract | T test_static_registry_is_small_frozen_and_legacy_honest；无动态注册调用者 | — |
| C04 | 只有旗舰enabled、legacy_limited目录，不自动支持全部旧模块 | VERIFIED | R _flagship/_legacy/CAPABILITIES；C:61–62 | 实际2条，disabled/catalogued=0；legacy不产spec | — |
| C05 | capability定义有goals/roles/grain/output/operator/限制 | VERIFIED | S CapabilityContract；R:21–53 | 实际字段与服务端常量读取；id/version精确查询 | — |
| C06 | Legacy诚实声明 represented record、缺转换/last bool/默认值 | VERIFIED | R:38–53；attribution_service._build_user_journeys:123–154 | 旧数学源码匹配；不是behavioral touchpoints；没有H1 wrapper | — |
| C07 | CandidatePlanV2必需字段、extra forbid、无可执行权限字段 | VERIFIED | S:22–23,104–131 | T schema/required role tests；I candidate 9类注入全部reject | — |
| C08 | Typed reviewed goals独立于candidate，补齐必需evidence | VERIFIED | C compile_candidate:49–60 | T shrink/funnel/causal/output negatives；无silent shrinking | — |
| C09 | 全字段合法但 legacy decline 必须 coverage mismatch | VERIFIED | C:46–62；R输出合同 | I legacy_all_roles_and_output_valid：legacy三角色、grain、expected output都合法，仍mismatch | — |
| C10 | 未知capability/version拒绝，无default/best effort | VERIFIED | C:46–48 | I causal_marketing_optimizer@999 → UNKNOWN_CAPABILITY | — |
| C11 | H1 compile是生产必经，非说明性schema/tests | VERIFIED | A:34–41,105–113,747–750；B prepare/execute；C execute_frozen | I真实create→BackgroundTasks→dispatcher→result；两次执行gate均到compiler | — |
| C12 | Backend reads current owned Dataset + persisted lineage | VERIFIED | B _owned:29–36/load_authoritative_input:39–72 | T owner/404；I真实adapter + reader、内存DB查询owner谓词、storage读轨迹 | — |
| C13 | 冻结spec包含cap/operator/input versions/bindings/population/comparison/output/plan/metadata/params | VERIFIED | S ExecutionSpec；C:103–116 | I实际生成/篡改spec；T roundtrip及嵌套frozen | — |
| C14 | 所有metadata/input指纹足以阻断stale执行 | CONTRADICTED | B:42–70；C:104–110 | I derived_base_metadata、derived_derived_transform_chain：变化后spec相等且completed | **BLOCKER F01** |
| C15 | context_version=null，H3 session/approval/idempotency deferred | VERIFIED | S:154；B RunParams；H1 implementation deferred声明 | 未要求不存在的H3字段；不把expected ID当审批签名 | — |
| C16 | create recompile，expected ID mismatch409且早于写入 | VERIFIED | B:92–108；A:747–778 | I expected_id/modified_candidate各409，add/commit/schedule=0 | — |
| C17 | 客户端不能提交server execution_spec | VERIFIED | B CapabilityRunParams/prepare | I params9类拒绝；真实create注入spec422、0写入 | — |
| C18 | Background读取、重编译、比较完整spec | VERIFIED | B execute_capability_artifact；C execute_frozen；A:103–113 | I source/derived读轨迹与正常完成；不是只信create时客户端状态 | — |
| C19 | 排队后相关变化全部failed/stale | CONTRADICTED | 同C14/C18 | frame/schema/JoinPlan受覆盖的变化正确fail；base schema/derived transform_chain错误完成 | **BLOCKER F01** |
| C20 | Client不能修改operator/formula/SQL/Python/module path | VERIFIED | S Contract/OperatorParameters；C:125–127 | I candidate/params18类reject、顶层9类ignore、spec9类篡改reject | — |
| C21 | H1不会静默调用旧manual attribution | VERIFIED | C生命周期/coverage；A旗舰分支return；Hermes endpoint规划函数 | 调用者检索；legacy没有进入H1适配器的fallback；NO BYPASS FOUND，限定H1路径 | — |
| C22 | 旧浏览器仍是P0B advisory，未接H1新Planner/API | VERIFIED | AnalysisPlanCard:98–116；Attribution:295–340,475；toolRegistry | 仅导航预填+人工按钮；app/src无H1 preflight调用；不能宣称整个UI已迁移 | —（已披露限制） |
| C23 | 旗舰无provider参与、fixed baseline recipe | VERIFIED | D imports及77–87；R CORE_OPERATOR；S OperatorParameters | I运行时连接guard；独立Fraction oracle；0 LLM参与 | — |
| C24 | unique_user源表必须唯一；detail先一致性校验后投影 | VERIFIED | D project_users:21–52 | T重复entity；I三个冲突分别data_invalid；drop_duplicates前已经nunique拒绝 | — |
| C25 | Saved LEFT Join必须base来源且完整人口相同 | VERIFIED | B:50–69；C:88–97 | I真实derived链正常；T缺base用户/来源、base属性变化、INNER Join阻断 | —（F01另列） |
| C26 | fanout不改变分母/分子/归属 | VERIFIED | D project_users/diagnose_conversion | I 2054行2000users；每期1000、240/188；extra order→2055行结果不变 | — |
| C27 | bool与数值0/1合法，null/2/-1/Inf非法 | VERIFIED | D:36–45 | I直接DataFrame负例全部拒绝；bool golden通过 | — |
| C28 | 字符串true/1在生产输入不能被接受 | PARTIALLY VERIFIED | D:42–45；dataset_io_service:25–44 | DataFrame拒绝；I真实xlsx文本cell s→bool/int64→COMPILED | **MAJOR F02** |
| C29 | 两期显式、不同、非空，current_month无alias | VERIFIED | S ComparisonSpec；D:57–63 | I同一期/别名/缺前期/缺后期/全空均结构化失败；标签实际是Name非固定Literal | — |
| C30 | 整体 golden −5.2/−2.56/−2.64pp及5×2渠道指标正确 | VERIFIED | D:63–88；T golden:59–79 | I stdlib CSV/Fraction exact oracle、所有channels counts/CVR/share/分项匹配；residual≈−4.44e−16pp | — |
| C31 | 新/消失渠道整体保留、分解unavailable、不编译完整旗舰 | VERIFIED | D:73–107；C:101–102 | I enter/exit整体相等、partial、unavailable、compiler拒绝；计数ranking仍complete有明确指标语义 | — |
| C32 | ranking有metric/universe/direction/coverage/rank/ties，无main_driver | VERIFIED | S Ranking；D:90–101 | I独立search_ads恶化fixture改变最差渠道；相同期全部并列；原demo按metric区分social/organic | — |
| C33 | 四项主要metamorphic invariants | VERIFIED | D固定recipe；T metamorphic | I独立seed983重排、真实额外order、clone新IDs、identical periods均通过 | — |
| C34 | channel rename不影响数学 | VERIFIED | D按实际channel排序/统计 | T test_channel_rename_preserves_math通过；源码无channel special-case | — |
| C35 | 生产无demo hardcode | VERIFIED | backend/app + app/src全局扫描 | 日志仅1000用于TTL/轮询/limit等；无social_ads或目标数字分支；I换最差渠道 | — |
| C36 | Golden测试expected独立，不是自身oracle | VERIFIED | T:59–79及run/business helpers | 整体显式常量、渠道独立pandas groupby；metamorphic双调用用于不变量，不冒充golden | — |
| C37 | H1 focused52、backend178/6skip、lint/build通过 | VERIFIED | 当前测试及app package脚本 | 本轮52passed；178passed/6skipped；lint0errors/355warnings；build通过 | — |
| C38 | Worker原始5warnings/具体耗时可作为本轮结果 | PARTIALLY VERIFIED | verification regression表 vs 本轮日志 | 本轮6warnings（增加cache权限warning）；耗时重新记录，不复制旧数字 | — |
| C39 | funnel/paid first order/DAG/H2–H6不在H1实现 | VERIFIED | R limitations；C:68–70；D optional branches；S context | T optional role/funnel拒绝；源码明确边界；本轮未实施后续阶段 | — |
| C40 | P0D-H1 CAPABILITY & EXECUTION GATE PASS 可接受 | CONTRADICTED | F01/F02源码与独立runtime证据 | 测试全绿不能抵消stale错误完成与reader contract缺口 | **FAIL** |

## Finding register

| ID | Severity | Expected | Actual | Impact / disposition |
|---|---|---|---|---|
| F01 | BLOCKER | 已冻结base metadata或derived lineage变化后reject旧spec | base schema dtype变化、derived transform_chain非空，两例spec仍相同且后台completed | Q2不能成立；记录未修复，需实现方处理后独立复审 |
| F02 | MAJOR | Excel conversion文本true/1应按声明data_invalid | 文本cell s被reader转bool/int64，preflight COMPILED | DataFrame负例不能证明实际生产输入合同；记录未修复 |

## Final questions

| 问题 | 回答 | 范围/理由 |
|---|---|---|
| Q1 Registry + Compiler为H1 Agent execution authority？ | **YES** | 新typed backend链必经compiler；旧browser仍advisory，不宣称已迁移 |
| Q2 Frozen ExecutionSpec不能被注入、stale或legacy路径绕过？ | **NO** | 注入/legacy未找到旁路，但F01提供明确stale旧spec执行反例 |
| Q3 无LLM、正确unique-user grain、结果独立可复算？ | **YES** | 合法输入golden、fanout、四项独立变形通过；F02另记输入合同缺陷 |

**P0D-H1 INDEPENDENT SOURCE AUDIT: FAIL**。本轮不修复、不commit/push、不进入H2；Gate 2继续FAIL / PAUSED。
