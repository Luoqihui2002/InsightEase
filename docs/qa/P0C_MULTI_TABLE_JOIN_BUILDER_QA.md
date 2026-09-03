# P0C Multi-table Join Builder Manual QA

## Setup

1. Apply `insightease-backend/migrations/20260903_add_join_lineage_fields.sql` to an existing database.
2. Start the authenticated frontend/backend stack.
3. Upload `manual-test-data/csv/01_users.csv`, `02_orders.csv`, and a related touchpoint/event dataset.
4. Create an active Relationship Set and confirm the exact join edges.

## Two-table happy path

- [ ] Ask a question whose plan requires users and orders.
- [ ] Verify the plan is `needs_join` and shows `创建分析数据集`.
- [ ] Open the builder and verify goal, sources, key fields, join type, and retained fields.
- [ ] Verify no Dataset exists before preview.
- [ ] Click preview and verify row counts, cardinality, match/null/duplicate rates, multiplier, grain, and rows.
- [ ] Verify no Dataset exists after preview.
- [ ] Confirm creation and verify one new Dataset appears in Dataset Catalog.
- [ ] Continue to the suggested analysis page and verify the derived dataset is prefilled.
- [ ] Verify the analysis does not start automatically.

## Three-table path

- [ ] Generate a plan with exactly three connected required datasets.
- [ ] Verify two deterministic ordered steps are displayed.
- [ ] Preview and confirm both step summaries and final aggregate risk are shown.
- [ ] Create and verify all three source ids are present in lineage metadata.

## Relationship and ownership safety

- [ ] Change one required edge to `requires_confirmation`; verify Join cannot execute.
- [ ] Switch away from the plan's Relationship Set; verify the builder asks to restore it.
- [ ] Remove or alter an exact edge; verify preview is rejected.
- [ ] Attempt a request with another user's dataset id; verify a generic not-found response with no path/owner details.

## Risk and limits

- [ ] Use duplicate keys on both sides; verify `N:N` and high risk are shown.
- [ ] Verify high risk requires the extra explicit confirmation.
- [ ] Use sufficiently repeated keys to cross the multiplier limit; verify preview is blocked and creation disabled.
- [ ] Use null and partially matching keys; verify warnings and metrics are accurate and nulls do not match.
- [ ] Verify same-named non-key fields receive stable right-dataset prefixes rather than `_x` / `_y`.

## Regression

- [ ] Single-table plans still use the existing confirmation/prefill path.
- [ ] Dataset upload, preview, DataWorkshop preview/save, analysis execution, ResultView, and Hermes result explanation still work.
- [ ] Browser console has no new errors during the P0C flow.
