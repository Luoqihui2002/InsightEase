"""
Phase 3C-1.5 Task 2: Real API Manual Validation
Runs against locally started backend (localhost:8000).
"""

import sys
import json
import time
import tempfile
import uuid
import httpx

BASE = "http://localhost:8000"
TEST_UID = str(uuid.uuid4())[:8]

def log(msg):
    print(f"[VALIDATION] {msg}")

def step(num, desc):
    print(f"\n{'='*60}")
    print(f"STEP {num}: {desc}")
    print('='*60)

# ---------------------------------------------------------------------------
# Step 0: Health check
# ---------------------------------------------------------------------------
step(0, "Health check")
try:
    r = httpx.get(f"{BASE}/docs", timeout=10)
    log(f"health status: {r.status_code}")
    if r.status_code != 200:
        log("Backend not ready, exiting")
        sys.exit(1)
except Exception as e:
    log(f"Backend unreachable: {e}")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Step 1: Login
# ---------------------------------------------------------------------------
step(1, "Login to get access token")
client = httpx.Client(base_url=BASE, timeout=30)

login_payload = {
    "username": f"user_{TEST_UID}",
    "password": "testpassword123"
}
r = client.post("/api/v1/auth/login/json", json=login_payload)
log(f"login status: {r.status_code}")

if r.status_code == 200:
    token = r.json()["data"]["access_token"]
    log(f"token obtained: {token[:20]}...")
elif r.status_code == 401:
    log("Login failed (401), trying register first...")
    reg = client.post("/api/v1/auth/register", json={
        "email": f"{TEST_UID}@example.com",
        "password": "testpassword123",
        "username": f"user_{TEST_UID}"
    })
    log(f"register status: {reg.status_code}")
    if reg.status_code not in (200, 201):
        log("Register failed, exiting")
        sys.exit(1)
    r = client.post("/api/v1/auth/login/json", json=login_payload)
    token = r.json()["data"]["access_token"]
    log(f"token obtained after register: {token[:20]}...")
else:
    log(f"Unexpected login status: {r.status_code}")
    sys.exit(1)

headers = {"Authorization": f"Bearer {token}"}

# ---------------------------------------------------------------------------
# Step 2: Upload a small CSV
# ---------------------------------------------------------------------------
step(2, "Upload test CSV")
csv_content = "name,age,city,score\nAlice,25,NY,85.5\nBob,30,LA,90.0\nCharlie,35,NY,78.0\nAlice,25,NY,88.0\nBob,30,LA,92.5\n"
with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
    f.write(csv_content)
    tmp_path = f.name

with open(tmp_path, "rb") as f:
    files = {"file": ("test_data.csv", f, "text/csv")}
    r = client.post("/api/v1/datasets/upload", headers=headers, files=files)

log(f"upload status: {r.status_code}")
if r.status_code not in (200, 201):
    log(f"Upload failed: {r.text}")
    sys.exit(1)

dataset_id = r.json()["data"]["id"]
log(f"uploaded dataset_id: {dataset_id}")

# ---------------------------------------------------------------------------
# Step 3: Preview transform (filter + rename + derive + sample)
# ---------------------------------------------------------------------------
step(3, "POST /datasets/{id}/transform/preview")

preview_ops = [
    {"type": "filter", "config": {"conditions": [{"column": "age", "operator": "gte", "value": "25"}], "logic": "and"}},
    {"type": "rename", "config": {"mappings": [{"old": "age", "new": "years"}]}},
    {"type": "derive", "config": {"newColumn": "double_score", "formula": "score * 2"}},
    {"type": "sample", "config": {"method": "count", "count": 3}},
]

r = client.post(
    f"/api/v1/datasets/{dataset_id}/transform/preview",
    headers=headers,
    json={"operations": preview_ops},
)
log(f"preview status: {r.status_code}")
if r.status_code != 200:
    log(f"Preview failed: {r.text}")
    sys.exit(1)

preview_data = r.json()
log(f"response code: {preview_data.get('code')}")
log(f"response message: {preview_data.get('message')}")
log(f"columns: {preview_data['data'].get('columns')}")
log(f"total_rows: {preview_data['data'].get('total_rows')}")
log(f"row count in preview: {len(preview_data['data'].get('data', []))}")
log(f"stats count: {len(preview_data['data'].get('column_stats', []))}")
log(f"summary: {json.dumps(preview_data['data'].get('execution_summary'), ensure_ascii=False)}")

