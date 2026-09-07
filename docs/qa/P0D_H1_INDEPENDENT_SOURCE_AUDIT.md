# P0D-H1-A — Independent Source Audit

日期：2026-09-07。审计对象：`14a116ee0161003cab67ba7697c00e86e62d056a`。

**P0D-H1 INDEPENDENT SOURCE AUDIT: FAIL**

发现 **1 个 BLOCKER（两种 stale-state 复现）和 1 个 MAJOR**。Registry/compiler 确实进入了新增后端执行链，合法 demo 的确定性数学与 unique-user grain 正确；但派生输入的冻结指纹不完整，不能证明后台拒绝所有相关 metadata/lineage 变化。真实 Excel 读取也会在旗舰校验前将明确的字符串转换标记转成合法值。

没有修改生产代码、测试、prompt、UI、配置或数据库；没有 commit/push、provider 调用、浏览器 E2E 或 H2 实施。Worker 的 PASS 仅作为待核验 claim。

## 1. Audit scope

本轮独立读取了要求的七份材料：H1 verification、H1 implementation、三份 H0 文档、GROUND_TRUTH、committed generator；随后读取 H1 全部生产变更和专项测试，追踪了 dataset reader、旧分析 dispatcher、Hermes planning endpoint 和前端导航/手动执行调用者。

源码路径以下以仓库根为基准；表中的 `services/*`、`schemas/*` 和 `endpoints/analysis.py` 分别位于 `insightease-backend/app/services/`、`insightease-backend/app/schemas/` 和 `insightease-backend/app/api/v1/endpoints/`。行号对应上述 HEAD。

测试使用 committed CSV、本地内存数据、内存 DB/storage 替身及真实 production reader/compiler/operator/后台函数。不连接真实 DB。没有使用 production operator 生成 golden expected。

独立证据文件（均 ignored、非生产）：

- `.venv/h1_audit_probe.py`：独立 oracle、变形、反例、create/后台及真实 reader 审计程序。
- `.venv/h1-audit-independent.json`、`.venv/h1-audit-independent.log`：最终观察与断言结果。
- `.venv/h1-audit-focused.log`、`h1-audit-backend.log`、`h1-audit-lint.log`、`h1-audit-build.log`、`h1-audit-hardcode.log`。

独立程序 SHA-256：`5D45763B8E3DF6988D94FE2BF2BD049DD74E65EB7E8D211601A77C268CCCAF70`。

复现命令（仓库根 PowerShell）：

```powershell
$env:PYTHONPATH = (Resolve-Path insightease-backend).Path
.\.venv\Scripts\python.exe .venv/h1_audit_probe.py
```

程序退出 0 表示其独立数学断言及观察采集完成，**不表示 H1 审计 PASS**；JSON 明确记录已复现的错误放行。该程序不导入 H1 测试 helper。Windows asyncio 私有 socketpair 在网络拦截器安装前初始化，此后 socket connect/create_connection 均抛错；审计路径没有 provider 参与。首次程序执行曾因网络拦截器同时阻止 Windows 私有 socketpair 而中止；只调整了 ignored 审计程序初始化顺序，未更改被审计系统。

## 2. Git provenance

按用户要求首先执行 `git status`、`git branch --show-current`、`git rev-parse HEAD`、`git remote -v`、`git log --oneline -20`、`git diff`、`git diff --check`。随后用 `git show --stat/--name-status`、父提交解析与 production diff 独立确认：

| 项目 | 独立证据 |
|---|---|
| branch | `codex/v1.0-p0d-e2e-demo-portfolio` |
| HEAD / H1 implementation | `14a116ee0161003cab67ba7697c00e86e62d056a`，`feat: add capability-aware conversion diagnosis contracts` |
| H0 docs commit / H1 direct parent | `267aba8a549fc5405ce093ec780e0cf85ef783ba`，仅新增三份 H0 文档 |
| H1 前最后 production baseline | `4025c971e229c86ac95035d5cc2edba4401cf442`；到 H0 的 backend/app、app/src diff 为空 |
| remote | origin `https://github.com/Luoqihui2002/InsightEase.git`，fetch/push 相同 |
| 起始状态 | branch 与本地 origin tracking ref 一致；未进行远端 fetch 验证 |
| 起始 tracked 修改 | `app/src/pages/AIWorkspace.tsx` 四处 navigation detail 从字符串改成 `{ path: target }` |
| 起始 untracked | `docs/qa/P0D_FULL_BROWSER_E2E.md` |

