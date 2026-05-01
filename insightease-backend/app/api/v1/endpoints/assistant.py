"""
AI Data Assistant endpoints.

Metadata-first, read-only. No LLM calls. No data modification.
"""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import pandas as pd

from app.core.database import get_db
from app.models import Dataset, User
from app.schemas.base import ResponseModel
from app.api.v1.endpoints.auth import get_current_active_user
from app.api.v1.endpoints.datasets import read_csv_with_auto_header
from app.services.assistant_profile_service import profile_dataset

router = APIRouter()


@router.post("/profile-dataset", response_model=ResponseModel[dict])
async def profile_dataset_endpoint(
    dataset_id: str,
    include_examples: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    On-demand dataset profiling.

    Returns a structured `DatasetProfile` including:
    - column profiles (dtype, semantic type, role, nulls, uniques, examples, stats)
    - table classification (type, confidence, evidence, recommended analyses)
    - quality warnings

    This endpoint is **read-only** — it never modifies the source dataset.
    """
    # Fetch dataset
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")

    # Read data file
    file_path = dataset.storage_path
    try:
        if file_path.endswith(".csv"):
            df = read_csv_with_auto_header(file_path)
        elif file_path.endswith((".xlsx", ".xls")):
            df = pd.read_excel(file_path)
        else:
            raise HTTPException(status_code=400, detail="不支持的文件格式")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"读取文件失败: {str(e)}")

    # Generate profile
    try:
        profile = profile_dataset(
            df,
            dataset_id=dataset.id,
            name=dataset.filename or dataset_id,
            include_examples=include_examples
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析数据集失败: {str(e)}")

    return ResponseModel(data=profile)
