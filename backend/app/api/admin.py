"""
后台管理API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import Optional, List
from datetime import datetime, timedelta
from app.database import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.models.usage import UsageRecord
from app.models.payment import Payment
from app.models.project import Project
from app.models.activity import UserActivityLog
import logging
import json
import csv
import io

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["后台管理"])

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """要求管理员权限"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user

class UserListItem(BaseModel):
    """用户列表项"""
    id: int
    username: str
    email: str
    nickname: Optional[str] = None
    is_active: bool
    is_admin: bool
    is_vip: bool
    free_usage_count: int
    total_usage_count: int
    total_token_used: int
    created_at: str
    
    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    """用户更新请求"""
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None  # 新密码（如果提供则更新）
    nickname: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_vip: Optional[bool] = None
    free_usage_count: Optional[int] = None
    total_usage_count: Optional[int] = None
    total_token_used: Optional[int] = None

class UsageStatsResponse(BaseModel):
    """使用统计响应"""
    total_users: int
    active_users_today: int
    active_users_week: int
    total_usage_count: int
    total_token_used: int
    anonymous_usage_count: int
    registered_usage_count: int
    usage_by_type: dict
    usage_trend: List[dict]

@router.get("/users")
async def get_all_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None
):
    """获取所有用户列表"""
    offset = (page - 1) * page_size
    query = db.query(User)
    
    if search:
        query = query.filter(
            (User.username.contains(search)) |
            (User.email.contains(search)) |
            (User.nickname.contains(search))
        )
    
    total = query.count()
    users = query.order_by(desc(User.created_at)).offset(offset).limit(page_size).all()
    
    return {
        "status": "success",
        "data": [
            UserListItem(
                id=u.id,
                username=u.username,
                email=u.email,
                nickname=u.nickname,
                is_active=u.is_active,
                is_admin=u.is_admin or False,
                is_vip=u.is_vip or False,
                free_usage_count=u.free_usage_count or 0,
                total_usage_count=u.total_usage_count or 0,
                total_token_used=u.total_token_used or 0,
                created_at=u.created_at.isoformat() if u.created_at else ""
            )
            for u in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """获取用户详情"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 获取用户的使用记录
    usage_records = db.query(UsageRecord).filter(
        UsageRecord.user_id == user_id
    ).order_by(desc(UsageRecord.created_at)).limit(50).all()
    
    # 获取用户的支付记录
    payments = db.query(Payment).filter(
        Payment.user_id == user_id
    ).order_by(desc(Payment.created_at)).limit(20).all()
    
    return {
        "status": "success",
        "data": {
            "user": UserListItem(
                id=user.id,
                username=user.username,
                email=user.email,
                nickname=user.nickname,
                is_active=user.is_active,
                is_admin=user.is_admin or False,
                is_vip=user.is_vip or False,
                free_usage_count=user.free_usage_count or 0,
                total_usage_count=user.total_usage_count or 0,
                total_token_used=user.total_token_used or 0,
                created_at=user.created_at.isoformat() if user.created_at else ""
            ),
            "usage_records": [
                {
                    "id": r.id,
                    "usage_type": r.usage_type,
                    "token_used": r.token_used,
                    "created_at": r.created_at.isoformat()
                }
                for r in usage_records
            ],
            "payments": [
                {
                    "id": p.id,
                    "payment_type": p.payment_type,
                    "amount": p.amount,
                    "quantity": p.quantity,
                    "status": p.status,
                    "created_at": p.created_at.isoformat()
                }
                for p in payments
            ]
        }
    }

@router.put("/users/{user_id}")
async def update_user(
    user_id: int,
    user_data: UserUpdateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """更新用户信息（管理员）"""
    from app.services.auth import get_password_hash, get_user_by_username, get_user_by_email
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 更新用户名（需要检查唯一性）
    if user_data.username is not None:
        if user_data.username != user.username:
            existing_user = get_user_by_username(db, user_data.username)
            if existing_user and existing_user.id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="用户名已存在"
                )
            user.username = user_data.username
    
    # 更新邮箱（需要检查唯一性）
    if user_data.email is not None:
        if user_data.email != user.email:
            existing_user = get_user_by_email(db, user_data.email)
            if existing_user and existing_user.id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="邮箱已存在"
                )
            user.email = user_data.email
    
    # 更新密码
    if user_data.password is not None and user_data.password.strip():
        user.hashed_password = get_password_hash(user_data.password)
    
    # 更新其他字段
    if user_data.nickname is not None:
        user.nickname = user_data.nickname
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.is_admin is not None:
        user.is_admin = user_data.is_admin
    if user_data.is_vip is not None:
        user.is_vip = user_data.is_vip
    if user_data.free_usage_count is not None:
        user.free_usage_count = user_data.free_usage_count
    if user_data.total_usage_count is not None:
        user.total_usage_count = user_data.total_usage_count
    if user_data.total_token_used is not None:
        user.total_token_used = user_data.total_token_used
    
    db.commit()
    db.refresh(user)
    
    return {
        "status": "success",
        "message": "用户信息更新成功",
        "data": UserListItem(
            id=user.id,
            username=user.username,
            email=user.email,
            nickname=user.nickname,
            is_active=user.is_active,
            is_admin=user.is_admin or False,
            is_vip=user.is_vip or False,
            free_usage_count=user.free_usage_count or 0,
            total_usage_count=user.total_usage_count or 0,
            total_token_used=user.total_token_used or 0,
            created_at=user.created_at.isoformat() if user.created_at else ""
        )
    }

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """删除用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 不能删除自己
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己"
        )
    
    db.delete(user)
    db.commit()
    
    return {"status": "success", "message": "用户删除成功"}

@router.get("/usage_stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """获取使用统计"""
    # 总用户数
    total_users = db.query(User).count()
    
    # 今日活跃用户
    today = datetime.utcnow().date()
    active_users_today = db.query(UsageRecord.user_id).filter(
        func.date(UsageRecord.created_at) == today,
        UsageRecord.user_id.isnot(None)
    ).distinct().count()
    
    # 本周活跃用户
    week_ago = datetime.utcnow() - timedelta(days=7)
    active_users_week = db.query(UsageRecord.user_id).filter(
        UsageRecord.created_at >= week_ago,
        UsageRecord.user_id.isnot(None)
    ).distinct().count()
    
    # 总使用次数
    total_usage_count = db.query(func.sum(User.total_usage_count)).scalar() or 0
    
    # 总token消耗
    total_token_used = db.query(func.sum(User.total_token_used)).scalar() or 0
    
    # 匿名用户使用次数
    anonymous_usage_count = db.query(UsageRecord).filter(
        UsageRecord.user_id.is_(None)
    ).count()
    
    # 注册用户使用次数
    registered_usage_count = db.query(UsageRecord).filter(
        UsageRecord.user_id.isnot(None)
    ).count()
    
    # 按类型统计
    usage_by_type = {}
    for usage_type in ["image", "video"]:
        count = db.query(UsageRecord).filter(
            UsageRecord.usage_type == usage_type
        ).count()
        usage_by_type[usage_type] = count
    
    # 使用趋势（最近7天）
    usage_trend = []
    for i in range(7):
        date = today - timedelta(days=i)
        count = db.query(UsageRecord).filter(
            func.date(UsageRecord.created_at) == date
        ).count()
        usage_trend.append({
            "date": date.isoformat(),
            "count": count
        })
    usage_trend.reverse()
    
    return UsageStatsResponse(
        total_users=total_users,
        active_users_today=active_users_today,
        active_users_week=active_users_week,
        total_usage_count=int(total_usage_count),
        total_token_used=int(total_token_used),
        anonymous_usage_count=anonymous_usage_count,
        registered_usage_count=registered_usage_count,
        usage_by_type=usage_by_type,
        usage_trend=usage_trend
    )

@router.get("/payments")
async def get_all_payments(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 20,
    status_filter: Optional[str] = None
):
    """获取所有支付记录"""
    offset = (page - 1) * page_size
    query = db.query(Payment)
    
    if status_filter:
        query = query.filter(Payment.status == status_filter)
    
    total = query.count()
    payments = query.order_by(desc(Payment.created_at)).offset(offset).limit(page_size).all()
    
    # 获取用户信息
    result = []
    for payment in payments:
        user = db.query(User).filter(User.id == payment.user_id).first()
        result.append({
            "id": payment.id,
            "user_id": payment.user_id,
            "username": user.username if user else "未知",
            "email": user.email if user else "未知",
            "payment_type": payment.payment_type,
            "amount": payment.amount,
            "quantity": payment.quantity,
            "status": payment.status,
            "payment_method": payment.payment_method,
            "transaction_id": payment.transaction_id,
            "created_at": payment.created_at.isoformat(),
            "completed_at": payment.completed_at.isoformat() if payment.completed_at else None
        })
    
    return {
        "status": "success",
        "data": result,
        "total": total,
        "page": page,
        "page_size": page_size
    }

# ============ 详细使用记录查询 ============

@router.get("/usage/records")
async def get_usage_records(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 50,
    user_id: Optional[int] = None,
    usage_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    country: Optional[str] = None,
    device_type: Optional[str] = None,
    api_endpoint: Optional[str] = None,
):
    """获取详细使用记录，支持多维度筛选"""
    offset = (page - 1) * page_size
    query = db.query(UsageRecord)
    
    # 筛选条件
    if user_id:
        query = query.filter(UsageRecord.user_id == user_id)
    if usage_type:
        query = query.filter(UsageRecord.usage_type == usage_type)
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.filter(UsageRecord.created_at >= start_dt)
        except:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.filter(UsageRecord.created_at <= end_dt)
        except:
            pass
    if country:
        query = query.filter(UsageRecord.country == country)
    if device_type:
        query = query.filter(UsageRecord.device_type == device_type)
    if api_endpoint:
        query = query.filter(UsageRecord.api_endpoint.contains(api_endpoint))
    
    total = query.count()
    records = query.order_by(desc(UsageRecord.created_at)).offset(offset).limit(page_size).all()
    
    # 获取用户信息
    result = []
    for record in records:
        user = None
        if record.user_id:
            user = db.query(User).filter(User.id == record.user_id).first()
        
        # 解析请求参数
        request_params = None
        if record.request_params:
            try:
                request_params = json.loads(record.request_params)
            except:
                pass
        
        result.append({
            "id": record.id,
            "user_id": record.user_id,
            "username": user.username if user else None,
            "email": user.email if user else None,
            "session_id": record.session_id,
            "usage_type": record.usage_type,
            "api_endpoint": record.api_endpoint,
            "api_method": record.api_method,
            "request_params": request_params,
            "response_status": record.response_status,
            "started_at": record.started_at.isoformat() if record.started_at else None,
            "completed_at": record.completed_at.isoformat() if record.completed_at else None,
            "duration_ms": record.duration_ms,
            "response_time_ms": record.response_time_ms,
            "ip_address": record.ip_address,
            "country": record.country,
            "city": record.city,
            "device_type": record.device_type,
            "browser": record.browser,
            "os": record.os,
            "input_tokens": record.input_tokens,
            "output_tokens": record.output_tokens,
            "total_tokens": record.total_tokens,
            "token_used": record.token_used,
            "error_message": record.error_message,
            "task_id": record.task_id,
            "project_id": record.project_id,
            "referer": record.referer,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        })
    
    return {
        "status": "success",
        "data": result,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/usage/records/{record_id}")
async def get_usage_record_detail(
    record_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """获取单条使用记录的详细信息"""
    record = db.query(UsageRecord).filter(UsageRecord.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="记录不存在"
        )
    
    user = None
    if record.user_id:
        user = db.query(User).filter(User.id == record.user_id).first()
    
    request_params = None
    if record.request_params:
        try:
            request_params = json.loads(record.request_params)
        except:
            pass
    
    return {
        "status": "success",
        "data": {
            "id": record.id,
            "user_id": record.user_id,
            "username": user.username if user else None,
            "email": user.email if user else None,
            "session_id": record.session_id,
            "usage_type": record.usage_type,
            "api_endpoint": record.api_endpoint,
            "api_method": record.api_method,
            "request_params": request_params,
            "response_status": record.response_status,
            "started_at": record.started_at.isoformat() if record.started_at else None,
            "completed_at": record.completed_at.isoformat() if record.completed_at else None,
            "duration_ms": record.duration_ms,
            "response_time_ms": record.response_time_ms,
            "ip_address": record.ip_address,
            "country": record.country,
            "city": record.city,
            "user_agent": record.user_agent,
            "device_type": record.device_type,
            "browser": record.browser,
            "os": record.os,
            "input_tokens": record.input_tokens,
            "output_tokens": record.output_tokens,
            "total_tokens": record.total_tokens,
            "token_used": record.token_used,
            "error_message": record.error_message,
            "task_id": record.task_id,
            "project_id": record.project_id,
            "referer": record.referer,
            "session_duration": record.session_duration,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        }
    }

@router.get("/usage/records/export")
async def export_usage_records(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    format: str = "csv",
    user_id: Optional[int] = None,
    usage_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """导出使用记录"""
    query = db.query(UsageRecord)
    
    # 应用筛选条件
    if user_id:
        query = query.filter(UsageRecord.user_id == user_id)
    if usage_type:
        query = query.filter(UsageRecord.usage_type == usage_type)
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
            query = query.filter(UsageRecord.created_at >= start_dt)
        except:
            pass
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
            query = query.filter(UsageRecord.created_at <= end_dt)
        except:
            pass
    
    records = query.order_by(desc(UsageRecord.created_at)).limit(10000).all()
    
    if format == "csv":
        # 生成CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # 写入表头
        writer.writerow([
            "ID", "用户ID", "用户名", "会话ID", "使用类型", "API端点", "HTTP方法",
            "响应状态", "IP地址", "国家", "城市", "设备类型", "浏览器", "操作系统",
            "输入Token", "输出Token", "总Token", "耗时(ms)", "创建时间"
        ])
        
        # 写入数据
        for record in records:
            user = None
            if record.user_id:
                user = db.query(User).filter(User.id == record.user_id).first()
            
            writer.writerow([
                record.id,
                record.user_id or "",
                user.username if user else "",
                record.session_id or "",
                record.usage_type or "",
                record.api_endpoint or "",
                record.api_method or "",
                record.response_status or "",
                record.ip_address or "",
                record.country or "",
                record.city or "",
                record.device_type or "",
                record.browser or "",
                record.os or "",
                record.input_tokens or 0,
                record.output_tokens or 0,
                record.total_tokens or 0,
                record.duration_ms or 0,
                record.created_at.isoformat() if record.created_at else "",
            ])
        
        csv_content = output.getvalue()
        output.close()
        
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=usage_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            }
        )
    else:
        # JSON格式
        result = []
        for record in records:
            user = None
            if record.user_id:
                user = db.query(User).filter(User.id == record.user_id).first()
            
            result.append({
                "id": record.id,
                "user_id": record.user_id,
                "username": user.username if user else None,
                "session_id": record.session_id,
                "usage_type": record.usage_type,
                "api_endpoint": record.api_endpoint,
                "api_method": record.api_method,
                "response_status": record.response_status,
                "ip_address": record.ip_address,
                "country": record.country,
                "city": record.city,
                "device_type": record.device_type,
                "browser": record.browser,
                "os": record.os,
                "input_tokens": record.input_tokens,
                "output_tokens": record.output_tokens,
                "total_tokens": record.total_tokens,
                "duration_ms": record.duration_ms,
                "created_at": record.created_at.isoformat() if record.created_at else None,
            })
        
        return {
            "status": "success",
            "data": result,
            "total": len(result)
        }

# ============ 统计分析接口 ============

@router.get("/usage/analytics")
async def get_usage_analytics(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    time_range: str = "7d",  # 7d, 30d, 90d
    group_by: str = "day",  # hour, day, week, month
):
    """综合统计分析"""
    # 计算时间范围
    now = datetime.utcnow()
    if time_range == "7d":
        start_time = now - timedelta(days=7)
    elif time_range == "30d":
        start_time = now - timedelta(days=30)
    elif time_range == "90d":
        start_time = now - timedelta(days=90)
    else:
        start_time = now - timedelta(days=7)
    
    # 基础查询
    base_query = db.query(UsageRecord).filter(UsageRecord.created_at >= start_time)
    
    # 按时间维度统计
    time_stats = []
    if group_by == "hour":
        for i in range(24):
            hour_start = start_time.replace(hour=i, minute=0, second=0, microsecond=0)
            hour_end = hour_start + timedelta(hours=1)
            count = base_query.filter(
                UsageRecord.created_at >= hour_start,
                UsageRecord.created_at < hour_end
            ).count()
            time_stats.append({"time": hour_start.isoformat(), "count": count})
    elif group_by == "day":
        for i in range((now - start_time).days + 1):
            day = start_time + timedelta(days=i)
            day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            count = base_query.filter(
                UsageRecord.created_at >= day_start,
                UsageRecord.created_at < day_end
            ).count()
            time_stats.append({"time": day_start.isoformat(), "count": count})
    
    # 按功能维度统计
    usage_by_type = {}
    for usage_type in ["image", "video", "text", "project", "other"]:
        count = base_query.filter(UsageRecord.usage_type == usage_type).count()
        if count > 0:
            usage_by_type[usage_type] = count
    
    # 按地理位置统计
    location_stats = db.query(
        UsageRecord.country,
        func.count(UsageRecord.id).label("count")
    ).filter(
        UsageRecord.created_at >= start_time,
        UsageRecord.country.isnot(None)
    ).group_by(UsageRecord.country).order_by(desc("count")).limit(10).all()
    
    location_by_country = {country: count for country, count in location_stats}
    
    # 按设备类型统计
    device_stats = db.query(
        UsageRecord.device_type,
        func.count(UsageRecord.id).label("count")
    ).filter(
        UsageRecord.created_at >= start_time,
        UsageRecord.device_type.isnot(None)
    ).group_by(UsageRecord.device_type).all()
    
    device_by_type = {device_type: count for device_type, count in device_stats}
    
    # Token消耗统计
    token_stats = db.query(
        func.sum(UsageRecord.total_tokens).label("total_tokens"),
        func.sum(UsageRecord.input_tokens).label("input_tokens"),
        func.sum(UsageRecord.output_tokens).label("output_tokens"),
        func.avg(UsageRecord.total_tokens).label("avg_tokens")
    ).filter(
        UsageRecord.created_at >= start_time
    ).first()
    
    # 用户活跃度
    active_users = db.query(
        func.count(func.distinct(UsageRecord.user_id)).label("count")
    ).filter(
        UsageRecord.created_at >= start_time,
        UsageRecord.user_id.isnot(None)
    ).scalar()
    
    return {
        "status": "success",
        "data": {
            "time_range": time_range,
            "group_by": group_by,
            "time_stats": time_stats,
            "usage_by_type": usage_by_type,
            "location_by_country": location_by_country,
            "device_by_type": device_by_type,
            "token_stats": {
                "total_tokens": int(token_stats.total_tokens or 0),
                "input_tokens": int(token_stats.input_tokens or 0),
                "output_tokens": int(token_stats.output_tokens or 0),
                "avg_tokens": float(token_stats.avg_tokens or 0),
            },
            "active_users": active_users or 0,
        }
    }

# ============ 用户行为分析 ============

@router.get("/users/{user_id}/activity")
async def get_user_activity(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 50,
):
    """获取用户详细活动记录"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    offset = (page - 1) * page_size
    
    # 获取使用记录
    usage_records = db.query(UsageRecord).filter(
        UsageRecord.user_id == user_id
    ).order_by(desc(UsageRecord.created_at)).offset(offset).limit(page_size).all()
    
    # 获取活动日志
    activity_logs = db.query(UserActivityLog).filter(
        UserActivityLog.user_id == user_id
    ).order_by(desc(UserActivityLog.created_at)).offset(offset).limit(page_size).all()
    
    return {
        "status": "success",
        "data": {
            "usage_records": [
                {
                    "id": r.id,
                    "usage_type": r.usage_type,
                    "api_endpoint": r.api_endpoint,
                    "created_at": r.created_at.isoformat(),
                    "total_tokens": r.total_tokens,
                }
                for r in usage_records
            ],
            "activity_logs": [
                {
                    "id": log.id,
                    "activity_type": log.activity_type or "unknown",
                    "activity_detail": json.loads(log.activity_detail) if log.activity_detail else None,
                    "ip_address": log.ip_address,
                    "created_at": log.created_at.isoformat(),
                }
                for log in activity_logs
            ]
        }
    }

@router.get("/users/{user_id}/timeline")
async def get_user_timeline(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    days: int = 30,
):
    """获取用户使用时间线"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    start_time = datetime.utcnow() - timedelta(days=days)
    
    # 按天统计使用情况
    timeline = []
    for i in range(days):
        day = start_time + timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        
        records = db.query(UsageRecord).filter(
            UsageRecord.user_id == user_id,
            UsageRecord.created_at >= day_start,
            UsageRecord.created_at < day_end
        ).all()
        
        timeline.append({
            "date": day_start.isoformat(),
            "count": len(records),
            "total_tokens": sum(r.total_tokens for r in records),
            "usage_types": {}
        })
        
        # 按类型统计
        for record in records:
            usage_type = record.usage_type
            if usage_type not in timeline[-1]["usage_types"]:
                timeline[-1]["usage_types"][usage_type] = 0
            timeline[-1]["usage_types"][usage_type] += 1
    
    return {
        "status": "success",
        "data": {
            "user_id": user_id,
            "username": user.username,
            "timeline": timeline
        }
    }

@router.get("/users/{user_id}/stats")
async def get_user_stats(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """获取用户使用统计"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 总使用次数
    total_records = db.query(UsageRecord).filter(UsageRecord.user_id == user_id).count()
    
    # 按类型统计
    usage_by_type = {}
    for usage_type in ["image", "video", "text", "project", "other"]:
        count = db.query(UsageRecord).filter(
            UsageRecord.user_id == user_id,
            UsageRecord.usage_type == usage_type
        ).count()
        if count > 0:
            usage_by_type[usage_type] = count
    
    # Token统计
    token_stats = db.query(
        func.sum(UsageRecord.total_tokens).label("total_tokens"),
        func.sum(UsageRecord.input_tokens).label("input_tokens"),
        func.sum(UsageRecord.output_tokens).label("output_tokens"),
        func.avg(UsageRecord.duration_ms).label("avg_duration_ms")
    ).filter(UsageRecord.user_id == user_id).first()
    
    # 最近使用
    recent_records = db.query(UsageRecord).filter(
        UsageRecord.user_id == user_id
    ).order_by(desc(UsageRecord.created_at)).limit(10).all()
    
    return {
        "status": "success",
        "data": {
            "user_id": user_id,
            "username": user.username,
            "total_records": total_records,
            "usage_by_type": usage_by_type,
            "token_stats": {
                "total_tokens": int(token_stats.total_tokens or 0),
                "input_tokens": int(token_stats.input_tokens or 0),
                "output_tokens": int(token_stats.output_tokens or 0),
                "avg_duration_ms": float(token_stats.avg_duration_ms or 0),
            },
            "recent_records": [
                {
                    "id": r.id,
                    "usage_type": r.usage_type,
                    "api_endpoint": r.api_endpoint,
                    "created_at": r.created_at.isoformat(),
                    "total_tokens": r.total_tokens,
                }
                for r in recent_records
            ]
        }
    }

# ============ 实时监控 ============

@router.get("/monitoring/realtime")
async def get_realtime_monitoring(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """获取实时使用情况"""
    now = datetime.utcnow()
    last_hour = now - timedelta(hours=1)
    last_24h = now - timedelta(hours=24)
    
    # 最近1小时的使用
    recent_1h = db.query(UsageRecord).filter(
        UsageRecord.created_at >= last_hour
    ).count()
    
    # 最近24小时的使用
    recent_24h = db.query(UsageRecord).filter(
        UsageRecord.created_at >= last_24h
    ).count()
    
    # 当前活跃用户（最近1小时）
    active_users_1h = db.query(
        func.count(func.distinct(UsageRecord.user_id))
    ).filter(
        UsageRecord.created_at >= last_hour,
        UsageRecord.user_id.isnot(None)
    ).scalar()
    
    # 最近的使用记录
    recent_records = db.query(UsageRecord).filter(
        UsageRecord.created_at >= last_hour
    ).order_by(desc(UsageRecord.created_at)).limit(20).all()
    
    return {
        "status": "success",
        "data": {
            "recent_1h": recent_1h,
            "recent_24h": recent_24h,
            "active_users_1h": active_users_1h or 0,
            "recent_records": [
                {
                    "id": r.id,
                    "user_id": r.user_id,
                    "usage_type": r.usage_type,
                    "api_endpoint": r.api_endpoint,
                    "created_at": r.created_at.isoformat(),
                    "response_status": r.response_status,
                }
                for r in recent_records
            ]
        }
    }

@router.get("/monitoring/health")
async def get_system_health(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """获取系统健康状态"""
    now = datetime.utcnow()
    last_hour = now - timedelta(hours=1)
    
    # 错误率
    total_requests = db.query(UsageRecord).filter(
        UsageRecord.created_at >= last_hour
    ).count()
    
    error_requests = db.query(UsageRecord).filter(
        UsageRecord.created_at >= last_hour,
        UsageRecord.response_status >= 400
    ).count()
    
    error_rate = (error_requests / total_requests * 100) if total_requests > 0 else 0
    
    # 平均响应时间
    avg_response_time = db.query(
        func.avg(UsageRecord.response_time_ms)
    ).filter(
        UsageRecord.created_at >= last_hour
    ).scalar()
    
    return {
        "status": "success",
        "data": {
            "total_requests_1h": total_requests,
            "error_requests_1h": error_requests,
            "error_rate": round(error_rate, 2),
            "avg_response_time_ms": round(float(avg_response_time or 0), 2),
            "status": "healthy" if error_rate < 5 and (avg_response_time or 0) < 5000 else "warning"
        }
    }

# ============ 数据归档 ============

@router.get("/archive/stats")
async def get_archive_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """获取归档统计信息"""
    from app.services.data_archiver import get_archive_stats
    stats = get_archive_stats(db)
    return {
        "status": "success",
        "data": stats
    }

@router.post("/archive/run")
async def run_archive(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """执行数据归档任务"""
    from app.services.data_archiver import archive_old_records
    result = archive_old_records(db)
    return {
        "status": result.get("status", "success"),
        "data": result
    }