实际 H1 文件集合共 9 个，6 个生产文件、1 个测试文件、2 份文档：

```text
M insightease-backend/app/api/v1/endpoints/analysis.py
A insightease-backend/app/schemas/capability.py
A insightease-backend/app/services/capability_registry.py
A insightease-backend/app/services/capability_compiler.py
A insightease-backend/app/services/capability_execution_service.py
A insightease-backend/app/services/conversion_diagnosis_service.py
A insightease-backend/tests/test_capability_execution.py
A docs/architecture/P0D_H1_CAPABILITY_EXECUTION_IMPLEMENTATION.md
A docs/qa/P0D_H1_CAPABILITY_EXECUTION_VERIFICATION.md
```

保护文件 SHA-256（审计开始取样并在交付前复核）：

- AIWorkspace.tsx：`5AFF69E3F33EEF53E60D3E147C1DE5745246CDF297243F70BEABF8D0AC587989`。
- Gate 2 QA：`A6D0DE4221332A84E4C91B933F6F0C7057687D091D48F913F14960661C957C9B`。

没有 reset/clean/rebase、staging 或覆盖这些文件。最终唯一新增的非 ignored 文件为本报告与 decision register。

## 3. H1 claim matrix

完整逐项结论见 [P0D_H1_AUDIT_DECISION_REGISTER.md](P0D_H1_AUDIT_DECISION_REGISTER.md)。核心结论：

| Claim | 结论 | 决定性证据 |
|---|---|---|
| Registry/compiler 为 H1 authority | VERIFIED | endpoint → prepare/preflight → compile；完整 spec 对比后进入唯一固定 recipe |
| create 前重新验证、错误先于写入 | VERIFIED | 独立 409/422，add/commit/schedule 均为 0 |
| 后台重读当前 owned 数据 | VERIFIED | 未替换 adapter/reader/compiler，storage 读记录证明重新加载 |
| 后台完整阻断 stale metadata/lineage | CONTRADICTED | base schema 与 derived transform_chain 改变，spec 仍相等且 completed（F01） |
| 字符串 conversion 不接受 | PARTIALLY VERIFIED | DataFrame 层拒绝；Excel reader 转型后 COMPILED（F02） |
| 正确 unique-user grain / golden 数学 | VERIFIED | stdlib CSV + Fraction oracle，fanout 与四项变形通过 |
| 全部 H1 gate PASS | CONTRADICTED | F01 BLOCKER，F02 MAJOR |

## 4. Registry authority audit

`capability_registry.py:6–55` 使用服务端常量、frozen Pydantic definitions 和 `MappingProxyType`。注册表版本为 `capability-registry@1`；定义实际包含 id/version/lifecycle、业务目标、required/optional roles、required/accepted grain、join requirements、固定 operator、metrics/dimensions、output contract、supported/unsupported claims、limitations/assumptions/confirmation requirements。

| lifecycle | capability | operator | 能否生成 H1 spec |
|---|---|---|---|
| enabled | `conversion_decline_diagnosis@1` | `conversion_decline_recipe@1` | 前置条件满足时可以 |
| legacy_limited | `touchpoint_attribution_legacy@1` | `touchpoint_attribution@legacy-1` | 不可以：`LEGACY_MANUAL_ONLY` 或先发生的 coverage rejection |
| disabled/catalogued | 0 项 | — | — |

没有运行时注册 API、frontend/provider 注册入口或自动枚举旧 endpoint 的逻辑。当前 schema 的 lifecycle 也只允许 enabled/legacy_limited，不能把“没有 disabled 条目”误读为所有旧模块都 enabled。

