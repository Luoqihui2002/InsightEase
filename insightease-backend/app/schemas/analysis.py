from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List

class AnalysisCreate(BaseModel):
    dataset_id: str
    analysis_type: str
    params: Dict[str, Any] = {}

class AnalysisResponse(BaseModel):
    id: str
    dataset_id: str
    type: str
    status: str
    params: Dict[str, Any]
    result_data: Optional[Dict[str, Any]] = None
    ai_interpretation: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True