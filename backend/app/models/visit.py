"""
页面访问记录模型
记录进入网站但可能未产生使用的访问（用于区分“仅访问”与“有使用”用户）
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class PageVisit(Base):
    """页面访问记录"""
    __tablename__ = "page_visits"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), nullable=True, index=True)  # 前端会话ID，用于关联“仅访问未使用”
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # 若已登录则记录

    # 请求信息
    ip_address = Column(String(45), nullable=True, index=True)
    user_agent = Column(String(500), nullable=True)
    device_type = Column(String(20), nullable=True, index=True)  # mobile / desktop / tablet
    browser = Column(String(100), nullable=True)
    os = Column(String(100), nullable=True)

    # 地理位置
    country = Column(String(100), nullable=True, index=True)
    region = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    timezone = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", backref="page_visits")
