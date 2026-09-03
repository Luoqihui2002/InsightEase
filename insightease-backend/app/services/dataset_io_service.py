"""Shared, storage-backed Dataset dataframe reader."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pandas as pd
from fastapi import HTTPException

from app.core.storage import storage
from app.models.models import Dataset


MAX_FILE_SIZE_MB = 100


def check_dataset_file_size(dataset: Dataset, max_size_mb: int = MAX_FILE_SIZE_MB) -> None:
    size_mb = dataset.file_size / (1024 * 1024)
    if size_mb > max_size_mb:
        raise HTTPException(413, detail=f"源文件大小超过 {max_size_mb} MB 限制")


async def load_dataset_dataframe(dataset: Dataset, *, nrows: int | None = None) -> pd.DataFrame:
    """Read CSV/Excel through the configured storage abstraction."""
    check_dataset_file_size(dataset)
    extension = Path(dataset.filename).suffix.lower()
    if extension not in {".csv", ".xlsx", ".xls"}:
        raise HTTPException(422, detail="数据集文件格式不支持")

    try:
        content = await storage.read(dataset.storage_path)
        with tempfile.NamedTemporaryFile(mode="wb", delete=False, suffix=extension) as temporary:
            temporary.write(content)
            temporary_path = temporary.name
        try:
            if extension == ".csv":
                from app.api.v1.endpoints.datasets import read_csv_with_auto_header

                return read_csv_with_auto_header(temporary_path, nrows=nrows, low_memory=False)
            return pd.read_excel(temporary_path, nrows=nrows)
        finally:
            os.remove(temporary_path)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, detail="数据集读取失败") from exc
