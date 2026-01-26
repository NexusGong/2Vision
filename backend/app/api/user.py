"""
用户API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from app.database import get_db
from app.services.auth import get_current_user, get_optional_user
from app.models.user import User
from app.models.project import Project
from app.models.usage import UsageRecord
from app.services.usage_manager import get_remaining_tokens
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
    email: Optional[str] = None  # 可选，手机号注册用户可能没有真实邮箱
    phone: Optional[str] = None  # 手机号
    nickname: Optional[str] = None
    avatar: Optional[str] = None
    is_admin: bool = False
    is_vip: bool = False
    vip_expires_at: Optional[str] = None
    free_tokens: int = 1250000  # 统一免费token（默认1,250,000 tokens = 图像6次 + 视频3次）
    token_balance: int = 0  # 统一付费token余额
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
    """获取剩余统一token余额（支持登录和非登录用户）"""
    from app.services.usage_manager import (
        get_remaining_tokens, 
        ANONYMOUS_FREE_TOKENS
    )
    
    session_id = http_request.headers.get("X-Session-Id")
    
    if current_user:
        # 登录用户
        remaining = get_remaining_tokens(db, current_user, None)
        # 计算总使用次数（所有类型）
        total_used = db.query(UsageRecord).filter(
            UsageRecord.user_id == current_user.id
        ).count()
        
        return {
            "remaining_count": remaining,  # 剩余统一token总数
            "total_count": total_used,  # 总使用次数
            "is_anonymous": False
        }
    elif session_id:
        # 非登录用户
        remaining = get_remaining_tokens(db, None, session_id)
        return {
            "remaining_count": remaining,  # 剩余统一token
            "total_count": ANONYMOUS_FREE_TOKENS,  # 最大免费token额度
            "is_anonymous": True
        }
    else:
        # 既没有用户也没有session_id
        return {
            "remaining_count": 0,
            "total_count": ANONYMOUS_FREE_TOKENS,
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
        phone=current_user.phone,
        nickname=current_user.nickname,
        avatar=current_user.avatar,
        is_admin=current_user.is_admin or False,
        is_vip=current_user.is_vip or False,
        vip_expires_at=current_user.vip_expires_at.isoformat() if current_user.vip_expires_at else None,
        free_tokens=current_user.free_tokens or 1250000,
        token_balance=current_user.token_balance or 0,
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
        phone=current_user.phone,
        nickname=current_user.nickname,
        avatar=current_user.avatar,
        is_admin=current_user.is_admin or False,
        is_vip=current_user.is_vip or False,
        vip_expires_at=current_user.vip_expires_at.isoformat() if current_user.vip_expires_at else None,
        free_tokens=current_user.free_tokens or 1250000,
        token_balance=current_user.token_balance or 0,
        total_usage_count=current_user.total_usage_count or 0,
        total_token_used=current_user.total_token_used or 0,
        created_at=current_user.created_at.isoformat()
    )

@router.get("/balance")
async def get_user_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户使用统计（统一token系统，返回统一token余额和分别的生成次数）"""
    from app.services.usage_manager import get_remaining_tokens
    
    # 获取最近的使用记录（按模式分类）
    image_usage = db.query(UsageRecord).filter(
        UsageRecord.user_id == current_user.id,
        UsageRecord.usage_type == "image"
    ).order_by(UsageRecord.created_at.desc()).limit(10).all()
    
    video_usage = db.query(UsageRecord).filter(
        UsageRecord.user_id == current_user.id,
        UsageRecord.usage_type == "video"
    ).order_by(UsageRecord.created_at.desc()).limit(10).all()
    
    # 统计总使用次数（从使用记录统计）
    image_total_used = db.query(UsageRecord).filter(
        UsageRecord.user_id == current_user.id,
        UsageRecord.usage_type == "image"
    ).count()
    
    video_total_used = db.query(UsageRecord).filter(
        UsageRecord.user_id == current_user.id,
        UsageRecord.usage_type == "video"
    ).count()
    
    # 计算统一剩余token（包含免费token和付费token）
    total_remaining = get_remaining_tokens(db, current_user, None)
    
    # 计算已使用的统一token（从使用记录统计，所有类型，使用total_tokens）
    total_used_tokens = db.query(
        func.sum(UsageRecord.total_tokens).label('total')
    ).filter(
        UsageRecord.user_id == current_user.id
    ).scalar() or 0
    
    # 分别计算图像和视频的已使用token（用于统计，使用total_tokens）
    image_used_tokens = db.query(
        func.sum(UsageRecord.total_tokens).label('total')
    ).filter(
        UsageRecord.user_id == current_user.id,
        UsageRecord.usage_type == "image"
    ).scalar() or 0
    
    video_used_tokens = db.query(
        func.sum(UsageRecord.total_tokens).label('total')
    ).filter(
        UsageRecord.user_id == current_user.id,
        UsageRecord.usage_type == "video"
    ).scalar() or 0
    
    return {
        "status": "success",
        "data": {
            "total_remaining": total_remaining,  # 统一token剩余
            "used_tokens": int(total_used_tokens),  # 统一token已使用
            "image": {
                "total_used": image_total_used,  # 图像生成次数
                "used_tokens": int(image_used_tokens),  # 图像生成已使用的token
                "recent_usage": [
                    {
                        "id": record.id,
                        "usage_type": record.usage_type,
                        "total_tokens": record.total_tokens or 0,  # 优先使用total_tokens
                        "token_used": record.total_tokens or 0,  # 兼容字段，使用total_tokens的值
                        "created_at": record.created_at.isoformat()
                    }
                    for record in image_usage
                ]
            },
            "video": {
                "total_used": video_total_used,  # 视频生成次数
                "used_tokens": int(video_used_tokens),  # 视频生成已使用的token
                "recent_usage": [
                    {
                        "id": record.id,
                        "usage_type": record.usage_type,
                        "total_tokens": record.total_tokens or 0,  # 优先使用total_tokens
                        "token_used": record.total_tokens or 0,  # 兼容字段，使用total_tokens的值
                        "created_at": record.created_at.isoformat()
                    }
                    for record in video_usage
                ]
            }
        }
    }

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
