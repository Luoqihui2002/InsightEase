"""Hermes assistant endpoints.

These endpoints expose bounded result explanation and advisory planning.
Both capabilities keep deterministic fallback and cannot execute work.
"""

import logging
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
    validate_and_normalize_analysis_plan,
    validate_explain_result_payload,
    validate_plan_analysis_payload,
)
from app.services.hermes_live_service import (
    HermesLiveError,
    explain_result_with_live_hermes,
    plan_analysis_with_live_hermes,
    probe_hermes_health,
)
from app.services.hermes_planning_service import build_deterministic_fallback_plan

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/status", response_model=ResponseModel[HermesStatusResponse])
async def hermes_status():
    """Return Hermes assistant capability status without exposing secrets."""
    mode = _active_mode()

    if mode == "dry_run":
        return ResponseModel(
            data=HermesStatusResponse(
                enabled=True,
                provider="mock",
                mode="dry_run",
                available=True,
                availability="dry_run",
                supports=HermesSupports(
                    explain_result=True,
                    plan_analysis=True,
                    explain_error=False,
                    tool_calls=False,
                ),
                message="Hermes dry-run validation mode is enabled. No external LLM calls are made.",
            )
        )

    if mode == "live":
        if not settings.HERMES_LIVE_CONFIGURED:
            return ResponseModel(
                data=HermesStatusResponse(
                    enabled=True,
                    provider="hermes",
                    mode="live",
                    available=False,
                    availability="misconfigured",
                    supports=HermesSupports(
                        explain_result=False,
                        plan_analysis=False,
                        explain_error=False,
                        tool_calls=False,
                    ),
                    message=(
                        "Hermes live mode is enabled but HERMES_BASE_URL or "
                        "HERMES_AUTH_TOKEN is missing. Deterministic fallback is available."
                    ),
                )
            )

        try:
            health = await probe_hermes_health(
                base_url=settings.HERMES_BASE_URL or "",
                auth_token=settings.HERMES_AUTH_TOKEN,
                timeout_ms=settings.HERMES_ASSISTANT_TIMEOUT_MS,
            )
            platform = health.get("platform") if isinstance(health, dict) else None
            return ResponseModel(
                data=HermesStatusResponse(
                    enabled=True,
                    provider="hermes",
                    mode="live",
                    available=True,
                    availability="live_available",
                    platform=str(platform) if platform else "hermes-agent",
                    supports=HermesSupports(
                        explain_result=True,
                        plan_analysis=True,
                        explain_error=False,
                        tool_calls=False,
                    ),
                    message="Hermes live result explanation and advisory planning are available.",
                )
            )
        except HermesLiveError:
            return ResponseModel(
                data=HermesStatusResponse(
                    enabled=True,
                    provider="hermes",
                    mode="live",
                    available=False,
                    availability="live_unavailable",
                    supports=HermesSupports(
                        explain_result=False,
                        plan_analysis=False,
                        explain_error=False,
                        tool_calls=False,
                    ),
                    message="Hermes live mode is configured but the agent health check is unavailable. Deterministic fallback is available.",
                )
            )

    return ResponseModel(
        data=HermesStatusResponse(
            enabled=False,
            provider="disabled",
            mode="disabled",
            available=False,
            availability="disabled",
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
    """Explain a SafeResultSummary via dry-run or live Hermes with fallback."""
    payload = _model_to_dict(request)

    try:
        validate_explain_result_payload(payload)
    except HermesValidationError as exc:
        raise _validation_http_error(exc) from exc

    mode = _active_mode()
    if mode == "live":
        if not settings.HERMES_LIVE_CONFIGURED:
            return ResponseModel(
                data=_fallback_explain_response(
                    request,
                    "Hermes live mode is misconfigured; deterministic frontend fallback should be used.",
                )
            )
        try:
            live_response = await explain_result_with_live_hermes(
                request=request,
                base_url=settings.HERMES_BASE_URL or "",
                auth_token=settings.HERMES_AUTH_TOKEN or "",
                model=settings.HERMES_MODEL,
                timeout_ms=settings.HERMES_ASSISTANT_TIMEOUT_MS,
            )
            return ResponseModel(data=live_response)
        except HermesLiveError:
            return ResponseModel(
                data=_fallback_explain_response(
                    request,
                    "Hermes live explanation failed; deterministic frontend fallback should be used.",
                )
            )

    if mode == "dry_run":
        return ResponseModel(data=_dry_run_explain_response(request))

    return ResponseModel(
        data=_fallback_explain_response(
            request,
            "Hermes assistant is disabled; deterministic frontend fallback should be used.",
        )
    )


def _dry_run_explain_response(request: HermesExplainResultRequest) -> HermesExplainResultResponse:
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

    return HermesExplainResultResponse(
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


@router.post(
    "/plan-analysis",
    response_model=ResponseModel[HermesPlanAnalysisResponse],
)
async def hermes_plan_analysis(
    request: HermesPlanAnalysisRequest,
    current_user: User = Depends(get_current_active_user),
):
    """Return a validated live plan or a safe deterministic fallback plan."""
    payload = _model_to_dict(request)

    try:
        validate_plan_analysis_payload(payload)
    except HermesValidationError as exc:
        raise _validation_http_error(exc) from exc

    mode = _active_mode()
    if mode == "live" and settings.HERMES_LIVE_CONFIGURED:
        try:
            provider_plan = await plan_analysis_with_live_hermes(
                request=request,
                base_url=settings.HERMES_BASE_URL or "",
                auth_token=settings.HERMES_AUTH_TOKEN or "",
                model=settings.HERMES_MODEL,
                timeout_ms=settings.HERMES_ASSISTANT_TIMEOUT_MS,
            )
            plan = validate_and_normalize_analysis_plan(
                provider_plan,
                request.assistant_context,
                request.user_question,
            )
            return ResponseModel(
                data=HermesPlanAnalysisResponse(
                    plan=plan,
                    clarifying_questions=plan.clarifying_questions,
                    warnings=plan.warnings,
                    confidence=plan.confidence,
                    fallback_used=False,
                )
            )
        except (HermesLiveError, HermesValidationError):
            logger.warning("Hermes live planning failed validation or provider delivery; using fallback")

    fallback_reason = {
        "live": "Live planner unavailable; local deterministic planning was used.",
        "dry_run": "Hermes dry-run mode does not call the provider; local deterministic planning was used.",
        "disabled": "Hermes planning is disabled; local deterministic planning was used.",
    }[mode]
    plan = build_deterministic_fallback_plan(request, fallback_reason)
    return ResponseModel(
        data=HermesPlanAnalysisResponse(
            plan=plan,
            clarifying_questions=plan.clarifying_questions,
            warnings=plan.warnings,
            confidence=plan.confidence,
            fallback_used=True,
        )
    )


def _active_mode() -> str:
    mode = settings.HERMES_ASSISTANT_MODE_SAFE
    if not settings.HERMES_ASSISTANT_ENABLED:
        return "disabled"
    if mode == "dry_run":
        return "dry_run"
    if mode == "live":
        return "live"
    return "disabled"


def _validation_http_error(exc: HermesValidationError) -> HTTPException:
    return HTTPException(status_code=400, detail=exc.to_detail())


def _fallback_explain_response(
    request: HermesExplainResultRequest,
    reason: str,
) -> HermesExplainResultResponse:
    summary = request.result_summary
    result_keys = _safe_string_list(summary.get("result_keys"))[:5]
    warnings = _safe_string_list(summary.get("warnings"))[:5]
    return HermesExplainResultResponse(
        answer=reason,
        key_findings=(
            [f"SafeResultSummary was validated with keys: {', '.join(result_keys)}."]
            if result_keys
            else ["SafeResultSummary was validated, but no result keys were available."]
        ),
        risks_and_caveats=(warnings or ["Hermes did not provide a live explanation."]),
        suggested_next_steps=[
            "Use the deterministic frontend result follow-up responder.",
            "Do not resend raw result_data or raw dataset rows.",
        ],
        recommended_actions=[],
        confidence="low",
        fallback_used=True,
    )


def _model_to_dict(model: Any) -> Dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(by_alias=True)
    return model.dict()


def _safe_string_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if item is not None]


def _safe_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []
