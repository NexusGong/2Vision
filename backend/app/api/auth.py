"""
认证API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.services.auth import (
    authenticate_user,
    create_user,
    create_access_token,
    get_current_user
)
from app.models.user import User
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

router = APIRouter(prefix="/api/auth", tags=["认证"])

class UserRegister(BaseModel):
    """用户注册模型"""
    username: str
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    """用户响应模型"""
    id: int
    username: str
    email: str
    nickname: str | None = None
    avatar: str | None = None
    is_active: bool
    is_admin: bool = False
    is_vip: bool = False
    free_usage_count: int = 20
    total_usage_count: int = 0
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    """令牌模型"""
    access_token: str
    token_type: str

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """用户注册"""
    # 检查用户名是否已存在
    from app.services.auth import get_user_by_username, get_user_by_email
    if get_user_by_username(db, user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    if get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邮箱已被注册"
        )
    
    # 创建用户
    user = create_user(db, user_data.username, user_data.email, user_data.password)
    return user

@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """用户登录"""
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    """获取当前用户信息"""
    return current_user

@router.post("/logout")
async def logout():
    """用户登出（前端删除token即可）"""
    return {"message": "登出成功"}

class OAuthLoginRequest(BaseModel):
    """第三方登录请求模型"""
    provider: str  # wechat/github/google
    code: str  # OAuth授权码
    state: str | None = None  # OAuth state参数

@router.post("/oauth/{provider}")
async def oauth_login(
    provider: str,
    request: OAuthLoginRequest,
    db: Session = Depends(get_db)
):
    """
    第三方登录（模拟实现）
    实际生产环境需要接入真实的OAuth服务
    """
    from app.services.auth import get_user_by_email, create_user
    
    # 模拟OAuth流程：根据provider和code获取用户信息
    # 这里只是示例，实际需要调用对应平台的API
    
    if provider not in ["wechat", "github", "google"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不支持的登录方式"
        )
    
    # 模拟获取用户信息（实际应该调用OAuth API）
    # 这里假设code就是用户的唯一标识
    oauth_id = request.code
    email = f"{oauth_id}@{provider}.com"  # 模拟邮箱
    username = f"{provider}_{oauth_id[:8]}"  # 模拟用户名
    
    # 查找或创建用户
    user = db.query(User).filter(
        User.oauth_provider == provider,
        User.oauth_id == oauth_id
    ).first()
    
    if not user:
        # 检查邮箱是否已被注册（非OAuth方式）
        existing_user = get_user_by_email(db, email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="该邮箱已被注册，请使用邮箱登录"
            )
        
        # 创建新用户
        user = User(
            username=username,
            email=email,
            hashed_password=None,  # OAuth用户没有密码
            oauth_provider=provider,
            oauth_id=oauth_id,
            free_usage_count=20  # 登录用户默认20次
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    # 生成token
    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user)
    }
