# V1.0 P0D — End-to-End Demo & Portfolio Finalization

Date: 2026-09-03

Branch: `codex/v1.0-p0d-e2e-demo-portfolio`

Starting commit: `8c3bc59d32aaf333c916ca68edfc0eb58ec9f579`

## 1. Scope

P0D prepares one flagship conversion-decline demo, verifies deterministic data/join truth, attempts the real Hermes/browser release gates, and produces accurate portfolio/interview material. It does not add analysis algorithms, SQL/connector support, automatic execution, new Join modes, server-side Relationship Sets, or release packaging.

## 2. Release Baseline

The clean P0C commit passed:

- frontend dependency install: PASS (425 packages);
- frontend lint: PASS with 0 errors / 355 historical warnings;
- frontend build: PASS (2,978 modules, approximately 6.84 s; existing large-chunk warnings);
- backend pytest: 105 passed, 6 skipped, 5 warnings;
- `git diff --check`: PASS.

The skipped tests are environment-dependent integration tests and were not counted as Hermes live evidence.

## 3. Demo Dataset Design

Added `manual-test-data/demo-v1/` with:

- 2,000 users at user grain;
- 594 orders at order grain with naturally duplicated `user_id`;
- 2,351 acquisition/retargeting touchpoints;
- 8,005 funnel events;
- a standard-library generator with fixed seed `20260903`;
- a pandas validator and committed generated CSVs.

Users and orders are required for the flagship derived dataset. Marketing touchpoints and event log are candidate/reference evidence. Exact cohort/funnel counts encode the causal pattern; randomness affects only non-causal details.

## 4. Ground Truth

The generated truth records:

- overall CVR 24.0% → 18.8% (-5.20 pp);
- traffic-mix effect -2.56 pp;
- within-channel effect -2.64 pp;
- social_ads share 15% → 40%;
- social_ads CVR 16% → 10%;
- social_ads checkout → payment success 53.3% → 33.3%;
- organic as the best channel and social_ads as the worst recent channel.

Two independent generator runs produced byte-identical CSV and ground-truth SHA-256 hashes.

## 5. Real Hermes Smoke Test

Status: **BLOCKED / NOT EXECUTED**.

Safe configuration inspection reported:

- `HERMES_ASSISTANT_ENABLED=false`;
- mode `disabled`;
- live configuration absent;
- status provider/availability `disabled`;
- configured model label `hermes-agent` (not contacted).

No token, key, or provider URL was recorded. No dry-run/mock/fallback result is presented as a live smoke. Provider/model latency, `source=hermes_live`, `fallback_used=false`, and live semantic validation remain release gates.

## 6. E2E Flow

The required UI sequence is recorded step by step in `docs/qa/P0D_E2E_ACCEPTANCE.md`. The browser flow could not start because MySQL, backend, and frontend were unreachable and no usable local database/container runtime was available.

## 7. Bugs Found

1. A users LEFT JOIN orders with a legitimate low conversion match rate was classified high risk solely because fewer than half of base keys matched, even though LEFT JOIN preserved all base rows.
2. Current user-facing fallback warnings still described the Analysis Dataset Builder as a future P0C step.
3. Root README retained multiple historical architecture diagrams and phase handoff language, obscuring the V1 boundary.
4. Deployment/onboarding material included stale behavior and infrastructure-oriented wording unsuitable for the current public V1 story.

## 8. Bugs Fixed

- Low-match LEFT JOIN is now medium risk with an explicit null-detail warning; low-match INNER JOIN remains high risk because it discards base records. N:N, cardinality mismatch, and row-explosion controls are unchanged.
- Removed P0C/future-phase wording from runtime fallback actions and warnings.
- Added regression tests for LEFT versus INNER information-loss risk and the committed flagship dataset.
- Replaced the root README with one accurate current architecture and explicit evidence status.
- Updated onboarding/deployment guidance to match deterministic Join execution and secret-safe configuration.

## 9. Join Validation

