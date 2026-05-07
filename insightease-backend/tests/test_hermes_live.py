import pytest

from app.core.config import Settings
from app.schemas.hermes import HermesExplainResultRequest
from app.services.hermes_live_service import (
    HermesLiveError,
    parse_hermes_explain_response,
)
from app.services.hermes_validation_service import (
    HermesValidationError,
    validate_explain_result_payload,
)


def _safe_summary():
    return {
        "analysis_id": "analysis-1",
        "analysis_type": "statistics",
        "status": "completed",
        "title": "Statistics",
        "result_keys": ["summary", "metrics"],
        "metrics": [{"label": "mean", "value": 12.3}],
        "tables": [],
        "charts": [],
        "warnings": [],
        "available_actions": [],
    }


def _request(summary=None):
    return HermesExplainResultRequest(
        user_question="Explain this result",
        result_summary=summary or _safe_summary(),
        safety={
            "allow_raw_data": False,
            "allow_auto_run": False,
            "allow_sql_generation": False,
            "allow_dataset_mutation": False,
        },
    )


def _dump_model(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


@pytest.fixture
def anyio_backend():
    return "asyncio"


def _endpoint_module():
    pytest.importorskip("fastapi")
    from fastapi import HTTPException
    from app.api.v1.endpoints import hermes

    return hermes, HTTPException


def test_settings_accept_live_hermes_env(monkeypatch):
    monkeypatch.setenv("HERMES_ASSISTANT_ENABLED", "true")
    monkeypatch.setenv("HERMES_ASSISTANT_MODE", "live")
    monkeypatch.setenv("HERMES_BASE_URL", "http://127.0.0.1:8642/v1")
    monkeypatch.setenv("HERMES_AUTH_TOKEN", "secret-token")
    monkeypatch.setenv("HERMES_MODEL", "hermes-agent")
    monkeypatch.setenv("HERMES_ASSISTANT_TIMEOUT_MS", "60000")

    settings = Settings(_env_file=None)

    assert settings.HERMES_ASSISTANT_ENABLED is True
    assert settings.HERMES_ASSISTANT_MODE_SAFE == "live"
    assert settings.HERMES_BASE_URL == "http://127.0.0.1:8642/v1"
    assert settings.HERMES_AUTH_TOKEN == "secret-token"
    assert settings.HERMES_MODEL == "hermes-agent"
    assert settings.HERMES_ASSISTANT_TIMEOUT_MS == 60000
    assert settings.HERMES_LIVE_CONFIGURED is True


@pytest.mark.anyio
async def test_status_live_misconfigured_does_not_expose_token(monkeypatch):
    hermes, _ = _endpoint_module()
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_ENABLED", True)
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_MODE", "live")
    monkeypatch.setattr(hermes.settings, "HERMES_BASE_URL", "")
    monkeypatch.setattr(hermes.settings, "HERMES_AUTH_TOKEN", "secret-token")

    response = await hermes.hermes_status()
    data = _dump_model(response.data)

    assert data["mode"] == "live"
    assert data["availability"] == "misconfigured"
    assert data["available"] is False
    assert "secret-token" not in str(data)


@pytest.mark.anyio
async def test_status_live_available_does_not_expose_token(monkeypatch):
    hermes, _ = _endpoint_module()
    async def fake_probe(**kwargs):
        assert kwargs["auth_token"] == "secret-token"
        return {"status": "ok", "platform": "hermes-agent"}

    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_ENABLED", True)
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_MODE", "live")
    monkeypatch.setattr(hermes.settings, "HERMES_BASE_URL", "http://127.0.0.1:8642/v1")
    monkeypatch.setattr(hermes.settings, "HERMES_AUTH_TOKEN", "secret-token")
    monkeypatch.setattr(hermes, "probe_hermes_health", fake_probe)

    response = await hermes.hermes_status()
    data = _dump_model(response.data)

    assert data["mode"] == "live"
    assert data["availability"] == "live_available"
    assert data["available"] is True
    assert data["supports"]["explain_result"] is True
    assert data["supports"]["plan_analysis"] is False
    assert "secret-token" not in str(data)


@pytest.mark.anyio
async def test_disabled_explain_result_does_not_call_live_hermes(monkeypatch):
    hermes, _ = _endpoint_module()
    async def fail_if_called(**kwargs):
        raise AssertionError("live Hermes should not be called in disabled mode")

    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_ENABLED", False)
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_MODE", "disabled")
    monkeypatch.setattr(hermes, "explain_result_with_live_hermes", fail_if_called)

    response = await hermes.hermes_explain_result(_request(), current_user=object())

    assert response.data.fallback_used is True
    assert "disabled" in response.data.answer.lower()


def test_explain_result_rejects_raw_result_data_key():
    payload = {
        "user_question": "Explain this",
        "result_summary": {"analysis_id": "1", "result_data": [{"raw": "row"}]},
        "safety": {
            "allow_raw_data": False,
            "allow_auto_run": False,
            "allow_sql_generation": False,
            "allow_dataset_mutation": False,
        },
    }

    with pytest.raises(HermesValidationError):
        validate_explain_result_payload(payload)


@pytest.mark.anyio
async def test_explain_result_rejects_forbidden_keys(monkeypatch):
    hermes, HTTPException = _endpoint_module()
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_ENABLED", True)
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_MODE", "live")

    request = _request({"analysis_id": "1", "tables": [], "api_key": "secret"})

    with pytest.raises(HTTPException) as exc:
        await hermes.hermes_explain_result(request, current_user=object())

    assert exc.value.status_code == 400


@pytest.mark.anyio
async def test_live_explain_failure_returns_fallback(monkeypatch):
    hermes, _ = _endpoint_module()
    async def fail_live(**kwargs):
        raise HermesLiveError("provider failed")

    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_ENABLED", True)
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_MODE", "live")
    monkeypatch.setattr(hermes.settings, "HERMES_BASE_URL", "http://127.0.0.1:8642/v1")
    monkeypatch.setattr(hermes.settings, "HERMES_AUTH_TOKEN", "secret-token")
    monkeypatch.setattr(hermes, "explain_result_with_live_hermes", fail_live)

    response = await hermes.hermes_explain_result(_request(), current_user=object())

    assert response.data.fallback_used is True
    assert response.data.confidence == "low"
    assert "secret-token" not in response.data.answer


def test_malformed_hermes_response_is_rejected():
    with pytest.raises(HermesLiveError):
        parse_hermes_explain_response({"choices": [{"message": {"content": "{}"}}]})


def test_openai_compatible_hermes_response_is_validated():
    response = parse_hermes_explain_response(
        {
            "choices": [
                {
                    "message": {
                        "content": (
                            '{"answer":"Looks good","key_findings":["A"],'
                            '"risks_and_caveats":["B"],"suggested_next_steps":["C"],'
                            '"recommended_actions":[],"confidence":"high"}'
                        )
                    }
                }
            ]
        }
    )

    assert response.fallback_used is False
    assert response.answer == "Looks good"
    assert response.confidence == "high"
