from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
import pandas as pd
import uuid
import shutil
import os
from pathlib import Path
from datetime import datetime

from app.core.database import get_db
from app.core.config import settings
from app.models import Dataset, User
from app.schemas.base import ResponseModel, PaginationModel
from app.schemas.dataset import (
    DatasetResponse, DatasetPreview, DatasetUpdate, 
    DatasetStatistics, DatasetSummary, ColumnStats
)
from app.api.v1.endpoints.auth import get_current_active_user

router = APIRouter()


def calculate_quality_score(df: pd.DataFrame) -> int:
    """
    计算数据集质量评分
    基于以下维度：
    - 完整性（40分）：缺失值比例
    - 一致性（30分）：重复值比例
    - 有效性（30分）：异常值比例
    """
    total_rows = len(df)
    if total_rows == 0:
        return 0
    
    score = 0
    
    # 1. 完整性评分（40分）- 基于缺失值
    null_count = df.isnull().sum().sum()
    total_cells = total_rows * len(df.columns)
    if total_cells > 0:
        completeness = 1 - (null_count / total_cells)
        score += int(completeness * 40)
    else:
        score += 40
    
    # 2. 一致性评分（30分）- 基于重复值
    unique_rows = len(df.drop_duplicates())
    if total_rows > 0:
        consistency = unique_rows / total_rows
        score += int(consistency * 30)
    else:
        score += 30
    
    # 3. 有效性评分（30分）- 基于数值型列的异常值
    numeric_cols = df.select_dtypes(include=['number']).columns
    if len(numeric_cols) > 0:
        outlier_ratios = []
        for col in numeric_cols:
            Q1 = df[col].quantile(0.25)
            Q3 = df[col].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)].shape[0]
            outlier_ratios.append(outliers / total_rows)
        
        avg_outlier_ratio = sum(outlier_ratios) / len(outlier_ratios)
        validity = 1 - min(avg_outlier_ratio * 2, 1.0)  # 异常值比例翻倍惩罚
        score += int(validity * 30)
    else:
        score += 30  # 没有数值列，默认给满分
    
    return min(max(score, 0), 100)

def _has_header(filepath: str) -> bool:
    """
    检测 CSV 文件是否有表头
    通过检查第一行是否为全数字/日期等数据类型来判断
    """
    try:
        # 读取前两行，不指定表头
        df_no_header = pd.read_csv(filepath, header=None, nrows=2)
        if len(df_no_header) < 2:
            return True  # 只有一行，默认有表头
        
        first_row = df_no_header.iloc[0]
        second_row = df_no_header.iloc[1]
        
        # 检查第一行是否看起来像是表头
        # 表头的特征：包含字符串，且不全是数字/日期格式
        header_like_score = 0
        
        for val in first_row:
            val_str = str(val)
            # 如果值是纯数字，可能是数据而不是表头
            if val_str.replace('.', '').replace('-', '').isdigit():
                header_like_score -= 1
            # 如果值包含字母，更可能是表头
            elif any(c.isalpha() for c in val_str):
                header_like_score += 1
        
        # 检查第二行是否更像数据（数值型）
        data_like_score = 0
        for val in second_row:
            val_str = str(val)
            if val_str.replace('.', '').replace('-', '').isdigit():
                data_like_score += 1
        
        # 如果第一行像数据，第二行也像数据，则认为没有表头
        # 如果第一行不像数据（更像表头），或第二行明显是数据，则认为有表头
        return header_like_score > 0 or data_like_score > len(second_row) * 0.5
    except Exception:
        return True  # 出错时默认有表头


def read_csv_with_auto_header(filepath: str, nrows: int = None, **kwargs) -> pd.DataFrame:
    """
    智能读取 CSV 文件，自动检测是否有表头
    如果没有表头，自动生成 col_0, col_1, ... 的列名
    """
    # 如果没有指定 nrows 或 nrows 较大，需要检测表头
    # 如果 nrows 较小（<=2），可能已经在上传时处理过了
    has_header = _has_header(filepath)
    
    if has_header:
        # 有表头，正常读取
        return pd.read_csv(filepath, nrows=nrows, **kwargs)
    else:
        # 无表头，读取时不指定 header，然后自动生成列名
        df = pd.read_csv(filepath, header=None, nrows=nrows, **kwargs)
        df.columns = [f"col_{i}" for i in range(len(df.columns))]
        return df


