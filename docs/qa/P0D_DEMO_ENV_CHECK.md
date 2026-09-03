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
