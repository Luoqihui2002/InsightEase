"""报告导出接口"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Response
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import uuid
import os
from datetime import datetime
from pathlib import Path

from app.core.database import get_db
from app.core.config import settings
from app.models import Dataset, Analysis
from app.schemas.base import ResponseModel
from app.schemas.report import ReportCreateRequest, ReportFormat
from app.services.report_service import report_service
import pandas as pd

router = APIRouter()

# 报告存储目录
REPORTS_DIR = Path("./data/reports")
REPORTS_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/generate")
async def generate_report(
    request: ReportCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """
    生成分析报告
    
    支持格式：pdf, word, html
    """
    # 获取数据集
    result = await db.execute(
        select(Dataset).where(Dataset.id == request.dataset_id, Dataset.is_deleted == False)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    # 生成报告ID
    report_id = str(uuid.uuid4())
    
    # 设置默认标题
    title = request.title or f"{dataset.filename} 数据分析报告"
    
    # 获取分析结果
    analysis_results = []
    if request.include_analysis:
        # 获取指定的分析结果
        for analysis_id in request.include_analysis:
            analysis_result = await db.execute(
                select(Analysis).where(Analysis.id == analysis_id)
            )
            analysis = analysis_result.scalar_one_or_none()
            if analysis and analysis.status == "completed" and analysis.result_data:
                analysis_results.append({
                    "type": analysis.type,
                    "data": analysis.result_data
                })
    else:
        # 获取该数据集的所有已完成分析
        analyses_result = await db.execute(
            select(Analysis)
            .where(Analysis.dataset_id == request.dataset_id, Analysis.status == "completed")
            .order_by(desc(Analysis.created_at))
            .limit(10)
        )
        analyses = analyses_result.scalars().all()
        for analysis in analyses:
            if analysis.result_data:
                analysis_results.append({
                    "type": analysis.type,
                    "data": analysis.result_data
                })
    
    # 准备数据集信息
    dataset_info = {
        "filename": dataset.filename,
        "row_count": dataset.row_count,
        "col_count": dataset.col_count,
        "file_size": dataset.file_size,
        "schema": dataset.schema or []
    }
    
    ai_summary = dataset.ai_summary
    
    # 生成报告文件
    file_ext = request.format.value
    filename = f"report_{report_id}.{file_ext}"
    filepath = REPORTS_DIR / filename
    
    try:
        if request.format == ReportFormat.PDF:
            content = report_service.generate_pdf_report(
                title, dataset_info, analysis_results, ai_summary
            )
            with open(filepath, "wb") as f:
                f.write(content)
                
        elif request.format == ReportFormat.WORD:
            content = report_service.generate_word_report(
                title, dataset_info, analysis_results, ai_summary
            )
            with open(filepath, "wb") as f:
                f.write(content)
                
        elif request.format == ReportFormat.HTML:
            content = report_service.generate_html_file(
                title, dataset_info, analysis_results, ai_summary
            )
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
        
        return ResponseModel(data={
            "report_id": report_id,
            "title": title,
            "format": request.format.value,
            "filename": filename,
            "download_url": f"/api/v1/reports/download/{report_id}?format={file_ext}",
            "status": "completed",
            "message": "报告生成成功",
            "created_at": datetime.now(),
            "analysis_count": len(analysis_results)
        })
        
    except Exception as e:
        return ResponseModel(code=500, message=f"报告生成失败: {str(e)}")


@router.get("/download/{report_id}")
async def download_report(
    report_id: str,
    format: str = "pdf",
    db: AsyncSession = Depends(get_db)
):
    """
    下载报告文件
    """
    filename = f"report_{report_id}.{format}"
    filepath = REPORTS_DIR / filename
    
    if not filepath.exists():
        raise HTTPException(404, detail="报告文件不存在或已过期")
    
    # 根据格式设置content_type
    content_types = {
        "pdf": "application/pdf",
        "word": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "html": "text/html"
    }
    
    # 设置下载文件名
    download_names = {
        "pdf": f"数据分析报告_{report_id}.pdf",
        "word": f"数据分析报告_{report_id}.docx",
        "html": f"数据分析报告_{report_id}.html"
    }
    
    return FileResponse(
        path=filepath,
        filename=download_names.get(format, filename),
        media_type=content_types.get(format, "application/octet-stream")
    )


@router.get("/preview/{report_id}")
async def preview_report(report_id: str, format: str = "html"):
    """
    预览报告（仅支持HTML格式）
    """
    if format != "html":
        raise HTTPException(400, detail="仅支持HTML格式预览")
    
    filename = f"report_{report_id}.html"
    filepath = REPORTS_DIR / filename
    
    if not filepath.exists():
        raise HTTPException(404, detail="报告文件不存在")
    
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    return Response(content=content, media_type="text/html")


@router.get("/formats")
async def get_supported_formats():
    """
    获取支持的报告格式
    """
    formats = [
        {
            "value": "pdf",
            "label": "PDF文档",
            "description": "适合打印和分享",
            "icon": "📄"
        },
        {
            "value": "word",
            "label": "Word文档",
            "description": "可编辑的文档格式",
            "icon": "📝"
        },
        {
            "value": "html",
            "label": "HTML网页",
            "description": "可在浏览器中查看",
            "icon": "🌐"
        }
    ]
    
    return ResponseModel(data=formats)


@router.post("/quick/{dataset_id}")
async def quick_generate_report(
    dataset_id: str,
    format: ReportFormat = ReportFormat.PDF,
    db: AsyncSession = Depends(get_db)
):
    """
    快速生成报告（使用默认设置）
    """
    request = ReportCreateRequest(
        dataset_id=dataset_id,
        format=format,
        include_analysis=[]
    )
    
    # 复用generate_report逻辑
    from fastapi import BackgroundTasks
    background_tasks = BackgroundTasks()
    
    return await generate_report(request, background_tasks, db)