@router.post("/upload", response_model=ResponseModel[DatasetResponse])
async def upload_dataset(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ext = Path(file.filename).suffix.lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(400, detail="仅支持CSV/Excel格式")
    
    dataset_id = str(uuid.uuid4())
    safe_name = f"{dataset_id}_{file.filename.replace(' ', '_')}"
    filepath = os.path.join(settings.UPLOAD_DIR, safe_name)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        if ext == ".csv":
            # 智能读取 CSV，自动检测表头
            df = read_csv_with_auto_header(filepath, low_memory=False)
            row_count = len(df)
        else:
            df = pd.read_excel(filepath)
            row_count = len(df)
        
        schema = []
        for col in df.columns:
            # 确保列名是字符串（pandas 列名可能是数字等其他类型）
            col_name = str(col)
            schema.append({
                "name": col_name,
                "dtype": str(df[col].dtype),
                "sample_values": df[col].dropna().head(3).tolist()
            })
        
        # 计算质量评分
        quality_score = calculate_quality_score(df)
        
        db_dataset = Dataset(
            id=dataset_id,
            user_id=current_user.id,
            filename=file.filename,
            storage_path=filepath,
            file_size=os.path.getsize(filepath),
            row_count=row_count,
            col_count=len(df.columns),
            schema=schema,
            quality_score=quality_score,
            status="ready"
        )
        
        db.add(db_dataset)
        await db.commit()
        await db.refresh(db_dataset)
        
        return ResponseModel(data=db_dataset)
        
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(500, detail=f"处理失败: {str(e)}")

def _normalize_dataset_schema(dataset):
    """
    规范化数据集的 schema，确保所有列名都是字符串
    用于处理旧数据或没有使用 read_csv_with_auto_header 读取的文件
    """
    if dataset and dataset.schema:
        for field in dataset.schema:
            if 'name' in field and not isinstance(field['name'], str):
                field['name'] = str(field['name'])
    return dataset


@router.get("", response_model=ResponseModel[PaginationModel[DatasetResponse]])
async def list_datasets(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    count_result = await db.execute(
        select(func.count(Dataset.id))
        .where(Dataset.is_deleted == False, Dataset.user_id == current_user.id)
    )
    total = count_result.scalar()
    
    result = await db.execute(
        select(Dataset)
        .where(Dataset.is_deleted == False, Dataset.user_id == current_user.id)
        .order_by(desc(Dataset.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    
    # 规范化 schema 中的列名
    datasets = result.scalars().all()
    for dataset in datasets:
        _normalize_dataset_schema(dataset)
    
    return ResponseModel(data={
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": datasets
    })

@router.get("/{dataset_id}", response_model=ResponseModel[DatasetResponse])
async def get_dataset(
    dataset_id: str, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, 
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    # 规范化 schema 中的列名
    _normalize_dataset_schema(dataset)
    
    return ResponseModel(data=dataset)

@router.get("/{dataset_id}/preview", response_model=ResponseModel[DatasetPreview])
async def preview_dataset(
    dataset_id: str, 
    rows: int = 20, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, 
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    try:
        ext = Path(dataset.storage_path).suffix.lower()
        if ext == ".csv":
            df = read_csv_with_auto_header(dataset.storage_path, nrows=rows)
        else:
            df = pd.read_excel(dataset.storage_path, nrows=rows)
        
        # 转换数据，确保所有键都是字符串
        raw_data = df.where(pd.notnull(df), None).to_dict(orient="records")
        # 将字典键转换为字符串
        data = [{str(k): v for k, v in row.items()} for row in raw_data]
        
        return ResponseModel(data={
            "columns": [str(col) for col in df.columns],
            "data": data,
            "total_rows": dataset.row_count
        })
    except Exception as e:
        raise HTTPException(500, detail=f"读取失败: {str(e)}")

@router.delete("/{dataset_id}")
async def delete_dataset(
    dataset_id: str, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, 
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    dataset.is_deleted = True
    dataset.updated_at = datetime.now()
    await db.commit()
    return ResponseModel(message="删除成功")


@router.put("/{dataset_id}", response_model=ResponseModel[DatasetResponse])
async def update_dataset(
    dataset_id: str, 
    update_data: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新数据集信息（如重命名）"""
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, 
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    # 更新文件名
    if update_data.filename:
        dataset.filename = update_data.filename
        dataset.updated_at = datetime.now()
    
    await db.commit()
    await db.refresh(dataset)
    return ResponseModel(message="更新成功", data=dataset)


@router.get("/{dataset_id}/statistics", response_model=ResponseModel[DatasetStatistics])
async def get_dataset_statistics(
    dataset_id: str, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取数据集详细统计信息"""
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, 
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    try:
        # 读取数据文件
        ext = Path(dataset.storage_path).suffix.lower()
        if ext == ".csv":
            df = read_csv_with_auto_header(dataset.storage_path)
        else:
            df = pd.read_excel(dataset.storage_path)
        
        # 计算内存使用
        memory_usage = f"{df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB"
        
        # 统计各列信息
        column_stats = []
        numeric_columns = []
        categorical_columns = []
        datetime_columns = []
        missing_values_total = 0
        
        for col in df.columns:
            col_data = df[col]
            null_count = int(col_data.isna().sum())
            missing_values_total += null_count
            
            col_stat = {
                "name": str(col),
                "dtype": str(col_data.dtype),
                "non_null_count": int(col_data.notna().sum()),
                "null_count": null_count,
                "null_percentage": round(null_count / len(df) * 100, 2)
            }
            
            # 判断列类型
            if pd.api.types.is_numeric_dtype(col_data):
                col_stat["type"] = "numeric"
                col_stat["mean"] = round(float(col_data.mean()), 4) if not col_data.empty else None
                col_stat["median"] = round(float(col_data.median()), 4) if not col_data.empty else None
                col_stat["std"] = round(float(col_data.std()), 4) if not col_data.empty else None
                col_stat["min"] = round(float(col_data.min()), 4) if not col_data.empty else None
                col_stat["max"] = round(float(col_data.max()), 4) if not col_data.empty else None
                numeric_columns.append(str(col))
                
            elif pd.api.types.is_datetime64_any_dtype(col_data):
                col_stat["type"] = "datetime"
                col_stat["unique_count"] = int(col_data.nunique())
                datetime_columns.append(str(col))
                
            else:
                col_stat["type"] = "categorical"
                col_stat["unique_count"] = int(col_data.nunique())
                col_stat["most_common"] = str(col_data.mode().iloc[0]) if not col_data.mode().empty else None
                categorical_columns.append(str(col))
            
            column_stats.append(col_stat)
        
        total_cells = len(df) * len(df.columns)
        missing_percentage = round(missing_values_total / total_cells * 100, 2) if total_cells > 0 else 0
        
        return ResponseModel(data={
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "memory_usage": memory_usage,
            "column_stats": column_stats,
            "numeric_columns": numeric_columns,
            "categorical_columns": categorical_columns,
            "datetime_columns": datetime_columns,
            "missing_values_total": missing_values_total,
            "missing_values_percentage": missing_percentage
        })
        
    except Exception as e:
        raise HTTPException(500, detail=f"统计计算失败: {str(e)}")


@router.get("/{dataset_id}/download")
async def download_dataset(
    dataset_id: str, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """下载数据集文件"""
    from fastapi.responses import FileResponse
    
    result = await db.execute(
        select(Dataset).where(
            Dataset.id == dataset_id, 
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    if not os.path.exists(dataset.storage_path):
        raise HTTPException(404, detail="文件不存在")
    
    # 处理中文文件名
    from urllib.parse import quote
    encoded_filename = quote(dataset.filename)
    
    return FileResponse(
        path=dataset.storage_path,
        filename=dataset.filename,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"
        }
    )


@router.get("/summary/dashboard", response_model=ResponseModel[DatasetSummary])
async def get_dataset_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取数据集汇总信息（用于仪表盘）"""
    # 总数统计
    total_result = await db.execute(
        select(func.count(Dataset.id)).where(
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    total_datasets = total_result.scalar()
    
    # 总行数
    rows_result = await db.execute(
        select(func.sum(Dataset.row_count)).where(
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    total_rows = rows_result.scalar() or 0
    
    # 总文件大小
    size_result = await db.execute(
        select(func.sum(Dataset.file_size)).where(
            Dataset.is_deleted == False,
            Dataset.user_id == current_user.id
        )
    )
    total_files_size = size_result.scalar() or 0
    
    # 最近上传的5个数据集
    recent_result = await db.execute(
        select(Dataset).where(Dataset.user_id == current_user.id)
        .where(Dataset.is_deleted == False)
        .order_by(desc(Dataset.created_at))
        .limit(5)
    )
    recent_uploads = recent_result.scalars().all()
    
    return ResponseModel(data={
        "total_datasets": total_datasets,
        "total_rows": total_rows,
        "total_files_size": total_files_size,
        "recent_uploads": recent_uploads
    })