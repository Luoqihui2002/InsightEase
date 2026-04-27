from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any, Union


# ===== Operation Configs =====

class FilterCondition(BaseModel):
    column: str
    operator: str = Field(..., pattern=r"^(eq|ne|gt|gte|lt|lte|contains|startswith|endswith|isNull|isNotNull)$")
    value: Optional[str] = None


class FilterConfig(BaseModel):
    conditions: List[FilterCondition] = Field(..., min_length=1)
    logic: str = Field(..., pattern=r"^(and|or)$")


class SelectConfig(BaseModel):
    columns: List[str] = Field(..., min_length=1)


class RenameMapping(BaseModel):
    old: str
    new: str


class RenameConfig(BaseModel):
    mappings: List[RenameMapping] = Field(..., min_length=1)


class SortConfig(BaseModel):
    by: List[str] = Field(..., min_length=1)
    ascending: Optional[List[bool]] = None
    na_position: str = Field(default="last", pattern=r"^(first|last)$")


class DedupConfig(BaseModel):
    columns: List[str] = Field(default_factory=list)
    keep: str = Field(default="first", pattern=r"^(first|last)$")
    case_sensitive: bool = True


class DeriveConfig(BaseModel):
    newColumn: str = Field(..., min_length=1)
    formula: str = Field(..., min_length=1)

    @field_validator("formula")
    @classmethod
    def validate_formula(cls, v: str) -> str:
        # V1: only numeric arithmetic
        allowed_chars = set("0123456789+-*/()% .`\t\n")
        for ch in v:
            if ch not in allowed_chars and not ch.isalpha() and ch != "_":
                raise ValueError(f"derive formula contains invalid character: '{ch}'")
        # Reject function calls / attributes / dangerous keywords
        lower_v = v.lower()
        for bad in ["import", "eval", "exec", "__", ".", "upper(", "lower(", "trim(",
                     "len(", "substr(", "replace(", "concat(", "if(", "and(", "or(",
                     "not(", "abs(", "round(", "floor(", "ceil(", "sqrt(", "log(",
                     "year(", "month(", "day(", "datediff("]:
            if bad in lower_v:
                raise ValueError(f"derive formula contains unsupported function/keyword: '{bad}'")
        return v


class SampleConfig(BaseModel):
    method: str = Field(..., pattern=r"^(count|percentage)$")
    count: Optional[int] = Field(default=None, ge=1)
    percentage: Optional[float] = Field(default=None, gt=0, le=100)
    seed: Optional[int] = None

    @field_validator("count", mode="after")
    @classmethod
    def validate_count(cls, v: Optional[int], info) -> Optional[int]:
        data = info.data
        if data.get("method") == "count" and v is None:
            raise ValueError("count is required when method='count'")
        return v

    @field_validator("percentage", mode="after")
    @classmethod
    def validate_percentage(cls, v: Optional[float], info) -> Optional[float]:
        data = info.data
        if data.get("method") == "percentage" and v is None:
            raise ValueError("percentage is required when method='percentage'")
        return v


# ===== Operation Union =====

class Operation(BaseModel):
    type: str = Field(..., pattern=r"^(filter|select|rename|sort|dedup|derive|sample)$")
    config: Union[
        FilterConfig,
        SelectConfig,
        RenameConfig,
        SortConfig,
        DedupConfig,
        DeriveConfig,
        SampleConfig,
    ]


# ===== Request / Response =====

class TransformOptions(BaseModel):
    filename: Optional[str] = None
    save_mode: str = Field(default="new_dataset", pattern=r"^(new_dataset|version)$")


class TransformPreviewRequest(BaseModel):
    operations: List[Operation] = Field(..., min_length=1, max_length=20)


class ColumnStat(BaseModel):
    name: str
    dtype: str
    non_null_count: int
    null_count: int
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None


class ExecutionSummary(BaseModel):
    steps_executed: int
    duration_ms: int
    warnings: List[str] = Field(default_factory=list)


class TransformPreviewResponse(BaseModel):
    columns: List[str]
    data: List[Dict[str, Any]]
    total_rows: int
    preview_limit: int
    column_stats: List[ColumnStat]
    execution_summary: ExecutionSummary


class TransformRequest(BaseModel):
    operations: List[Operation] = Field(..., min_length=1, max_length=20)
    options: Optional[TransformOptions] = None


class TransformResultResponse(BaseModel):
    new_dataset_id: str
    filename: str
    row_count: int
    col_count: int
    parent_dataset_id: str
    transform_chain: List[Operation]
    execution_summary: ExecutionSummary
