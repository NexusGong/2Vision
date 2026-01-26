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
    email = Column(String(100), unique=True, index=True, nullable=True)  # 改为可选，支持手机号注册
    phone = Column(String(20), unique=True, index=True, nullable=True)  # 手机号
    hashed_password = Column(String(255), nullable=True)  # 第三方登录用户可能没有密码
    password_set = Column(Boolean, default=False)  # 标记用户是否主动设置了密码（手机号注册用户需要主动设置）
    nickname = Column(String(50), nullable=True)  # 昵称
    avatar = Column(Text, nullable=True)  # Base64编码的头像
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)  # 是否为管理员
    is_vip = Column(Boolean, default=False)  # 是否为会员
    vip_expires_at = Column(DateTime, nullable=True)  # 会员到期时间
    total_usage_count = Column(Integer, default=0)  # 总使用次数
    total_token_used = Column(Integer, default=0)  # 总token消耗
    
    # 统一token计费系统
    free_tokens = Column(Integer, default=1250000)  # 统一免费token（注册用户默认1,250,000 tokens = 图像6次 + 视频3次）
    token_balance = Column(Integer, default=0)  # 统一付费token余额
    
    oauth_provider = Column(String(20), nullable=True)  # 第三方登录提供商（wechat/github/google）
    oauth_id = Column(String(100), nullable=True)  # 第三方登录ID
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    usage_records = relationship("UsageRecord", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")
    activity_logs = relationship("UserActivityLog", back_populates="user", cascade="all, delete-orphan")

