# setup_backend.py
# 修复版 - Windows直接双击运行
import os
import shutil

def create_file(filepath, content):
    """安全创建文件"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True) if os.path.dirname(filepath) else None
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ {filepath}")

def main():
    # 创建目录结构
    dirs = [
        "insightease-backend/app/core",
        "insightease-backend/app/models", 
        "insightease-backend/app/schemas",
        "insightease-backend/app/api/v1/endpoints",
        "insightease-backend/app/services",
        "insightease-backend/data/uploads"
    ]
    
    for d in dirs:
        os.makedirs(d, exist_ok=True)
    
    # 创建 __init__.py 文件
    for root, dirs, files in os.walk("insightease-backend/app"):
        if "__pycache__" not in root:
            init_file = os.path.join(root, "__init__.py")
            if not os.path.exists(init_file):
                open(init_file, 'w').close()

    # 1. requirements.txt
    create_file("insightease-backend/requirements.txt", '''fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
pydantic==2.5.3
pydantic-settings==2.1.0
python-multipart==0.0.6
pandas==2.1.4
numpy==1.26.3
scikit-learn==1.4.0
openpyxl==3.1.2
pymysql==1.1.0
cryptography==41.0.8
aiomysql==0.2.0
greenlet==3.0.3
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
aiofiles==23.2.1
openai==1.10.0
prophet==1.1.5
matplotlib==3.8.2
seaborn==0.13.1
reportlab==4.0.9
alembic==1.13.1''')

    # 2. config.py
    create_file("insightease-backend/app/core/config.py", '''from pydantic_settings import BaseSettings
from functools import lru_cache
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "InsightEase API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # MySQL配置 (阿里云ECS用)
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", "3306"))
    DB_USER: str = os.getenv("DB_USER", "root")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "password")
    DB_NAME: str = os.getenv("DB_NAME", "insightease")
    
    @property
    def DATABASE_URL(self) -> str:
        return f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
    
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024
    
    # AI配置
    KIMI_API_KEY: str = os.getenv("KIMI_API_KEY", "")
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_MODEL: str = "moonshot-v1-8k"
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key")

    class Config:
        env_file = ".env"

settings = Settings()''')

    # 3. database.py
    create_file("insightease-backend/app/core/database.py", '''from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=3600
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def close_db():
    await engine.dispose()''')

    # 4. models.py
    create_file("insightease-backend/app/models.py", '''from sqlalchemy import Column, String, Integer, DateTime, Text, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Dataset(Base):
    __tablename__ = "datasets"
    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}
    
    id = Column(String(36), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    storage_path = Column(String(500), nullable=False)
    file_size = Column(Integer, default=0)
    row_count = Column(Integer, default=0)
    col_count = Column(Integer, default=0)
    schema = Column(JSON, default=list)
    quality_score = Column(Integer, nullable=True)
    ai_summary = Column(Text, nullable=True)
    status = Column(String(20), default="uploaded")
    is_deleted = Column(Boolean, default=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    analyses = relationship("Analysis", back_populates="dataset", cascade="all, delete-orphan")

class Analysis(Base):
    __tablename__ = "analyses"
    __table_args__ = {"mysql_engine": "InnoDB", "mysql_charset": "utf8mb4"}
    
    id = Column(String(36), primary_key=True, index=True)
    dataset_id = Column(String(36), ForeignKey("datasets.id", ondelete="CASCADE"), index=True)
    type = Column(String(50), nullable=False)
    status = Column(String(20), default="pending")
    params = Column(JSON, default=dict)
    result_data = Column(JSON, nullable=True)
    ai_interpretation = Column(Text, nullable=True)
    ai_recommendations = Column(JSON, default=list)
    export_files = Column(JSON, nullable=True)
    error_msg = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    dataset = relationship("Dataset", back_populates="analyses")''')

    # 5. Schemas
    create_file("insightease-backend/app/schemas/base.py", '''from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel

T = TypeVar("T")

class ResponseModel(BaseModel, Generic[T]):
    code: int = 200
    message: str = "success"
    data: Optional[T] = None

class PaginationModel(BaseModel, Generic[T]):
    total: int
    page: int
    page_size: int
    items: List[T]''')

    create_file("insightease-backend/app/schemas/dataset.py", '''from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Dict, Any

class FieldSchema(BaseModel):
    name: str
    dtype: str = "object"
    semantic_type: Optional[str] = None
    sample_values: List[Any] = []

class DatasetResponse(BaseModel):
    id: str
    filename: str
    row_count: int
    col_count: int
    file_size: int
    schema: List[FieldSchema]
    quality_score: Optional[int] = None
    ai_summary: Optional[str] = None
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class DatasetPreview(BaseModel):
    columns: List[str]
    data: List[Dict[str, Any]]
    total_rows: int''')

    create_file("insightease-backend/app/schemas/analysis.py", '''from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, List

class AnalysisCreate(BaseModel):
    dataset_id: str
    analysis_type: str
    params: Dict[str, Any] = {}

class AnalysisResponse(BaseModel):
    id: str
    dataset_id: str
    type: str
    status: str
    params: Dict[str, Any]
    result_data: Optional[Dict[str, Any]] = None
    ai_interpretation: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True''')

    # 6. API Endpoints
    create_file("insightease-backend/app/api/v1/endpoints/datasets.py", '''from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
import pandas as pd
import uuid
import shutil
import os
from pathlib import Path

from app.core.database import get_db
from app.core.config import settings
from app.models import Dataset
from app.schemas.base import ResponseModel, PaginationModel
from app.schemas.dataset import DatasetResponse, DatasetPreview

router = APIRouter()

@router.post("/upload", response_model=ResponseModel[DatasetResponse])
async def upload_dataset(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
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
            df = pd.read_csv(filepath, nrows=1000)
            row_count = len(df)
        else:
            df = pd.read_excel(filepath, nrows=1000)
            row_count = len(df)
        
        schema = []
        for col in df.columns:
            schema.append({
                "name": col,
                "dtype": str(df[col].dtype),
                "sample_values": df[col].dropna().head(3).tolist()
            })
        
        db_dataset = Dataset(
            id=dataset_id,
            filename=file.filename,
            storage_path=filepath,
            file_size=os.path.getsize(filepath),
            row_count=row_count,
            col_count=len(df.columns),
            schema=schema,
            quality_score=85,
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

@router.get("/", response_model=ResponseModel[PaginationModel[DatasetResponse]])
async def list_datasets(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    count_result = await db.execute(select(func.count(Dataset.id)).where(Dataset.is_deleted == False))
    total = count_result.scalar()
    
    result = await db.execute(
        select(Dataset)
        .where(Dataset.is_deleted == False)
        .order_by(desc(Dataset.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    
    return ResponseModel(data={
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": result.scalars().all()
    })

@router.get("/{dataset_id}", response_model=ResponseModel[DatasetResponse])
async def get_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.is_deleted == False)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    return ResponseModel(data=dataset)

@router.get("/{dataset_id}/preview", response_model=ResponseModel[DatasetPreview])
async def preview_dataset(dataset_id: str, rows: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.is_deleted == False)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    try:
        ext = Path(dataset.storage_path).suffix.lower()
        if ext == ".csv":
            df = pd.read_csv(dataset.storage_path, nrows=rows)
        else:
            df = pd.read_excel(dataset.storage_path, nrows=rows)
        
        data = df.where(pd.notnull(df), None).to_dict(orient="records")
        return ResponseModel(data={
            "columns": df.columns.tolist(),
            "data": data,
            "total_rows": dataset.row_count
        })
    except Exception as e:
        raise HTTPException(500, detail=f"读取失败: {str(e)}")

@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Dataset).where(Dataset.id == dataset_id, Dataset.is_deleted == False)
    )
    dataset = result.scalar_one_or_none()
    if not dataset:
        raise HTTPException(404, detail="数据集不存在")
    
    dataset.is_deleted = True
    await db.commit()
    return ResponseModel(message="删除成功")''')

    create_file("insightease-backend/app/api/v1/endpoints/analysis.py", '''from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
import uuid
from datetime import datetime

from app.core.database import get_db
from app.models import Analysis, Dataset
from app.schemas.base import ResponseModel
from app.schemas.analysis import AnalysisCreate, AnalysisResponse

router = APIRouter()

@router.post("/", response_model=ResponseModel[AnalysisResponse], status_code=202)
async def create_analysis(
    payload: AnalysisCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Dataset).where(Dataset.id == payload.dataset_id, Dataset.is_deleted == False)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(404, detail="数据集不存在")
    
    analysis = Analysis(
        id=str(uuid.uuid4()),
        dataset_id=payload.dataset_id,
        type=payload.analysis_type,
        status="pending",
        params=payload.params
    )
    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)
    
    return ResponseModel(message="分析任务已创建", data=analysis)

@router.get("/{analysis_id}", response_model=ResponseModel[AnalysisResponse])
async def get_analysis(analysis_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Analysis).where(Analysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(404, detail="分析任务不存在")
    return ResponseModel(data=analysis)''')

    create_file("insightease-backend/app/api/v1/endpoints/ai.py", '''from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import json
import openai
from app.core.config import settings

router = APIRouter()

@router.post("/chat")
async def chat_stream():
    async def generate():
        yield "data: " + json.dumps({"chunk": "你好", "finished": False}) + "\\n\\n"
        yield "data: " + json.dumps({"chunk": "，我是AI助手", "finished": True, "full_text": "你好，我是AI助手"}) + "\\n\\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )''')

    # 7. API路由汇总
    create_file("insightease-backend/app/api/v1/api.py", '''from fastapi import APIRouter
from app.api.v1.endpoints import datasets, analysis, ai

api_router = APIRouter()
api_router.include_router(datasets.router, prefix="/datasets", tags=["数据集"])
api_router.include_router(analysis.router, prefix="/analyses", tags=["分析"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI助手"])''')

    # 8. 主程序
    create_file("insightease-backend/app/main.py", '''from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.core.database import init_db, close_db
from app.api.v1.api import api_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await close_db()

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
async def root():
    return {"name": settings.PROJECT_NAME, "docs": "/docs"}''')

    # 9. 启动文件
    create_file("insightease-backend/main.py", '''import uvicorn
import os
from app.core.config import settings

if __name__ == "__main__":
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    print(f"启动 {settings.PROJECT_NAME} v{settings.VERSION}")
    print(f"API文档: http://localhost:8000/docs")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)''')

    # 10. Docker配置
    create_file("insightease-backend/docker-compose.yml", '''version: "3.8"

services:
  mysql:
    image: mysql:8.0
    container_name: ie-mysql
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: InsightEase2024!
      MYSQL_DATABASE: insightease
      MYSQL_USER: ieuser
      MYSQL_PASSWORD: ie123456
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - ie-net

  backend:
    build: .
    container_name: ie-api
    ports:
      - "8000:8000"
    volumes:
      - ./data/uploads:/app/data/uploads
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=ieuser
      - DB_PASSWORD=ie123456
      - DB_NAME=insightease
      - KIMI_API_KEY=${KIMI_API_KEY}
    depends_on:
      - mysql
    networks:
      - ie-net

volumes:
  mysql_data:

networks:
  ie-net:
    driver: bridge''')

    create_file("insightease-backend/Dockerfile", '''FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc default-libmysqlclient-dev pkg-config && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data/uploads

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]''')

    # 11. 环境变量和gitignore
    create_file("insightease-backend/.env.example", '''DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=password
DB_NAME=insightease
KIMI_API_KEY=sk-your-key-here
SECRET_KEY=your-secret-key''')

    create_file("insightease-backend/.gitignore", '''__pycache__/
*.py[cod]
.env
venv/
data/uploads/*
!data/uploads/.gitkeep
*.db''')

    # 占位文件
    open("insightease-backend/data/uploads/.gitkeep", 'w').close()

    print("\\n" + "="*50)
    print("✅ InsightEase 后端项目创建完成！")
    print("="*50)
    print("📁 位置: insightease-backend/")
    print("🔧 配置: 1. 编辑 .env 文件填入MySQL密码和KIMI_API_KEY")
    print("🚀 启动: 2. python main.py")
    print("📖 文档: http://localhost:8000/docs")
    print("="*50)

if __name__ == "__main__":
    main()