Pandas reference and the production pure Join engine both report:

- relationship: users.user_id 1:N orders.user_id;
- LEFT join rows: 2,054;
- columns: 15;
- row multiplier: 1.0270×;
- matched base users: 27.00%;
- result grain: likely detail/order;
- risk: medium after the preserving-LEFT correction;
- colliding `cohort_period` field safely renamed `orders__cohort_period`.

Database persistence/lineage remains covered by P0C automated tests, but the flagship derived record was not created in a real browser environment.

## 10. Analysis Validation

Offline cohort, channel, funnel, paid-user, and join invariants pass. The direction and exact figures are fixed in `GROUND_TRUTH.md`. A real ResultView from the manually started analysis page was not produced because the runtime was unavailable, so AC5 is not fully satisfied.

The intended narrative may use two existing modules: Statistics for cohort/channel rates and Path Analysis on event log for funnel localization. No new “channel conversion analyzer” was added.

## 11. Result Explanation Validation

Status: **BLOCKED / NOT EXECUTED**. The three required questions are preserved in the demo script and E2E record. SafeResultSummary boundary unit tests pass in the existing suite, but a real Hermes explanation of an actual flagship ResultView was not available.

## 12. UI Polish

No speculative redesign was performed. The only current-path wording cleanup removes stale phase labels. The join risk correction makes the flagship preview accurately explain preserved unmatched users without weakening dangerous INNER/N:N/expansion handling.

## 13. Automated Regression

Final P0D results:

- frontend lint: PASS, 0 errors / 355 known warnings;
- frontend production build: PASS, 2,978 modules, 7.95 s; existing chunk-size warning remains;
- backend pytest: 108 passed, 6 skipped, 5 warnings in 21.07 s;
- demo generation and invariant/pandas reference validation: PASS;
- `git diff --check`: PASS.

The six skipped tests remain external integration tests and do not satisfy the live Hermes gate.

## 14. Browser QA

No browser pass is claimed. Required runtime ports 5173/3000, 8000, and 3306 were closed. The acceptance table marks each unobserved browser step BLOCKED and keeps API/unit evidence separate.

## 15. Portfolio Assets

Completed:

- rewritten public README with one architecture diagram;
- reproducible demo pack and generated ground truth;
- environment and reset checklists;
- detailed E2E evidence record;
- 2–4 minute flagship script;
- accurate known limitations.

Not completed:

- the fresh P0D `01`–`08` screenshot sequence;
- a real-provider demo recording.

Historical screenshots were not renamed as new evidence.

## 16. Interview Assets

Added:

- 30-second, 2-minute, and 5-minute narratives;
- ten architecture/safety interview answers;
- STAR project deep dive;
- Hermes hallucination and Join-risk technical deep dives;
- Chinese and English resume bullets with a live-gate claim guard.

## 17. Known Limitations

`docs/KNOWN_LIMITATIONS.md` documents browser-local Relationship Sets, 2–3 table equality joins, bounded CSV/Excel/pandas execution, no SQL/distributed engine/connectors, manual DB migrations, historical frontend warnings, and the external requirement for a real Hermes provider.

## 18. Remaining Release Gates

1. Configure a real Hermes-compatible provider and pass planning with `source=hermes_live`, `fallback_used=false`, valid references, and `needs_join`.
2. Start reachable MySQL/backend/frontend services and execute the entire UI flow from registration through result explanation.
3. Validate one real persisted derived dataset and actual analysis output against the fixed ground truth.
4. Ask all three result questions through real Hermes and verify bounded, non-invented findings.
5. Reset and repeat the full flow.
6. Capture the fresh eight-screen portfolio sequence and record the flagship demo.

## 19. V1.0 Readiness Decision

# V1.0 NOT READY

The offline data, deterministic Join correctness, risk semantics, tests, and portfolio text are ready. Real Hermes planning/explanation and the complete browser E2E are mandatory release gates and could not be executed in the available environment. P0D therefore stops here and does not enter P1 Release Packaging.
