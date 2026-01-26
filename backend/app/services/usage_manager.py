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

# Token限制配置（统一token系统）
# 图像生成：76,685 tokens/次
IMAGE_TOKENS_PER_GENERATION = 76685
# 视频生成：263,193 tokens/次（720p 12秒 16:9）
VIDEO_TOKENS_720P_12S = 263193

# 非注册用户免费token额度（统一）
# 494,000 tokens（保证3次图像 + 1次视频）
ANONYMOUS_FREE_TOKENS = 494000

# 注册用户免费token额度（统一，存储在数据库中，这里作为默认值）
# 1,250,000 tokens（保证6次图像 + 3次视频）
REGISTERED_FREE_TOKENS = 1250000

def calculate_video_tokens(duration: int, resolution: str, aspect_ratio: str, fps: int = 24) -> int:
    """
    计算视频生成所需的token数量
    
    Args:
        duration: 视频时长（秒）
        resolution: 分辨率（720p 或 1080p）
        aspect_ratio: 宽高比（16:9, 9:16, 1:1）
        fps: 帧率（默认24）
    
    Returns:
        token数量
    """
    # 分辨率对应的宽高
    if resolution == "720p":
        base_width, base_height = 1280, 720
    elif resolution == "1080p":
        base_width, base_height = 1920, 1080
    else:
        base_width, base_height = 1280, 720  # 默认720p
    
    # 根据比例调整宽高
    if aspect_ratio == "9:16":
        # 竖屏：交换宽高
        width, height = base_height, base_width
    elif aspect_ratio == "1:1":
        # 方形：取较小的边
        min_size = min(base_width, base_height)
        width, height = min_size, min_size
    else:
        # 默认16:9
        width, height = base_width, base_height
    
    # token计算公式：token用量 = (宽 × 高 × 帧率 × 时长) / 1024
    tokens = int((width * height * fps * duration) / 1024)
    
    return tokens

def get_session_id_from_request(request) -> Optional[str]:
    """从请求中获取session_id（用于非登录用户）"""
    # 这里可以从请求头或cookie中获取session_id
    # 暂时返回None，由调用方传入
    return None

def get_remaining_tokens(
    db: Session, 
    user: Optional[User] = None, 
    session_id: Optional[str] = None
) -> int:
    """
    获取剩余token余额（统一token系统，包含免费token和付费token）
    
    Args:
        db: 数据库会话
        user: 用户对象（登录用户）
        session_id: 会话ID（非登录用户）
    
    Returns:
        剩余token余额（免费token + 付费token余额）
    """
    if user:
        # 登录用户：返回统一免费token + 统一付费token余额
        free_tokens = user.free_tokens or 0
        paid_tokens = user.token_balance or 0
        return free_tokens + paid_tokens
    elif session_id:
        # 非登录用户：计算已使用的token（所有类型）
        used_tokens = db.query(UsageRecord).filter(
            UsageRecord.session_id == session_id
        ).with_entities(
            db.func.sum(UsageRecord.total_tokens).label('total')
        ).scalar() or 0
        
        # 非登录用户统一免费token额度
        free_tokens = ANONYMOUS_FREE_TOKENS
        
        return max(0, free_tokens - used_tokens)
    else:
        # 既没有用户也没有session_id，返回0
        return 0

def check_token_balance(
    db: Session, 
    user: Optional[User] = None, 
    session_id: Optional[str] = None,
    required_tokens: int = 0
) -> tuple[bool, str]:
    """
    检查统一token余额是否足够
    
    Args:
        db: 数据库会话
        user: 用户对象（登录用户）
        session_id: 会话ID（非登录用户）
        required_tokens: 需要的token数量
    
    Returns:
        (是否允许使用, 错误消息)
    """
    remaining = get_remaining_tokens(db, user, session_id)
    
    if remaining < required_tokens:
        if user:
            return False, f"您的Token余额不足（需要{required_tokens:,} tokens，当前余额{remaining:,} tokens），请充值后继续使用"
        else:
            return False, f"您的免费Token额度不足（需要{required_tokens:,} tokens，当前余额{remaining:,} tokens），请登录后继续使用（登录用户可获得更多免费Token）"
    
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
        token_used: 消耗的token数（兼容旧接口，内部使用total_tokens）
        user: 用户对象（登录用户）
        session_id: 会话ID（非登录用户）
    
    Returns:
        使用记录对象
    """
    usage_record = UsageRecord(
        user_id=user.id if user else None,
        session_id=session_id,
        usage_type=usage_type,
        total_tokens=token_used,  # 使用total_tokens
        token_used=token_used  # 兼容旧字段
    )
    db.add(usage_record)
    
    # 如果是登录用户，更新用户统计并扣除统一token（优先扣除免费token）
    if user:
        user.total_usage_count = (user.total_usage_count or 0) + 1
        user.total_token_used = (user.total_token_used or 0) + token_used
        
        # 优先扣除统一免费token，然后扣除统一付费token
        free_tokens = user.free_tokens or 0
        paid_tokens = user.token_balance or 0
        
        if free_tokens >= token_used:
            # 免费token足够
            user.free_tokens = free_tokens - token_used
        else:
            # 免费token不够，先用完免费token，再扣除付费token
            remaining = token_used - free_tokens
            user.free_tokens = 0
            user.token_balance = max(0, paid_tokens - remaining)
    
    db.commit()
    db.refresh(usage_record)
    
    logger.info(f"记录使用: user_id={user.id if user else None}, session_id={session_id}, type={usage_type}, tokens={token_used}")
    
    return usage_record


def add_token_balance(db: Session, user: User, tokens: int) -> bool:
    """
    增加用户的统一token余额（用于充值）
    
    Args:
        db: 数据库会话
        user: 用户对象
        tokens: 增加的token数
    
    Returns:
        是否成功
    """
    user.token_balance = (user.token_balance or 0) + tokens
    db.commit()
    logger.info(f"为用户 {user.id} 增加 {tokens} tokens（统一token）")
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
    
    # 计算token（优先使用total_tokens，否则使用token_used作为兼容）
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
        total_tokens=final_total_tokens,  # 优先使用此字段
        token_used=final_total_tokens,  # 兼容旧字段，保持同步
        error_message=error_message[:1000] if error_message else None,  # 限制长度
        task_id=task_id,
        project_id=project_id,
        referer=referer[:500] if referer else None,  # 限制长度
        session_duration=session_duration,
    )
    db.add(usage_record)
    
    # 如果是登录用户，更新用户统计并扣除token（优先扣除免费token）
    if user:
        user.total_usage_count = (user.total_usage_count or 0) + 1
        user.total_token_used = (user.total_token_used or 0) + final_total_tokens
        
        # 优先扣除统一免费token，然后扣除统一付费token
        free_tokens = user.free_tokens or 0
        paid_tokens = user.token_balance or 0
        
        if free_tokens >= final_total_tokens:
            # 免费token足够
            user.free_tokens = free_tokens - final_total_tokens
        else:
            # 免费token不够，先用完免费token，再扣除付费token
            remaining = final_total_tokens - free_tokens
            user.free_tokens = 0
            user.token_balance = max(0, paid_tokens - remaining)
    
    db.commit()
    db.refresh(usage_record)
    
    logger.info(
        f"记录详细使用: user_id={user.id if user else None}, "
        f"session_id={session_id}, type={usage_type}, "
        f"endpoint={api_endpoint}, tokens={final_total_tokens}"
    )
    
    return usage_record
