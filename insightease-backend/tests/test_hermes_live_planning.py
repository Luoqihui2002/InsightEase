import json

import pytest

from app.schemas.assistant import AssistantAnalysisPlan
from app.schemas.hermes import HermesPlanAnalysisRequest
from app.services.hermes_live_service import (
    HermesLiveError,
    parse_hermes_plan_response,
    plan_analysis_with_live_hermes,
)
from app.services.hermes_validation_service import (
    HermesValidationError,
    validate_and_normalize_analysis_plan,
    validate_plan_analysis_payload,
)


def _safety():
    return {
        "allow_raw_data": False,
        "allow_auto_run": False,
        "allow_sql_generation": False,
        "allow_dataset_mutation": False,
        "require_user_confirmation_for_execution": True,
    }


def _context(*, multi=False, confirmed=True):
    datasets = [
        {
            "id": "sales",
            "name": "Sales",
            "schema": [
                {"name": "order_id", "semantic_type": "identifier"},
                {"name": "user_id", "semantic_type": "identifier"},
                {"name": "revenue", "semantic_type": "numeric"},
                {"name": "order_date", "semantic_type": "datetime"},
            ],
            "analysis_tags": ["descriptive", "forecast"],
        }
    ]
    selected_ids = ["sales"]
    relationship_set = None
    if multi:
        datasets.append(
            {
                "id": "users",
                "name": "Users",
                "schema": [
                    {"name": "user_id", "semantic_type": "identifier"},
                    {"name": "channel", "semantic_type": "categorical"},
                ],
                "analysis_tags": ["attribution"],
            }
        )
        selected_ids = ["sales", "users"]
        relationship_set = {
            "id": "commerce",
            "name": "Commerce",
            "dataset_nodes": [
                {"dataset_id": "sales", "role": "connected", "joinable": confirmed},
                {"dataset_id": "users", "role": "connected", "joinable": confirmed},
            ],
            "relationships": [
                {
                    "id": "sales-users",
                    "source_dataset_id": "sales",
                    "source_column": "user_id",
                    "target_dataset_id": "users",
                    "target_column": "user_id",
                    "relationship_type": "many_to_one",
                    "risk_level": "low",
                    "status": "confirmed",
                }
            ] if confirmed else [],
        }
    return {
        "selected_dataset_ids": selected_ids,
        "selected_dataset_id": "sales" if not multi else None,
        "datasets": datasets,
        "relationship_set": relationship_set,
    }


def _request(*, multi=False, confirmed=True):
    return HermesPlanAnalysisRequest(
        user_question=(
            "Compare channel attribution across orders and users"
            if multi
            else "Summarize revenue"
        ),
        assistant_context=_context(multi=multi, confirmed=confirmed),
        safety=_safety(),
    )


def _plan(*, required_ids=None, field="revenue", multi=False, relationship_status="confirmed"):
    required_ids = required_ids or (["sales", "users"] if multi else ["sales"])
    relationships = []
    fields = [
        {
            "dataset_id": "sales",
            "role": "target_metric",
            "required": True,
            "candidate_columns": [field],
            "reason": "Revenue is the requested metric.",
        }
    ]
    if multi:
        fields.append(
            {
                "dataset_id": "users",
                "role": "dimension",
                "required": True,
                "candidate_columns": ["channel"],
                "reason": "Channel is the comparison dimension.",
            }
        )
        relationships = [
            {
                "relationship_id": "sales-users",
                "source_dataset_id": "sales",
                "source_column": "user_id",
                "target_dataset_id": "users",
                "target_column": "user_id",
                "status": relationship_status,
                "relationship_type": "many_to_one",
                "risk_level": "low",
                "reason": "Use the user key after explicit confirmation.",
            }
        ]
    return {
        "id": "plan-1",
        "user_question": "provider question",
        "interpreted_goal": "Summarize revenue by available dimensions.",
        "recommended_analysis_type": "attribution" if multi else "descriptive",
        "required_datasets": ["provider supplied name"],
        "required_dataset_ids": required_ids,
        "candidate_dataset_ids": [],
        "candidate_datasets": [],
        "required_fields": fields,
        "required_relationships": relationships,
        "metrics": [
            {
                "name": "Revenue",
                "dataset_id": "sales",
                "field": field,
                "aggregation": "sum",
                "description": "Total revenue.",
            }
        ],
        "reference_dataset_ids": [],
        "assumptions": [],
        "warnings": [],
        "clarifying_questions": [],
        "execution_readiness": "ready_single_table",
        "next_action": "review_plan",
        "next_actions": [],
        "source": "hermes_live",
        "confidence": "high",
        "fallback_used": False,
    }


def _endpoint_module():
    pytest.importorskip("fastapi")
    from app.api.v1.endpoints import hermes

    return hermes


def _enable_live(monkeypatch, hermes):
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_ENABLED", True)
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_MODE", "live")
    monkeypatch.setattr(hermes.settings, "HERMES_BASE_URL", "http://127.0.0.1:8642/v1")
    monkeypatch.setattr(hermes.settings, "HERMES_AUTH_TOKEN", "secret-token")


