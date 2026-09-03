# P0D End-to-End Acceptance Record

Date: 2026-09-03

Branch: `codex/v1.0-p0d-e2e-demo-portfolio`

Baseline commit: `8c3bc59d32aaf333c916ca68edfc0eb58ec9f579`

This record distinguishes executed evidence from intended steps. API/unit evidence is not presented as browser E2E evidence.

## Offline acceptance

| Step | Expected | Observed | Result | Notes |
|---|---|---|---|---|
| Generate demo data | Fixed seed produces stable files | Two consecutive generations produced identical SHA-256 hashes | PASS | seed `20260903` |
| Ground truth | 24.0% → 18.8% overall CVR | -5.20 pp; mix -2.56 pp; within-channel -2.64 pp | PASS | generated from cohort rules |
| Data grain | users unique; orders duplicated by user | 2,000 unique users; 594 orders; real 1:N edge | PASS | synthetic data only |
| pandas reference join | Exact bounded LEFT join | 2,054 rows, 15 columns, 1.0270×, 27.00% match | PASS | `validate_demo_data.py` |
| Product join engine | Match pandas and expose grain/risk | 2,054 rows, 15 columns, 1:N, likely-detail grain, medium risk | PASS | automated test against committed CSV |
| Preview side effect | Preview persists nothing | Pure preview engine exercised; persistence path not called | PASS | existing P0C unit coverage also verifies boundary |
| Hermes status | Live provider available | disabled / unavailable | FAIL | no provider configuration |

## Required browser flow

| Step | Expected | Observed | Result | Notes |
|---|---|---|---|---|
| Register / login | Demo user enters application | Not run | BLOCKED | MySQL/backend unavailable |
| Upload four CSV files | Four owned datasets appear | Not run | BLOCKED | backend unavailable |
| Dataset Catalog/profile | Grain and schema visible | Not run | BLOCKED | runtime unavailable |
| Relationship inference | users→orders detected | Not run | BLOCKED | runtime unavailable |
| Review and activate set | Confirmed 1:N edge in active set | Not run | BLOCKED | runtime unavailable |
| Ask flagship question | Planning request starts visibly | Not run | BLOCKED | runtime unavailable |
| Hermes live plan | `source=hermes_live`, `fallback_used=false`, `needs_join` | Not run | BLOCKED | Hermes disabled/unconfigured |
| Join Builder | Shows relationship, cardinality, row counts, match, grain and risk | Not run in UI | BLOCKED | engine behavior passes offline |
| Preview | Creates zero datasets | Not run in UI | BLOCKED | persistence boundary covered in tests |
| Explicit create | Creates exactly one derived dataset with lineage | Not run in UI | BLOCKED | requires database |
| Navigate to analysis | Derived dataset prefilled | Not run | BLOCKED | requires browser runtime |
| Manual analysis start | No automatic execution | Not run | BLOCKED | requires browser runtime |
| ResultView | Key metrics/table/chart/caveat readable | Not run | BLOCKED | requires browser runtime |
| Workbench handoff | SafeResultSummary attached only after user action | Not run | BLOCKED | requires browser runtime |
| Three Hermes questions | Ground-truth aligned bounded explanation | Not run | BLOCKED | Hermes unavailable |
| Second clean run | Full sequence repeats | Not run | BLOCKED | first browser run unavailable |

## Loading, failure, and safety states

| State | Required observation | Result |
|---|---|---|
| Hermes planning loading | Visible, no automatic execution | NOT OBSERVED |
| Join preview loading | Visible and bounded | NOT OBSERVED |
| Analysis running | Visible until ResultView | NOT OBSERVED |
| Hermes explanation loading | Visible and retry/fallback is honest | NOT OBSERVED |
| Failure response | No stack trace or secret in UI | Covered by backend tests/static code, not browser-observed |
| LLM join executions | Must be zero | Architecture/tests indicate zero; browser run pending |
| SQL execution | Must be zero | No SQL execution feature exists |
| Source mutation | Must be zero | Join service creates a new dataset; browser run pending |

## Screenshot status

Existing historical product screenshots remain in `docs/assets/interview/`, but the required P0D sequence (`01`–`08`, especially Hermes live plan and Join Preview) was not captured. Renaming historical images would misrepresent evidence, so no placeholder P0D screenshots were created.

## Acceptance decision

`V1.0 NOT READY` in this environment. The deterministic data and execution checks pass, but AC1, AC2–AC8 browser evidence, AC6 live explanation, repeatability, and the final screenshot set remain open.
