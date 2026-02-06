"""认证接口"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
import uuid

from app.core.database import get_db
from app.core.security import (
    verify_password, get_password_hash, create_access_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.models import User
from app.schemas.base import ResponseModel
from app.schemas.auth import (
    UserCreate, UserResponse, UserLogin, Token,
    UserUpdate, UserPasswordUpdate
)

router = APIRouter()

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """获取当前用户（依赖注入）"""
    from app.core.security import decode_access_token
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无效的认证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """获取当前活跃用户"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    return current_user


@router.post("/register", response_model=ResponseModel[UserResponse], status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    用户注册
    """
    # 检查用户名是否已存在
    result = await db.execute(
        select(User).where(User.username == user_data.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 检查邮箱是否已存在
    result = await db.execute(
        select(User).where(User.email == user_data.email)
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="邮箱已被注册")
    
    # 创建用户
    user = User(
        id=str(uuid.uuid4()),
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        nickname=user_data.nickname,
        is_active=True,
        is_superuser=False
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return ResponseModel(message="注册成功", data=user)


@router.post("/login", response_model=ResponseModel[Token])
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """
    用户登录（OAuth2格式）
    
    - username: 用户名或邮箱
    - password: 密码
    """
    # 查找用户（支持用户名或邮箱登录）
    result = await db.execute(
        select(User).where(
            (User.username == form_data.username) | (User.email == form_data.username)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    
    # 更新最后登录时间
    user.last_login = datetime.now()
    await db.commit()
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return ResponseModel(data={
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    })


@router.post("/login/json", response_model=ResponseModel[Token])
async def login_json(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    用户登录（JSON格式，用于前端直接调用）
    """
    # 查找用户
    result = await db.execute(
        select(User).where(
            (User.username == login_data.username) | (User.email == login_data.username)
        )
    )
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户已被禁用")
    
    # 更新最后登录时间
    user.last_login = datetime.now()
    await db.commit()
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )
    
    return ResponseModel(data={
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    })


@router.get("/me", response_model=ResponseModel[UserResponse])
async def get_me(current_user: User = Depends(get_current_active_user)):
    """
    获取当前登录用户信息
    """
    return ResponseModel(data=current_user)


@router.put("/me", response_model=ResponseModel[UserResponse])
async def update_me(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    更新当前用户信息
    """
    # 检查邮箱是否被其他用户使用
    if update_data.email and update_data.email != current_user.email:
        result = await db.execute(
            select(User).where(User.email == update_data.email, User.id != current_user.id)
        )
        if result.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="邮箱已被其他用户使用")
    
    # 更新字段
    if update_data.nickname is not None:
        current_user.nickname = update_data.nickname
    if update_data.email is not None:
        current_user.email = update_data.email
    if update_data.avatar is not None:
        current_user.avatar = update_data.avatar
    
    current_user.updated_at = datetime.now()
    await db.commit()
    await db.refresh(current_user)
    
    return ResponseModel(message="更新成功", data=current_user)


@router.post("/me/password")
async def change_password(
    password_data: UserPasswordUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    修改当前用户密码
    """
    # 验证旧密码
    if not verify_password(password_data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="旧密码错误")
    
    # 更新密码
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.updated_at = datetime.now()
    await db.commit()
    
    return ResponseModel(message="密码修改成功")


@router.get("/check-username")
async def check_username(username: str, db: AsyncSession = Depends(get_db)):
    """
    检查用户名是否可用
    """
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalar_one_or_none()
    return ResponseModel(data={
        "available": user is None,
        "username": username
    })


@router.get("/check-email")
async def check_email(email: str, db: AsyncSession = Depends(get_db)):
    """
    检查邮箱是否可用
    """
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    return ResponseModel(data={
        "available": user is None,
        "email": email
    })