`compile_candidate:46–62` 先查精确 `(id, version)`，再检查 goals/evidence/output/lifecycle。未知能力没有 default analyzer；legacy 不具备 decline 输出覆盖。这个 authority 作用于 H1 新合同入口；不是已经迁移了整个旧浏览器规划产品。

## 5. Compiler call graph

真实预检链：

```text
POST /api/v1/analyses/capability-preflight
  analysis.capability_preflight [34–41]
  → capability_execution_service.preflight_owned [82–89]
  → request_dataset_id → load_authoritative_input → _owned + dataset reader
  → capability_compiler.compile_candidate [44–117]
       → CAPABILITIES lookup + goal/evidence/output/lifecycle gate
       → roles/grain/version/column/provenance/base population gate
       → diagnose_conversion (只读 preflight 计算，检查 coverage)
       → server-created ExecutionSpec
```

真实创建与执行链：

```text
POST /api/v1/analyses/ (analysis_type=conversion_decline_diagnosis)
  analysis.create_analysis [717–784]
  → owned dataset check
  → prepare_capability_run [92–108]
       → strict CapabilityRunParams
       → preflight_owned → compile_candidate
       → compare expected_execution_spec_id
       → server CapabilityArtifactParams
  → Analysis add/commit/refresh
  → BackgroundTasks.add_task(execute_analysis_task, server params)
  → new AsyncSessionLocal
  → execute_capability_artifact [111–121]
       → parse saved artifact + id checks
       → load_authoritative_input again
       → execute_frozen [120–127]
            → compile_candidate again
            → full spec equality
            → diagnose_conversion
  → update_analysis_status completed / failed
```

`analysis_type` 在当前新增分支用于选择 H1 adapter；它没有让旗舰直接落入旧 executor。`execute_frozen` 在相等性检查后只调用固定 recipe，不从请求查找 callable。只有一个 enabled recipe 的当前目录与此实现一致。

全局调用者检索表明 `diagnose_conversion` 的生产调用集中于 compiler preflight 和 execute_frozen；没有另一个 H1 HTTP 直接 operator 入口，也没有 compile 失败后的 attribution fallback。失败分支 `analysis.py:108–111` 明确 return。

## 6. ExecutionSpec immutability audit

`schemas/capability.py:22–23`：`extra=forbid, frozen=True, allow_inf_nan=False`；嵌套合同同样 frozen，集合使用 tuple。

CandidatePlanV2 的必需字段为 schema_version、plan_id/version、user_question、capability_ref、business_goal_ids、required_evidence_types、field_bindings、population_spec、comparison_spec、expected_output_contract。无 executable、formula、SQL、code 或 module path。`CompileOutcome.executable` 是由 ready + spec 推导的字段。

ExecutionSpec 实际字段（140–155）：

```text
schema_version, execution_spec_id, version
capability_ref, operator_ref
input_refs (version required), field_bindings (versioned + provenance)
population_spec, comparison_spec, required_output_contract
plan_version, plan_hash, metadata_version, context_version
operator_parameters (formula/projection/missing/channel-enter-exit literals)
```

`plan_hash` 绑定整个 request（含 reviewed requirements），metadata hash 包含 registry version 与 capability definition。主输入 hash 绑定解析后的 frame/列顺序/dtypes/行顺序与 adapter 选取的 metadata。**不是原始文件字节 hash，也不是完整数据库记录 hash。** base 输入 version 只有 frame hash；遗漏详见 F01。

独立修改 capability/operator/binding/population/cohort/output/plan hash/metadata hash/frozen formula 共 9 类，schema 或 execute_frozen 完整比较均拒绝。不是仅检查一个 `frozen=True` 注解。现有测试还实测嵌套比较对象赋值被拒绝。

`context_version=null`、session authority、approval token、idempotency 和服务端关系批准版本属于明确 deferred 的 H3，不作为本轮 bug。expected spec ID 是内容一致性检查，不是签名审批票据；客户端重新预检一个合法新候选会得到新 spec，这是合同允许的行为。

## 7. Create/background revalidation

