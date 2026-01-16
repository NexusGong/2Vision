"""
用户API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.services.auth import get_current_user, get_optional_user
from app.models.user import User
from app.models.project import Project
from app.models.usage import UsageRecord
from app.services.usage_manager import get_remaining_count, ANONYMOUS_FREE_COUNT
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/user", tags=["用户"])

class ProfileUpdate(BaseModel):
    """用户资料更新模型"""
    nickname: Optional[str] = None
    avatar: Optional[str] = None  # Base64编码的头像

class UserProfileResponse(BaseModel):
    """用户资料响应模型"""
    id: int
    username: str
    email: str
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    is_admin: bool = False
    is_vip: bool = False
    vip_expires_at: Optional[str] = None
    free_usage_count: int = 20
    total_usage_count: int = 0
    total_token_used: int = 0
    created_at: str
    
    class Config:
        from_attributes = True

class UsageStatsResponse(BaseModel):
    """使用统计响应模型"""
    remaining_count: int
    total_usage_count: int
    total_token_used: int
    recent_usage: list[dict]

@router.get("/usage/remaining")
async def get_remaining_usage(
    http_request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """获取剩余使用次数（支持登录和非登录用户）"""
    session_id = http_request.headers.get("X-Session-Id")
    
    if current_user:
        # 登录用户
        remaining = get_remaining_count(db, current_user, None)
        total = current_user.total_usage_count + remaining
        return {
            "remaining_count": remaining,
            "total_count": total,
            "is_anonymous": False
        }
    elif session_id:
        # 非登录用户
        remaining = get_remaining_count(db, None, session_id)
        return {
            "remaining_count": remaining,
            "total_count": ANONYMOUS_FREE_COUNT,
            "is_anonymous": True
        }
    else:
        # 既没有用户也没有session_id
        return {
            "remaining_count": 0,
            "total_count": ANONYMOUS_FREE_COUNT,
            "is_anonymous": True
        }

@router.get("/profile", response_model=UserProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户资料"""
    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        nickname=current_user.nickname,
        avatar=current_user.avatar,
        is_admin=current_user.is_admin or False,
        is_vip=current_user.is_vip or False,
        vip_expires_at=current_user.vip_expires_at.isoformat() if current_user.vip_expires_at else None,
        free_usage_count=current_user.free_usage_count or 0,
        total_usage_count=current_user.total_usage_count or 0,
        total_token_used=current_user.total_token_used or 0,
        created_at=current_user.created_at.isoformat()
    )

@router.put("/profile", response_model=UserProfileResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新用户资料"""
    if profile_data.nickname is not None:
        # 验证昵称长度
        if len(profile_data.nickname) > 50:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="昵称长度不能超过50个字符"
            )
        current_user.nickname = profile_data.nickname
    
    if profile_data.avatar is not None:
        # 验证Base64头像大小（限制为2MB）
        import base64
        try:
            # 移除data:image前缀
            if profile_data.avatar.startswith("data:image"):
                avatar_data = profile_data.avatar.split(",")[1]
            else:
                avatar_data = profile_data.avatar
            
            avatar_bytes = base64.b64decode(avatar_data)
            if len(avatar_bytes) > 2 * 1024 * 1024:  # 2MB
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="头像大小不能超过2MB"
                )
            current_user.avatar = profile_data.avatar
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="头像格式无效"
            )
    
    db.commit()
    db.refresh(current_user)
    
    return UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        nickname=current_user.nickname,
        avatar=current_user.avatar,
        is_admin=current_user.is_admin or False,
        is_vip=current_user.is_vip or False,
        vip_expires_at=current_user.vip_expires_at.isoformat() if current_user.vip_expires_at else None,
        free_usage_count=current_user.free_usage_count or 0,
        total_usage_count=current_user.total_usage_count or 0,
        total_token_used=current_user.total_token_used or 0,
        created_at=current_user.created_at.isoformat()
    )

@router.get("/usage", response_model=UsageStatsResponse)
async def get_usage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取使用统计"""
    remaining = get_remaining_count(db, current_user)
    
    # 获取最近的使用记录
    recent_usage = db.query(UsageRecord).filter(
        UsageRecord.user_id == current_user.id
    ).order_by(UsageRecord.created_at.desc()).limit(10).all()
    
    return UsageStatsResponse(
        remaining_count=remaining,
        total_usage_count=current_user.total_usage_count or 0,
        total_token_used=current_user.total_token_used or 0,
        recent_usage=[
            {
                "id": record.id,
                "usage_type": record.usage_type,
                "token_used": record.token_used,
                "created_at": record.created_at.isoformat()
            }
            for record in recent_usage
        ]
    )

@router.get("/history")
async def get_user_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 20
):
    """获取用户历史记录（仅登录用户）"""
    offset = (page - 1) * page_size
    
    projects = db.query(Project).filter(
        Project.user_id == current_user.id
    ).order_by(Project.created_at.desc()).offset(offset).limit(page_size).all()
    
    total = db.query(Project).filter(
        Project.user_id == current_user.id
    ).count()
    
    return {
        "status": "success",
        "data": [
            {
                "id": p.id,
                "title": p.title,
                "original_text": p.original_text[:100] + "..." if len(p.original_text) > 100 else p.original_text,
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat()
            }
            for p in projects
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }
