# Phase 4B-8I: Analysis Result to AI Workbench Handoff

## Objective

Add a safe handoff path from analysis result surfaces into AI Workbench so users can bring a result into assistant context and ask follow-up questions.

This phase uses the Phase 4B-8H `SafeResultSummary` contract. It does not add Hermes/LLM, does not auto-generate explanations, does not rerun analysis, does not auto-join datasets, and does not modify SmartAnalysis.

## Handoff Payload Contract

Created `app/src/lib/assistant/aiWorkbenchHandoff.ts`.

Payload:

```ts
interface AIWorkbenchHandoffPayload {
  source: "analysis_result" | "history";
  analysis_id?: string;
  safe_result_summary?: SafeResultSummary;
  suggested_prompts?: string[];
  created_at: string;
}
```

Storage:

```text
sessionStorage.insightease_ai_workbench_handoff
```

Rules:

- TTL: 24 hours.
- Prefer `analysis_id` when available.
- Store only `SafeResultSummary`, never raw `result_data`.
- Clear payload after AI Workspace consumes it.

## Files Inspected

- `app/src/pages/History.tsx`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/AICompanion.tsx`
- `app/src/components/AppLayout.tsx`
- `app/src/lib/assistant/safeResultSummary.ts`
- `app/src/types/resultSummary.ts`
- `app/src/types/api.ts`
- `app/src/components/results/`
- `app/src/pages/Forecast.tsx`
- `app/src/pages/PathAnalysis.tsx`
- `app/src/pages/Attribution.tsx`
- `app/src/pages/Statistics.tsx`

## Files Modified

- `app/src/components/AppLayout.tsx`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/lib/assistant/aiWorkbenchHandoff.ts`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/pages/History.tsx`
- `app/src/pages/Statistics.tsx`
- documentation files listed below

## Workbench Open Mechanism

Added frontend events:

- `insightease:open-ai-workbench`
- `insightease:ai-workbench-handoff`

`AppLayout` listens for the open event and opens AI Workbench.

`AIWorkspace` listens for the handoff event and also consumes a stored handoff payload when opened.

## History Action Behavior

History result dialog now has:

```text
让 AI 解读这个结果
```

Click behavior:

- builds `SafeResultSummary`;
- stores handoff payload with `source: "history"`;
- opens AI Workbench;
- attaches selected analysis id and safe summary;
- shows follow-up prompt chips;
- does not generate an explanation automatically.

## Result Page Action Behavior

Added a low-risk `带到 AI 工作台` action to Statistics results.

Forecast, PathAnalysis, and Attribution are documented as next candidates because their result states are more complex and page-specific.

## AI Workbench Behavior

On handoff:

- selected history id is set when available;
- attached safe result summary is stored in Workbench session state;
- right Context Panel shows the result context even if the history list does not contain the item;
- assistant adds a short note explaining that no analysis or explanation was auto-run;
- prompt chips are replaced with result follow-up prompts.

## Safety Rules

- No Hermes/LLM call.
- No automatic result explanation.
- No analysis rerun.
- No SQL generation.
- No auto-join.
- No raw `result_data` persisted in sessionStorage.
- Only bounded `SafeResultSummary` may be stored.

## Validation Results

- `cd app && npx tsc --noEmit`
- `cd app && npm run build`
- `git status`

## Manual QA Checklist

- [ ] Open History.
- [ ] Open a completed result dialog.
- [ ] Click `让 AI 解读这个结果`.
- [ ] AI Workbench opens.
- [ ] Right Context Panel shows that result context.
- [ ] Assistant does not auto-generate a full explanation.
- [ ] Suggested prompt chips appear.
- [ ] `sessionStorage.insightease_ai_workbench_handoff` is cleared after consumption.
- [ ] Run/open Statistics result.
- [ ] Click `带到 AI 工作台`.
- [ ] AI Workbench opens with safe result context.
- [ ] No analysis reruns.

## Known Limitations

- Statistics is the only direct result page wired in this phase.
- Forecast, PathAnalysis, and Attribution should add the same action after their result metadata/state is normalized.
- The assistant still does not explain results automatically; users must click a prompt or ask a question.

## Next Recommended Phase

Add a deterministic result-follow-up response mode or define the Hermes result-explainer boundary using `SafeResultSummary` as input.
