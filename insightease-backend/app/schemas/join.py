"""Strict contracts for deterministic multi-table dataset construction."""

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator


class JoinModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConfirmedJoinRelationship(JoinModel):
    id: str = Field(..., min_length=1, max_length=500)
    source_dataset_id: str = Field(..., min_length=1, max_length=200)
    source_field: str = Field(..., min_length=1, max_length=200)
    target_dataset_id: str = Field(..., min_length=1, max_length=200)
    target_field: str = Field(..., min_length=1, max_length=200)
    status: Literal["confirmed"]
    expected_cardinality: Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many", "unknown"] = "unknown"
    risk_level: Literal["low", "medium", "high"] = "low"


class JoinStep(JoinModel):
    left_dataset_id: str = Field(..., min_length=1, max_length=200)
    right_dataset_id: str = Field(..., min_length=1, max_length=200)
    left_field: str = Field(..., min_length=1, max_length=200)
    right_field: str = Field(..., min_length=1, max_length=200)
    join_type: Literal["left", "inner"] = "left"
    relationship_id: str = Field(..., min_length=1, max_length=500)
    relationship_status: Literal["confirmed"]
    expected_cardinality: Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many", "unknown"] = "unknown"


class JoinPlan(JoinModel):
    id: str = Field(..., min_length=1, max_length=200)
    source_analysis_plan_id: str = Field(..., min_length=1, max_length=200)
    relationship_set_id: str = Field(..., min_length=1, max_length=200)
    base_dataset_id: str = Field(..., min_length=1, max_length=200)
    included_dataset_ids: List[str] = Field(..., min_length=2, max_length=3)
    join_steps: List[JoinStep] = Field(..., min_length=1, max_length=2)
    confirmed_relationships: List[ConfirmedJoinRelationship] = Field(..., min_length=1, max_length=2)
    selected_fields: Dict[str, List[str]]
    output_columns: List[str] = Field(default_factory=list, max_length=200)
    warnings: List[str] = Field(default_factory=list, max_length=20)
    requires_confirmation: Literal[True]

    @model_validator(mode="after")
    def validate_shape(self):
        if len(set(self.included_dataset_ids)) != len(self.included_dataset_ids):
            raise ValueError("included_dataset_ids must be unique")
        if self.base_dataset_id not in self.included_dataset_ids:
            raise ValueError("base_dataset_id must be included")
        if set(self.selected_fields) - set(self.included_dataset_ids):
            raise ValueError("selected_fields contains an unknown dataset")
        if len(self.join_steps) != len(self.included_dataset_ids) - 1:
            raise ValueError("join_steps must connect every included dataset exactly once")
        included = set(self.included_dataset_ids)
        for step in self.join_steps:
            if step.left_dataset_id not in included or step.right_dataset_id not in included:
                raise ValueError("join_steps contains an unknown dataset")
        return self


class JoinPreviewRequest(JoinModel):
    join_plan: JoinPlan
    max_preview_rows: int = Field(default=20, ge=1, le=50)


class JoinStepMetrics(JoinModel):
    step_index: int
    left_dataset_id: str
    right_dataset_id: str
    left_row_count: int
    right_row_count: int
    output_row_count: int
    matched_left_rows: int
    unmatched_left_rows: int
    unmatched_right_rows: int
    match_rate: float
    left_null_key_count: int
    right_null_key_count: int
    left_null_key_rate: float
    right_null_key_rate: float
    left_duplicate_key_count: int
    right_duplicate_key_count: int
    left_duplicate_key_rate: float
    right_duplicate_key_rate: float
    left_unique_key_count: int
    right_unique_key_count: int
    cardinality: Literal["one_to_one", "one_to_many", "many_to_one", "many_to_many"]
    row_multiplier: float
    risk_level: Literal["low", "medium", "high", "blocked"]
    warnings: List[str]


class JoinRiskSummary(JoinModel):
    risk_level: Literal["low", "medium", "high", "blocked"]
    row_multiplier: float
    cardinalities: List[str]
    base_grain: str
    result_grain: str
    warnings: List[str]
    blocked_reasons: List[str]


class JoinPreview(JoinModel):
    input_dataset_ids: List[str]
    input_row_counts: Dict[str, int]
    output_row_count: int
    output_column_count: int
    output_columns: List[str]
    preview_rows: List[Dict[str, object]]
    preview_limit: int
    step_metrics: List[JoinStepMetrics]
    risk_summary: JoinRiskSummary


class CreateJoinedDatasetRequest(JoinModel):
    join_plan: JoinPlan
    filename: str = Field(..., min_length=1, max_length=255)
    confirm_create: Literal[True]
    confirm_high_risk: bool = False


class DerivedDatasetMetadata(JoinModel):
    dataset_id: str
    filename: str
    source_dataset_ids: List[str]
    source_analysis_plan_id: str
    derivation_type: Literal["join"]
    row_count: int
    col_count: int
    risk_summary: JoinRiskSummary
    created_at: str
