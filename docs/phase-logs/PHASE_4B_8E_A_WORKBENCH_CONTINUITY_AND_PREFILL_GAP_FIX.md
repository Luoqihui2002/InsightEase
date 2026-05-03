# Phase 4B-8E-A: AI Workbench Continuity & Prefill Gap Fix

## Objective

Fix the remaining UX gaps after Phase 4B-8E:

- Keep the current AI Workbench session when the panel is closed and reopened.
- Add safe AI Workbench prefill support to Statistics.
- Add search/filter affordances for dataset and relationship-set selectors.

## User-Reported Issues

- Closing and reopening AI Workbench started a new/default conversation.
- Descriptive/statistics plans routed to `/app/statistics` without preselecting the planned dataset.
- Dataset and relationship-set dropdowns became difficult to use as tables and relationship sets grew.

## Files Inspected

- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/AICompanion.tsx`
- `app/src/components/AppLayout.tsx`
- `app/src/hooks/useAssistantContext.ts`
- `app/src/pages/Statistics.tsx`
- `app/src/lib/assistant/prefillNavigation.ts`
- `app/src/types/assistant.ts`
- `app/src/components/assistant/AnalysisPlanCard.tsx`
- `app/src/components/DatasetSelector.tsx`
- `app/src/components/assistant/RelationshipReviewPanel.tsx`

## Files Modified

- `app/src/pages/AIWorkspace.tsx`
- `app/src/pages/Statistics.tsx`
- `app/src/components/DatasetSelector.tsx`
- `app/src/components/assistant/RelationshipReviewPanel.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`

## Session Persistence Behavior

AI Workbench now stores a browser-session snapshot in `sessionStorage`:

`insightease_ai_workbench_active_session`

The snapshot includes:

- messages
- active tab
- selected dataset ID
- active relationship set ID
- current generated plan
- plan question
- preview layout state
- current session ID
- updated timestamp

It does not store dataset preview rows or raw dataset values.

Closing AI Workbench only hides the panel. Reopening restores the current working session. Clicking `新对话` intentionally resets the conversation and current generated plan while leaving reusable assistant metadata such as relationship sets intact.

## Statistics Prefill Behavior

Statistics reads the existing `?prefill=<key>` query param through `prefillNavigation`.

Accepted payload analysis types:

- `descriptive`
- `ab_test`
- `regression`
- `custom_query`

Behavior:

- preselects `primary_dataset_id` or the first `dataset_ids` entry;
- shows a prefill banner;
- displays suggested fields as chips;
- applies exact field-name suggestions to the selected column when safe;
- never auto-runs analysis.

Invalid or missing prefill keys load the page normally.

## Selector Search Behavior

Added lightweight search/filter inputs to:

- AI Workbench top dataset selector;
- AI Workbench top relationship-set selector;
- shared `DatasetSelector`;
- RelationshipReviewPanel dataset selection area;
- RelationshipReviewPanel relationship-set management selector/list.

Empty states:

- `未找到匹配的数据集`
- `未找到匹配的关系组`

No new dependencies were added.

## Validation Results

- `cd app && npx tsc --noEmit`: passed.
- `cd app && npm run build`: passed with the existing Vite large chunk warning.

## Manual QA Checklist

- Generate a plan in AI Workbench.
- Close AI Workbench.
- Reopen AI Workbench.
- Same conversation/plan remains.
- Click `新对话`.
- Conversation resets intentionally.
- Relationship set selection remains persisted unless changed by user.
- Ask for descriptive/statistics analysis.
- Navigate to Statistics.
- Statistics preselects the dataset and shows the prefill banner.
- Statistics does not auto-run analysis.
- Dataset dropdowns support searching `orders`, `event`, `users`.
- Relationship-set selector supports searching by set name.
- Empty search states render without overflow.
- Forecast, PathAnalysis, and Attribution prefill still work.
- Relationship set management still works.
- Guided Quick Analysis still works.
- No console errors.

## Known Limitations

- Search is simple client-side filtering over loaded datasets/relationship sets.
- Statistics field prefill is exact-match only.
- Semantic and DataWorkshop prefill remain mapped but not implemented.

## Next Recommended Phase

Extend safe prefill readers to Semantic and DataWorkshop, then consider extracting a reusable prefill banner component across target analysis pages.
