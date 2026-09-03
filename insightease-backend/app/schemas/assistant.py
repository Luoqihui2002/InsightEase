"""Canonical schemas for metadata-first Assistant capabilities."""

from typing import Annotated, Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class StrictAssistantModel(BaseModel):
    """Reject fields outside the documented metadata/plan contract."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class RelationshipEvidence(StrictAssistantModel):
    type: str
    score: float
    message: str


class TableRelationship(StrictAssistantModel):
    id: str
    source_dataset_id: str
    target_dataset_id: str
    source_dataset_name: str
    target_dataset_name: str
    source_column: str
    target_column: str
    relationship_type: str
    confidence: float
    status: str
    evidence: List[RelationshipEvidence]
    warnings: List[str]
    created_at: Optional[str] = None
    confirmed_at: Optional[str] = None


class InferRelationshipsRequest(StrictAssistantModel):
    dataset_ids: List[str]
    include_value_overlap: bool = False
    max_candidates: int = Field(default=200, ge=1, le=1000)


class InferRelationshipsResponse(StrictAssistantModel):
    relationships: List[TableRelationship]
    generated_at: str
    warnings: List[str]


# ---------------------------------------------------------------------------
# Bounded planning context
# ---------------------------------------------------------------------------

PlanSource = Literal["hermes_live", "deterministic_fallback"]
PlanConfidence = Literal["low", "medium", "high"]
ExecutionReadiness = Literal[
    "ready_single_table",
    "needs_join",
    "needs_clarification",
    "unsupported",
]
PlanNextAction = Literal[
    "review_plan",
    "navigate_analysis",
    "create_analysis_dataset",
    "clarify",
]
RecommendedAnalysisType = Literal[
    "descriptive",
    "data_overview",
    "attribution",
    "forecast",
    "path_analysis",
    "ab_test",
    "regression",
    "smart_process",
    "visualization",
]
AnalysisFieldRole = Literal[
    "target_metric",
    "time_column",
    "user_id",
    "group_column",
    "event_name",
    "dimension",
    "feature",
    "join_key",
]
BoundedPlanText = Annotated[str, Field(min_length=1, max_length=500)]


class PlanningColumnMetadata(StrictAssistantModel):
    name: str = Field(..., min_length=1, max_length=200)
    dtype: Optional[str] = Field(default=None, max_length=100)
    semantic_type: Optional[str] = Field(default=None, max_length=100)
    role: Optional[str] = Field(default=None, max_length=100)
    null_rate: Optional[float] = Field(default=None, ge=0, le=1)
    unique_rate: Optional[float] = Field(default=None, ge=0, le=1)


class PlanningDatasetMetadata(StrictAssistantModel):
    id: str = Field(..., min_length=1, max_length=200)
    name: Optional[str] = Field(default=None, max_length=255)
    filename: Optional[str] = Field(default=None, max_length=255)
    columns: List[PlanningColumnMetadata] = Field(
        default_factory=list,
        alias="schema",
        serialization_alias="schema",
        max_length=100,
    )
    table_type: Optional[str] = Field(default=None, max_length=100)
    business_category: Optional[str] = Field(default=None, max_length=100)
    data_type: Optional[str] = Field(default=None, max_length=100)
    analysis_tags: List[str] = Field(default_factory=list, max_length=20)
    recommended_analyses: List[str] = Field(default_factory=list, max_length=20)
    quality_warnings: List[str] = Field(default_factory=list, max_length=20)


class PlanningRelationshipSetNode(StrictAssistantModel):
    dataset_id: str = Field(..., min_length=1, max_length=200)
    dataset_name: Optional[str] = Field(default=None, max_length=255)
    role: Literal["connected", "isolated", "reference_only"]
    joinable: bool


class PlanningRelationshipMetadata(StrictAssistantModel):
    id: Optional[str] = Field(default=None, max_length=500)
    source_dataset_id: str = Field(..., min_length=1, max_length=200)
    source_column: str = Field(..., min_length=1, max_length=200)
    target_dataset_id: str = Field(..., min_length=1, max_length=200)
    target_column: str = Field(..., min_length=1, max_length=200)
    relationship_type: Optional[Literal[
        "one_to_one",
        "one_to_many",
        "many_to_one",
        "many_to_many",
        "unknown",
    ]] = None
    risk_level: Optional[Literal["low", "medium", "high"]] = None
    status: Literal["confirmed"] = "confirmed"


class PlanningRelationshipSet(StrictAssistantModel):
    id: str = Field(..., min_length=1, max_length=200)
    name: str = Field(..., min_length=1, max_length=255)
    dataset_nodes: List[PlanningRelationshipSetNode] = Field(default_factory=list, max_length=50)
    relationships: List[PlanningRelationshipMetadata] = Field(default_factory=list, max_length=200)


class BoundedPlanningContext(StrictAssistantModel):
    selected_dataset_ids: List[str] = Field(default_factory=list, max_length=20)
    selected_dataset_id: Optional[str] = Field(default=None, max_length=200)
    datasets: List[PlanningDatasetMetadata] = Field(default_factory=list, max_length=20)
    relationship_set: Optional[PlanningRelationshipSet] = None
    analysis_history_summary: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Canonical advisory AnalysisPlan
# ---------------------------------------------------------------------------


class AnalysisFieldRequirement(StrictAssistantModel):
    dataset_id: str = Field(..., min_length=1, max_length=200)
    role: AnalysisFieldRole
    required: bool
    candidate_columns: List[str] = Field(default_factory=list, max_length=20)
    reason: str = Field(..., min_length=1, max_length=500)


class AnalysisRelationshipRequirement(StrictAssistantModel):
    relationship_id: Optional[str] = Field(default=None, max_length=500)
    source_dataset_id: str = Field(..., min_length=1, max_length=200)
    source_column: str = Field(..., min_length=1, max_length=200)
    target_dataset_id: str = Field(..., min_length=1, max_length=200)
    target_column: str = Field(..., min_length=1, max_length=200)
    status: Literal["confirmed", "requires_confirmation"]
    relationship_type: Optional[Literal[
        "one_to_one",
        "one_to_many",
        "many_to_one",
        "many_to_many",
        "unknown",
    ]] = None
    risk_level: Optional[Literal["low", "medium", "high"]] = None
    reason: str = Field(..., min_length=1, max_length=500)


class AnalysisMetricTarget(StrictAssistantModel):
    name: str = Field(..., min_length=1, max_length=200)
    dataset_id: str = Field(..., min_length=1, max_length=200)
    field: Optional[str] = Field(default=None, max_length=200)
    aggregation: Optional[Literal["count", "count_distinct", "sum", "average", "min", "max", "rate"]] = None
    description: str = Field(..., min_length=1, max_length=500)


class AssistantCandidateDataset(StrictAssistantModel):
    dataset_id: str = Field(..., min_length=1, max_length=200)
    dataset_name: Optional[str] = Field(default=None, max_length=255)
    reasons: List[BoundedPlanText] = Field(default_factory=list, max_length=8)
    confidence: PlanConfidence


class AssistantNextAction(StrictAssistantModel):
    type: Literal["navigate", "confirm", "explain", "warning"]
    label: str = Field(..., min_length=1, max_length=200)
    target: Optional[str] = Field(default=None, max_length=300)
    payload: Optional[Dict[str, Any]] = None


class AssistantAnalysisPlan(StrictAssistantModel):
    id: str = Field(..., min_length=1, max_length=200)
    user_question: str = Field(..., min_length=1, max_length=2000)
    interpreted_goal: str = Field(..., min_length=1, max_length=1000)
    recommended_analysis_type: RecommendedAnalysisType
    required_datasets: List[str] = Field(default_factory=list, max_length=20)
    required_dataset_ids: List[str] = Field(default_factory=list, max_length=20)
    candidate_dataset_ids: List[str] = Field(default_factory=list, max_length=20)
    candidate_datasets: List[AssistantCandidateDataset] = Field(default_factory=list, max_length=20)
    required_fields: List[AnalysisFieldRequirement] = Field(default_factory=list, max_length=100)
    required_relationships: List[AnalysisRelationshipRequirement] = Field(default_factory=list, max_length=50)
    metrics: List[AnalysisMetricTarget] = Field(default_factory=list, max_length=20)
    relationship_set_id: Optional[str] = Field(default=None, max_length=200)
    relationship_set_name: Optional[str] = Field(default=None, max_length=255)
    reference_dataset_ids: List[str] = Field(default_factory=list, max_length=20)
    assumptions: List[BoundedPlanText] = Field(default_factory=list, max_length=20)
    warnings: List[BoundedPlanText] = Field(default_factory=list, max_length=20)
    clarifying_questions: List[BoundedPlanText] = Field(default_factory=list, max_length=8)
    execution_readiness: ExecutionReadiness
    next_action: PlanNextAction
    next_actions: List[AssistantNextAction] = Field(default_factory=list, max_length=8)
    source: PlanSource
    confidence: PlanConfidence
    fallback_used: bool
