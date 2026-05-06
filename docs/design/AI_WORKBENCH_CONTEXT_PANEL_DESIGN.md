# AI Workbench Context Panel Design

## Purpose

The AI Workbench Context Panel is the reusable context surface for the assistant. It replaces the old preview-only right panel.

The panel must explain what context the assistant is allowed to consider without running analysis, joining data, or generating SQL.

## Context Levels

1. Dataset context
   - selected primary dataset;
   - schema and first 5 preview rows;
   - quality and size metadata.

2. Relationship set context
   - topic-scoped dataset graph;
   - connected tables;
   - isolated/reference tables;
   - confirmed edges;
   - high-risk edges.

3. Analysis history context
   - future placeholder for selected historical results and follow-up suggestions.

## Safety Rules

- Do not auto-run analysis.
- Do not auto-join datasets.
- Do not generate SQL.
- Do not persist preview rows.
- Do not fetch every relationship-set table automatically.
- Keep relationship sets as allowed context, not required datasets.

## Preview Rules

- Primary dataset preview may load automatically.
- Relationship-set table previews are lazy and per-table.
- Preview cache is component-local and session-only.

## Phase 4B-8G Update: Collapsible Context Modules

Context Panel modules are collapsible so the right-side AI Workbench area stays usable as context grows.

Section state is stored in `sessionStorage.insightease_ai_workbench_context_panel_sections` as boolean open/closed values only. No raw preview rows, raw result tables, or generated analysis output are persisted.

Default behavior:

- Current dataset summary and relationship set summary are open.
- Sample rows, long field summaries, isolated/reference tables, and long relationship lists start collapsed.
- High-risk relationship context is open when high-risk edges exist.
- Relationship-set table previews remain lazy and per-table.

## Phase 4B-8G Update: Initial Analysis History Context

The Context Panel now has an initial analysis history context section. It can list recent analysis items, search them, select one as context, and show a compact safe summary.

The history context is display-only in this phase:

- It does not trigger AI explanation.
- It does not rerun analysis.
- It does not persist raw result data.
- AI Workbench session persistence stores only `selected_analysis_history_id`.

## Phase 4B-8H Update: Safe Result Summary Contract

The inline history result preview now renders from the shared `SafeResultSummary` contract.

Rules:

- Build summaries with `buildSafeResultSummary`.
- Show existing `ai_summary` or `ai_interpretation` only; do not generate explanations.
- Cap table previews to 5 rows.
- Summarize nested objects by keys/counts.
- Do not store raw result data in sessionStorage.

See `docs/design/SAFE_RESULT_SUMMARY_CONTRACT.md`.

## Phase 4B-8I Update: Result Handoff

AI Workbench can now receive result context from History and supported analysis pages through a temporary handoff payload.

Behavior:

- Open AI Workbench programmatically.
- Attach selected `analysis_id` and/or `SafeResultSummary`.
- Show result context in the analysis history section.
- Show follow-up prompt chips.
- Do not auto-run analysis or auto-generate explanations.

## Phase 4B-8J Update: Default Layout and Follow-up Responses

AI Workbench now defaults to horizontal side-by-side layout when no saved preference exists. Saved user layout preference is still preserved.

When a result context is attached, supported follow-up prompts are answered deterministically from `SafeResultSummary`; unsupported prompts continue to the normal planner path.

## Phase 4B-10B Update: Searchable History Selector

The analysis history selector in the Context Panel now uses a single searchable dropdown instead of a separate search input and native select.

History options use deterministic Analysis History Catalog metadata:

- analysis type label;
- status label;
- dataset id/name;
- created time;
- AI-ready label;
- bounded safe-summary labels and result keys.

Selecting a history item still only prepares bounded result context. It does not rerun analysis or generate an AI explanation.

## Phase 4B-10C Update: Searchable Selector Accessibility Polish

The shared selector used by the Context Panel history picker now has lightweight combobox polish:

- Escape closes the dropdown without changing selection.
- ArrowUp/ArrowDown move the highlighted option.
- Enter selects the highlighted option.
- Tab closes the dropdown while allowing normal focus movement.
- Clicking outside closes and resets the local search query.
- Trigger, listbox, and options expose basic ARIA attributes.

This remains a local, dependency-free selector. It is not yet a full portal-based design-system combobox.

## Phase 4B-10D Update: Result Page Handoff Coverage

AI Workbench can now receive direct safe result handoffs from:

- History result dialogs;
- Statistics result pages;
- Forecast result pages;
- PathAnalysis result pages;
- Attribution result pages.

The Context Panel continues to render only bounded `SafeResultSummary` context. Opening AI Workbench from a result page does not rerun analysis and does not generate an explanation until the user asks a follow-up prompt.
