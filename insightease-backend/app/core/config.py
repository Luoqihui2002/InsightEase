from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
from urllib.parse import quote_plus

class Settings(BaseSettings):
    PROJECT_NAME: str = "InsightEase API"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    
    # 环境配置
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        """Accept common environment labels without crashing settings load."""
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "prod", "production"}:
                return False
            if normalized in {"debug", "dev", "development"}:
                return True
        return value
    
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
    
    # 阿里云 OSS 配置（云端存储）
    OSS_ACCESS_KEY_ID: str = ""
    OSS_ACCESS_KEY_SECRET: str = ""
    OSS_BUCKET_NAME: str = ""
    OSS_ENDPOINT: str = ""  # 如: oss-cn-hangzhou.aliyuncs.com
    OSS_REGION: str = ""    # 如: cn-hangzhou
    
    @property
    def OSS_ENABLED(self) -> bool:
        """是否启用 OSS 云端存储"""
        return all([
            self.OSS_ACCESS_KEY_ID,
            self.OSS_ACCESS_KEY_SECRET,
            self.OSS_BUCKET_NAME,
            self.OSS_ENDPOINT
        ])
    
    # AI配置
    KIMI_API_KEY: str = ""
    KIMI_BASE_URL: str = "https://api.moonshot.cn/v1"
    KIMI_MODEL: str = "moonshot-v1-8k"

    # Hermes assistant configuration.
    # Live provider credentials must come from environment/secrets only.
    HERMES_ASSISTANT_ENABLED: bool = False
    HERMES_ASSISTANT_MODE: str = "disabled"  # disabled | dry_run | live
    HERMES_ASSISTANT_TIMEOUT_MS: int = 10000
    HERMES_BASE_URL: str | None = None
    HERMES_AUTH_TOKEN: str | None = None
    HERMES_MODEL: str = "hermes-agent"

    @property
    def HERMES_ASSISTANT_MODE_SAFE(self) -> str:
        """Return a supported Hermes mode, falling back safely to disabled."""
        mode = (self.HERMES_ASSISTANT_MODE or "disabled").strip().lower()
        if mode not in {"disabled", "dry_run", "live"}:
            return "disabled"
        return mode

    @property
    def HERMES_LIVE_CONFIGURED(self) -> bool:
        """Return whether required live Hermes connection fields are present."""
        return bool(
            self.HERMES_BASE_URL
            and self.HERMES_BASE_URL.strip()
            and self.HERMES_AUTH_TOKEN
            and self.HERMES_AUTH_TOKEN.strip()
        )
    
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