`create_analysis:748` 在 `db.add:761`、`commit:762`、`add_task:766` 前调用 prepare。独立使用真实 create 函数与 BackgroundTasks，并保留真实 owned adapter + storage-backed reader，只替换物理存储读和 DB 会话：

| create 请求 | actual | add / commit / scheduled |
|---|---|---|
| 错 expected spec ID | 409，`EXECUTION_SPEC_CHANGED_REVIEW_REQUIRED` | 0 / 0 / 0 |
| 改变 baseline/current，保留旧 ID | 同上 409 | 0 / 0 / 0 |
| params 注入 execution_spec | 422，`INVALID_CAPABILITY_RUN_PARAMS` | 0 / 0 / 0 |

后台独立复现（JSON `background`）：

| 排队后状态 | actual | 结论 |
|---|---|---|
| source 无变化 | completed，新 result contract | 正常执行 |
| source CSV 行顺序变化 | failed，`EXECUTION_SPEC_STALE_OR_MODIFIED` | 拦截 |
| source schema 变化 | 同上 | 拦截 |
| bound converted 列被移除 | failed，`UNKNOWN_COLUMN` | 拦截，无假结果 |
| derived 无变化 | completed | 正常执行 |
| saved JoinPlan id 变化 | failed，`EXECUTION_SPEC_STALE_OR_MODIFIED` | 拦截 |
| base CSV 行顺序变化 | 同上 | 拦截 |
| base schema dtype 变化，frame 不变 | **spec 仍相等，completed** | **F01** |
| derived transform_chain 从 null 变非空，frame 不变 | **spec 仍相等，completed** | **F01** |

因此“后台只是信任客户端 create 状态”不符合源码：后台真的重读、重编译。但“所有相关 stale state 均阻断”同样不成立：重编译使用了不完整的版本输入。两点不能相互替代。

## 8. Injection / bypass audit

独立逐项构造 `operator/formula/sql/python/code/module_path/execution_spec/server_spec/executable`：

| 注入位置 | actual |
|---|---|
| CandidatePlanV2 内（9 类） | 全部 ValidationError：未知字段 |
| CapabilityRunParams 内（9 类） | 全部 ValidationError；真实 create 的 saved-spec 注入返回422 |
| AnalysisCreate 顶层（9 类） | 旧 envelope 的 Pydantic 默认 extra ignore，全部从 model_dump 丢弃；合法 params 原样保留，不能影响执行 |
| 持久化 spec 各执行字段 | schema literal 或完整 spec equality 阻断 |

没有用户字段传给 `eval/exec/importlib`、任意 SQL 或函数路径。字段名仅作 pandas 列引用，公式固定在服务端实现。

**Legacy boundary：NO BYPASS FOUND（限 H1 typed executable path）。**

- `analysis.py:582–603` 的手动 attribution 分支确实继续存在且不经过 compiler，符合允许的 legacy compatibility；登录本身不是能力 gate。
- H1 candidate 选择 legacy 会在 compile 阶段失败；H1 参数不会被转换成旧 attribution 参数，也没有失败 fallback。
- `hermes.py:248–306` 只生成/验证旧 advisory plan；没有调用 create/run dispatcher。
- `AnalysisPlanCard.tsx:98–116` 只保存 prefill 并导航；`Attribution.tsx:295–340,475` 仍需用户单独点击 `handleAnalyze`，才提交 `analysis_type='attribution'`。
- 前端没有 H1 preflight/CandidatePlanV2 调用，`toolRegistry.ts` 的 run_analysis 仍 implemented=false。不能宣称旧 browser Planner 已经完成 H1 迁移，也不能将用户主动手动归因算成隐藏的 H1 执行 fallback。

任意认证客户端依然能显式调用旧手动 API；本审计不声称整个 `/analyses/` 已统一受 H1 authority 管理。若未来给 Agent 通用旧 API 调用工具，需要重新审计；当前源码未发现该接线。

## 9. Deterministic operator audit

`conversion_diagnosis_service.py` 只导入 math/pandas/typed result/registry constants，无 LLM/provider/storage/SQL 调用。固定公式位于 77–87：