@pytest.mark.anyio
async def test_live_plan_success_is_validated_and_normalized(monkeypatch):
    hermes = _endpoint_module()
    _enable_live(monkeypatch, hermes)

    async def fake_live(**kwargs):
        return AssistantAnalysisPlan.model_validate(_plan())

    monkeypatch.setattr(hermes, "plan_analysis_with_live_hermes", fake_live)
    response = await hermes.hermes_plan_analysis(_request(), current_user=object())

    assert response.data.plan.source == "hermes_live"
    assert response.data.plan.required_datasets == ["Sales"]
    assert response.data.plan.execution_readiness == "ready_single_table"
    assert response.data.plan.next_actions[0].target == "/app/statistics"
    assert response.data.fallback_used is False


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("plan_data", "request_value"),
    [
        (_plan(required_ids=["invented-dataset"]), _request()),
        (_plan(field="invented_field"), _request()),
        (_plan(multi=True), _request(multi=True, confirmed=False)),
    ],
)
async def test_hallucinated_plan_references_trigger_fallback(monkeypatch, plan_data, request_value):
    hermes = _endpoint_module()
    _enable_live(monkeypatch, hermes)

    async def fake_live(**kwargs):
        return AssistantAnalysisPlan.model_validate(plan_data)

    monkeypatch.setattr(hermes, "plan_analysis_with_live_hermes", fake_live)
    response = await hermes.hermes_plan_analysis(request_value, current_user=object())

    assert response.data.plan.source == "deterministic_fallback"
    assert response.data.fallback_used is True
    assert "secret-token" not in str(response.data)


@pytest.mark.anyio
async def test_provider_timeout_triggers_deterministic_fallback(monkeypatch):
    hermes = _endpoint_module()
    _enable_live(monkeypatch, hermes)

    async def fail_live(**kwargs):
        raise HermesLiveError("provider timed out")

    monkeypatch.setattr(hermes, "plan_analysis_with_live_hermes", fail_live)
    response = await hermes.hermes_plan_analysis(_request(), current_user=object())

    assert response.data.plan.source == "deterministic_fallback"
    assert response.data.plan.fallback_used is True


@pytest.mark.anyio
async def test_disabled_mode_never_calls_provider(monkeypatch):
    hermes = _endpoint_module()
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_ENABLED", False)
    monkeypatch.setattr(hermes.settings, "HERMES_ASSISTANT_MODE", "disabled")

    async def fail_if_called(**kwargs):
        raise AssertionError("provider must not be called")

    monkeypatch.setattr(hermes, "plan_analysis_with_live_hermes", fail_if_called)
    response = await hermes.hermes_plan_analysis(_request(), current_user=object())

    assert response.data.plan.source == "deterministic_fallback"
    assert response.data.plan.fallback_used is True


def test_multi_table_live_plan_stops_at_needs_join():
    request = _request(multi=True)
    normalized = validate_and_normalize_analysis_plan(
        AssistantAnalysisPlan.model_validate(_plan(multi=True)),
        request.assistant_context,
        request.user_question,
    )

    assert normalized.execution_readiness == "needs_join"
    assert normalized.next_action == "create_analysis_dataset"
    assert normalized.next_actions[0].type == "warning"
    assert any("no join has been executed" in warning for warning in normalized.warnings)


def test_malformed_plan_json_is_rejected():
    with pytest.raises(HermesLiveError):
        parse_hermes_plan_response({"choices": [{"message": {"content": "not-json"}}]})


@pytest.mark.anyio
async def test_malformed_provider_plan_triggers_endpoint_fallback(monkeypatch):
    hermes = _endpoint_module()
    _enable_live(monkeypatch, hermes)

    async def malformed_request(*args, **kwargs):
        return {"choices": [{"message": {"content": "not-json"}}]}

    monkeypatch.setattr("app.services.hermes_live_service._request_json", malformed_request)
    response = await hermes.hermes_plan_analysis(_request(), current_user=object())

    assert response.data.plan.source == "deterministic_fallback"
    assert response.data.fallback_used is True


@pytest.mark.anyio
async def test_provider_receives_only_bounded_metadata(monkeypatch):
    captured = {}

    async def fake_request_json(method, url, payload, auth_token, timeout_ms):
        captured["payload"] = payload
        return {"choices": [{"message": {"content": json.dumps(_plan())}}]}

    monkeypatch.setattr("app.services.hermes_live_service._request_json", fake_request_json)
    response = await plan_analysis_with_live_hermes(
        request=_request(),
        base_url="http://127.0.0.1:8642/v1",
        auth_token="secret-token",
        model="hermes-agent",
        timeout_ms=1000,
    )

    user_content = captured["payload"]["messages"][1]["content"]
    forwarded_context = json.loads(user_content)["assistant_context"]
    assert response.source == "hermes_live"
    assert "revenue" in user_content
    serialized_context = json.dumps(forwarded_context)
    assert all(key not in serialized_context for key in ("raw_rows", "raw_data", "result_data", "storage_path"))
    assert "secret-token" not in json.dumps(captured["payload"])


@pytest.mark.parametrize(
    "forbidden_key",
    ["raw_rows", "raw_data", "result_data", "storage_path", "token", "password", "api_key"],
)
def test_planning_context_rejects_raw_or_sensitive_keys(forbidden_key):
    payload = {
        "user_question": "Plan this",
        "assistant_context": {
            **_context(),
            "analysis_history_summary": {forbidden_key: "must-not-pass"},
        },
        "safety": _safety(),
    }

    with pytest.raises(HermesValidationError):
        validate_plan_analysis_payload(payload)


def test_planning_context_rejects_dataset_cap_overflow():
    payload = {
        "user_question": "Plan this",
        "assistant_context": {
            "datasets": [{"id": f"dataset-{index}", "schema": []} for index in range(21)],
            "selected_dataset_ids": [],
        },
        "safety": _safety(),
    }

    with pytest.raises(HermesValidationError) as exc:
        validate_plan_analysis_payload(payload)

    assert exc.value.code == "CONTEXT_TOO_LARGE"
