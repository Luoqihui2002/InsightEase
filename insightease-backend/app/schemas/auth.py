"""认证相关的Schemas"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    """用户基础信息"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    nickname: Optional[str] = None


class UserCreate(UserBase):
    """用户注册请求"""
    password: str = Field(..., min_length=6, max_length=50)


class UserUpdate(BaseModel):
    """用户更新请求"""
    nickname: Optional[str] = None
    email: Optional[EmailStr] = None
    avatar: Optional[str] = None


class UserPasswordUpdate(BaseModel):
    """修改密码请求"""
    old_password: str
    new_password: str = Field(..., min_length=6, max_length=50)


class UserInDB(UserBase):
    """数据库中的用户（包含敏感信息）"""
    id: str
    hashed_password: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserResponse(UserBase):
    """用户响应（不包含敏感信息）"""
    id: str
    avatar: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    """用户登录请求"""
    username: str
    password: str


class Token(BaseModel):
    """令牌响应"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # 过期时间（秒）


class TokenPayload(BaseModel):
    """令牌载荷"""
    sub: Optional[str] = None  # 用户ID
    exp: Optional[datetime] = None


class PasswordResetRequest(BaseModel):
    """密码重置请求"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """密码重置确认"""
    token: str
    new_password: str = Field(..., min_length=6, max_length=50)
