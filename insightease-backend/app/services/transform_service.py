"""
Transform Service - Business layer for DataWorkshop transform operations.

Handles:
- File I/O (storage abstraction)
- Transaction management
- Preview vs Save logic
- Error cleanup
"""

import uuid
import os
import tempfile
import logging
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Tuple

import pandas as pd
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.storage import storage
from app.services.dataset_io_service import check_dataset_file_size, load_dataset_dataframe
from app.core.transform_executor import (
    execute_operations,
    build_column_stats,
    serialize_dataframe,
    TransformError,
)
from app.models.models import Dataset

logger = logging.getLogger(__name__)

# Constants
MAX_OPERATIONS = 20
MAX_PREVIEW_ROWS = 100
MAX_OUTPUT_ROWS = 1_000_000
MAX_FILE_SIZE_MB = 100


def _check_file_size(dataset: Dataset) -> None:
    """Check if source file exceeds V1 limit."""
    check_dataset_file_size(dataset, MAX_FILE_SIZE_MB)


async def preview_transform(
    dataset: Dataset,
    operations: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Preview transform result without saving.

    Returns:
        dict matching TransformPreviewResponse structure.
    """
    _check_file_size(dataset)

    if not operations:
        raise HTTPException(status_code=422, detail="操作链不能为空")
    if len(operations) > MAX_OPERATIONS:
        raise HTTPException(status_code=422, detail=f"操作链长度不能超过 {MAX_OPERATIONS}")

    df = await load_dataset_dataframe(dataset)

    try:
        result_df, summary = execute_operations(df, operations)
    except TransformError as e:
        raise HTTPException(
            status_code=422,
            detail=e.args[0],
        )

    columns, data, total_rows = serialize_dataframe(result_df, limit=MAX_PREVIEW_ROWS)

    return {
        "columns": columns,
        "data": data,
        "total_rows": total_rows,
        "preview_limit": MAX_PREVIEW_ROWS,
        "column_stats": build_column_stats(result_df),
        "execution_summary": summary,
    }


async def execute_transform(
    dataset: Dataset,
    operations: List[Dict[str, Any]],
    options: Dict[str, Any],
    db: AsyncSession,
    current_user_id: str,
) -> Dict[str, Any]:
    """
    Execute transform and save as a new Dataset.

    Returns:
        dict matching TransformResultResponse structure.
    """
    _check_file_size(dataset)

    if not operations:
        raise HTTPException(status_code=422, detail="操作链不能为空")
    if len(operations) > MAX_OPERATIONS:
        raise HTTPException(status_code=422, detail=f"操作链长度不能超过 {MAX_OPERATIONS}")

    df = await load_dataset_dataframe(dataset)
    input_rows = len(df)

    try:
        result_df, summary = execute_operations(df, operations)
    except TransformError as e:
        raise HTTPException(
            status_code=422,
            detail=e.args[0],
        )

    # Output row limit
    if len(result_df) > MAX_OUTPUT_ROWS:
        raise HTTPException(
            status_code=413,
            detail=f"结果行数 {len(result_df):,} 超过上限 {MAX_OUTPUT_ROWS:,}，请添加筛选条件",
        )

    # Generate new dataset
    new_dataset_id = str(uuid.uuid4())
    original_name = Path(dataset.filename).stem
    original_ext = Path(dataset.filename).suffix.lower()
    custom_filename = options.get("filename") if options else None
    if custom_filename:
        new_filename = custom_filename
    else:
        new_filename = f"{original_name}_transformed{original_ext}"

    # Write to temp file
    ext = Path(new_filename).suffix.lower()
    tmp = tempfile.NamedTemporaryFile(mode="wb", delete=False, suffix=ext)
    tmp_path = tmp.name
    tmp.close()

    try:
        if ext == ".csv":
            result_df.to_csv(tmp_path, index=False, encoding="utf-8-sig")
        else:
            result_df.to_excel(tmp_path, index=False)

        with open(tmp_path, "rb") as f:
            file_content = f.read()

        new_storage_path = await storage.save(new_dataset_id, new_filename, file_content)

        # Build schema
        schema = []
        for col in result_df.columns:
            col_name = str(col)
            schema.append({
                "name": col_name,
                "dtype": str(result_df[col].dtype),
                "sample_values": result_df[col].dropna().head(3).tolist(),
            })

        # Compute quality score (reuse logic from datasets.py)
        from app.api.v1.endpoints.datasets import calculate_quality_score
        quality_score = calculate_quality_score(result_df)

        new_dataset = Dataset(
            id=new_dataset_id,
            user_id=current_user_id,
            filename=new_filename,
            storage_path=new_storage_path,
            file_size=len(file_content),
            row_count=len(result_df),
            col_count=len(result_df.columns),
            schema=schema,
            quality_score=quality_score,
            status="ready",
            parent_dataset_id=dataset.id,
            transform_chain=operations,
        )

        db.add(new_dataset)
        await db.commit()
        await db.refresh(new_dataset)

        return {
            "new_dataset_id": new_dataset_id,
            "filename": new_filename,
            "row_count": len(result_df),
            "col_count": len(result_df.columns),
            "parent_dataset_id": dataset.id,
            "transform_chain": operations,
            "execution_summary": {
                "steps_executed": summary["steps_executed"],
                "duration_ms": summary["duration_ms"],
                "input_rows": input_rows,
                "output_rows": len(result_df),
                "warnings": summary.get("warnings", []),
            },
        }

    except HTTPException:
        raise
    except Exception:
        await db.rollback()
        # Clean up saved file if any
        try:
            if "new_storage_path" in locals():
                await storage.delete(new_storage_path)
        except Exception:
            pass
        logger.exception("Transform save failed for dataset %s", dataset.id)
        raise HTTPException(status_code=500, detail="转换结果保存失败")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
