"""AI智能分析接口"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.config import settings
from app.models import Dataset
from app.schemas.base import ResponseModel
from app.schemas.ai import (
    DataInterpretationRequest, DataInterpretationResponse,
    SuggestionRequest, SuggestionResponse,
    QuestionRequest, QuestionResponse,
    ChatRequest
)
from app.services.ai_service import ai_service
import pandas as pd
from pathlib import Path
from app.api.v1.endpoints.datasets import read_csv_with_auto_header

router = APIRouter()


def load_dataset_file(dataset: Dataset) -> pd.DataFrame:
    """加载数据集文件"""
    file_path = dataset.storage_path
    ext = Path(file_path).suffix.lower()
    
    try:
        if ext == ".csv":
            df = read_csv_with_auto_header(file_path)
        elif ext in [".xlsx", ".xls"]:
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")
        
        # 限制数据量，避免token过多
        if len(df) > 1000:
            df = df.sample(1000, random_state=42)
        
        return df
    except Exception as e:
        raise HTTPException(500, detail=f"读取数据文件失败: {str(e)}")


@router.post("/interpret", response_model=ResponseModel[DataInterpretationResponse])
async def interpret_data(
    request: DataInterpretationRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    AI数据解读
    
    分析类型：
    - general: 通用解读
    - business: 商业分析视角
    - technical: 技术分析视角
    """
    # 获取数据集
    result = await db.execute(
        select(Dataset).where(Dataset.id == request.dataset_id, Dataset.is_deleted == False)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    # 加载数据
    df = load_dataset_file(dataset)
    
    # 调用AI解读
    interpretation = await ai_service.interpret_data(df, request.analysis_type)
    
    return ResponseModel(data=interpretation)


@router.post("/suggestions", response_model=ResponseModel[SuggestionResponse])
async def generate_suggestions(
    request: SuggestionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    生成智能分析建议
    
    根据数据特征推荐适合的分析方法
    """
    # 获取数据集
    result = await db.execute(
        select(Dataset).where(Dataset.id == request.dataset_id, Dataset.is_deleted == False)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    # 加载数据
    df = load_dataset_file(dataset)
    
    # 生成建议
    suggestions = await ai_service.generate_suggestions(df, request.context)
    
    return ResponseModel(data={"suggestions": suggestions})


@router.post("/ask", response_model=ResponseModel[QuestionResponse])
async def answer_question(
    request: QuestionRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    数据问答
    
    用自然语言提问，AI基于数据回答
    """
    # 获取数据集
    result = await db.execute(
        select(Dataset).where(Dataset.id == request.dataset_id, Dataset.is_deleted == False)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    # 加载数据
    df = load_dataset_file(dataset)
    
    # 回答问题
    answer = await ai_service.answer_question(
        df, 
        request.question, 
        request.chat_history or []
    )
    
    return ResponseModel(data=answer)


@router.post("/chat")
async def chat_stream(request: ChatRequest):
    """
    AI聊天对话（流式）
    
    通用对话接口，支持流式返回
    """
    async def generate():
        full_text = ""
        async for chunk in ai_service.chat_stream(request.message, request.chat_history or []):
            full_text += chunk
            yield "data: " + json.dumps({"chunk": chunk, "finished": False}) + "\n\n"
        
        yield "data: " + json.dumps({"chunk": "", "finished": True, "full_text": full_text}) + "\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.get("/status")
async def check_ai_status():
    """
    检查AI服务状态
    """
    is_available = bool(settings.KIMI_API_KEY)
    return ResponseModel(data={
        "available": is_available,
        "model": settings.KIMI_MODEL if is_available else None,
        "message": "AI服务已配置" if is_available else "请在.env中配置KIMI_API_KEY"
    })
