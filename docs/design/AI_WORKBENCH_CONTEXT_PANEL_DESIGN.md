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
