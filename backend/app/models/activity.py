"""
用户活动日志模型
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class UserActivityLog(Base):
    """用户活动日志模型"""
    __tablename__ = "user_activity_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 可为空，非登录用户
    session_id = Column(String(100), nullable=True, index=True)  # 会话ID
    
    # 活动信息
    activity_type = Column(String(50), nullable=True, default='unknown', index=True)  # 活动类型（login/logout/page_view/api_call/error等）
    activity_detail = Column(Text, nullable=True)  # 活动详情（JSON格式）
    
    # 请求信息
    ip_address = Column(String(45), nullable=True, index=True)  # IP地址
    user_agent = Column(String(500), nullable=True)  # 用户代理
    
    # 时间信息
    created_at = Column(DateTime, default=datetime.utcnow, index=True)  # 创建时间
    
    # 关联关系
    user = relationship("User", back_populates="activity_logs")
