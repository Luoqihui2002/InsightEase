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
from app.services.relationship_inference_service import infer_relationships
from app.schemas.ai import InferRelationshipsRequest, InferRelationshipsResponse

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


@router.post("/infer-relationships", response_model=ResponseModel[InferRelationshipsResponse])
async def infer_relationships_endpoint(
    request: InferRelationshipsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Metadata-only relationship inference between multiple datasets.

    Accepts a list of dataset IDs, profiles each dataset, and returns
    suggested relationships with confidence scores, evidence, and warnings.

    This endpoint is **read-only** — it never modifies datasets.
    Value overlap is not implemented; inference uses metadata only.
    """
    if len(request.dataset_ids) < 2:
        raise HTTPException(status_code=400, detail="至少需要提供 2 个数据集 ID")

    if len(request.dataset_ids) > 20:
        raise HTTPException(status_code=400, detail="单次推断的数据集数量不能超过 20 个")

    # Fetch datasets
    result = await db.execute(
        select(Dataset).where(
            Dataset.id.in_(request.dataset_ids),
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    datasets = result.scalars().all()
    found_ids = {str(d.id) for d in datasets}
    missing_ids = set(request.dataset_ids) - found_ids

    profiles: dict = {}
    profile_warnings: list = []

    for dataset in datasets:
        file_path = dataset.storage_path
        try:
            if file_path.endswith(".csv"):
                df = read_csv_with_auto_header(file_path)
            elif file_path.endswith((".xlsx", ".xls")):
                df = pd.read_excel(file_path)
            else:
                profile_warnings.append(f"数据集 {dataset.filename} 格式不支持，已跳过")
                continue
        except Exception as e:
            profile_warnings.append(f"读取数据集 {dataset.filename} 失败: {str(e)}")
            continue

        try:
            profile = profile_dataset(
                df,
                dataset_id=str(dataset.id),
                name=dataset.filename or str(dataset.id),
                include_examples=False
            )
            profiles[str(dataset.id)] = profile
        except Exception as e:
            profile_warnings.append(f"分析数据集 {dataset.filename} 失败: {str(e)}")
            continue

    if missing_ids:
        profile_warnings.append(f"以下数据集不存在或无权访问: {', '.join(missing_ids)}")

    if len(profiles) < 2:
        return ResponseModel(
            data=InferRelationshipsResponse(
                relationships=[],
                generated_at="",
                warnings=profile_warnings + ["成功分析的数据集不足 2 个，无法推断关系"]
            )
        )

    # Run inference
    try:
        inference_result = infer_relationships(
            profiles,
            include_value_overlap=request.include_value_overlap,
            max_candidates=request.max_candidates
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"关系推断失败: {str(e)}")

    # Merge warnings
    all_warnings = profile_warnings + inference_result.get("warnings", [])

    return ResponseModel(
        data=InferRelationshipsResponse(
            relationships=inference_result.get("relationships", []),
            generated_at=inference_result.get("generated_at", ""),
            warnings=all_warnings
        )
    )
