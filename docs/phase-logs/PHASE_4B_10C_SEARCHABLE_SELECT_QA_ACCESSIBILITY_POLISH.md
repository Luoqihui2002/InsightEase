# Phase 4B-10C: SearchableSelect QA & Accessibility Polish

## Objective

Polish and harden the shared `SearchableSelect` component introduced in Phase 4B-10B.

This phase improves keyboard behavior, focus handling, click-outside closing, basic ARIA semantics, dropdown overflow, empty states, and clear/disabled stability without changing backend behavior or assistant planning logic.

## Scope

Included:

- `SearchableSelect` keyboard handling.
- Click-outside close behavior.
- Search input focus and query reset behavior.
- Basic combobox/listbox ARIA attributes.
- Dropdown max height, overflow, z-index, highlighted option, and badge truncation polish.
- QA documentation and phase status updates.

Excluded:

- No Hermes/LLM integration.
- No backend change.
- No SmartAnalysis change.
- No dependency or package-file change.
- No catalog page search/filter behavior change.
- No assistant planner/runtime behavior change.

## Files Inspected

- `app/src/components/ui/SearchableSelect.tsx`
- `app/src/components/DatasetSelector.tsx`
- `app/src/pages/AIWorkspace.tsx`
- `app/src/components/assistant/AIWorkbenchContextPanel.tsx`
- `app/src/components/assistant/RelationshipReviewPanel.tsx`
- `app/src/pages/SmartProcess.tsx`
- `app/src/pages/Datasets.tsx`
- `app/src/pages/History.tsx`
- `docs/phase-logs/PHASE_4B_10B_WORKBENCH_HISTORY_SELECTOR_AND_SEARCHABLE_SELECTORS.md`
- `docs/qa/AI_WORKBENCH_QA_RECIPES.md`

## Files Modified

- `app/src/components/ui/SearchableSelect.tsx`
- `docs/CURRENT_PROGRESS.md`
- `docs/CHANGELOG.md`
- `docs/ROADMAP.md`
- `docs/qa/AI_WORKBENCH_QA_RECIPES.md`
- `docs/design/AI_WORKBENCH_CONTEXT_PANEL_DESIGN.md`
- `docs/phase-logs/PHASE_4B_10C_SEARCHABLE_SELECT_QA_ACCESSIBILITY_POLISH.md`

## Pre-coding Findings

Current props:

- `value`
- `options`
- `placeholder`
- `searchPlaceholder`
- `emptyText`
- `onChange`
- `allowClear`
- `disabled`
- `className`

Current behavior before this phase:

- Click trigger toggled dropdown.
- Dropdown search filtered by label, description, badges, and keywords.
- Search input focused after open.
- Document `mousedown` closed the dropdown when clicking outside.
- Long option lists scrolled with `max-h-72`.
- Clear action called `onChange(undefined)`.

Gaps found:

- No explicit Escape close path.
- No ArrowUp/ArrowDown highlighted option movement.
- No Enter selection for the highlighted option.
- No basic combobox/listbox ARIA semantics.
- Query reset was not centralized for every close path.
- Dropdown z-index and option badge truncation could be slightly more robust.

## Fixes Applied

- Added a highlighted-option state for keyboard navigation.
- Added Enter, Space, ArrowDown, ArrowUp, Escape, and Tab support:
  - Enter/Space use native button activation to open the trigger.
  - ArrowDown on trigger opens the dropdown.
  - ArrowDown/ArrowUp in search moves the highlighted enabled option.
  - Enter in search selects the highlighted option.
  - Escape closes the dropdown and returns focus to the trigger.
  - Tab closes the dropdown while allowing normal focus movement.
- Consolidated close behavior so outside click, Escape, Tab, selection, clear, and trigger close reset query/highlight state.
- Switched outside close listener to `pointerdown`.
- Added basic ARIA semantics:
  - trigger uses `role="combobox"`;
  - trigger exposes `aria-expanded`, `aria-controls`, and `aria-haspopup="listbox"`;
  - dropdown uses `role="listbox"`;
  - options use `role="option"` and `aria-selected`;
  - search input has `aria-label`, `aria-controls`, and `aria-activedescendant`.
- Raised dropdown layering to `z-[80]`.
- Tightened dropdown overflow with `max-h-64 overflow-y-auto overscroll-contain`.
- Improved long option rendering with truncated labels and capped badge width.
- Preserved all existing public props and current call-site behavior.

## Usage Regression Checklist

AI Workbench dataset selector:

- [ ] Click opens dropdown.
- [ ] Search input focuses.
- [ ] Search by filename, dataset id, schema keyword, or catalog keyword filters options.
- [ ] Arrow keys move highlighted option.
- [ ] Enter selects highlighted option.
- [ ] Clear resets selected dataset.
- [ ] Context Panel updates.

AI Workbench relationship set selector:

- [ ] Click opens dropdown.
- [ ] Search by relationship set name or included dataset name filters options.
- [ ] `不使用关系组` remains selectable.
- [ ] Selection updates Context Panel.

AI Workbench history selector:

- [ ] Search by analysis type, status, dataset, or AI-ready label filters options.
- [ ] Selecting history item updates result context.
- [ ] Result follow-up remains deterministic.

RelationshipReviewPanel:

- [ ] Active relationship set selector still works.
- [ ] Relationship inference multi-dataset selection is unaffected.

Shared DatasetSelector / SmartProcess:

- [ ] Dataset search and selection work.
- [ ] Preprocessing behavior is unchanged.

Catalog pages:

- [ ] Datasets page catalog search still works.
- [ ] History page catalog search still works.

## Validation Results

- `cd app && npx.cmd tsc --noEmit`: passed.
- `cd app && npm.cmd run build`: passed with the existing Vite large chunk warning.

Backend validation is not required because no backend files changed.

## Known Limitations

- `SearchableSelect` is still a lightweight local component, not a full design-system combobox with portals, grouped options, async search, or full screen-reader pattern parity.
- Dropdowns still position absolutely inside their local container. No portal was added because current usages do not require it.
- Catalog pages intentionally keep standalone search/filter controls because they are list-browsing surfaces, not single-value selectors.

## Next Recommended Phase

If selector complexity grows, consider a design-system combobox pass with grouped options, optional portal rendering, and automated browser accessibility smoke tests.
