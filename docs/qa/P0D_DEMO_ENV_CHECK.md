# P0D Demo Environment Check

Run this checklist immediately before recording or presenting the flagship demo. Never record tokens, passwords, or the full provider URL in evidence.

## Required configuration

Backend `.env` (uncommitted):

```dotenv
ENVIRONMENT=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=insightease_app
DB_PASSWORD=<local-secret>
DB_NAME=insightease
HERMES_ASSISTANT_ENABLED=true
HERMES_ASSISTANT_MODE=live
HERMES_BASE_URL=<hermes-compatible-base-url>
HERMES_AUTH_TOKEN=<backend-only-secret>
HERMES_MODEL=<available-model>
```

Frontend `.env.local` (uncommitted):

```dotenv
VITE_ASSISTANT_RUNTIME_PROVIDER=hermes_live
```

## Hermes Gateway endpoint contract and cross-device setup

Use the Gateway root as `HERMES_BASE_URL` (no `/v1` suffix). The backend probes
`GET /health` and sends both planning and explanation to `POST /v1/chat/completions`.
For the verified server setup, the model is `deepseek-v4-flash`; the Gateway Bearer
credential belongs only in backend `HERMES_AUTH_TOKEN`.

`127.0.0.1` refers to the machine running the backend. On a personal computer,
first establish an SSH tunnel to the existing Gateway server, using your actual
SSH destination (the placeholder below must be replaced):

```powershell
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:8642:127.0.0.1:8642 ubuntu@<gateway-server>
```

Keep the tunnel open and use `HERMES_BASE_URL=http://127.0.0.1:8642` locally.
If the backend runs in a container, its loopback is separate and needs an
appropriate host/tunnel address. Do not expose the Gateway publicly to solve this.

When resuming an older checkout, preserve the existing local `.env` privately,
then migrate its supported settings against `.env.example`. In particular,
`KIMI_API_KEY` was removed in P0A and causes settings validation to fail if retained
in the active `.env`. Do not weaken settings validation to accept obsolete keys.

After status is `live_available`, sign in and upload the four demo CSVs. Confirm
and activate the users-to-orders relationship, then ask the flagship question in
Workbench. Inspect `/api/v1/assistant/hermes/plan-analysis` and require:

- `data.plan.source=hermes_live`;
- `data.fallback_used=false` and `data.plan.fallback_used=false`;
- valid dataset, field, and confirmed relationship references;
- `data.plan.execution_readiness=needs_join` for the multi-table case;
- no Join, analysis execution, SQL, or mutation until explicit user action.

Record elapsed time, model, validation outcome, and fallback state. Capture token
usage only if available in provider-side diagnostics, without secrets or raw rows.
A successful plain-text Gateway reply alone does not pass structured-plan acceptance.

## Preflight checklist

| Check | Expected evidence |
|---|---|
| Frontend reachable | `http://localhost:5173` renders the login or application page |
| Backend reachable | `http://localhost:8000/` returns the public service/version payload |
| MySQL reachable | Backend starts and initializes metadata tables without connection errors |
| Hermes health available | `/api/v1/assistant/hermes/status` reports `availability=live_available` |
| Hermes live mode enabled | Status reports `provider=hermes`, `mode=live`, `available=true` |
| Frontend runtime | Workbench status shows Hermes Live; a successful plan badge says `AI Plan · Hermes Live` |
| Demo login | A dedicated synthetic demo user can register or log in |
| Demo files | The four files under `manual-test-data/demo-v1/` exist |
| Relationship state | No unrelated active Relationship Set is selected |
| Derived data state | No earlier derived dataset can be confused with this run |

## Safe status commands

From `insightease-backend/`, these commands reveal capability state but not secrets:

```bash
.venv/bin/python -c 'from app.core.config import settings; print(settings.HERMES_ASSISTANT_ENABLED, settings.HERMES_ASSISTANT_MODE_SAFE, settings.HERMES_LIVE_CONFIGURED, settings.HERMES_MODEL)'
curl -sS http://localhost:8000/api/v1/assistant/hermes/status
```

Proceed only if the status response is live and available. `dry_run`, `disabled`, `misconfigured`, `live_unavailable`, or a plan with `fallback_used=true` does not satisfy the P0D live gate.

## P0D execution record — 2026-09-03

| Check | Observed | Result |
|---|---|---|
| Frontend ports 5173/3000 | closed | BLOCKED |
| Backend port 8000 | closed | BLOCKED |
| MySQL port 3306 | closed | BLOCKED |
| Local database/container runtime | no usable client/runtime detected | BLOCKED |
| Backend Hermes configuration | enabled=false, mode=disabled, live_configured=false | BLOCKED |
| Hermes status contract | provider=disabled, availability=disabled | BLOCKED |
| Demo CSV and ground truth | generated and offline-validated | PASS |

No real provider request was attempted because the required backend-only configuration was absent. This is a release-environment blocker, not a passing smoke test.