```text
channel mix = (current.share - baseline.share) * baseline.cvr * 100
channel within = current.share * (current.cvr - baseline.cvr) * 100
overall delta = (current overall CVR - baseline overall CVR) * 100
total mix / within = math.fsum(channel terms)
reconciliation = delta - mix - within; absolute tolerance 1e-10 pp
```

overall 差值与 `Σ(w1*r1-w0*r0)` 等价：每期 share 使用该期唯一用户分母，渠道分割完备。内部未做显示舍入。没有请求公式 override；`OperatorParameters.formula` 固定为 `baseline_rate_mix_current_share_within@1`。

两期来自 spec 中的显式 `previous_month`、`recent_month`。ComparisonSpec 是非空字符串合同，不是固定两字符串 Literal；任意实际存在的两个不同标签也可比较。`current_month` 在 demo 不存在时返回 `INSUFFICIENT_POPULATION`，无别名映射。同一期比较返回 `COHORTS_NOT_DISJOINT`。缺任一期或全空都结构化 data_invalid，不返回0%、NaN或Inf。

Channel enter/exit：保留 overall；缺期 cell/CVR/delta 为 null，整体 coverage=partial，decomposition=unavailable；compiler 返回 `CHANNEL_ENTER_EXIT_REQUIRES_POLICY` 并列缺少 mix evidence。CVR/mix/within rankings 为 partial；**conversion_count_delta ranking 仍 complete**，因为缺期人数可定义为0且其全集均有计数差。没有把后者当作完整 CVR/分解。

Ranking 每项有 metric、universe、ascending direction、unit、coverage；成员有 rank/ties（competition rank，1e-10绝对容差）。无 `main_driver` 自由结论。独立把 recent search_ads 的 converted 置0，最差 CVR 渠道从 social_ads 变为 search_ads；没有复用原测试的 organic 变形。

## 10. Independent golden recomputation

Expected 使用 `csv.DictReader` 按 `(cohort, channel)` 累计人数和转换人数，`fractions.Fraction` 做精确有理数运算。没有调用生产公式 helper、registry 输出或 generator 函数生成 expected；production 仅生成 actual。另与现有专项测试中的独立 pandas groupby 核对方法交叉检查。

输入 SHA-256：

- users.csv：`1356E354523E940B5A6FD8A3F2E58D69D1B1257AC47CE9C7C14445976D2A6092`。
- orders.csv：`2C8210C0947331CD22C93DCECFE813D5C68D53FB1FB90436E1C26AC88C84FC7F`。

| cohort | users | converted | CVR |
|---|---:|---:|---:|
| previous_month | 1000 | 240 | 0.240 |
| recent_month | 1000 | 188 | 0.188 |

| channel | previous users/converted | previous CVR/share | recent users/converted | recent CVR/share | mix pp | within pp |
|---|---|---|---|---|---:|---:|
| affiliate | 150/30 | .20/.15 | 120/24 | .20/.12 | -.60 | 0 |
| organic | 300/90 | .30/.30 | 200/60 | .30/.20 | -3.00 | 0 |
| push | 100/18 | .18/.10 | 80/14 | .175/.08 | -.36 | -.04 |
| search_ads | 300/78 | .26/.30 | 200/50 | .25/.20 | -2.60 | -.20 |
| social_ads | 150/24 | .16/.15 | 400/40 | .10/.40 | +4.00 | -2.40 |

精确 `delta=-26/5 pp`、`mix=-64/25 pp`、`within=-66/25 pp`，即 −5.2/−2.56/−2.64pp；有理数恒等式严格成立。production 未舍入 residual 为 `-4.440892098500626e-16 pp`。五渠道×两期全部 counts/CVR/share/分项与独立 oracle 一致。

CVR/within 升序最负为 social_ads，conversion count/mix 最负为 organic。GROUND_TRUTH 的“main/secondary”历史叙事不能替代这些 metric-specific 排名；本轮未改真值或 generator。

## 11. Grain/fanout audit

