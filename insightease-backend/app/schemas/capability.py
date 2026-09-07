"""Versioned H1 contracts. Candidates contain choices, never execution authority."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

Name = Annotated[str, Field(min_length=1, max_length=200, strict=True)]
BusinessGoal = Literal[
    "conversion_decline", "cohort_cvr_comparison", "channel_diagnosis",
    "mix_decomposition", "funnel_diagnosis", "touchpoint_allocation", "causal_channel_effect",
]
EvidenceConcept = Literal[
    "cohort_cvr_comparison", "channel_cvr_comparison", "mix_within_decomposition",
    "funnel_comparison", "touchpoint_allocation",
]
FieldRole = Literal[
    "entity_id", "conversion_flag", "cohort", "acquisition_channel",
    "paid_first_order", "represented_touchpoint", "sortable_timestamp",
]
Grain = Literal["unique_user", "user_order_detail", "represented_record"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, allow_inf_nan=False)


class CapabilityRef(Contract):
    capability_id: Name
    version: Name


class OperatorRef(Contract):
    operator_id: Name
    version: Name


class DatasetRef(Contract):
    dataset_id: Name
    # Candidate may explicitly request current; compiler always freezes a hash.
    version: Name | None


class ColumnProvenance(Contract):
    source_dataset_id: Name
    source_column: Name


class FieldBinding(Contract):
    dataset_ref: DatasetRef
    column: Name
    role: FieldRole
    provenance: ColumnProvenance | None


class VersionedDatasetRef(DatasetRef):
    version: Name


class FrozenFieldBinding(FieldBinding):
    dataset_ref: VersionedDatasetRef


class PopulationSpec(Contract):
    grain: Grain
    entity_role: Literal["entity_id"]
    scope: Literal["all_input_users_in_selected_cohorts"]
    conversion_policy: Literal["binary_required_missing_invalid"]


class ComparisonSpec(Contract):
    baseline: Name
    current: Name


class OutputContract(Contract):
    contract_id: Name
    version: Name
    required_evidence_types: tuple[EvidenceConcept, ...] = Field(min_length=1, max_length=8)


class CapabilityContract(Contract):
    schema_version: Literal["capability@1"] = "capability@1"
    capability_id: Name
    version: Name
    lifecycle: Literal["enabled", "legacy_limited"]
    display_name: Name
    supported_question_types: tuple[Name, ...]
    supported_business_goals: tuple[BusinessGoal, ...]
    required_field_roles: tuple[FieldRole, ...]
    optional_field_roles: tuple[FieldRole, ...]
    required_grain: Grain
    accepted_grains: tuple[Grain, ...]
    join_requirements: tuple[Name, ...]
    deterministic_operator: OperatorRef
    supported_metrics: tuple[Name, ...]
    supported_dimensions: tuple[FieldRole, ...]
    output_contract: OutputContract
    supported_claims: tuple[Name, ...]
    unsupported_claims: tuple[Name, ...]
    known_limitations: tuple[Name, ...]
    assumptions: tuple[Name, ...]
    confirmation_requirements: tuple[Name, ...]


class CandidatePlanV2(Contract):
    schema_version: Literal["candidate-plan@2"]
    plan_id: Name
    plan_version: Annotated[int, Field(strict=True, ge=1)]
    user_question: Annotated[str, Field(strict=True, min_length=1, max_length=2000)]
    capability_ref: CapabilityRef
    business_goal_ids: tuple[BusinessGoal, ...] = Field(min_length=1, max_length=8)
    required_evidence_types: tuple[EvidenceConcept, ...] = Field(min_length=1, max_length=8)
    field_bindings: tuple[FieldBinding, ...] = Field(max_length=7)
    population_spec: PopulationSpec
    comparison_spec: ComparisonSpec
    expected_output_contract: OutputContract


class ReviewedRequirements(Contract):
    """Application/user-reviewed requirements, separate from provider's candidate.

    H1 validates these typed goals, not arbitrary natural-language entailment.
    This is not an approval token or a new session-state implementation.
    """
    business_goal_ids: tuple[BusinessGoal, ...] = Field(min_length=1, max_length=8)
    required_evidence_types: tuple[EvidenceConcept, ...] = Field(min_length=1, max_length=8)


class CapabilityPreflightRequest(Contract):
    candidate: CandidatePlanV2
    requirements: ReviewedRequirements


class OperatorParameters(Contract):
    formula: Literal["baseline_rate_mix_current_share_within@1"] = "baseline_rate_mix_current_share_within@1"
    projection: Literal["validate_consistency_then_unique_user@1"] = "validate_consistency_then_unique_user@1"
    missing_conversion: Literal["data_invalid"] = "data_invalid"
    channel_enter_exit: Literal["decomposition_unavailable"] = "decomposition_unavailable"


class ExecutionSpec(Contract):
    schema_version: Literal["execution-spec@1"] = "execution-spec@1"
    execution_spec_id: Name
    version: Literal["1"] = "1"
    capability_ref: CapabilityRef
    operator_ref: OperatorRef
    input_refs: tuple[VersionedDatasetRef, ...] = Field(min_length=1, max_length=2)
    field_bindings: tuple[FrozenFieldBinding, ...] = Field(min_length=4, max_length=4)
    population_spec: PopulationSpec
    comparison_spec: ComparisonSpec
    required_output_contract: OutputContract
    plan_version: int
    plan_hash: Name
    metadata_version: Name
    context_version: None = None  # H3 server conversation revisions do not exist yet.
    operator_parameters: OperatorParameters


class CompileOutcome(Contract):
    status: Literal["ready", "needs_clarification", "unsupported", "data_invalid", "stale"]
    code: Name
    missing_goals: tuple[BusinessGoal, ...] = ()
    missing_evidence: tuple[EvidenceConcept, ...] = ()
    execution_spec: ExecutionSpec | None = None

    @model_validator(mode="after")
    def ready_requires_spec(self):
        if (self.status == "ready") != (self.execution_spec is not None):
            raise ValueError("Only a ready outcome can carry an execution spec")
        return self

    @computed_field
    @property
    def executable(self) -> bool:
        return self.status == "ready" and self.execution_spec is not None


class CohortMetrics(Contract):
    cohort: Name
    user_count: int
    converted_user_count: int
    cvr: float


class OverallComparison(Contract):
    baseline: CohortMetrics
    current: CohortMetrics
    cvr_delta_pp: float


class ChannelMetrics(CohortMetrics):
    share: float


class ChannelComparison(Contract):
    channel: Name
    baseline: ChannelMetrics | None
    current: ChannelMetrics | None
    channel_cvr_delta: float | None  # percentage points
    conversion_count_delta: int
    mix_effect_pp: float | None
    within_effect_pp: float | None


class Coverage(Contract):
    status: Literal["complete", "partial", "unavailable"]
    reason: Name | None = None


class Decomposition(Contract):
    formula: Literal["baseline_rate_mix_current_share_within@1"] = "baseline_rate_mix_current_share_within@1"
    mix_effect_pp: float | None
    within_effect_pp: float | None
    reconciliation_residual_pp: float | None
    coverage: Coverage


class RankingItem(Contract):
    channel: Name
    value: float
    rank: int
    ties: tuple[Name, ...]


class Ranking(Contract):
    ranking_metric: Literal["channel_cvr_delta", "conversion_count_delta", "within_effect_pp", "mix_effect_pp"]
    ranking_universe: tuple[Name, ...]
    direction: Literal["ascending"] = "ascending"
    unit: Literal["percentage_point", "count"]
    coverage: Coverage
    items: tuple[RankingItem, ...]


class InputGrainSummary(Contract):
    input_rows: int
    unique_users: int
    selected_users: int
    excluded_other_cohort_users: int
    projection: Literal["identity", "validated_user_projection"]


class FunnelBranch(Contract):
    status: Literal["not_requested", "missing_input", "blocked", "computed"]
    reason: Name | None


class OptionalBranches(Contract):
    funnel: FunnelBranch


class ConversionDiagnosisResult(Contract):
    schema_version: Literal["ConversionDiagnosisResult@1"] = "ConversionDiagnosisResult@1"
    operator_ref: OperatorRef
    overall_comparison: OverallComparison
    channel_comparison: tuple[ChannelComparison, ...]
    decomposition: Decomposition
    rankings: tuple[Ranking, ...]
    coverage: Coverage
    quality_flags: tuple[Name, ...]
    input_grain_summary: InputGrainSummary
    optional_branches: OptionalBranches
