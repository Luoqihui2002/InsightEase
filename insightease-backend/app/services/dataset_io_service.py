"""Shared, storage-backed Dataset dataframe reader."""

from __future__ import annotations

import os
from dataclasses import dataclass
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


@dataclass
class CapabilityDatasetFrames:
    """Same byte snapshot, usual columns plus logical values before inference."""
    frame: pd.DataFrame
    logical_frame: pd.DataFrame


async def load_dataset_dataframe(dataset: Dataset, *, nrows: int | None = None) -> pd.DataFrame:
    """Existing reader contract is unchanged for all legacy callers."""
    return await _load_dataset(dataset, nrows=nrows, preserve_logical=False)


async def load_capability_dataset_frames(dataset: Dataset) -> CapabilityDatasetFrames:
    """H1 conversion policy consumes logical cells, never pandas inferred values."""
    return await _load_dataset(dataset, nrows=None, preserve_logical=True)


async def _load_dataset(dataset, *, nrows, preserve_logical):
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
                def read(**kwargs):
                    return read_csv_with_auto_header(
                        temporary_path, nrows=nrows, low_memory=False, **kwargs,
                    )
            else:
                def read(**kwargs):
                    return pd.read_excel(temporary_path, nrows=nrows, **kwargs)
            frame = read()
            if not preserve_logical:
                return frame
            # object disables dtype inference; na_filter=False preserves blank /
            # unknown text for our explicit reject policy instead of NA coercion.
            if extension == ".xlsx":
                from openpyxl import load_workbook
                book = load_workbook(temporary_path, read_only=True, data_only=False)
                try:
                    sheet = book.worksheets[0]
                    cells = sheet.iter_rows(min_row=2, max_row=len(frame) + 1,
                                            max_col=len(frame.columns))
                    values = [[cell.value for cell in row] for row in cells] if len(frame) else []
                    logical = pd.DataFrame(values, columns=frame.columns, dtype=object)
                finally:
                    book.close()
            elif extension == ".xls":
                import xlrd
                book = xlrd.open_workbook(temporary_path)
                try:
                    sheet = book.sheet_by_index(0)
                    def logical_cell(cell):
                        if cell.ctype == xlrd.XL_CELL_BOOLEAN:
                            return bool(cell.value)
                        if cell.ctype == xlrd.XL_CELL_DATE:
                            return xlrd.xldate_as_datetime(cell.value, book.datemode)
                        if cell.ctype == xlrd.XL_CELL_ERROR:
                            return xlrd.error_text_from_code[cell.value]
                        return cell.value
                    values = [[logical_cell(sheet.cell(r, c)) for c in range(len(frame.columns))]
                              for r in range(1, len(frame) + 1)]
                    logical = pd.DataFrame(values, columns=frame.columns, dtype=object)
                finally:
                    book.release_resources()
            else:
                logical = read(dtype=object, na_filter=False)
            if not frame.columns.equals(logical.columns) or len(frame) != len(logical):
                raise HTTPException(422, detail="源逻辑值与读取结果不一致")
            return CapabilityDatasetFrames(frame, logical)
        finally:
            os.remove(temporary_path)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(422, detail="数据集读取失败") from exc
