# P0D Flagship Demo Reset

This procedure returns the demo to a repeatable state without adding a product reset button.

## 1. Regenerate the public data pack

From the repository root:

```bash
python3 manual-test-data/demo-v1/scripts/generate_demo_data.py
insightease-backend/.venv/bin/python manual-test-data/demo-v1/scripts/validate_demo_data.py
```

The validator must report 2,054 LEFT-join rows, 15 columns, a 1.0270 row multiplier, and 27.00% matched users.

## 2. Remove earlier demo records through the UI

Log in as the demo user. In Dataset Catalog, delete the four source datasets and any derived dataset created by the prior run. Delete associated analysis history where the UI exposes that action. This keeps ownership checks and storage cleanup on the normal API path.

Do not manually delete upload files while matching database records remain.

## 3. Clear browser-local assistant state

In the browser developer console for the local app, run:

```js
[
  'insightease_assistant_relationship_sets',
  'insightease_assistant_active_relationship_set_id',
  'insightease_assistant_confirmed_relationships',
  'insightease_assistant_rejected_relationship_ids',
].forEach((key) => localStorage.removeItem(key));
```

Reload the page. Keep the access token if reusing the same demo account; use the normal logout flow if a clean authentication run is required.

## 4. Confirm live runtime before uploading

- Backend status must report Hermes `live_available`.
- Frontend must be built or started with `VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_live`.
- Workbench must not label the generated plan as `Local Plan · Fallback`.

## 5. Recreate the scenario

1. Upload `users.csv`, `orders.csv`, `marketing_touchpoints.csv`, and `event_log.csv`.
2. Review inferred edges; confirm `users.user_id` → `orders.user_id` as 1:N.
3. Confirm the users → marketing touchpoints edge if inference proposes the correct fields.
4. Create and activate a Relationship Set containing all four datasets, with event log retained as reference context.
5. Ask the exact flagship question from `manual-test-data/demo-v1/README.md`.
6. Preview a users LEFT JOIN orders plan and explicitly create one derived dataset.
7. Manually start the chosen existing analysis module.

Repeat the complete flow once after this reset before recording. Preview alone must create zero datasets; the explicit confirmation must create exactly one.
