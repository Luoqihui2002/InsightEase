"""
Integration tests for transform endpoints.
Tests against the locally running backend (localhost:8000).
Requires the backend server to be running.

Run with: python -m pytest tests/test_transform_integration.py -v -s
"""

import os
import sys
import uuid
import tempfile
import pytest
import httpx

BASE_URL = "http://localhost:8000"
pytestmark = pytest.mark.skipif(
    os.getenv("INSIGHTEASE_RUN_INTEGRATION") != "1",
    reason="requires a running backend; set INSIGHTEASE_RUN_INTEGRATION=1 to enable",
)


@pytest.fixture(scope="module")
def auth_headers():
    """Register a test user, login, and return auth headers."""
    uid = str(uuid.uuid4())[:8]
    username = f"inttest_{uid}"
    email = f"{uid}@test.com"
    password = "testpass123"

    client = httpx.Client(base_url=BASE_URL)

    # Register
    r = client.post("/api/v1/auth/register", json={
        "username": username,
        "email": email,
        "password": password,
    })
    if r.status_code not in (200, 201):
        print(f"Register failed: {r.text}", file=sys.stderr)
        raise RuntimeError("Failed to register test user")

    # Login
    r = client.post("/api/v1/auth/login/json", json={
        "username": username,
        "password": password,
    })
    if r.status_code != 200:
        print(f"Login failed: {r.text}", file=sys.stderr)
        raise RuntimeError("Failed to login test user")

    token = r.json()["data"]["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    yield headers

    # Cleanup: delete user and datasets via direct DB or API if available
    # For simplicity we rely on manual cleanup or accept test data in dev DB
    client.close()


@pytest.fixture
def test_dataset(auth_headers):
    """Upload a test CSV and return its ID."""
    client = httpx.Client(base_url=BASE_URL)
    csv_content = "name,age,city,score\nAlice,25,NY,85.5\nBob,30,LA,90.0\nCharlie,35,NY,78.0\n"

    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write(csv_content)
        tmp_path = f.name

    with open(tmp_path, "rb") as f:
        r = client.post("/api/v1/datasets/upload", headers=auth_headers, files={"file": ("test.csv", f, "text/csv")})

    os.remove(tmp_path)
    assert r.status_code == 200, f"Upload failed: {r.text}"
    return r.json()["data"]["id"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_preview_success(auth_headers, test_dataset):
    client = httpx.Client(base_url=BASE_URL)
    r = client.post(
        f"/api/v1/datasets/{test_dataset}/transform/preview",
        headers=auth_headers,
        json={"operations": [
            {"type": "filter", "config": {"conditions": [{"column": "age", "operator": "gte", "value": "25"}], "logic": "and"}}
        ]},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 200
    data = body["data"]
    assert "columns" in data and "data" in data
    assert "total_rows" in data and "column_stats" in data and "execution_summary" in data
    assert data["execution_summary"]["steps_executed"] == 1


def test_transform_success(auth_headers, test_dataset):
    client = httpx.Client(base_url=BASE_URL)
    r = client.post(
        f"/api/v1/datasets/{test_dataset}/transform",
        headers=auth_headers,
        json={
            "operations": [{"type": "select", "config": {"columns": ["name", "age"]}}],
            "options": {"filename": "transformed.csv"}
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["code"] == 200
    data = body["data"]
    assert "new_dataset_id" in data
    assert data["parent_dataset_id"] == test_dataset
    assert data["filename"] == "transformed.csv"
    assert data["row_count"] == 3
    assert data["col_count"] == 2


def test_preview_404_not_found(auth_headers):
    client = httpx.Client(base_url=BASE_URL)
    r = client.post(
        "/api/v1/datasets/does-not-exist/transform/preview",
        headers=auth_headers,
        json={"operations": [{"type": "select", "config": {"columns": ["name"]}}]},
    )
    assert r.status_code == 404


def test_transform_404_not_found(auth_headers):
    client = httpx.Client(base_url=BASE_URL)
    r = client.post(
        "/api/v1/datasets/does-not-exist/transform",
        headers=auth_headers,
        json={"operations": [{"type": "select", "config": {"columns": ["name"]}}]},
    )
    assert r.status_code == 404


def test_preview_422_invalid_operation(auth_headers, test_dataset):
    client = httpx.Client(base_url=BASE_URL)
    r = client.post(
        f"/api/v1/datasets/{test_dataset}/transform/preview",
        headers=auth_headers,
        json={"operations": [{"type": "hack", "config": {}}]},
    )
    assert r.status_code == 422


def test_preview_column_not_found(auth_headers, test_dataset):
    client = httpx.Client(base_url=BASE_URL)
    r = client.post(
        f"/api/v1/datasets/{test_dataset}/transform/preview",
        headers=auth_headers,
        json={"operations": [{"type": "select", "config": {"columns": ["nonexistent"]}}]},
    )
    # Executor raises TransformError caught by service layer -> 422
    assert r.status_code == 422
    assert "列" in r.json()["detail"] or "COLUMN_NOT_FOUND" in r.text
