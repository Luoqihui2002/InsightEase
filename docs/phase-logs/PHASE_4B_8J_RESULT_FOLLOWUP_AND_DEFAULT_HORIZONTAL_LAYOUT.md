# Phase 4B-8J: Result Follow-up Mode and Default Horizontal Layout

## Objective

Improve AI Workbench result-context workflow by defaulting the Workbench to horizontal layout and adding a deterministic, rule-based result follow-up mode using `SafeResultSummary`.

This phase does not add Hermes/LLM, does not auto-run analysis, does not auto-join datasets, does not generate SQL, does not modify datasets, and does not modify SmartAnalysis.

## Layout Default Change

AI Workbench now falls back to horizontal layout when there is no valid saved layout preference.

Rules:

- Saved `vertical` remains vertical.
- Saved `horizontal` remains horizontal.
- Missing or invalid layout falls back to `horizontal`.
- Close/reopen still preserves the current session layout.

## Result Follow-up Intent Detection

Created:

```text
app/src/lib/assistant/resultFollowupResponder.ts
```

Supported intents:

- `explain_result`
- `risks_and_anomalies`
- `next_steps`
- `report_summary`
- `unknown`

Supported prompt families:

- "帮我解释这个结果", "解释一下", "这个结果说明什么"
- "有哪些异常或风险？", "有什么问题", "风险在哪里"
- "下一步建议做什么？", "下一步", "继续怎么分析"
- "整理成报告文字", "写成报告", "总结成报告"

## Response Rules

All responses:

- are generated only from `SafeResultSummary`;
- include a caveat that no analysis is rerun;
- do not call Hermes/LLM;
- do not read full raw `result_data`;
- do not generate SQL or mutate data.

Intent-specific behavior:

- `explain_result`: summarizes title, type, dataset, status, existing summary/interpretion, metrics, keys, tables, and charts.
- `risks_and_anomalies`: uses warnings, failed/error status, missing summary, empty metrics/tables, and explicit risk-like result keys.
- `next_steps`: uses deterministic next steps by analysis type.
- `report_summary`: creates a short business-style paragraph without fabricating conclusions.

## Files Inspected

- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/AICompanion.tsx`
- `app/src/components/AppLayout.tsx`
- `app/src/lib/assistant/ruleBasedAssistantRuntime.ts`
- `app/src/lib/assistant/assistantRuntime.ts`
- `app/src/types/resultSummary.ts`
- `app/src/lib/assistant/safeResultSummary.ts`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`

## Files Modified

- `app/src/pages/AIWorkspace.tsx`
- `app/src/lib/assistant/resultFollowupResponder.ts`
- `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Validation Results

- `cd app && npx tsc --noEmit`
- `cd app && npm run build`
- `git status`

## Manual QA Checklist

- [ ] Fresh open AI Workbench; default layout is horizontal.
- [ ] Toggle to vertical.
- [ ] Close/reopen; vertical is preserved.
- [ ] Missing/invalid saved layout falls back to horizontal.
- [ ] Open History result and click `让 AI 解读这个结果`.
- [ ] AI Workbench opens with result context.
- [ ] Click `帮我解释这个结果`; response is deterministic and summary-based.
- [ ] Click `有哪些异常或风险？`; response uses warnings/limitations without fabrication.
- [ ] Click `下一步建议做什么？`; response uses analysis-type-aware next steps.
- [ ] Click `整理成报告文字`; response returns a short report-style paragraph.
- [ ] No Hermes/LLM request occurs.
- [ ] No analysis reruns.
- [ ] No raw `result_data` is stored in sessionStorage.
- [ ] Dataset planning, relationship set planning, prefill navigation, and Context Panel still work.

## Known Limitations

- Responses are deterministic and summary-based; they do not perform deeper statistical interpretation.
- If the safe summary is sparse, responses explicitly say the available context is limited.
- Unsupported prompts continue to the existing planning flow.

## Next Recommended Phase

Define a Hermes result-explainer boundary that accepts `SafeResultSummary` only, then add an opt-in AI explanation flow.
