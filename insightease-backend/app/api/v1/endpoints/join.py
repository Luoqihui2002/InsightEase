"""Authenticated preview/write boundary for deterministic JoinPlans."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.auth import get_current_active_user
from app.core.database import get_db
from app.models.models import Dataset, User
from app.schemas.base import ResponseModel
from app.schemas.join import (
    CreateJoinedDatasetRequest,
    DerivedDatasetMetadata,
    JoinPreview,
    JoinPreviewRequest,
)
from app.services.join_service import create_joined_dataset, preview_join_plan


router = APIRouter()


async def _get_owned_datasets(
    dataset_ids: list[str],
    db: AsyncSession,
    current_user: User,
) -> dict[str, Dataset]:
    result = await db.execute(
        select(Dataset).where(
            Dataset.id.in_(dataset_ids),
            Dataset.user_id == current_user.id,
            Dataset.is_deleted == False,
        )
    )
    datasets = {dataset.id: dataset for dataset in result.scalars().all()}
    if set(datasets) != set(dataset_ids):
        raise HTTPException(404, detail="一个或多个源数据集不存在")
    return datasets


@router.post("/preview", response_model=ResponseModel[JoinPreview])
async def preview_join(
    request: JoinPreviewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Run bounded join computation and risk analysis without saving a Dataset."""
    datasets = await _get_owned_datasets(
        request.join_plan.included_dataset_ids,
        db,
        current_user,
    )
    preview, _ = await preview_join_plan(
        request.join_plan,
        datasets,
        request.max_preview_rows,
    )
    return ResponseModel(data=preview)


@router.post("/create-dataset", response_model=ResponseModel[DerivedDatasetMetadata])
async def create_join_dataset(
    request: CreateJoinedDatasetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Recompute a confirmed JoinPlan and persist one derived Dataset."""
    datasets = await _get_owned_datasets(
        request.join_plan.included_dataset_ids,
        db,
        current_user,
    )
    derived = await create_joined_dataset(
        plan=request.join_plan,
        datasets=datasets,
        filename=request.filename,
        confirm_high_risk=request.confirm_high_risk,
        db=db,
        current_user_id=current_user.id,
    )
    return ResponseModel(data=derived)
