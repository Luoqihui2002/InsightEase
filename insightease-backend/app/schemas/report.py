"""报告导出相关的Schemas"""
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum


class ReportFormat(str, Enum):
    """报告格式"""
    PDF = "pdf"
    WORD = "word"
    HTML = "html"


class ReportCreateRequest(BaseModel):
    """创建报告请求"""
    dataset_id: str
    title: Optional[str] = None
    format: ReportFormat = ReportFormat.PDF
    include_analysis: List[str] = []  # 要包含的分析ID列表，为空则包含所有


class ReportResponse(BaseModel):
    """报告响应"""
    id: str
    title: str
    format: str
    dataset_id: str
    file_url: Optional[str] = None
    status: str  # generating, completed, failed
    message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


class ReportDownloadResponse(BaseModel):
    """报告下载响应"""
    download_url: str
    filename: str
    expires_at: datetime
