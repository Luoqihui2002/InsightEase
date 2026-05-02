"""AI相关的Schemas"""
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime


class DataInterpretationRequest(BaseModel):
    """数据解读请求"""
    dataset_id: str
    analysis_type: str = "general"  # general, business, technical


class DataInterpretationResponse(BaseModel):
    """数据解读响应"""
    analysis_type: str
    interpretation: str
    summary: str


class SuggestionRequest(BaseModel):
    """智能建议请求"""
    dataset_id: str
    context: Optional[str] = None  # 用户背景信息


class SuggestionItem(BaseModel):
    """单个建议项"""
    type: str
    title: str
    description: str
    reason: str
    priority: str  # high, medium, low


class SuggestionResponse(BaseModel):
    """智能建议响应"""
    suggestions: List[SuggestionItem]


class QuestionRequest(BaseModel):
    """数据问答请求"""
    dataset_id: str
    question: str
    chat_history: Optional[List[Dict[str, str]]] = []


class QuestionResponse(BaseModel):
    """数据问答响应"""
    question: str
    answer: str
    data_summary: str


class ChatRequest(BaseModel):
    """聊天请求"""
    message: str
    chat_history: Optional[List[Dict[str, str]]] = []


class ChatStreamResponse(BaseModel):
    """聊天流式响应"""
    chunk: str
    finished: bool
    full_text: Optional[str] = None


class AIInsight(BaseModel):
    """AI洞察记录"""
    id: str
    dataset_id: str
    type: str  # interpretation, suggestion, qa
    content: Dict[str, Any]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Relationship Inference Schemas
# ---------------------------------------------------------------------------

class RelationshipEvidence(BaseModel):
    """单条关系推断证据"""
    type: str  # column_name_match, role_match, type_compatibility, uniqueness_signal, table_type_signal, value_overlap, null_rate_check, manual_confirmation
    score: float
    message: str


class TableRelationship(BaseModel):
    """表间关系推断结果"""
    id: str
    source_dataset_id: str
    target_dataset_id: str
    source_dataset_name: str
    target_dataset_name: str
    source_column: str
    target_column: str
    relationship_type: str  # one_to_one, one_to_many, many_to_one, many_to_many, unknown
    confidence: float
    status: str  # suggested, confirmed, rejected
    evidence: List[RelationshipEvidence]
    warnings: List[str]
    created_at: Optional[str] = None
    confirmed_at: Optional[str] = None


class InferRelationshipsRequest(BaseModel):
    """关系推断请求"""
    dataset_ids: List[str]
    include_value_overlap: bool = False
    max_candidates: int = 200


class InferRelationshipsResponse(BaseModel):
    """关系推断响应"""
    relationships: List[TableRelationship]
    generated_at: str
    warnings: List[str]
