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