`project_users:21–52` 依次检查角色、列唯一性、空值、category/entity 类型、binary conversion、每 user 的三个属性 `nunique`、unique_user 输入重复；**先拒绝冲突，才对完整四列投影 drop_duplicates**，不存在 first/last/max/min 决定冲突属性的逻辑。此处删除已证明完全相同的投影不属于 silent conflict resolution。

真实 users LEFT JOIN orders：2054 行、2000 unique users；production 仍为每期1000人，转换240/188。derived compiler 还要求 saved LEFT Join、base 来源字段、base unique_user 投影和 derived 投影完全相等（compiler:88–97）。独立正常 derived 走真实 adapter/reader/create/background，最终 completed；专项测试补充缺来源、缺 base 用户、base 属性变化与 INNER Join 拒绝。

同 user 三类冲突分别实测：converted 0/1、previous/recent cohort、organic/social channel，全部 `data_invalid / CONFLICTING_USER_ATTRIBUTES`。没有用订单行数作为注册人口分母。

## 12. Metamorphic audit

| 独立变形 | actual |
|---|---|
| row order permutation（seed 983） | 完整 typed result 相等，含 rankings/quality/input summary |
| 为已有 user 新增一笔 order，再做 LEFT Join | 2054→2055 行；所有业务结果相等，仅输入行数改变 |
| 全人口复制并赋新 user IDs | 每期人数/转换数及每渠道人数/转换数×2；CVR/share/delta/decomposition 不变 |
| 两期人口组成和转换完全相同，IDs 分离 | delta=mix=within=0；所有 ranking 成员并列 rank1 |

变形比较 actual 与 actual 是验证不变量，**没有被用作 golden expected oracle**。现有专项测试的 channel rename 也通过。

## 13. Negative cases

| 条件 | 独立/现有证据及结果 |
|---|---|
| decline goal + legacy capability，全部真实字段 | 独立 `legacy_all_roles_and_output_valid`：连 legacy 三角色、represented_record grain、LegacyAttributionResult 输出均合法，仍 `CAPABILITY_OUTPUT_COVERAGE_MISMATCH`，无 spec |
| causal_marketing_optimizer@999 | 独立 `UNKNOWN_CAPABILITY`，无默认执行 |
| 改 reviewed goals / 删除必需 evidence / output缩水 | 现有专项 `test_compiler_negative_contracts`：coverage mismatch / GOAL_SHRINKING |
| 缺 required role / 幻觉列 / 错 grain / 旧 input version | 专项拒绝：MISSING_FIELD_ROLE / UNKNOWN_COLUMN / GRAIN_MISMATCH / INPUT_VERSION_CHANGED |
| funnel / causal 明确需求 | coverage mismatch，无静默删目标 |
| paid_first_order 显式绑定 | OPTIONAL_ROLE_NOT_IMPLEMENTED |
| null / 2 / -1 / Inf | 独立 data_invalid；null 为 MISSING_POPULATION_ATTRIBUTE，其余 INVALID_CONVERSION_FLAG |
| DataFrame 字符串 true / 1 | 独立 INVALID_CONVERSION_FLAG |
| Excel 文本单元格 true/false、1/0 | **ready/COMPILED，F02** |
| bool 或数值0/1 | 接受，正常 golden |
| 无当前期、无基期、全空、别名期、重复期 | 独立结构化拒绝，无无效数值结果 |
| 缺 entity/cohort/channel、unique_user重复 | 专项全部拒绝 |
| 他人/删除/不存在 Dataset | _owned SQL 含 user_id/is_deleted；专项 missing/foreign 返回404 |

## 14. Anti-hardcode and test-source independence

生产目录 `insightease-backend/app` 与 `app/src` 全局搜索 social_ads、24.0、18.8、−5.2、−2.56、−2.64、独立整数1000/240/188。没有 demo channel 或结果值驱动的生产分支。1000 命中为 timeout单位、TTL、样本/展示上限和轮询等；H1 recipe 没有这些 demo 结果常量。扫描原始输出保留于 ignored log。

