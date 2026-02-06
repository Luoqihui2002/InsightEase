from pydantic_settings import BaseSettings
from functools import lru_cache
from urllib.parse import quote_plus

class Settings(BaseSettings):
    PROJECT_NAME: str = "InsightEase API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # 环境配置
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # MySQL配置
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "password"
    DB_NAME: str = "insightease"
    
    @property
    def DATABASE_URL(self) -> str:
        # 对密码进行URL编码，处理特殊字符如 @
        encoded_password = quote_plus(self.DB_PASSWORD)
        return f"mysql+aiomysql://{self.DB_USER}:{encoded_password}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
    
    UPLOAD_DIR: str = "./data/uploads"
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024
    
    # AI配置
    KIMI_API_KEY: str = ""
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_MODEL: str = "moonshot-v1-8k"
    
    SECRET_KEY: str = "your-secret-key"
    
    # CORS配置
    ALLOWED_ORIGINS: str = "*"
    
    # 日志配置
    LOG_LEVEL: str = "DEBUG"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()
