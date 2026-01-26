"""
支付记录模型
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Payment(Base):
    """支付记录模型"""
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    mode = Column(String(20), nullable=False)  # 模式（image/video）
    payment_type = Column(String(20), nullable=False)  # 支付类型（times/tokens）
    amount = Column(Float, nullable=False)  # 支付金额
    quantity = Column(Integer, nullable=False)  # 购买数量（次数或token）
    status = Column(String(20), default="pending")  # 支付状态（pending/completed/failed）
    payment_method = Column(String(20), default="simulate")  # 支付方式（simulate/alipay）
    transaction_id = Column(String(100), nullable=True, unique=True, index=True)  # 交易ID
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime, nullable=True)  # 完成时间
    
    # 关联关系
    user = relationship("User", back_populates="payments")
