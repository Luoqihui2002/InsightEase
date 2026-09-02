"""Schemas for metadata-first Assistant capabilities."""

from typing import List, Optional

from pydantic import BaseModel, Field


class RelationshipEvidence(BaseModel):
    type: str
    score: float
    message: str


class TableRelationship(BaseModel):
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


class InferRelationshipsRequest(BaseModel):
    dataset_ids: List[str]
    include_value_overlap: bool = False
    max_candidates: int = Field(default=200, ge=1, le=1000)


class InferRelationshipsResponse(BaseModel):
    relationships: List[TableRelationship]
    generated_at: str
    warnings: List[str]