H1 专项 `test_demo_golden_and_independent_channel_oracle:59–79` 使用固定整体 expected + 原始 CSV 的 pandas groupby，没有 `expected=production_function(...)`。`run()` helper 仅生产 actual。变形测试中的两次 production 调用是在比较变形不变量；不是伪造独立 oracle。

专项测试的不足是 adapter 测试 mock 了 `load_dataset_dataframe`，stale 测试主要改变 frame；因此它们没有暴露 F01/F02。测试通过与架构验收是两个事实。

## 15. Regression results

所有命令在原工作树执行。backend 从仓库根设置进程级 PYTHONPATH，未读取/更改后端旧 `.env`，未放宽 settings。

| 命令 | 结果 |
|---|---|
| `.\.venv\Scripts\python.exe -m pytest -q -rs insightease-backend/tests/test_capability_execution.py` | 52 passed，6 warnings，6.60s |
| `.\.venv\Scripts\python.exe -m pytest -q -rs insightease-backend/tests` | 178 passed，6 skipped，6 warnings，9.48s |
| app `npm run lint` | exit0；0 errors / 355 warnings |
| app `npm run build` | exit0；16.57s，既有 large chunk warning |
| ignored 独立 probe | exit0；记录两种 stale 错误放行和两种 Excel string 错误放行 |
| `git diff --check` | PASS（开始、验证后、交付前） |

6 skipped 全部来自 `test_transform_integration.py`（84/102/123/133/143/153），要求显式开启运行中 backend integration；本轮未启用。6 warnings 中5条是既有 Pydantic/model warnings，另1条是本机 `.pytest_cache/v/cache` 写权限 warning。没有为了去掉 warning 修改测试、配置或权限。测试总数不抵消 F01/F02。

## 16. Findings

### F01 — BLOCKER：派生输入冻结指纹遗漏 base metadata 和 derived transform_chain

**文件 / symbols / lines**：

- `services/capability_execution_service.py`，`load_authoritative_input:42–70`：主 metadata 列表不含 transform_chain；join 分支没有对 derived 自身非空 transform_chain 的检查；base metadata 没进入 source metadata。
- `services/capability_compiler.py`，`compile_candidate:103–110`：base ref 只使用 `frame_version(source.base_frame)`。
- `services/capability_compiler.py`，`execute_frozen:122–127`：基于上述不完整输入重新生成 spec，错误地相等后执行。

**独立复现**：使用 committed users/orders 形成合法 saved LEFT Join，真实 adapter/preflight/create 排队。DB、storage 为内存替身，其余生产链未 mock。两种情况分别新建内存场景，不共享 mutation：

```python
# 情况 A：排队后只改已冻结 base input 的 schema，CSV 不变。
datasets['users'].schema[0]['dtype'] = 'int64'  # user_id 仍是 Uxxxxx 字符串

# 情况 B：排队后只改 derived 的 transform lineage，CSV 不变。
datasets['derived'].transform_chain = [
    {'operation': 'filter', 'predicate': 'user_id != U00001'}
]
# 重新 preflight 比较，再调用原 BackgroundTasks。
```

**Expected**：schema/lineage 变化触发 stale 或明确 unsupported/data_invalid；原 reviewed spec 不能继续标 completed。情况 B 不要求系统执行该 filter；非空、未验证 transform lineage 本就不能默默等同原合法 join。

**Actual**：两例 `same_spec_after_mutation=true`，真实后台 `completed / ConversionDiagnosisResult@1`。每次均重新读了 derived/base；不是缓存替身返回旧 frame。对照组的 source schema、saved JoinPlan、base frame 变化能正确 failed。

**Impact**：重读并未建立完整 metadata/input fingerprint；旧 spec 在相关状态变化后仍可执行，违反本轮 Q2。此复现不证明客户端有权直接编辑数据库，也不声称存在 metadata 修改 endpoint；它验证的是用户明确要求的“排队后服务端状态变化”威胁模型。它不是 deferred H3 context/approval 问题，因为已声称为 H1 冻结输入的 base Dataset 及 derived lineage 直接受影响。

发现后只记录，未修复。

