# P0D Gate 1 — Real Hermes Structured Planning Smoke

**P0D REAL HERMES PLANNING GATE: PASS**

Final live response: 2026-09-06T16:29:00.016+00:00 (2026-09-07 00:29:00 Asia/Shanghai).
This is a successful smoke after explicit user clarification and a retry; it is
not evidence of a zero-fallback rate or repeatable provider reliability.

## Environment and Git alignment

- Personal Windows repository: `C:\Users\cc249\InsightEase`.
- Branch: `codex/v1.0-p0d-e2e-demo-portfolio`.
- HEAD and upstream: `f6f8674e85189fb8c74d42fcae585d0a906a708a`.
- Origin: `https://github.com/Luoqihui2002/InsightEase.git`.
- Endpoint hotfix committed and pushed as `fix: align Hermes Gateway chat endpoint`.
- Fresh fetch during final verification: HEAD/upstream 0 ahead, 0 behind.
- Fetched master `5ac52774846af42bdf15ff6e5ce7e4e4ac9ae27b` is an ancestor of HEAD.
- P0A `cc0a466`, P0B `f36ba0f`, P0C `8c3bc59`, P0D `57642db` are present.
- Initial personal-PC checkout was `2103fbd`, with no working changes or stashes.
  Existing branches, ignored configuration, and data were preserved.
- At Gate 1 completion, the additional fixes/tests and report were local and uncommitted.
  Gate 2 closure commits this reviewed set after rerunning regression; its SHA is
  recorded in the Gate 2 QA report.
  No unknown changes were overwritten; no history rewrite or force push occurred.
- Alignment covers company progress published on GitHub; unpublished company-PC
  changes cannot be verified here. The prior handoff document is historical.

Frontend: `http://127.0.0.1:5173/`, visible logged-in browser, runtime
`hermes_live`. Backend: `http://127.0.0.1:8000/`. Python 3.13, Node 24, npm 11.
The user-provided cloud MySQL connection is used; a local MySQL installation is
not needed. The original backend `.env` was preserved. Ignored `.env.local` files
supply current supported runtime configuration, with no obsolete Kimi setting.
No credential was committed. The backend receives the Gateway bearer token,
not a DeepSeek credential.

## Tunnel, Gateway and backend status

The user established SSH forwarding of local 8642 to remote 127.0.0.1:8642.
Keep that SSH session open. Personal-PC checks passed:

- `GET /health`: status ok, platform hermes-agent.
- Authenticated `GET /v1/models`: accepted the Gateway bearer token; exposed ID
  hermes-agent. Actual planning responses identify `deepseek-v4-flash`.
- InsightEase `/api/v1/assistant/hermes/status`: provider hermes, mode live,
  available true, availability live_available.
- Gateway base URL is the root `http://127.0.0.1:8642`; health uses `/health`,
  both planning/explanation use `/v1/chat/completions`.
- Actual provider path: browser → InsightEase backend → SSH tunnel → Hermes
  Gateway → configured DeepSeek provider → deepseek-v4-flash response.

## Data and relationship setup through the UI

Uploaded the existing committed `manual-test-data/demo-v1/` CSVs through the
real upload control: users 2,000 rows; orders 594; marketing_touchpoints 2,348;
event_log 8,005. No replacement demo was generated.

| Dataset | Actual ID |
|---|---|
| orders.csv | `93bbc019-e68b-49a5-8042-d262a96bdb45` |
| users.csv | `1cf61809-c462-4967-b5ce-bb8999e5daf2` |
| marketing_touchpoints.csv | `543a685e-809e-4566-a6a4-9c1195e4f56b` |
| event_log.csv | `65b21d9d-95d6-4b2b-acaf-78b9c8c9540d` |

Created and activated `P0D 新客转化 · Gate 1` through the UI:
4 tables, 1 confirmed edge, 2 isolated/candidate reference tables. The confirmed
edge is orders.user_id → users.user_id, many_to_one (equivalent to users 1:N orders).
Its existing high-risk warning remains. Marketing/event edges were not confirmed;
they remain optional context and cannot silently enter a join. No localStorage
state was injected.

Before uploads, the existing cloud datasets table lacked P0C lineage columns.
With explicit user approval, applied the committed migration
`insightease-backend/migrations/20260903_add_join_lineage_fields.sql` unchanged:
4 nullable columns and 1 index. Table row count was 142 before and 142 after;
existing rows were not updated or deleted. Pre-migration schema retained locally.

## Question and explicit user clarification

The original flagship question was submitted through AI Workbench:

> 最近一个月新客转化表现为什么下降？请比较不同营销渠道的转化表现，并帮我定位主要原因。

The first semantically valid live plan requested clarification. The user then
explicitly approved the following demo definitions, which were appended to the
original question through the same UI:

- Main conversion: users.converted; orders first paid order cross-check.
- Compare cohort_period current_month versus previous_month.
- Channel dimension: users.acquisition_channel.
- marketing_touchpoints and event_log remain candidate reference context.
- Produce a plan for user review only.

The successful final request includes that approved clarification. The original
unclarified question alone did not satisfy the needs_join acceptance criterion.

## Final real provider evidence

| Check | Observation |
|---|---|
| Model returned by Gateway | deepseek-v4-flash |
| Plan ID | plan_p0d_new_user_conversion_decline_v1 |
| Plan source | hermes_live |
| Plan fallback_used | false |
| Outer response fallback_used | false |
| Strict Pydantic schema | PASS |
| Dataset/field/relationship semantic validation | PASS |
| Offline revalidation with unchanged validators | PASS; normalization idempotent |
| Supported analysis type | attribution |
| Required datasets | users.csv, orders.csv |
| Candidates | marketing_touchpoints.csv, event_log.csv |
| Required relationship | Confirmed orders.user_id → users.user_id |
| Clarifying questions | Empty |
| Execution readiness | needs_join |
| Next action | create_analysis_dataset |
| Gateway request latency | 71053 ms |
| Backend endpoint latency | 71251 ms |
| Prompt / completion / total token usage | 17533 / 9807 / 27340 |

