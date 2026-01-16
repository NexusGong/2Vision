"""
支付API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import uuid
from app.database import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.models.payment import Payment
from app.services.usage_manager import add_usage_count, add_token_balance
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payment", tags=["支付"])

class PaymentCreateRequest(BaseModel):
    """创建支付订单请求"""
    payment_type: str  # times 或 tokens
    quantity: int  # 购买数量
    payment_method: str = "simulate"  # 支付方式

class PaymentOrderResponse(BaseModel):
    """支付订单响应"""
    order_id: int
    transaction_id: str
    payment_type: str
    amount: float
    quantity: int
    status: str
    created_at: str

class PaymentSimulateRequest(BaseModel):
    """模拟支付请求"""
    transaction_id: str

# 价格配置（模拟）
PRICE_CONFIG = {
    "times": {
        10: 9.9,   # 10次 9.9元
        50: 39.9,  # 50次 39.9元
        100: 69.9, # 100次 69.9元
    },
    "tokens": {
        10000: 9.9,    # 10000 tokens 9.9元
        50000: 39.9,   # 50000 tokens 39.9元
        100000: 69.9, # 100000 tokens 69.9元
    }
}

def calculate_price(payment_type: str, quantity: int) -> float:
    """计算价格"""
    if payment_type == "times":
        # 按次数计费
        if quantity <= 10:
            return PRICE_CONFIG["times"].get(10, 9.9)
        elif quantity <= 50:
            return PRICE_CONFIG["times"].get(50, 39.9)
        else:
            return PRICE_CONFIG["times"].get(100, 69.9)
    elif payment_type == "tokens":
        # 按token计费
        if quantity <= 10000:
            return PRICE_CONFIG["tokens"].get(10000, 9.9)
        elif quantity <= 50000:
            return PRICE_CONFIG["tokens"].get(50000, 39.9)
        else:
            return PRICE_CONFIG["tokens"].get(100000, 69.9)
    else:
        raise ValueError("不支持的支付类型")

@router.post("/create", response_model=PaymentOrderResponse)
async def create_payment_order(
    request: PaymentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建支付订单"""
    if request.payment_type not in ["times", "tokens"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="支付类型必须是 times 或 tokens"
        )
    
    if request.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="购买数量必须大于0"
        )
    
    # 计算价格
    amount = calculate_price(request.payment_type, request.quantity)
    
    # 生成交易ID
    transaction_id = f"TXN_{uuid.uuid4().hex[:16].upper()}"
    
    # 创建支付记录
    payment = Payment(
        user_id=current_user.id,
        payment_type=request.payment_type,
        amount=amount,
        quantity=request.quantity,
        status="pending",
        payment_method=request.payment_method,
        transaction_id=transaction_id
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    
    logger.info(f"创建支付订单: user_id={current_user.id}, transaction_id={transaction_id}, amount={amount}")
    
    return PaymentOrderResponse(
        order_id=payment.id,
        transaction_id=payment.transaction_id,
        payment_type=payment.payment_type,
        amount=payment.amount,
        quantity=payment.quantity,
        status=payment.status,
        created_at=payment.created_at.isoformat()
    )

@router.post("/simulate")
async def simulate_payment(
    request: PaymentSimulateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    模拟支付完成
    实际生产环境应该由支付平台回调
    """
    # 查找支付记录
    payment = db.query(Payment).filter(
        Payment.transaction_id == request.transaction_id,
        Payment.user_id == current_user.id
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="支付订单不存在"
        )
    
    if payment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"订单状态为 {payment.status}，无法完成支付"
        )
    
    # 更新支付状态
    payment.status = "completed"
    payment.completed_at = datetime.utcnow()
    
    # 增加用户的使用次数或token
    if payment.payment_type == "times":
        add_usage_count(db, current_user, payment.quantity)
    elif payment.payment_type == "tokens":
        add_token_balance(db, current_user, payment.quantity)
    
    db.commit()
    db.refresh(payment)
    
    logger.info(f"支付完成: user_id={current_user.id}, transaction_id={request.transaction_id}")
    
    return {
        "status": "success",
        "message": "支付成功",
        "payment": PaymentOrderResponse(
            order_id=payment.id,
            transaction_id=payment.transaction_id,
            payment_type=payment.payment_type,
            amount=payment.amount,
            quantity=payment.quantity,
            status=payment.status,
            created_at=payment.created_at.isoformat()
        )
    }

@router.get("/orders")
async def get_payment_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = 1,
    page_size: int = 20
):
    """获取支付订单列表"""
    offset = (page - 1) * page_size
    
    payments = db.query(Payment).filter(
        Payment.user_id == current_user.id
    ).order_by(Payment.created_at.desc()).offset(offset).limit(page_size).all()
    
    total = db.query(Payment).filter(
        Payment.user_id == current_user.id
    ).count()
    
    return {
        "status": "success",
        "data": [
            PaymentOrderResponse(
                order_id=p.id,
                transaction_id=p.transaction_id,
                payment_type=p.payment_type,
                amount=p.amount,
                quantity=p.quantity,
                status=p.status,
                created_at=p.created_at.isoformat()
            ) for p in payments
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }

@router.post("/callback")
async def payment_callback(
    transaction_id: str,
    status: str,
    db: Session = Depends(get_db)
):
    """
    支付回调接口（模拟）
    实际生产环境应该验证签名等
    """
    payment = db.query(Payment).filter(
        Payment.transaction_id == transaction_id
    ).first()
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="支付订单不存在"
        )
    
    if payment.status != "pending":
        return {"status": "success", "message": "订单已处理"}
    
    # 更新支付状态
    if status == "success":
        payment.status = "completed"
        payment.completed_at = datetime.utcnow()
        
        # 增加用户的使用次数或token
        user = db.query(User).filter(User.id == payment.user_id).first()
        if user:
            if payment.payment_type == "times":
                add_usage_count(db, user, payment.quantity)
            elif payment.payment_type == "tokens":
                add_token_balance(db, user, payment.quantity)
    else:
        payment.status = "failed"
    
    db.commit()
    
    return {"status": "success", "message": "回调处理成功"}