### F02 — MAJOR：真实 Excel reader 在旗舰校验前默默转换非法字符串 conversion

**文件 / symbols / lines**：`services/dataset_io_service.py`，`load_dataset_dataframe:25–44`；`services/capability_execution_service.py:40–49`；`services/conversion_diagnosis_service.py`，`project_users:42–45`。

**独立复现**：把 committed users 的 converted 分别映射为全部字符串 `'true'/'false'` 或 `'1'/'0'`，写到内存 xlsx。用 openpyxl 确认 conversion 单元格 `data_type='s'`，确实是 Excel 文本，不是布尔/数字单元格。通过 production `load_dataset_dataframe` 读取内存 storage 返回的字节，再走真实 owned adapter/compiler。

| 原始 Excel 类型 | reader parsed dtype | actual |
|---|---|---|
| string true/false | bool | ready / COMPILED |
| string 1/0 | int64 | ready / COMPILED |

**Expected**：按本轮与 worker 声明的 binary required contract，字符串 conversion 必须 data_invalid，不应静默转型后 executable。

**Actual**：`pd.read_excel` 默认推断已丢失原始 string 类型，operator 只看到合法 bool/int，不能再拒绝。直接把字符串放入 DataFrame 的现有测试正确拒绝，但没有覆盖实际 reader 边界。CSV 默认推断有类似风险；本项使用有明确单元格类型的 xlsx 作为无歧义复现。

**Impact**：生产输入接受范围大于声明与专项负例证明的范围；合法 demo 数值不因此改变，但不能将 DataFrame-level string rejection 外推为真实上传文件的强合同。归类 MAJOR；不把它误报为客户端公式/code 注入。

发现后只记录，未修复。

## 17. Limitations

本轮没有远端部署状态验证、真实 HTTP 服务/认证栈联调、真实数据库事务落盘、provider smoke 或浏览器 E2E。Runtime 边界验证直接调用真实 route function/BackgroundTasks，物理 DB 和 storage 被替换；Pydantic schema 校验使用实际模型。不能由此推导服务部署或网络配置已正确。

右侧 orders 是已持久化 derived dataset 的历史来源，当前 H1 只冻结 derived 与 base 两个 input refs；没有宣称每次重建 Join 或 paid-first-order cross-check。其后续源更新是否应触发重建需要明确策略，未将未复现的全部源更新泛化为额外 finding。

生产 reader 的100MB metadata-size 检查、operator 的1,000,000行/200渠道上限已读源码，未开展负载/并发压力实验。Frozen Pydantic 不是针对服务器内任意 Python 内存篡改的安全沙箱；本轮对象为不可信客户端请求和 create/background 状态变化。

H2 EvidencePack、H3 context/session/approval、H4 grounding、funnel、paid-first-order、任意DAG/SQL和 browser Planner 接线均未实现且不在本轮开发范围。旧 Gate 2 仍 FAIL / PAUSED。

## 18. Final decision

**Q1 — YES。** Capability Registry + Compiler 是当前 H1 typed backend execution path 的真实 authority；没有通过 gate 的 CandidatePlanV2 不能沿该路径进入最终执行。该结论不表示旧 browser Planner 已迁移。

**Q2 — NO。** 客户端注入和已追踪的 legacy fallback 未找到旁路，create 确实重验；但 F01 已证明 base metadata / derived lineage 改变后旧 spec 仍相等并执行 completed，故无法证明完整 Frozen ExecutionSpec 防绕过承诺。

**Q3 — YES。** 对合法输入，`conversion_decline_diagnosis@1` 在0 LLM/provider参与下按正确 unique-user grain 得到独立可复算结果；2054行订单 fanout 不污染2000用户。F02 是额外的真实输入类型合同缺陷，不改变本项合法输入的数学复算结论。

**P0D-H1 INDEPENDENT SOURCE AUDIT: FAIL**

F01/F02 需由后续获授权的实现方处理并接受独立复审。本轮停止，不修复、不进入 H2，也不将原 worker PASS 或178条回归通过升级为审计通过。
