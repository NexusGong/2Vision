"""
使用记录模型
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class UsageRecord(Base):
    """使用记录模型"""
    __tablename__ = "usage_records"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 可为空，非登录用户
    session_id = Column(String(100), nullable=True, index=True)  # 非登录用户的会话ID
    usage_type = Column(String(20), nullable=False, index=True)  # 使用类型（image/video/text）
    
    # API信息
    api_endpoint = Column(String(200), nullable=True, index=True)  # API端点路径
    api_method = Column(String(10), nullable=True)  # HTTP方法
    request_params = Column(Text, nullable=True)  # 请求参数（JSON格式）
    response_status = Column(Integer, nullable=True, index=True)  # 响应状态码
    
    # 时间信息
    started_at = Column(DateTime, nullable=True, index=True)  # 请求开始时间
    completed_at = Column(DateTime, nullable=True)  # 请求完成时间
    duration_ms = Column(Integer, nullable=True)  # 总耗时（毫秒）
    response_time_ms = Column(Integer, nullable=True)  # 响应时间（毫秒）
    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # 记录创建时间
    
    # 地理位置信息
    ip_address = Column(String(45), nullable=True, index=True)  # 客户端IP地址（支持IPv6）
    country = Column(String(100), nullable=True, index=True)  # 国家
    city = Column(String(100), nullable=True)  # 城市
    
    # 设备信息
    user_agent = Column(String(500), nullable=True)  # 浏览器/客户端信息
    device_type = Column(String(20), nullable=True, index=True)  # 设备类型（mobile/desktop/tablet）
    browser = Column(String(100), nullable=True)  # 浏览器类型
    os = Column(String(100), nullable=True)  # 操作系统
    
    # Token信息
    input_tokens = Column(Integer, default=0)  # 输入token数
    output_tokens = Column(Integer, default=0)  # 输出token数
    total_tokens = Column(Integer, default=0)  # 总token数（优先使用此字段）
    token_used = Column(Integer, default=0)  # 消耗的token数（已废弃，仅用于兼容旧数据，新代码应使用total_tokens）
    
    # 错误信息
    error_message = Column(Text, nullable=True)  # 错误信息
    
    # 关联信息
    task_id = Column(String(100), nullable=True, index=True)  # 关联的任务ID
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)  # 关联的项目ID
    
    # 其他信息
    referer = Column(String(500), nullable=True)  # 来源页面
    session_duration = Column(Integer, nullable=True)  # 会话持续时间（秒）
    
    # 关联关系
    user = relationship("User", back_populates="usage_records")
