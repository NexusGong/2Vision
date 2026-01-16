"""
用户模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    """用户模型"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # 第三方登录用户可能没有密码
    nickname = Column(String(50), nullable=True)  # 昵称
    avatar = Column(Text, nullable=True)  # Base64编码的头像
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # 是否为管理员
    is_vip = Column(Boolean, default=False)  # 是否为会员
    vip_expires_at = Column(DateTime, nullable=True)  # 会员到期时间
    free_usage_count = Column(Integer, default=20)  # 剩余免费次数（登录用户默认20次）
    total_usage_count = Column(Integer, default=0)  # 总使用次数
    total_token_used = Column(Integer, default=0)  # 总token消耗
    oauth_provider = Column(String(20), nullable=True)  # 第三方登录提供商（wechat/github/google）
    oauth_id = Column(String(100), nullable=True)  # 第三方登录ID
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    usage_records = relationship("UsageRecord", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("UserActivityLog", back_populates="user", cascade="all, delete-orphan")

