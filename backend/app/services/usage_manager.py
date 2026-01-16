"""
使用次数管理服务
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.usage import UsageRecord
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)

# 使用次数限制配置
ANONYMOUS_FREE_COUNT = 5  # 非登录用户免费次数
REGISTERED_FREE_COUNT = 20  # 登录用户免费次数

def get_session_id_from_request(request) -> Optional[str]:
    """从请求中获取session_id（用于非登录用户）"""
    # 这里可以从请求头或cookie中获取session_id
    # 暂时返回None，由调用方传入
    return None

def get_remaining_count(db: Session, user: Optional[User] = None, session_id: Optional[str] = None) -> int:
    """
    获取剩余使用次数
    
    Args:
        db: 数据库会话
        user: 用户对象（登录用户）
        session_id: 会话ID（非登录用户）
    
    Returns:
        剩余次数
    """
    if user:
        # 登录用户：使用用户表中的free_usage_count
        return user.free_usage_count or 0
    elif session_id:
        # 非登录用户：计算已使用次数
        used_count = db.query(UsageRecord).filter(
            UsageRecord.session_id == session_id
        ).count()
        return max(0, ANONYMOUS_FREE_COUNT - used_count)
    else:
        # 既没有用户也没有session_id，返回0
        return 0

def check_usage_limit(db: Session, user: Optional[User] = None, session_id: Optional[str] = None) -> tuple[bool, str]:
    """
    检查使用次数限制
    
    Args:
        db: 数据库会话
        user: 用户对象（登录用户）
        session_id: 会话ID（非登录用户）
    
    Returns:
        (是否允许使用, 错误消息)
    """
    remaining = get_remaining_count(db, user, session_id)
    
    if remaining <= 0:
        if user:
            return False, "您的免费次数已用完，请充值后继续使用"
        else:
            return False, f"您已使用完{ANONYMOUS_FREE_COUNT}次免费体验，请登录后继续使用（登录用户有{REGISTERED_FREE_COUNT}次免费体验）"
    
    return True, ""

def record_usage(
    db: Session,
    usage_type: str,
    token_used: int = 0,
    user: Optional[User] = None,
    session_id: Optional[str] = None
) -> UsageRecord:
    """
    记录使用情况
    
    Args:
        db: 数据库会话
        usage_type: 使用类型（image/video）
        token_used: 消耗的token数
        user: 用户对象（登录用户）
        session_id: 会话ID（非登录用户）
    
    Returns:
        使用记录对象
    """
    usage_record = UsageRecord(
        user_id=user.id if user else None,
        session_id=session_id,
        usage_type=usage_type,
        token_used=token_used
    )
    db.add(usage_record)
    
    # 如果是登录用户，更新用户统计
    if user:
        user.total_usage_count = (user.total_usage_count or 0) + 1
        user.total_token_used = (user.total_token_used or 0) + token_used
        # 扣除免费次数（如果还有）
        if user.free_usage_count and user.free_usage_count > 0:
            user.free_usage_count -= 1
    
    db.commit()
    db.refresh(usage_record)
    
    logger.info(f"记录使用: user_id={user.id if user else None}, session_id={session_id}, type={usage_type}, tokens={token_used}")
    
    return usage_record

def deduct_usage(
    db: Session,
    user: Optional[User] = None,
    session_id: Optional[str] = None
) -> bool:
    """
    扣除使用次数（在检查通过后调用）
    
    Args:
        db: 数据库会话
        user: 用户对象（登录用户）
        session_id: 会话ID（非登录用户）
    
    Returns:
        是否成功
    """
    if user:
        if user.free_usage_count and user.free_usage_count > 0:
            user.free_usage_count -= 1
            db.commit()
            return True
        return False
    else:
        # 非登录用户通过记录使用来扣除次数
        return True

def add_usage_count(db: Session, user: User, count: int) -> bool:
    """
    增加用户的使用次数（用于充值）
    
    Args:
        db: 数据库会话
        user: 用户对象
        count: 增加的次数
    
    Returns:
        是否成功
    """
    user.free_usage_count = (user.free_usage_count or 0) + count
    db.commit()
    logger.info(f"为用户 {user.id} 增加 {count} 次使用次数")
    return True

def add_token_balance(db: Session, user: User, tokens: int) -> bool:
    """
    增加用户的token余额（用于充值）
    
    Args:
        db: 数据库会话
        user: 用户对象
        tokens: 增加的token数
    
    Returns:
        是否成功
    """
    # 这里可以扩展为单独的token余额字段，暂时先记录
    # 实际使用时从total_token_used中扣除
    logger.info(f"为用户 {user.id} 增加 {tokens} tokens")
    return True

def record_detailed_usage(
    db: Session,
    usage_type: str,
    user: Optional[User] = None,
    session_id: Optional[str] = None,
    api_endpoint: Optional[str] = None,
    api_method: Optional[str] = None,
    request_params: Optional[Dict[str, Any]] = None,
    response_status: Optional[int] = None,
    started_at: Optional[datetime] = None,
    completed_at: Optional[datetime] = None,
    duration_ms: Optional[int] = None,
    response_time_ms: Optional[int] = None,
    ip_address: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    user_agent: Optional[str] = None,
    device_type: Optional[str] = None,
    browser: Optional[str] = None,
    os: Optional[str] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    total_tokens: int = 0,
    token_used: int = 0,  # 兼容旧字段
    error_message: Optional[str] = None,
    task_id: Optional[str] = None,
    project_id: Optional[int] = None,
    referer: Optional[str] = None,
    session_duration: Optional[int] = None,
) -> UsageRecord:
    """
    记录详细的使用情况
    
    Args:
        db: 数据库会话
        usage_type: 使用类型（image/video/text/project）
        user: 用户对象（登录用户）
        session_id: 会话ID（非登录用户）
        api_endpoint: API端点路径
        api_method: HTTP方法
        request_params: 请求参数（字典格式，会自动转换为JSON）
        response_status: 响应状态码
        started_at: 请求开始时间
        completed_at: 请求完成时间
        duration_ms: 总耗时（毫秒）
        response_time_ms: 响应时间（毫秒）
        ip_address: IP地址
        country: 国家
        city: 城市
        user_agent: 用户代理
        device_type: 设备类型
        browser: 浏览器
        os: 操作系统
        input_tokens: 输入token数
        output_tokens: 输出token数
        total_tokens: 总token数
        token_used: 消耗的token数（兼容旧字段，如果total_tokens为0则使用此值）
        error_message: 错误信息
        task_id: 任务ID
        project_id: 项目ID
        referer: 来源页面
        session_duration: 会话持续时间（秒）
    
    Returns:
        使用记录对象
    """
    # 处理请求参数（转换为JSON字符串）
    request_params_json = None
    if request_params:
        try:
            request_params_json = json.dumps(request_params, ensure_ascii=False)
        except Exception as e:
            logger.warning(f"请求参数序列化失败: {str(e)}")
    
    # 计算token（优先使用total_tokens，否则使用token_used）
    final_total_tokens = total_tokens if total_tokens > 0 else token_used
    
    # 创建使用记录
    usage_record = UsageRecord(
        user_id=user.id if user else None,
        session_id=session_id,
        usage_type=usage_type,
        api_endpoint=api_endpoint,
        api_method=api_method,
        request_params=request_params_json,
        response_status=response_status,
        started_at=started_at or datetime.utcnow(),
        completed_at=completed_at or datetime.utcnow(),
        duration_ms=duration_ms,
        response_time_ms=response_time_ms,
        ip_address=ip_address,
        country=country,
        city=city,
        user_agent=user_agent[:500] if user_agent else None,  # 限制长度
        device_type=device_type,
        browser=browser,
        os=os,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=final_total_tokens,
        token_used=final_total_tokens,  # 兼容旧字段
        error_message=error_message[:1000] if error_message else None,  # 限制长度
        task_id=task_id,
        project_id=project_id,
        referer=referer[:500] if referer else None,  # 限制长度
        session_duration=session_duration,
    )
    db.add(usage_record)
    
    # 如果是登录用户，更新用户统计
    if user:
        user.total_usage_count = (user.total_usage_count or 0) + 1
        user.total_token_used = (user.total_token_used or 0) + final_total_tokens
        # 扣除免费次数（如果还有）
        if user.free_usage_count and user.free_usage_count > 0:
            user.free_usage_count -= 1
    
    db.commit()
    db.refresh(usage_record)
    
    logger.info(
        f"记录详细使用: user_id={user.id if user else None}, "
        f"session_id={session_id}, type={usage_type}, "
        f"endpoint={api_endpoint}, tokens={final_total_tokens}"
    )
    
    return usage_record
