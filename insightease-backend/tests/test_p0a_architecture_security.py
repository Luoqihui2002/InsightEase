import json
import uuid

import pytest
from fastapi import HTTPException, Request
from pydantic import ValidationError

from app.api.v1.endpoints.reports import _report_path
from app.core.config import Settings
from app.main import app, global_exception_handler


def test_legacy_ai_routes_are_not_registered():
    paths = set(app.openapi()["paths"])

    assert not any(path == "/api/v1/ai" or path.startswith("/api/v1/ai/") for path in paths)
    assert "/api/v1/assistant/profile-dataset" in paths
    assert "/api/v1/assistant/hermes/explain-result" in paths


def test_default_settings_fail_closed_without_static_secrets(monkeypatch):
    for name in ("DEBUG", "SECRET_KEY", "ALLOWED_ORIGINS", "KIMI_API_KEY"):
        monkeypatch.delenv(name, raising=False)

    first = Settings(_env_file=None)
    second = Settings(_env_file=None)

    assert first.DEBUG is False
    assert first.CORS_ORIGINS == ["http://localhost:5173", "http://127.0.0.1:5173"]
    assert len(first.SECRET_KEY) >= 32
    assert first.SECRET_KEY != second.SECRET_KEY
    assert not hasattr(first, "KIMI_API_KEY")


def test_production_rejects_placeholder_credentials():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            DB_USER="root",
            DB_PASSWORD="replace-with-a-strong-password",
            SECRET_KEY="replace-with-output-of-openssl-rand",
        )


def test_production_wildcard_cors_fails_closed():
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        DB_USER="insightease_app",
        DB_PASSWORD="a-real-database-password",
        SECRET_KEY="a-stable-random-secret-that-is-long-enough-for-jwt",
        ALLOWED_ORIGINS="*",
    )

    assert settings.CORS_ORIGINS == []


def test_report_paths_are_scoped_to_authenticated_user():
    report_id = str(uuid.uuid4())
    alice_path = _report_path("alice", report_id, "pdf")
    bob_path = _report_path("bob", report_id, "pdf")

    assert alice_path != bob_path
    assert alice_path.parent.name == "alice"
    assert bob_path.parent.name == "bob"
    assert _report_path("alice", report_id, "word").suffix == ".docx"

    with pytest.raises(HTTPException):
        _report_path("alice", "../report", "pdf")


@pytest.mark.anyio
async def test_global_error_response_does_not_expose_exception_details():
    request = Request({"type": "http", "method": "GET", "path": "/boom", "headers": []})
    response = await global_exception_handler(request, RuntimeError("db-password=super-secret"))
    body = json.loads(response.body)

    assert response.status_code == 500
    assert body == {"code": 500, "message": "服务器内部错误，请稍后重试"}
    assert "super-secret" not in response.body.decode("utf-8")
