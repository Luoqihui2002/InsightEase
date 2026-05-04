"""Hermes assistant dry-run endpoints.

These endpoints expose the future Hermes API shape and validate safety
constraints. They do not call Hermes, Kimi, OpenAI, or any external LLM.
"""

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException

from app.api.v1.endpoints.auth import get_current_active_user
from app.core.config import settings
from app.models import User
from app.schemas.base import ResponseModel
from app.schemas.hermes import (
    HermesExplainResultRequest,
    HermesExplainResultResponse,
    HermesPlanAnalysisRequest,
    HermesPlanAnalysisResponse,
    HermesRecommendedAction,
    HermesStatusResponse,
    HermesSupports,
)
from app.services.hermes_validation_service import (
    HermesValidationError,
    validate_explain_result_payload,
    validate_plan_analysis_payload,
)

router = APIRouter()


@router.get("/status", response_model=ResponseModel[HermesStatusResponse])
async def hermes_status():
    """Return Hermes assistant capability status without exposing secrets."""
    mode = _active_dry_run_mode()

    if mode == "dry_run":
        return ResponseModel(
            data=HermesStatusResponse(
                enabled=True,
                provider="mock",
                mode="dry_run",
                supports=HermesSupports(
                    explain_result=True,
                    plan_analysis=True,
                    explain_error=False,
                    tool_calls=False,
                ),
                message="Hermes dry-run validation mode is enabled. No external LLM calls are made.",
            )
        )

    return ResponseModel(
        data=HermesStatusResponse(
            enabled=False,
            provider="disabled",
            mode="disabled",
            supports=HermesSupports(),
            message="Hermes assistant is disabled. Deterministic fallback is available.",
        )
    )


@router.post(
    "/explain-result",
    response_model=ResponseModel[HermesExplainResultResponse],
)
async def hermes_explain_result(
    request: HermesExplainResultRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Validate a safe result summary and return a bounded dry-run response."""
    _ensure_dry_run_enabled()
    payload = _model_to_dict(request)

    try:
        validate_explain_result_payload(payload)
    except HermesValidationError as exc:
        raise _validation_http_error(exc) from exc

    summary = request.result_summary
    result_keys = _safe_string_list(summary.get("result_keys"))[:5]
    metrics = _safe_list(summary.get("metrics"))[:3]
    warnings = _safe_string_list(summary.get("warnings"))[:5]

    key_findings: List[str] = []
    if result_keys:
        key_findings.append(f"Result summary exposes top-level keys: {', '.join(result_keys)}.")
    for metric in metrics:
        if isinstance(metric, dict):
            label = metric.get("label")
            value = metric.get("value")
            if label is not None and value is not None:
                key_findings.append(f"{label}: {value}")

    if not key_findings:
        key_findings.append("Dry-run validation found a bounded result summary, but no key metrics were available.")

    risks = warnings or [
        "No explicit warnings were present in the safe result summary.",
        "This is a dry-run response and not a Hermes-generated explanation.",
    ]

    return ResponseModel(
        data=HermesExplainResultResponse(
            answer=(
                "This is a Hermes dry-run response: the backend validated the safe "
                "result summary input, but no Hermes or LLM provider was called."
            ),
            key_findings=key_findings[:5],
            risks_and_caveats=risks[:5],
            suggested_next_steps=[
                "Use the deterministic frontend result follow-up responder for current user-facing answers.",
                "Enable Hermes dry-run only for contract testing.",
                "Keep full result_data and raw rows out of assistant requests.",
            ],
            recommended_actions=[
                HermesRecommendedAction(
                    label="Use local fallback",
                    action_type="generate_plan",
                    reason="Hermes dry-run mode validates contracts only and does not generate live explanations.",
                )
            ],
            confidence="low",
            fallback_used=True,
        )
    )


@router.post(
    "/plan-analysis",
    response_model=ResponseModel[HermesPlanAnalysisResponse],
)
async def hermes_plan_analysis(
    request: HermesPlanAnalysisRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Validate bounded planning context and return a minimal advisory plan."""
    _ensure_dry_run_enabled()
    payload = _model_to_dict(request)

    try:
        validate_plan_analysis_payload(payload)
    except HermesValidationError as exc:
        raise _validation_http_error(exc) from exc

    context = request.assistant_context
    selected_dataset_id = context.get("selected_dataset_id")
    selected_dataset_ids = _safe_string_list(context.get("selected_dataset_ids"))
    primary_dataset = selected_dataset_id or (selected_dataset_ids[0] if selected_dataset_ids else None)
    relationship_set = context.get("relationship_set") if isinstance(context.get("relationship_set"), dict) else None

    warnings = [
        "Hermes dry-run mode returned a contract-shaped advisory plan only.",
        "No analysis was executed, no SQL was generated, and no datasets were joined or modified.",
    ]
    if relationship_set:
        warnings.append("Relationship set context was treated as allowed context, not as required datasets.")

    plan = {
        "id": f"hermes-dry-run-{int(datetime.utcnow().timestamp())}",
        "user_question": request.user_question,
        "interpreted_goal": "Dry-run contract validation for future Hermes planning.",
        "recommended_analysis_type": "custom_query",
        "required_datasets": [primary_dataset] if primary_dataset else [],
        "required_dataset_ids": [primary_dataset] if primary_dataset else [],
        "required_fields": [],
        "required_relationships": [],
        "relationship_set_id": relationship_set.get("id") if relationship_set else None,
        "relationship_set_name": relationship_set.get("name") if relationship_set else None,
        "reference_dataset_nodes": [],
        "assumptions": [
            "This dry-run response does not infer beyond the provided bounded context.",
            "The deterministic frontend planner remains the default runtime.",
        ],
        "warnings": warnings,
        "next_actions": [
            {
                "type": "warning",
                "label": "Hermes dry-run only",
                "payload": {"fallback_used": True},
            }
        ],
    }

    return ResponseModel(
        data=HermesPlanAnalysisResponse(
            plan=plan,
            clarifying_questions=[
                "Please confirm the target analysis module before any future execution.",
            ],
            warnings=warnings,
            confidence="low",
            fallback_used=True,
        )
    )


def _active_dry_run_mode() -> str:
    mode = settings.HERMES_ASSISTANT_MODE_SAFE
    if not settings.HERMES_ASSISTANT_ENABLED:
        return "disabled"
    if mode == "dry_run":
        return "dry_run"
    # Live mode is intentionally not implemented in this dry-run scaffold.
    return "disabled"


def _ensure_dry_run_enabled() -> None:
    if _active_dry_run_mode() != "dry_run":
        raise HTTPException(
            status_code=503,
            detail={
                "code": "HERMES_DISABLED",
                "message": "Hermes assistant dry-run mode is disabled.",
                "user_message": "Hermes assistant is disabled. The deterministic frontend fallback is available.",
                "retryable": False,
                "fallback_available": True,
            },
        )


def _validation_http_error(exc: HermesValidationError) -> HTTPException:
    return HTTPException(status_code=400, detail=exc.to_detail())


def _model_to_dict(model: Any) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _safe_string_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item is not None]


def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []
