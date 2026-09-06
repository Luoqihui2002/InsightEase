# P0D personal computer handoff — 2026-09-06

## Repository alignment

- Local repository: `C:\Users\cc249\InsightEase`.
- Remote: `https://github.com/Luoqihui2002/InsightEase.git`.
- Initial branch: `phase-4b-11b-hermes-result-explainer-live`.
- Initial HEAD: `2103fbd706ad7748180263a92058c6e9c317223d`.
- Initial tracked/untracked working changes: none; stash list: empty.
- Fetched origin and switched to existing remote branch
  `codex/v1.0-p0d-e2e-demo-portfolio`, with upstream tracking.
- Current HEAD/upstream: `57642db9f63907bbc0955d8b96636954a99998c7` (0 ahead / 0 behind before local edits).
- Latest fetched master: `5ac52774846af42bdf15ff6e5ce7e4e4ac9ae27b`.
  It is an ancestor of P0D, which is four commits ahead.
- P0A `cc0a466`, P0B `f36ba0f`, P0C `8c3bc59`, P0D `57642db` are present.
- Original local branches, ignored local configuration, and data were preserved.
  No reset, stash, rebase, commit, or push was performed.

This aligns the computer with company progress published on GitHub. Unpushed
company-device changes cannot be verified from this computer.

## Minimal compatibility fix

The fetched P0D source still used `/chat/completions` for both planning and
explanation. Both now use `/v1/chat/completions`; health remains `/health`.
Base URLs must be Gateway roots, without `/v1` appended.

Production behavior changed only in those two endpoint strings. P0B request and
response schemas, semantic validation, deterministic fallback, payload boundaries,
authentication, timeouts, and execution restrictions were not changed.

Tests assert method, full URL, token forwarding, and timeout for both chat callers
and health, with and without a trailing slash. Existing bounded-metadata and
explanation-hints assertions remain. Updated the environment example and linked
cross-device setup instructions.

## Verification on this computer

| Check | Result |
|---|---|
| Frontend dependency install | PASS: `npm ci --no-audit --no-fund`, 425 packages |
| Frontend lint | PASS: 0 errors, 355 existing warnings |
| Frontend production build | PASS: 2,978 modules; existing large-chunk and Browserslist warnings |
| Backend full pytest suite | PASS: 112 passed, 6 skipped, 5 warnings; 15.34 s |
| Whitespace validation | PASS: `git diff --check` |

The initial plain `npm ci` did not exit after installing dependencies and running
its install script; it was stopped and retried with ancillary audit/funding disabled.
The lockfile and dependency versions were unchanged. Lint/build were rerun after
the successful install. This is not an npm audit pass.

The default Anaconda Python lacked FastAPI. A project-local ignored `.venv` was
created with Python 3.13 and the full `requirements-dev.txt` dependencies. The old
backend `.env` contains the removed `KIMI_API_KEY` setting and fails strict settings
validation. It was preserved. Tests ran from the repository root, without loading
that old backend `.env`:

```powershell
.\.venv\Scripts\python.exe -m pytest -q -rs insightease-backend/tests
```

The six skipped tests explicitly require a running backend and
`INSIGHTEASE_RUN_INTEGRATION=1`. They are not real-provider evidence. Backend
requirements are not version-locked, so source alignment does not establish
identical dependency versions to the company environment.

## Runtime and evidence boundary

At inspection, local loopback ports 3306, 8000, 8642, and 5173 were unreachable.
No MySQL, app, or Gateway service was started in this task. No provider request was
made and no actual provider credential was changed.

The user-provided company/server evidence confirms healthy Gateway `/health`,
Bearer authentication, DeepSeek `deepseek-v4-flash`, successful CLI use, and a
successful authenticated `/v1/chat/completions` response. This task did not rerun
those server checks. Structured AnalysisPlan and actual ResultView explanation
remain unverified.

## Next smoke test and release gates

Follow [the environment checklist](P0D_DEMO_ENV_CHECK.md#hermes-gateway-endpoint-contract-and-cross-device-setup).
Migrate the preserved local configuration, establish an SSH tunnel to the existing
Gateway, and start MySQL/backend/frontend. Set backend live mode and
`HERMES_MODEL=deepseek-v4-flash`, a Gateway root base URL, and the backend-only auth
token. A smoke-test timeout of `HERMES_ASSISTANT_TIMEOUT_MS=60000` fits the existing
65-second frontend planning/explanation timeout; measure actual latency.

1. Status must report `live_available`. Upload demo data, confirm and activate the
   users/orders relationship, and submit the flagship question through Workbench.
2. Require `data.plan.source=hermes_live`, both fallback flags false, valid schema
   and references, and multi-table readiness `needs_join`. HTTP 200 alone is not
   sufficient. Planning must not execute joins or analyses.
3. Complete browser flow: explicit preview/create, exactly one persisted derived
   dataset with lineage, manual analysis, ResultView, and comparison with ground truth.
4. Ask the three real Hermes result questions using only SafeResultSummary.
5. Reset and repeat the complete flow; capture loading/failure/safety evidence.
6. Capture eight fresh P0D screenshots and the flagship demo recording.

V1.0 remains not release-ready until these gates pass. No P1/core feature work
was started. This hotfix remains a local uncommitted change for review.
