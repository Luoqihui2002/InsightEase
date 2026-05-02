# Phase 4B-7 Log: Relationship-aware Analysis Planner Mock

**Phase ID**: 4B-7  
**Date**: 2026-04-28  
**Owner**: Code Agent  
**Status**: ✅ Completed

---

## Objective

Add a mock, rule-based analysis planner to the AI Workbench that converts simple user goals into structured analysis plans using keyword matching, selected datasets, and optionally confirmed relationships.

---

## Files Created

| File | Description |
|------|-------------|
| `app/src/lib/assistant/analysisPlannerMock.ts` | Rule-based mock planner: keyword matching, field detection, plan generation |
| `app/src/components/assistant/AnalysisPlanCard.tsx` | Structured analysis plan display card |

## Files Modified

| File | Description |
|------|-------------|
| `app/src/types/assistant.ts` | Added `RecommendedAnalysisType`, `AnalysisFieldRequirement`, `AssistantNextAction`, `AssistantAnalysisPlan` |
| `app/src/pages/AIWorkspace.tsx` | Integrated analysis plan panel into capabilities tab; added `生成分析计划` card; added `handleGeneratePlan` |
| `docs/CURRENT_PROGRESS.md` | Added 4B-7 entry |
| `docs/CHANGELOG.md` | Added 4B-7 entry |
| `docs/ROADMAP.md` | Updated 4B-7 status |

---

## Planner Design

### Keyword Rules

| 关键词 | 分析类型 | 路由 |
|--------|----------|------|
| 预测/趋势/未来/forecast/sales | forecast | /app/forecast |
| 路径/漏斗/转化/流失/journey/funnel | path_analysis | /app/path |
| 归因/渠道/campaign/attribution | attribution | /app/attribution |
| AB/实验/对照组/treatment | ab_test | /app/statistics |
| 文本/评论/语义/情感/sentiment | semantic | /app/semantic |
| 清洗/缺失/异常值/clean | smart_process | /app/data-workshop |
| 回归/LTV/驱动因素/regression | regression | /app/statistics |
| 其他 | descriptive | /app/statistics |

### Required Fields per Type

- **forecast**: time_column (必需), target_metric (必需)
- **path_analysis**: user_id (必需), event_name (必需), time_column (可选)
- **attribution**: user_id (必需), dimension (必需), time_column (可选), target_metric (可选)
- **ab_test**: group_column (必需), target_metric (必需), user_id (可选)
- **semantic**: text_column (必需)
- **smart_process**: target_metric (可选)
- **regression**: target_metric (必需), feature (可选), user_id (可选)
- **descriptive**: target_metric (可选), dimension (可选)

### Field Detection

基于列名模式匹配：
- time_column: date, dt, time, timestamp, created_at, order_date...
- user_id: user_id, uid, customer_id...
- event_name: event, action, page...
- group_column: group, variant, treatment...
- target_metric: revenue, gmv, sales, converted...
- text_column: review, comment, text...
- dimension: category, brand, channel...
- feature: age, gender, region...

### Relationship Awareness

- 若传入 confirmed relationships，plan 中显示已确认关系列表
- 若选择多个数据集但无 confirmed relationships，显示警告：「建议先使用理清表关系确认 join key」
- 当前阶段未接入 RelationshipReviewPanel 的本地状态（TODO: 持久化后增强）

### Plan Output

`AssistantAnalysisPlan` 包含：
- id, user_question, interpreted_goal
- recommended_analysis_type
- required_datasets, required_fields
- required_relationships (optional)
- assumptions, warnings
- next_actions (navigate / explain / warning)

---

## UI Design

### Entry Point

AI Workbench「能力」标签页新增卡片：
- **图标**: `ClipboardList`
- **标题**: 生成分析计划
- **描述**: 输入业务问题，生成结构化分析路径建议

### Analysis Plan Panel

- 顶部返回箭头 + 「生成分析计划」标题
- 输入框 + 「生成计划」按钮（Wand2 图标）
- 6 个示例问题 chip：
  - 为什么最近转化率下降？
  - 哪些渠道贡献最高？
  - 未来销售额会怎么变化？
  - 哪些用户路径流失最多？
  - 评论里用户主要在抱怨什么？
  - 缺失值怎么处理？
- 生成后展示 `AnalysisPlanCard`

### AnalysisPlanCard

- 分析类型标签（彩色徽章）
- 推断目标 + 原始问题
- 所需数据集列表
- 所需字段卡片（含候选列、必需/可选标记、未找到警告）
- 已确认表关系（若有）
- 推断假设列表
- 注意事项列表
- 底部操作按钮：导航到对应分析页面 / 查看字段详情 / 检查警告

---

## Validation

```bash
cd app
npx tsc --noEmit      # 0 errors ✅
npm run build         # built in 19.28s ✅
```

---

## Manual QA Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | AI Workbench opens normally | ✅ |
| 2 | 能力 tab shows 生成分析计划 card | ✅ |
| 3 | User can enter a question | ✅ Input + sample chips |
| 4 | Sample chips populate input | ✅ Click chip sets input |
| 5 | 「未来销售额会怎么变化？」→ forecast plan | ✅ Keywords match forecast rule |
| 6 | 「哪些渠道贡献最高？」→ attribution plan | ✅ Keywords match attribution rule |
| 7 | 「评论里用户主要在抱怨什么？」→ semantic plan | ✅ Keywords match semantic rule |
| 8 | 「缺失值怎么处理？」→ smart_process plan | ✅ Keywords match smart_process rule |
| 9 | Plan card displays recommended analysis type | ✅ Colored badge |
| 10 | Plan card displays required fields | ✅ With candidate columns |
| 11 | Plan card displays assumptions and warnings | ✅ |
| 12 | Multiple datasets + no relationships → warning | ✅ |
| 13 | Next action buttons navigate to existing pages | ✅ Uses useNavigate |
| 14 | No analysis executed automatically | ✅ Only navigates |
| 15 | No join performed | ✅ |
| 16 | No LLM/Hermes call | ✅ Pure frontend rule matching |
| 17 | Existing RelationshipReviewPanel still works | ✅ Unchanged |
| 18 | No console errors | ⏸️ Runtime not tested |

---

## Known Limitations

- 规则匹配为简单关键词包含，不支持复杂语义理解
- 未接入 RelationshipReviewPanel 的本地 confirmed relationships（需持久化后增强）
- 导航到分析页面时不携带预填充配置
- 字段检测仅基于列名模式，无后端 profile 数据

---

## Next Recommended Phase

**4B-8**: Real AI Integration — 将规则型 planner 升级为元数据优先的 LLM 调用，或接入 Hermes Agent 适配层。