All required, candidate and reference IDs exist in the supplied bounded context;
all referenced field names exist. Required/candidate sets are disjoint. All
required_fields (including optional items), metrics and relationship endpoints
belong to the required dataset subset. Required fields have nonempty column
lists. The only confirmed edge matches the active UI relationship set.

| Dataset | Field role | Columns | Required |
|---|---|---|---|
| users.csv | target_metric | converted | true |
| users.csv | time_column | cohort_period | true |
| users.csv | group_column | acquisition_channel | true |
| users.csv | user_id | user_id | true |
| orders.csv | join_key | user_id | true |
| orders.csv | time_column | cohort_period | true |
| orders.csv | feature | is_first_order | true |
| orders.csv | feature | payment_status | true |
| users.csv | dimension | register_date | false |
| orders.csv | dimension | order_date | false |

The real browser rendered `AI Plan · Hermes Live`, `需要多表分析数据集`, and the
`创建分析数据集` action. That action was **not clicked**. Earlier fallback and
clarification cards remain in conversation history for transparency.

## Failures, fixes and limitations

- Endpoint compatibility: both chat call sites corrected and covered for base URLs
  with/without trailing slash; health remains unchanged (commit f6f8674).
- Relationship cardinality: orders has 540 distinct user IDs in 594 rows. The
  previous >=90% uniqueness heuristic incorrectly implied 1:1. With explicit
  user approval, cardinality now uses exact unique/non-null counts, including
  nullable and rounded-rate edge cases. Scoring, warnings and risk checks remain.
- First local observation helper mishandled an empty OPTIONS body. Fixed only the
  temporary helper; the resulting frontend fallback is not provider evidence.
- Actual initial live planning timed out at 60,122 ms. Local backend budget was
  raised to 120,000 ms and frontend planning timeout to 125,000 ms. Explanation
  frontend timeout is unchanged. No timeout-based success is inferred.
- A response at 58,385 ms failed nested schema validation. The client now sends
  the canonical `AssistantAnalysisPlan.model_json_schema()` and strict JSON
  instructions instead of relying on top-level field names alone.
- Subsequent schema-valid responses at 65,984 and 80,003 ms failed semantic
  validation. The latter concretely referenced candidate-table fields in
  required_fields. Request wording now states existing subset/disjointness rules
  and the meaning of candidate_columns; validators were not changed.
- A 68,214 ms response was genuinely hermes_live with fallback false but correctly
  normalized to needs_clarification (business questions and empty required column
  lists). It was not counted as Gate PASS. User clarification was obtained.
- After clarification, one 72,557 ms response did not yield parseable plan JSON
  and fell back. An unchanged-code, same-input retry succeeded in 71,053 ms.
  Its earlier failed raw text was not captured, so the exact malformed formatting
  cause remains unknown. No parser relaxation or fabricated reference was added.
- Provider output remains variable and has substantial context/latency overhead.
  This gate establishes a real validated smoke, not a provider reliability SLA.

## Regression verification

- Frontend dependency installation: PASS (`npm ci --no-audit --no-fund`).
- Frontend lint: PASS, 0 errors / 355 existing warnings.
- Frontend production build: PASS (17.63 s); existing large-chunk warning remains.
- Final backend: **126 passed, 6 skipped, 5 warnings** (7.54 s).
- `git diff --check`: PASS.
- Six optional external integration tests were not enabled for this planning-only
  gate and are not real Hermes evidence.
- Tests include real demo cardinality, all cardinality directions, nulls,
  rounding near uniqueness, forwarded canonical schema, rejected malformed nested
  output, and field/metric/relationship references outside the required subset.
- Tests must run from repository root with backend on PYTHONPATH. Running inside
  the backend folder auto-loads the preserved obsolete `.env` and fails settings
  collection; this configuration issue was not bypassed by weakening settings.

No P0B schema, semantic validation, fallback, or execution safety boundary changed.

## Execution safety

The final actual planning request was 4,797 bytes of bounded context plus question.
The backend separately supplies the output schema. All four allow flags were
false (raw data, auto run, SQL generation, dataset mutation), and execution
confirmation was required. The unchanged payload validator passed.

Read-only post-response comparison with the pre-planning baseline verified:

- 4 source dataset records before and after; all source metadata unchanged.
- All 4 uploaded source-file SHA-256 hashes unchanged.
- 0 analysis records before and after; no derived dataset created.
- Observed write routes were upload, relationship inference and planning only;
  no Join, Transform or analysis execution route was invoked.
- No analytical SQL was generated/executed by this workflow. The explicitly
  authorized schema migration and read-only metadata audit SQL are separate.
- No demo screenshot/recording, result explanation, or Gate 2 operation occurred.

Temporary local diagnostics and detailed evidence are ignored under `.venv/`;
shared evidence omits credentials, auth headers, raw source rows and DB endpoints.

## Resume and next release gates

Keep the user's SSH tunnel and local frontend/backend running. Start the backend
from the repository root using the supported app and isolated runtime config:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir insightease-backend --env-file insightease-backend/.env.local --host 127.0.0.1 --port 8000
```

This turn stops at Workbench plan review. The next separately scoped gate is:
Join Preview → explicit derived dataset creation → manual analysis → ground truth
validation → ResultView → real Hermes result explanation. Screenshots/recording
and final portfolio polish follow successful E2E. No new core feature is needed.

**P0D REAL HERMES PLANNING GATE: PASS**
