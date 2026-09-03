"""Schemas for the bounded Hermes assistant boundary."""

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.assistant import AssistantAnalysisPlan, BoundedPlanningContext


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


class HermesModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HermesSupports(HermesModel):
    explain_result: bool = False
    plan_analysis: bool = False
    explain_error: bool = False
    tool_calls: bool = False


class HermesStatusResponse(HermesModel):
    enabled: bool
    provider: HermesProvider
    mode: HermesMode
    supports: HermesSupports
    available: bool = False
    availability: Optional[HermesAvailability] = None
    platform: Optional[str] = None
    message: Optional[str] = None


class HermesSafetyFlags(HermesModel):
    allow_raw_data: Literal[False]
    allow_auto_run: Literal[False]
    allow_sql_generation: Literal[False]
    allow_dataset_mutation: Literal[False]


class HermesPlanSafetyFlags(HermesSafetyFlags):
    require_user_confirmation_for_execution: Literal[True]


class HermesRecommendedAction(HermesModel):
    label: str
    action_type: HermesActionType
    target: Optional[str] = None
    reason: Optional[str] = None


class HermesExplainResultRequest(HermesModel):
    user_question: str = Field(..., min_length=1, max_length=2000)
    result_summary: Dict[str, Any]
    assistant_context: Optional[Dict[str, Any]] = None
    safety: HermesSafetyFlags


class HermesExplainResultResponse(HermesModel):
    answer: str
    key_findings: List[str] = Field(default_factory=list)
    risks_and_caveats: List[str] = Field(default_factory=list)
    suggested_next_steps: List[str] = Field(default_factory=list)
    recommended_actions: List[HermesRecommendedAction] = Field(default_factory=list)
    confidence: Optional[HermesConfidence] = "low"
    fallback_used: bool = True


class HermesPlanAnalysisRequest(HermesModel):
    user_question: str = Field(..., min_length=1, max_length=2000)
    assistant_context: BoundedPlanningContext
    safety: HermesPlanSafetyFlags


class HermesPlanAnalysisResponse(HermesModel):
    plan: AssistantAnalysisPlan
    clarifying_questions: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    confidence: Optional[HermesConfidence] = "low"
    fallback_used: bool = True


class HermesAssistantError(HermesModel):
    code: Literal[
        "HERMES_DISABLED",
        "INVALID_SAFETY_FLAGS",
        "SUMMARY_TOO_LARGE",
        "CONTEXT_TOO_LARGE",
        "INVALID_REQUEST",
        "INVALID_RESULT_SUMMARY",
        "HERMES_TIMEOUT",
        "HERMES_PROVIDER_ERROR",
        "INVALID_PLAN_RESPONSE",
        "UNSUPPORTED_ANALYSIS_TYPE",
    ]
    message: str
    user_message: str
    retryable: bool
    fallback_available: bool
