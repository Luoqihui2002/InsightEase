from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any

class FieldSchema(BaseModel):
    name: str
    dtype: str = "object"
    semantic_type: Optional[str] = None
    sample_values: List[Any] = []

class DatasetResponse(BaseModel):
    id: str
    filename: str
    row_count: int
    col_count: int
    file_size: int
    schema: List[FieldSchema]
    quality_score: Optional[int] = None
    ai_summary: Optional[str] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DatasetPreview(BaseModel):
    columns: List[str]
    data: List[Dict[str, Any]]
    total_rows: int


class DatasetUpdate(BaseModel):
    """更新数据集请求"""
    filename: Optional[str] = None


class ColumnStats(BaseModel):
    """列统计信息"""
    name: str
    dtype: str
    type: str  # numeric, categorical, datetime
    non_null_count: int
    null_count: int
    null_percentage: float
    # 数值型特有
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    # 分类型特有
    unique_count: Optional[int] = None
    most_common: Optional[str] = None


class DatasetStatistics(BaseModel):
    """数据集统计概览"""
    total_rows: int
    total_columns: int
    memory_usage: str
    column_stats: List[ColumnStats]
    numeric_columns: List[str]
    categorical_columns: List[str]
    datetime_columns: List[str]
    missing_values_total: int
    missing_values_percentage: float


class DatasetSummary(BaseModel):
    """数据集汇总信息（用于仪表盘）"""
    total_datasets: int
    total_rows: int
    total_files_size: int
    recent_uploads: List[DatasetResponse]