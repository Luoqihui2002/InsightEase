from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import Dataset
from app.schemas.base import ResponseModel
from app.schemas.transform import (
    TransformPreviewRequest,
    TransformPreviewResponse,
    TransformRequest,
    TransformResultResponse,
)
from app.services.transform_service import preview_transform, execute_transform
from app.api.v1.endpoints.auth import get_current_active_user

router = APIRouter()


async def _get_owned_dataset(
    dataset_id: str,
    db: AsyncSession,
    current_user,
) -> Dataset:
    """Fetch dataset and verify ownership."""
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id,
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id,
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集不存在")
    return dataset


@router.post("/{dataset_id}/transform/preview", response_model=ResponseModel[TransformPreviewResponse])
async def preview_dataset_transform(
    dataset_id: str,
    request: TransformPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Preview the result of applying an operation chain to a dataset.
    Does not create a new dataset.
    """
    dataset = await _get_owned_dataset(dataset_id, db, current_user)

    # Convert Pydantic operations to plain dicts for the executor
    operations = [op.model_dump() for op in request.operations]

    result = await preview_transform(dataset, operations)
    return ResponseModel(data=result)


@router.post("/{dataset_id}/transform", response_model=ResponseModel[TransformResultResponse])
async def transform_dataset(
    dataset_id: str,
    request: TransformRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    """
    Execute an operation chain and save the result as a new dataset.
    """
    dataset = await _get_owned_dataset(dataset_id, db, current_user)

    operations = [op.model_dump() for op in request.operations]
    options = request.options.model_dump() if request.options else {}

    result = await execute_transform(
        dataset=dataset,
        operations=operations,
        options=options,
        db=db,
        current_user_id=current_user.id,
    )
    return ResponseModel(data=result)
