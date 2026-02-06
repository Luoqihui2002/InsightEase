from fastapi import APIRouter
from app.api.v1.endpoints import auth, datasets, analysis, ai, reports

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["数据集"])
api_router.include_router(analysis.router, prefix="/analyses", tags=["分析"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI助手"])
api_router.include_router(reports.router, prefix="/reports", tags=["报告导出"])