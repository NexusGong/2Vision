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

# ============ 辅助函数 ============

def get_total_tokens_from_record(record: UsageRecord) -> int:
    """从使用记录获取token数量（优先使用total_tokens）"""
    return record.total_tokens or 0

def calculate_token_summary(db: Session, user_id: Optional[int] = None, usage_type: Optional[str] = None, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None) -> dict:
    """
    计算token统计摘要（优化版，支持时间范围筛选）
    
    Args:
        db: 数据库会话
        user_id: 用户ID（可选）
        usage_type: 使用类型（可选）
        start_date: 开始日期（可选）
        end_date: 结束日期（可选）
    
    Returns:
        包含input_tokens, output_tokens, total_tokens的字典
    """
    query = db.query(UsageRecord)
    
    if user_id:
        query = query.filter(UsageRecord.user_id == user_id)
    if usage_type:
        query = query.filter(UsageRecord.usage_type == usage_type)
    if start_date:
        query = query.filter(UsageRecord.created_at >= start_date)
    if end_date:
        query = query.filter(UsageRecord.created_at <= end_date)
    
    result = query.with_entities(
        func.sum(UsageRecord.input_tokens).label('input_tokens'),
        func.sum(UsageRecord.output_tokens).label('output_tokens'),
        func.sum(UsageRecord.total_tokens).label('total_tokens'),
        func.count(UsageRecord.id).label('count')
    ).first()
    
    return {
        "input_tokens": int(result.input_tokens or 0),
        "output_tokens": int(result.output_tokens or 0),
        "total_tokens": int(result.total_tokens or 0),
        "count": int(result.count or 0)
    }

# 成本配置（基于COST_ANALYSIS.md）
# 使用分档定价：输入0.8元/百万，输出8元/百万
COST_CONFIG = {
    "input_price_per_million": 0.8,  # 输入tokens价格（元/百万tokens）
    "output_price_per_million": 8.0,  # 输出tokens价格（元/百万tokens）
    "unified_price_per_million": 2.6,  # 统一定价（元/百万tokens，如适用）
    "use_unified_pricing": False,  # 是否使用统一定价
}

# 销售价格配置（从payment.py导入逻辑）
def calculate_sale_price(quantity: int) -> float:
    """计算销售价格（统一token定价）"""
    from app.api.payment import calculate_price
    try:
        return calculate_price(quantity)
    except:
        return 0.0

def calculate_cost(input_tokens: int, output_tokens: int) -> float:
    """
    计算成本（基于tokens）
    
    Args:
        input_tokens: 输入tokens
        output_tokens: 输出tokens
    
    Returns:
        成本（元）
    """
    if COST_CONFIG["use_unified_pricing"]:
        total_tokens = input_tokens + output_tokens
        return total_tokens / 1_000_000 * COST_CONFIG["unified_price_per_million"]
    else:
        input_cost = input_tokens / 1_000_000 * COST_CONFIG["input_price_per_million"]
        output_cost = output_tokens / 1_000_000 * COST_CONFIG["output_price_per_million"]
        return input_cost + output_cost

