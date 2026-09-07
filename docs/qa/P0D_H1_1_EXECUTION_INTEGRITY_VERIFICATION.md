# P0D-H1.1 — Execution Integrity Verification

日期：2026-09-07。Worker remediation record；不是独立复审结论。

**P0D-H1.1 REMEDIATION: READY FOR INDEPENDENT RE-AUDIT**

H1 原 worker PASS 已被独立源码审计推翻。F01/F02 的修复与回归在本轮完成，
但缺陷关闭及 H1 final freeze 必须由原 clean-room auditor 确认；H2 仍 BLOCKED。

## 1. Consumed audit / git baseline

Defect authority：
[独立审计](P0D_H1_INDEPENDENT_SOURCE_AUDIT.md)、
[独立决策登记](P0D_H1_AUDIT_DECISION_REGISTER.md)。两份原文只读，FAIL 保持原样。
已读取它们、H1 verification/implementation 及三份 H0 文档，核对生产 reader、compiler、
adapter、spec、后台调用和旧测试；没有把审计反例解释为测试误差。

- 分支：`codex/v1.0-p0d-e2e-demo-portfolio`。
- 起始 HEAD：`14a116ee0161003cab67ba7697c00e86e62d056a`。
- 检查 status、branch、HEAD、最近15次提交、完整 diff、diff --check。
- 旧 AIWorkspace.tsx 导航补丁与 Gate 2 QA 保留，未纳入本轮提交。
- 独立审计两文档起初未跟踪，允许单独记录为文档提交；不混进修复提交。
- ignored 独立 probe/logs 不改动，不提交。不改配置、服务或云数据。

只读保护文件 SHA-256：

| 文件 | SHA-256 |
|---|---|
| P0D_H1_INDEPENDENT_SOURCE_AUDIT.md | 9413F8409F21621846CC720EADC4649313688853D510673766DE9D4667ECAD61 |
| P0D_H1_AUDIT_DECISION_REGISTER.md | 3F9C3D509E067462BD21C2F0D2D603A8B253470E03CCA64E20085BA1B3B4F916 |
| AIWorkspace.tsx | 5AFF69E3F33EEF53E60D3E147C1DE5745246CDF297243F70BEABF8D0AC587989 |
| P0D_FULL_BROWSER_E2E.md | A6D0DE4221332A84E4C91B933F6F0C7057687D091D48F913F14960661C957C9B |

## 2. F01 root cause and fix

原后台确实重读、重新 compile、比较整个 spec。但主输入 metadata 未绑定 derived transform_chain，
base ref 只用 frame hash；重验的不完整指纹使两种 metadata-only mutation 仍等价。
此次没有添加会话版本或审批票据，而是统一当前执行所依赖的 artifact fingerprint。

`AuthoritativeInputFingerprint` 的版本固定为 `authoritative-input-fingerprint@1`。
它是 ExecutionSpec 的必需字段，由服务器构造，候选/创建请求不能提供。

| 层 | 绑定的语义状态 |
|---|---|
| input / base | DatasetInputFingerprint：artifact_ref 的 id/version + DatasetSemanticState |
| 每个 DatasetSemanticState | dataset identity、canonical frame hash、schema semantic hash、bound-field semantics hash、grain、row semantics、derivation type、derivation fingerprint、transform_chain hash、历史source IDs、base ID、relationship snapshot hash |
| 输入级别 | 实际依赖的 source refs/versions、projection policy、normalization policy完整定义/id/version、reader contract/version、normalization records |
| ExecutionSpec | 指纹整体进入 metadata_version 与 execution_spec_id；既有plan/capability/operator/字段/输出绑定保留 |

schema 的执行语义白名单：name、dtype、semantic_type、role、nullable、unit。
不将 sample_values 或 description 当权威语义。
bound-field hash 单独绑定 role→column→该列语义。base 同样绑定这套状态，不能再仅使用 frame hash。

规范化：canonical JSON 使用 sort_keys、固定separators、UTF-8、拒绝NaN；不使用 str(dict)/repr。
schema按列名排序，source IDs与无序relationship集合排序；dict顺序变化不影响指纹。
Join步骤及输出列顺序保留，输入行序同旧H1一样保守地视为版本变化。
将来增加语义状态或政策必须审阅指纹字段，并在需要时升级版本。

### Semantic vs presentation

必须失效：源frame/schema、bound字段dtype/semantic_type、base四个角色的schema、base frame、
saved JoinPlan身份/步骤、source refs、parent/base ref、relationship snapshot、grain声明、
normalization policy/version、reader contract/version、字段绑定。

可保持有效：display_name、description、ui_label、updated_at、schema description/sample_values、
Join warnings文案。这些不参与当前执行或人口校验；测试同时证明spec不变且后台正常完成。
不是整条数据库记录全部hash。

### Derived lineage / transform policy

