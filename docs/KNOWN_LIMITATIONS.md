# Known Limitations

InsightEase V1 intentionally has a bounded scope:

- Relationship Sets persist in browser-local storage; they are not server-synchronized or shared across devices.
- The Analysis Dataset Builder supports two or three source tables and confirmed equality-key relationships only.
- Execution is bounded, in-process pandas over uploaded CSV/Excel files; it is not a large-data or distributed engine.
- The assistant does not generate or execute arbitrary SQL, and the product has no database or warehouse connectors.
- Derived dataset creation is explicit and immutable with respect to source datasets, but there is no production audit-log product.
- Database schema changes use checked-in manual SQL migrations rather than a fully managed migration workflow.
- The frontend lint baseline contains historical warnings, although release checks require zero lint errors.
- Hermes live planning and result explanation require a separately configured compatible provider. Disabled, dry-run, unavailable, or invalid provider responses use or require an explicitly labelled deterministic fallback.
- Relationship inference is metadata-based and can be wrong; user confirmation is required before a relationship is eligible for a JoinPlan.
- Analysis modules are existing bounded workflows, not a general autonomous analyst. Complex cross-module root-cause questions may require two manual analyses.