# Verify ResponseModel format
assert preview_data.get("code") == 200, "code should be 200"
assert "data" in preview_data, "data key missing"
assert "message" in preview_data, "message key missing"
assert "columns" in preview_data["data"], "columns missing in data"
assert "data" in preview_data["data"], "data (rows) missing in data"
assert "total_rows" in preview_data["data"], "total_rows missing in data"
assert "column_stats" in preview_data["data"], "column_stats missing in data"
assert "execution_summary" in preview_data["data"], "execution_summary missing in data"

# Verify business logic
rows = preview_data["data"]["data"]
assert len(rows) <= 3, "sample should return <=3 rows"
assert "years" in preview_data["data"]["columns"], "rename should produce 'years'"
assert "double_score" in preview_data["data"]["columns"], "derive should produce 'double_score'"

log("preview validation PASSED")

# ---------------------------------------------------------------------------
# Step 4: Execute transform (save as new dataset)
# ---------------------------------------------------------------------------
step(4, "POST /datasets/{id}/transform")

transform_ops = [
    {"type": "filter", "config": {"conditions": [{"column": "city", "operator": "eq", "value": "NY"}], "logic": "and"}},
    {"type": "select", "config": {"columns": ["name", "age", "city", "score"]}},
]

r = client.post(
    f"/api/v1/datasets/{dataset_id}/transform",
    headers=headers,
    json={
        "operations": transform_ops,
        "options": {"filename": "transformed_ny.csv"}
    },
)
log(f"transform status: {r.status_code}")
if r.status_code not in (200, 201):
    log(f"Transform failed: {r.text}")
    sys.exit(1)

transform_data = r.json()
log(f"response code: {transform_data.get('code')}")
log(f"response message: {transform_data.get('message')}")
log(f"new dataset id: {transform_data['data'].get('new_dataset_id')}")
log(f"new dataset filename: {transform_data['data'].get('filename')}")
log(f"new dataset parent_dataset_id: {transform_data['data'].get('parent_dataset_id')}")

new_dataset_id = transform_data["data"]["new_dataset_id"]
assert transform_data.get("code") == 200, "code should be 200"
assert transform_data["data"].get("parent_dataset_id") == dataset_id, "parent_dataset_id should match source"
assert transform_data["data"].get("filename") == "transformed_ny.csv", "filename should match option"

log("transform validation PASSED")

# ---------------------------------------------------------------------------
# Step 5: Verify new dataset exists
# ---------------------------------------------------------------------------
step(5, "Verify new dataset in list + storage")

r = client.get("/api/v1/datasets", headers=headers)
log(f"list datasets status: {r.status_code}")

datasets = r.json()["data"]["items"]
new_ds = next((d for d in datasets if d["id"] == new_dataset_id), None)
assert new_ds is not None, "new dataset not found in list"
log(f"new dataset found in list: {new_ds['filename']}")

# Note: DatasetResponse schema does not expose storage_path or transform_chain,
# but the transform endpoint already verified parent_dataset_id and execution.
# We verify the dataset appears in the list with correct filename.
assert new_ds["filename"] == "transformed_ny.csv", "filename should match"

log("dataset existence validation PASSED")

# ---------------------------------------------------------------------------
# Step 6: Error cases (404, 422)
# ---------------------------------------------------------------------------
step(6, "Error case validation")

# 404 - dataset not found
r = client.post(
    "/api/v1/datasets/nonexistent-id/transform/preview",
    headers=headers,
    json={"operations": [{"type": "select", "config": {"columns": ["name"]}}]},
)
log(f"404 test status: {r.status_code}")
assert r.status_code == 404, "nonexistent dataset should return 404"

# 422 - invalid operation type
r = client.post(
    f"/api/v1/datasets/{dataset_id}/transform/preview",
    headers=headers,
    json={"operations": [{"type": "invalid_op", "config": {}}]},
)
log(f"422 test status: {r.status_code}")
assert r.status_code == 422, "invalid operation should return 422"

log("error case validation PASSED")

# ---------------------------------------------------------------------------
# Cleanup
# ---------------------------------------------------------------------------
client.delete(f"/api/v1/datasets/{dataset_id}", headers=headers)
client.delete(f"/api/v1/datasets/{new_dataset_id}", headers=headers)
log("cleaned up test datasets")

print("\n" + "="*60)
print("ALL MANUAL API VALIDATIONS PASSED")
print("="*60)
