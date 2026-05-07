# Phase 4B-11B-2: AI Workbench UX QA Bugfix

## Goal

Fix three frontend UX issues found during Hermes result explainer QA before moving to Phase 4B-11C.

## Scope

- AI Workbench header alignment.
- Chat auto-scroll behavior after user and assistant messages.
- Analysis History selector dropdown clipping in the right Context Panel.

## Non-goals

This phase did not implement live plan-analysis, Join Builder, multi-table execution, SQL generation/execution, automatic joins, automatic analysis reruns, source dataset mutation, or backend Hermes contract changes.

## Bugs Fixed

### Bug 1: Header/Icon Alignment

The close button had been absolutely positioned while the header content used left padding. This made the close button, assistant avatar, title, and subtitle read as separate vertical systems.

Fix:

- Added a visible close button directly inside the header flex row.
- Removed the padded-header dependency and aligned the close button, avatar, and title block with `items-center`, fixed button dimensions, and tight title leading.
- Preserved the existing close behavior.

### Bug 2: Chat Auto-scroll

Some message paths appended content only after async work completed, so long Hermes live responses could leave the chat panel at an old scroll position.

Fix:

- Added a bottom sentinel and scroll container tracking.
- Added near-bottom detection with a 120px threshold.
- Forced scroll when the user sends a message.
- Allowed assistant responses to auto-scroll when the user is already near the bottom.
- Updated result follow-up prompts to append the user message before waiting for Hermes or deterministic fallback.
- Quick action chips now use the same prompt path for result follow-up prompts.

### Bug 3: Analysis History Dropdown Clipping

The shared `SearchableSelect` rendered dropdown content inside its local container. In the Context Panel empty-history state, parent overflow could clip the analysis history dropdown.

Fix:

- Rendered `SearchableSelect` dropdown content through a React portal to `document.body`.
- Positioned dropdowns with `position: fixed` based on the trigger bounds.
- Added internal max-height and scrolling for long option lists.
- Preserved keyboard navigation, click-outside close, search focus, clear behavior, and option badges.

## Root Causes

- Header close action was visually independent from the header row.
- Result follow-up messages waited on async response generation before appending the user message.
- The local dropdown layer could not escape parent overflow clipping.

## Files Changed

- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/ui/SearchableSelect.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/phase-logs/PHASE_4B_11B_2_AI_WORKBENCH_UX_QA_BUGFIX.md`

## Manual QA Results

Manual browser QA was not run in this environment. The implemented behavior targets the required manual checklist:

- header close/avatar/title row alignment;
- auto-scroll after user messages;
- auto-scroll after Hermes or deterministic result follow-up responses;
- quick action result prompts using the same message path;
- analysis history dropdown escaping Context Panel clipping;
- history selection still flowing through the existing Context Panel callback.

## Validation Results

- `cd app && npx tsc --noEmit`
  - Passed.
- `cd app && npm run build`
  - Passed.
- `cd app && npx eslint src/components/ui/SearchableSelect.tsx`
  - Passed.
- `cd app && npm run lint`
  - Failed due existing broad lint debt across the frontend. The run reported 435 existing problems, including many `any`, Fast Refresh export, purity, and hook rule issues across unrelated files. A touched-file selector lint issue was fixed during this phase.

## Regression Notes

- No backend files were changed.
- No Hermes safety model changes were made.
- Frontend still calls InsightEase backend only.
- Result follow-up still uses SafeResultSummary context and deterministic fallback behavior.
- Live plan-analysis remains unimplemented.

## Remaining Risks

- Full visual confirmation of exact header alignment and dropdown placement still requires browser QA.
- Project-wide lint remains blocked by pre-existing frontend lint debt.

## Status

Completed.
