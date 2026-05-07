"""Schemas for Hermes assistant dry-run endpoints.

These schemas define a validation-only backend scaffold. They do not imply
that a real Hermes provider or LLM integration exists.
"""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


HermesMode = Literal["disabled", "dry_run", "live"]
HermesProvider = Literal["hermes", "mock", "disabled"]
HermesAvailability = Literal[
    "disabled",
    "dry_run",
    "live_configured",
    "live_available",
    "live_unavailable",
    "misconfigured",
]
HermesConfidence = Literal["low", "medium", "high"]
HermesActionType = Literal[
    "navigate",
    "generate_plan",
    "ask_clarifying_question",
    "requires_confirmation",
]


class HermesSupports(BaseModel):
    explain_result: bool = False
    plan_analysis: bool = False
    explain_error: bool = False
    tool_calls: bool = False


class HermesStatusResponse(BaseModel):
    enabled: bool
    provider: HermesProvider
    mode: HermesMode
    supports: HermesSupports
    available: bool = False
    availability: Optional[HermesAvailability] = None
    platform: Optional[str] = None
    message: Optional[str] = None


class HermesSafetyFlags(BaseModel):
    allow_raw_data: Literal[False]
    allow_auto_run: Literal[False]
    allow_sql_generation: Literal[False]
    allow_dataset_mutation: Literal[False]


class HermesPlanSafetyFlags(HermesSafetyFlags):
    require_user_confirmation_for_execution: Literal[True]


class HermesRecommendedAction(BaseModel):
    label: str
    action_type: HermesActionType
    target: Optional[str] = None
    reason: Optional[str] = None


class HermesExplainResultRequest(BaseModel):
    user_question: str = Field(..., min_length=1, max_length=2000)
    result_summary: Dict[str, Any]
    assistant_context: Optional[Dict[str, Any]] = None
    safety: HermesSafetyFlags


class HermesExplainResultResponse(BaseModel):
    answer: str
    key_findings: List[str] = []
    risks_and_caveats: List[str] = []
    suggested_next_steps: List[str] = []
    recommended_actions: List[HermesRecommendedAction] = []
    confidence: Optional[HermesConfidence] = "low"
    fallback_used: bool = True


class HermesPlanAnalysisRequest(BaseModel):
    user_question: str = Field(..., min_length=1, max_length=2000)
    assistant_context: Dict[str, Any]
    safety: HermesPlanSafetyFlags


class HermesPlanAnalysisResponse(BaseModel):
    plan: Dict[str, Any]
    clarifying_questions: List[str] = []
    warnings: List[str] = []
    confidence: Optional[HermesConfidence] = "low"
    fallback_used: bool = True


class HermesAssistantError(BaseModel):
    code: Literal[
        "HERMES_DISABLED",
        "INVALID_SAFETY_FLAGS",
        "SUMMARY_TOO_LARGE",
        "CONTEXT_TOO_LARGE",
        "INVALID_REQUEST",
        "INVALID_RESULT_SUMMARY",
        "HERMES_TIMEOUT",
        "HERMES_PROVIDER_ERROR",
    ]
    message: str
    user_message: str
    retryable: bool
    fallback_available: bool