当前只支持已保存LEFT Join→经一致性验证的unique-user projection。
derived 的 derivation_type、JoinPlan（排除warnings文案）、source_dataset_ids、parent_dataset_id、
relationship snapshot、grain声明进入指纹。transform_chain 仅允许null或空列表；
其他状态在读取/计算前返回 `unsupported / UNSUPPORTED_DERIVED_TRANSFORM_LINEAGE`。
不解释filter、不执行transform、不默认忽略。base自身仍须为未派生源人口。

source_dataset_refs 是**当前真正读取的执行依赖**，在derived场景为base的完整指纹版本。
原H1保存的右表仅作为历史Join来源ID绑定；本轮不重建Join、不读取右表、不伪造其历史版本。
因此右表后续数据更新不会自动重建已保存的derived文件，这是当前H1执行语义的明确边界。

### Freshness order

创建：load owned input→logical normalization→build fingerprint→compile→比较expected spec ID→保存现有Analysis。
后台：重读当前状态→normalize/build fingerprint→人口一致性校验→比较旧指纹→重新compile→完整spec比较→recipe。
fingerprint不同时，在任何diagnose_conversion调用前拒绝；不能仅在计算后阻止发布。
人口不合法或来源已不支持时允许更早的结构化data_invalid/unsupported（保留原H1错误）。
schema-only变化则明确 `stale / EXECUTION_SPEC_STALE_OR_MODIFIED`。

旧H1保存的spec缺少新必需fingerprint，拒绝为 INVALID_SAVED_EXECUTION_SPEC，需要重新预检/审阅；
不从旧字段补造完整来源版本。已完成的历史result不回写、不迁移。

## 3. F01 production-path mutation regression

`test_execution_integrity.py` 使用真实 route、BackgroundTasks、owned adapter、storage-backed reader、
compiler、operator、update_analysis_status；只替换物理DB会话与storage.read。
不是mock一个新版hash后宣称后台正确，也不接真实数据库。

| 原始审计反例 | 本轮结果 |
|---|---|
| create后仅变base schema dtype，文件完全不变 | 四个绑定角色分别变更：spec ID改变；后台failed/EXECUTION_SPEC_STALE_OR_MODIFIED |
| create后仅变derived transform_chain，文件不变 | 重新预检unsupported；后台failed/UNSUPPORTED_DERIVED_TRANSFORM_LINEAGE |

两例以及全部语义mutation场景均在排队后把diagnose_conversion替换为会失败的哨兵，
后台仍正常返回结构化failed；证明没有进入分析recipe。

18个参数化语义场景还覆盖source content/schema、bound dtype/semantics、移除字段、base frame、
JoinPlan、source refs、base ref、relationship、grain、normalization/reader版本。
另有排队后修改字段绑定的同值列反例，返回stale且零recipe调用。
7种非语义mutation保持spec与正常执行；canonical顺序重排保持spec相同。
字段清单测试对DatasetSemanticState新增字段提供显式审阅提醒。

## 4. F02 policy decision

按用户本轮决定，采用 **ConversionNormalizationPolicy@1**（policy_id=conversion-normalization，version=1）。

| source logical value | 规则 |
|---|---|
| native boolean | true→1，false→0 |
| native numeric0/1 | 接受；非finite/其他数值拒绝 |
| string | strip whitespace + casefold，仅true/false/1/0映射 |
| mixed valid native/string | 逐值同政策映射，允许；string_count>0即normalization_applied=true |
| yes/no、y/n、paid/unpaid、unknown、2/−1文本、空串、null | data_invalid；不drop/fill/default |

原独立审计“文本true/1必须拒绝”的expected是旧合同历史。本轮用户明确批准的新产品政策允许这些文本，
条件是**从真实source逻辑表示经应用白名单映射并留下版本化记录**。
这不是改弱operator：纯canonical DataFrame内的字符串仍被原operator拒绝，旧负例断言全部保留。
旧H1测试只调整一个adapter替身的新接口及base metadata字段，没有删除或改松断言。

## 5. Real reader / normalization provenance

新增 `load_capability_dataset_frames`：一次storage字节读取，建立普通frame和独立logical frame。
其他列继续用原reader结果；仅bound conversion列被应用normalizer替换为canonical int64 0/1。
旧 `load_dataset_dataframe` 调用行为不变。

- CSV：原表头策略保留，logical解析使用dtype=object、na_filter=False；数字字面量和带引号数字
  在CSV本质上均是文本token，由应用政策转换，不把pandas推断的int当source原生类型。
- XLSX：直接openpyxl读取原生cell value（data_only=false）；不经pandas类型推断取得logical conversion。
  测试用openpyxl明确写入和核验cell.data_type=s/b/n。
- XLS：保留既有格式入口，使用xlrd原生cell类型（boolean/date/error分别保留逻辑类型）；
  本轮验收矩阵是CSV/XLSX，未声称完成XLS fixture验证。

首次专项暴露：单用pandas dtype=object仍会在混合bool/numeric列中合并Python值类型。
因此没有放宽测试，改为直接Excel cell读取；mixed输入的boolean_count/numeric_count/string_count现在准确。
另一个新测试的对照fixture从混合数字/文本改为审计原例的整列文本/原生布尔，
以实际复现“pandas推断相同，但source逻辑表示不同”。这不改变旧H1负例expected。

NormalizationRecord记录dataset/column、完整policy、reader/version、逻辑类型计数、
带类型标签的源逻辑值hash、normalization_applied；不保存原始行到spec或result。
policy规定normalized_semantic_type=binary_0_1。records进入完整指纹并随执行结果返回；
policy定义或version变化即使计算值一致，也改变spec并阻断排队中的旧规格。

dataset artifact version表达canonical frame/semantic metadata状态；source逻辑类型hash及policy/version
另在完整AuthoritativeInputFingerprint绑定。整个spec比较覆盖两者，不能只比较其中一个ref。

## 6. F02 matrices

CSV与XLSX各自测试：native 0/1/boolean、string 0/1、string true/false（大小写/空白）、mixed valid。
Excel string fixture明确断言原cell.data_type=s，以及logical reader仍返回str；
规范化record再证明接受来自policy，不能归功于pandas猜测。

两种格式分别测试9类invalid：yes、no、2文本、−1文本、空串、unknown、null、numeric2、numeric−1；
全部data_invalid，无Analysis创建，不丢行、不补值。

Excel native boolean/numeric→同值string mutation：普通pandas结果相等，
完整fingerprint、normalization records和execution_spec_id仍不同。
有效输入真正执行到completed，result中的normalization records与冻结spec一致。

## 7. Regression

仓库根、PYTHONPATH=insightease-backend；未读写.env，未放宽settings。

| 验证 | 结果 |
|---|---|
| H1 + H1.1 focused | 110 passed，5既有warnings，15.75s |
| backend full | 236 passed，6 skipped，5既有warnings，20.22s |
| frontend lint | PASS，0 errors / 355既有warnings |
| frontend build | PASS，18.78s；保留既有 chunk size warning |
| git diff --check | PASS（含提交前 staged 检查） |

6 skipped均为需要显式开启的运行中backend transform integration。本轮不启用。
本机ignored日志：.venv/h11-focused.log、h11-backend.log、h11-lint.log、h11-build.log。
新增58项；保留原52项H1测试。首次运行发现旧mock接口已变化及上述Excel类型问题，修复后专项全通过。

anti-regression：legacy decline→CAPABILITY_OUTPUT_COVERAGE_MISMATCH；unknown capability拒绝；
2054 detail rows→2000 users；golden 24.0%/18.8%、−5.2/−2.56/−2.64pp；
无LLM算术、SQL/code/module注入、无silent goal shrinking；全部原断言保持。

## 8. Changed files / known limits / handoff

Remediation files（仓库相对路径）：

```text
insightease-backend/app/schemas/capability.py
insightease-backend/app/services/capability_input_service.py
insightease-backend/app/services/capability_compiler.py
insightease-backend/app/services/capability_execution_service.py
insightease-backend/app/services/dataset_io_service.py
insightease-backend/tests/test_capability_execution.py
insightease-backend/tests/test_execution_integrity.py
docs/architecture/P0D_H1_CAPABILITY_EXECUTION_IMPLEMENTATION.md
docs/qa/P0D_H1_CAPABILITY_EXECUTION_VERIFICATION.md
docs/qa/P0D_H1_1_EXECUTION_INTEGRITY_VERIFICATION.md
```

没有改算法、capability目录、frontend、prompt、schema迁移、会话/审批/路由或EvidencePack。
单次读取快照与fingerprint不是数据库/对象存储分布式事务，未声称锁住外部写入；
测试验证的是当前owned输入快照和create/background之间的状态变化。
frame hashing沿用pandas确定性hash；runtime/reader语义变化需升级reader policy，未实现跨任意库版本的归档重放。
schema语义白名单新增字段必须同时审阅fingerprint与mutation矩阵。
不从源数据证明线下业务人口完整性；原H1业务假设仍成立。

修复提交SHA在任务交付消息提供。原clean-room auditor应重新验证F01原两例，并抽样source/base frame、
JoinPlan、field binding、normalization policy version；验证真实Excel文本true/false与1/0依新policy接受，
yes/unknown/2/null仍拒绝。独立历史报告不得改FAIL为PASS，应新增复审结论。

**P0D-H1.1 REMEDIATION: READY FOR INDEPENDENT RE-AUDIT**。
F01/F02待独立复审关闭；本worker不宣布H1 FINAL PASS，停止于此，H2继续BLOCKED。