def calculate_sale_price_by_usage(mode: str, usage_count: int = 1, total_tokens: int = 0) -> float:
    """
    根据使用情况计算销售价格（统一token定价系统）
    
    Args:
        mode: 模式（image/video）
        usage_count: 使用次数
        total_tokens: 总tokens
    
    Returns:
        销售价格（元）
    """
    if total_tokens > 0:
        # 统一token定价：0.0190元/1000 tokens（利润17%）
        unit_price = 0.0190
        return total_tokens / 1000 * unit_price
    elif usage_count > 0:
        # 根据模式估算token消耗
        if mode == "image":
            # 图像生成：约76,685 tokens/次
            estimated_tokens = 76685 * usage_count
        else:  # video
            # 视频生成：约263,193 tokens/次（720p 12秒）
            estimated_tokens = 263193 * usage_count
        unit_price = 0.0190
        return estimated_tokens / 1000 * unit_price
    return 0.0

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """要求管理员权限"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user

class UserListItem(BaseModel):
    """用户列表项（统一token系统）"""
    id: int
    username: str
    email: str
    nickname: Optional[str] = None
    is_active: bool
    is_admin: bool
    is_vip: bool
    free_tokens: int  # 统一免费token
    token_balance: int  # 统一付费token余额
    total_usage_count: int
    total_token_used: int
    created_at: str
    
    class Config:
        from_attributes = True

class UserUpdateRequest(BaseModel):
    """用户更新请求（统一token系统）"""
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None  # 新密码（如果提供则更新）
    nickname: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_vip: Optional[bool] = None
    free_tokens: Optional[int] = None  # 统一免费token
    token_balance: Optional[int] = None  # 统一付费token余额
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
                free_tokens=u.free_tokens or 1250000,
                token_balance=u.token_balance or 0,
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
                free_tokens=user.free_tokens or 1250000,
                token_balance=user.token_balance or 0,
                total_usage_count=user.total_usage_count or 0,
                total_token_used=user.total_token_used or 0,
                created_at=user.created_at.isoformat() if user.created_at else ""
            ),
            "usage_records": [
                {
                    "id": r.id,
                    "usage_type": r.usage_type,
                    "total_tokens": r.total_tokens or 0,  # 优先使用total_tokens
                    "token_used": r.total_tokens or 0,  # 兼容字段
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
    if user_data.free_tokens is not None:
        user.free_tokens = user_data.free_tokens
    if user_data.token_balance is not None:
        user.token_balance = user_data.token_balance
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
            free_tokens=user.free_tokens or 1250000,
            token_balance=user.token_balance or 0,
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
            "total_tokens": record.total_tokens or 0,  # 优先使用total_tokens
            "token_used": record.total_tokens or 0,  # 兼容字段，使用total_tokens的值
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
            "total_tokens": record.total_tokens or 0,  # 优先使用total_tokens
            "token_used": record.total_tokens or 0,  # 兼容字段，使用total_tokens的值
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
    
    # Token消耗统计（使用优化的辅助函数）
    token_summary = calculate_token_summary(db, start_date=start_time, end_date=now)
    token_stats = type('TokenStats', (), {
        'total_tokens': token_summary['total_tokens'],
        'input_tokens': token_summary['input_tokens'],
        'output_tokens': token_summary['output_tokens'],
        'avg_tokens': token_summary['total_tokens'] / token_summary['count'] if token_summary['count'] > 0 else 0
    })()
    
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
                    "total_tokens": get_total_tokens_from_record(r),
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
            "total_tokens": sum(get_total_tokens_from_record(r) for r in records),
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
                    "total_tokens": get_total_tokens_from_record(r),
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

# ============ 成本监控 ============

@router.get("/cost/overview")
async def get_cost_overview(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    usage_type: Optional[str] = None,
):
    """
    获取成本概览
    按模型、使用类型等维度统计成本和收入
    """
    # 解析日期
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    else:
        start_dt = datetime.utcnow() - timedelta(days=7)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    else:
        end_dt = datetime.utcnow()
    
    # 构建查询
    query = db.query(UsageRecord).filter(
        UsageRecord.created_at >= start_dt,
        UsageRecord.created_at <= end_dt
    )
    
    if usage_type:
        query = query.filter(UsageRecord.usage_type == usage_type)
    
    records = query.all()
    
    # 查询实际收入（从支付记录中获取已完成的支付金额）
    payment_query = db.query(
        func.sum(Payment.amount).label("total_revenue")
    ).filter(
        Payment.status == "completed",
        Payment.completed_at >= start_dt,
        Payment.completed_at <= end_dt
    )
    actual_revenue_result = payment_query.first()
    actual_revenue = float(actual_revenue_result.total_revenue or 0) if actual_revenue_result else 0.0
    
    # 按使用类型统计
    stats_by_type = {}
    total_cost = 0.0
    total_sale = 0.0  # 理论收入（基于使用记录计算）
    total_input_tokens = 0
    total_output_tokens = 0
    total_tokens = 0
    
    for record in records:
        usage_type_key = record.usage_type or "unknown"
        if usage_type_key not in stats_by_type:
            stats_by_type[usage_type_key] = {
                "count": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "cost": 0.0,
                "sale": 0.0,
            }
        
        input_tokens = record.input_tokens or 0
        output_tokens = record.output_tokens or 0
        # 优先使用total_tokens，如果没有则计算
        total_record_tokens = record.total_tokens if record.total_tokens and record.total_tokens > 0 else (input_tokens + output_tokens)
        
        # 计算成本（包含文本分析和生成成本）
        text_analysis_cost = calculate_cost(input_tokens, output_tokens)
        
        # 根据使用类型添加生成成本
        if usage_type_key == "image":
            # 图像生成：每次生成6张图片，成本1.2元
            generation_cost = 6 * 0.2  # 6张 × 0.2元/张
            cost = text_analysis_cost + generation_cost
        elif usage_type_key == "video":
            # 视频生成：720p 12秒有声，token用量259,200，成本4.1472元
            # token用量 = (1280 × 720 × 24 × 12) / 1024 = 259,200 tokens
            video_tokens = 259200
            generation_cost = video_tokens / 1_000_000 * 16.00  # 有声16元/百万token
            cost = text_analysis_cost + generation_cost
        else:
            cost = text_analysis_cost
        
        # 计算销售价格（根据使用类型判断mode）
        mode = "image" if usage_type_key == "image" else "video"
        sale = calculate_sale_price_by_usage(mode, 1, total_record_tokens)
        
        stats_by_type[usage_type_key]["count"] += 1
        stats_by_type[usage_type_key]["input_tokens"] += input_tokens
        stats_by_type[usage_type_key]["output_tokens"] += output_tokens
        stats_by_type[usage_type_key]["total_tokens"] += total_record_tokens
        stats_by_type[usage_type_key]["cost"] += cost
        stats_by_type[usage_type_key]["sale"] += sale
        
        total_cost += cost
        total_sale += sale
        total_input_tokens += input_tokens
        total_output_tokens += output_tokens
        total_tokens += total_record_tokens
    
    # 计算利润
    # 理论利润（基于使用记录计算的理论收入）
    theoretical_profit = total_sale - total_cost
    theoretical_profit_margin = (theoretical_profit / total_sale * 100) if total_sale > 0 else 0
    
    # 实际利润（基于实际充值收入）
    actual_profit = actual_revenue - total_cost
    actual_profit_margin = (actual_profit / actual_revenue * 100) if actual_revenue > 0 else 0
    
    return {
        "status": "success",
        "data": {
            "period": {
                "start_date": start_dt.isoformat(),
                "end_date": end_dt.isoformat(),
            },
            "summary": {
                "total_records": len(records),
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens,
                "total_tokens": total_tokens,
                "total_cost": round(total_cost, 4),
                "total_sale": round(total_sale, 4),  # 理论收入（基于使用记录计算）
                "actual_revenue": round(actual_revenue, 4),  # 实际收入（用户实际充值）
                "theoretical_profit": round(theoretical_profit, 4),  # 理论利润
                "theoretical_profit_margin": round(theoretical_profit_margin, 2),  # 理论利润率
                "actual_profit": round(actual_profit, 4),  # 实际利润
                "actual_profit_margin": round(actual_profit_margin, 2),  # 实际利润率
                # 兼容旧字段
                "total_profit": round(actual_profit, 4),  # 使用实际利润
                "profit_margin": round(actual_profit_margin, 2),  # 使用实际利润率
            },
            "by_type": {
                k: {
                    "count": v["count"],
                    "input_tokens": v["input_tokens"],
                    "output_tokens": v["output_tokens"],
                    "total_tokens": v["total_tokens"],
                    "cost": round(v["cost"], 4),
                    "sale": round(v["sale"], 4),
                    "profit": round(v["sale"] - v["cost"], 4),
                    "profit_margin": round((v["sale"] - v["cost"]) / v["sale"] * 100, 2) if v["sale"] > 0 else 0,
                    "avg_cost_per_record": round(v["cost"] / v["count"], 4) if v["count"] > 0 else 0,
                    "avg_sale_per_record": round(v["sale"] / v["count"], 4) if v["count"] > 0 else 0,
                }
                for k, v in stats_by_type.items()
            }
        }
    }

@router.get("/cost/by-user")
async def get_cost_by_user(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: Optional[int] = None,
    page: int = 1,
    page_size: int = 50,
):
    """
    按用户统计成本和收入
    """
    # 解析日期
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    else:
        start_dt = datetime.utcnow() - timedelta(days=7)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    else:
        end_dt = datetime.utcnow()
    
    # 构建查询
    query = db.query(
        UsageRecord.user_id,
        UsageRecord.usage_type,
        func.count(UsageRecord.id).label("count"),
        func.sum(UsageRecord.input_tokens).label("total_input_tokens"),
        func.sum(UsageRecord.output_tokens).label("total_output_tokens"),
        func.sum(UsageRecord.total_tokens).label("total_tokens"),
    ).filter(
        UsageRecord.created_at >= start_dt,
        UsageRecord.created_at <= end_dt,
        UsageRecord.user_id.isnot(None)
    )
    
    if user_id:
        query = query.filter(UsageRecord.user_id == user_id)
    
    # 按用户分组
    user_stats = query.group_by(
        UsageRecord.user_id,
        UsageRecord.usage_type
    ).all()
    
    # 查询每个用户的实际充值收入
    user_payment_query = db.query(
        Payment.user_id,
        func.sum(Payment.amount).label("total_payment")
    ).filter(
        Payment.status == "completed",
        Payment.completed_at >= start_dt,
        Payment.completed_at <= end_dt
    )
    
    if user_id:
        user_payment_query = user_payment_query.filter(Payment.user_id == user_id)
    
    user_payments = user_payment_query.group_by(Payment.user_id).all()
    user_payment_map = {up.user_id: float(up.total_payment or 0) for up in user_payments}
    
    # 聚合用户数据
    user_data = {}
    for stat in user_stats:
        user_id = stat.user_id
        if user_id not in user_data:
            user_data[user_id] = {
                "user_id": user_id,
                "total_records": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_tokens": 0,
                "total_cost": 0.0,
                "total_sale": 0.0,
                "by_type": {}
            }
        
        usage_type = stat.usage_type or "unknown"
        input_tokens = int(stat.total_input_tokens or 0)
        output_tokens = int(stat.total_output_tokens or 0)
        total_tokens = int(stat.total_tokens or 0)
        count = int(stat.count or 0)
        
        # 计算成本（包含文本分析和生成成本）
        text_analysis_cost = calculate_cost(input_tokens, output_tokens)
        
        # 根据使用类型添加生成成本
        if usage_type == "image":
            # 图像生成：每次生成6张图片，成本1.2元
            generation_cost = 6 * 0.2 * count  # 6张 × 0.2元/张 × 次数
            cost = text_analysis_cost + generation_cost
        elif usage_type == "video":
            # 视频生成：720p 12秒有声，token用量259,200，成本4.1472元
            video_tokens = 259200
            generation_cost = (video_tokens / 1_000_000 * 16.00) * count  # 有声16元/百万token × 次数
            cost = text_analysis_cost + generation_cost
        else:
            cost = text_analysis_cost
        
        # 计算销售价格
        mode = "image" if usage_type == "image" else "video"
        sale = calculate_sale_price_by_usage(mode, count, total_tokens)
        
        user_data[user_id]["total_records"] += count
        user_data[user_id]["total_input_tokens"] += input_tokens
        user_data[user_id]["total_output_tokens"] += output_tokens
        user_data[user_id]["total_tokens"] += total_tokens
        user_data[user_id]["total_cost"] += cost
        user_data[user_id]["total_sale"] += sale
        user_data[user_id]["by_type"][usage_type] = {
            "count": count,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "cost": cost,
            "sale": sale,
        }
    
    # 获取用户信息
    user_ids = list(user_data.keys())
    users = db.query(User).filter(User.id.in_(user_ids)).all()
    user_map = {u.id: u for u in users}
    
    # 格式化结果
    result = []
    for user_id, data in user_data.items():
        user = user_map.get(user_id)
        # 获取该用户的实际充值收入
        actual_revenue = user_payment_map.get(user_id, 0.0)
        
        # 理论利润（基于使用记录计算）
        theoretical_profit = data["total_sale"] - data["total_cost"]
        theoretical_profit_margin = (theoretical_profit / data["total_sale"] * 100) if data["total_sale"] > 0 else 0
        
        # 实际利润（基于实际充值收入）
        actual_profit = actual_revenue - data["total_cost"]
        actual_profit_margin = (actual_profit / actual_revenue * 100) if actual_revenue > 0 else 0
        
        # 兼容旧字段，使用实际利润
        total_profit = actual_profit
        profit_margin = actual_profit_margin
        
        result.append({
            "user_id": user_id,
            "username": user.username if user else f"用户{user_id}",
            "email": user.email if user else None,
            "total_records": data["total_records"],
            "total_input_tokens": data["total_input_tokens"],
            "total_output_tokens": data["total_output_tokens"],
            "total_tokens": data["total_tokens"],
            "total_cost": round(data["total_cost"], 4),
            "total_sale": round(data["total_sale"], 4),  # 理论收入（基于使用记录计算）
            "actual_revenue": round(actual_revenue, 4),  # 实际收入（用户实际充值）
            "theoretical_profit": round(theoretical_profit, 4),  # 理论利润
            "theoretical_profit_margin": round(theoretical_profit_margin, 2),  # 理论利润率
            "actual_profit": round(actual_profit, 4),  # 实际利润
            "actual_profit_margin": round(actual_profit_margin, 2),  # 实际利润率
            "total_profit": round(total_profit, 4),  # 兼容旧字段，使用实际利润
            "profit_margin": round(profit_margin, 2),  # 兼容旧字段，使用实际利润率
            "by_type": {
                k: {
                    "count": v["count"],
                    "input_tokens": v["input_tokens"],
                    "output_tokens": v["output_tokens"],
                    "total_tokens": v["total_tokens"],
                    "cost": round(v["cost"], 4),
                    "sale": round(v["sale"], 4),
                    "profit": round(v["sale"] - v["cost"], 4),
                }
                for k, v in data["by_type"].items()
            }
        })
    
    # 排序（按总成本降序）
    result.sort(key=lambda x: x["total_cost"], reverse=True)
    
    # 分页
    total = len(result)
    offset = (page - 1) * page_size
    paginated_result = result[offset:offset + page_size]
    
    return {
        "status": "success",
        "data": paginated_result,
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.get("/cost/detailed")
async def get_cost_detailed(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: Optional[int] = None,
    usage_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
):
    """
    获取详细的成本记录（每次调用）
    """
    # 解析日期
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    else:
        start_dt = datetime.utcnow() - timedelta(days=7)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    else:
        end_dt = datetime.utcnow()
    
    # 构建查询
    query = db.query(UsageRecord).filter(
        UsageRecord.created_at >= start_dt,
        UsageRecord.created_at <= end_dt
    )
    
    if user_id:
        query = query.filter(UsageRecord.user_id == user_id)
    
    if usage_type:
        query = query.filter(UsageRecord.usage_type == usage_type)
    
    # 总数
    total = query.count()
    
    # 分页
    offset = (page - 1) * page_size
    records = query.order_by(desc(UsageRecord.created_at)).offset(offset).limit(page_size).all()
    
    # 获取用户信息
    user_ids = list(set(r.user_id for r in records if r.user_id))
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u for u in users}
    
    # 格式化结果
    result = []
    for record in records:
        input_tokens = record.input_tokens or 0
        output_tokens = record.output_tokens or 0
        total_tokens = record.total_tokens or (input_tokens + output_tokens)
        
        # 计算成本（包含文本分析和生成成本）
        text_analysis_cost = calculate_cost(input_tokens, output_tokens)
        
        # 根据使用类型添加生成成本
        if record.usage_type == "image":
            # 图像生成：每次生成6张图片，成本1.2元
            generation_cost = 6 * 0.2  # 6张 × 0.2元/张
            cost = text_analysis_cost + generation_cost
        elif record.usage_type == "video":
            # 视频生成：720p 12秒有声，token用量259,200，成本4.1472元
            video_tokens = 259200
            generation_cost = video_tokens / 1_000_000 * 16.00  # 有声16元/百万token
            cost = text_analysis_cost + generation_cost
        else:
            cost = text_analysis_cost
        
        # 计算销售价格
        mode = "image" if record.usage_type == "image" else "video"
        sale = calculate_sale_price_by_usage(mode, 1, total_tokens)
        profit = sale - cost
        profit_margin = (profit / sale * 100) if sale > 0 else 0
        
        user = user_map.get(record.user_id) if record.user_id else None
        
        result.append({
            "id": record.id,
            "user_id": record.user_id,
            "username": user.username if user else None,
            "usage_type": record.usage_type,
            "api_endpoint": record.api_endpoint,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "cost": round(cost, 4),
            "sale": round(sale, 4),
            "profit": round(profit, 4),
            "profit_margin": round(profit_margin, 2),
            "response_status": record.response_status,
            "created_at": record.created_at.isoformat() if record.created_at else None,
        })
    
    return {
        "status": "success",
        "data": result,
        "total": total,
        "page": page,
        "page_size": page_size
    }
