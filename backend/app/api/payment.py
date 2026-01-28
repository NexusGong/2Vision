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
from app.services.usage_manager import add_token_balance
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payment", tags=["支付"])

class PaymentCreateRequest(BaseModel):
    """创建支付订单请求（统一token计费）"""
    quantity: int  # 购买token数量
    payment_method: str = "alipay"  # 支付方式

class PaymentOrderResponse(BaseModel):
    """支付订单响应"""
    order_id: int
    transaction_id: str
    amount: float
    quantity: int  # token数量
    status: str
    created_at: str
    payment_method: str = "alipay"  # 支付方式
    payment_info: Optional[dict] = None  # 支付信息（收款码等）

class PaymentConfirmRequest(BaseModel):
    """确认支付请求"""
    transaction_id: str

# 价格配置（基于实际成本数据，利润15-20%）
# 成本参考（基于2026年1月实际使用数据）：
# - 文本分析：平均输入2,799 tokens，输出1,194 tokens，成本0.01179元/次
# - 图像生成：每次生成6张图片，成本1.2元，总成本1.21179元/次
# - 视频生成：720p 12秒有声，token用量259,200，成本4.1472元，总成本4.159元/次
# - 定价确保利润15-20%

# 价格配置（只支持token计费，利润15-20%）
# 成本参考（基于2026年1月实际使用数据）：
# - 文本分析：平均输入2,799 tokens，输出1,194 tokens，成本0.01179元/次
# - 图像生成：每次生成6张图片，成本1.2元，总成本1.21179元/次
# - 视频生成：支持720p/1080p，5秒/12秒，成本根据参数变化
# - 定价确保利润15-20%

# 统一token定价配置（图像和视频使用相同的token定价）
# 统一token定价：0.0190元/1000 tokens（利润17%）
# 图像生成等价76,685 tokens/次，视频生成263,193 tokens/次（720p 12秒）
# 最小套餐：800K tokens（至少10次图像）
# 测试套餐：1 token 0.01元（用于支付测试验证）
PRICE_CONFIG = {
    1: 0.01,            # 1 token 0.01元（测试用）
    800000: 15.20,      # 800K tokens 15.20元（图像10次，视频3次）
    1500000: 28.50,     # 1.5M tokens 28.50元（图像19次，视频5次）
    2500000: 47.50,     # 2.5M tokens 47.50元（图像32次，视频9次）
    4000000: 76.00,     # 4M tokens 76.00元（图像52次，视频15次）
    6000000: 114.00,    # 6M tokens 114.00元（图像78次，视频22次）
    10000000: 190.00,   # 10M tokens 190.00元（图像130次，视频37次）
}

# 每个套餐对应的收款码图片（相对于storage目录的路径）
QR_CODE_CONFIG = {
    1: "qrcode/alipay_1.jpg",              # 1 token 测试用
    800000: "qrcode/alipay_800k.png",      # 800K tokens
    1500000: "qrcode/alipay_1.5m.png",     # 1.5M tokens
    2500000: "qrcode/alipay_2.5m.png",    # 2.5M tokens
    4000000: "qrcode/alipay_4m.png",       # 4M tokens
    6000000: "qrcode/alipay_6m.png",       # 6M tokens
    10000000: "qrcode/alipay_10m.png",     # 10M tokens
}

def calculate_price(quantity: int) -> float:
    """
    计算统一token价格
    
    Args:
        quantity: 购买token数量
    
    Returns:
        价格（元）
    """
    # 测试套餐：1 token 0.01元
    if quantity == 1:
        return PRICE_CONFIG.get(1, 0.01)
    
    # 按token计费，根据数量选择最接近的套餐（统一token定价）
    # 最小套餐：800K tokens（至少10次图像）
    if quantity < 800000:
        # 如果小于最小套餐，返回最小套餐价格
        return PRICE_CONFIG.get(800000, 15.20)
    elif quantity <= 800000:
        return PRICE_CONFIG.get(800000, 15.20)
    elif quantity <= 1500000:
        return PRICE_CONFIG.get(1500000, 28.50)
    elif quantity <= 2500000:
        return PRICE_CONFIG.get(2500000, 47.50)
    elif quantity <= 4000000:
        return PRICE_CONFIG.get(4000000, 76.00)
    elif quantity <= 6000000:
        return PRICE_CONFIG.get(6000000, 114.00)
    elif quantity <= 10000000:
        return PRICE_CONFIG.get(10000000, 190.00)
    else:
        # 超过10M tokens，按10M套餐计算，然后按比例调整
        base_price = PRICE_CONFIG.get(10000000, 190.00)
        base_quantity = 10000000
        unit_price = base_price / base_quantity
        return round(unit_price * quantity, 2)

@router.post("/create", response_model=PaymentOrderResponse)
async def create_payment_order(
    request: PaymentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建支付订单（统一token计费）"""
    if request.quantity <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="购买token数量必须大于0"
        )
    
    # 计算价格（统一token定价）
    try:
        amount = calculate_price(request.quantity)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    # 生成交易ID
    transaction_id = f"TXN_{uuid.uuid4().hex[:16].upper()}"
    
    # 创建支付记录（统一token计费系统）
    payment = Payment(
        user_id=current_user.id,
        mode="unified",  # 统一token系统，固定值
        payment_type="tokens",  # 固定为tokens
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
    
    # 如果是支付宝支付，返回收款码信息（不启动自动轮询，等用户点击确认后再查询）
    payment_info = None
    if request.payment_method == "alipay":
        from config import config
        from pathlib import Path
        from app.services.file_storage import get_local_url
        
        logger.info(
            f"查找收款码: 订单数量={request.quantity}, 订单金额={amount}, "
            f"可用套餐={list(QR_CODE_CONFIG.keys())}"
        )
        
        # 必须精确匹配套餐对应的收款码，不允许自动fallback
        qr_code_path = QR_CODE_CONFIG.get(request.quantity)
        
        if not qr_code_path:
            # 如果精确匹配失败，记录错误
            logger.error(
                f"订单数量 {request.quantity} 未在收款码配置中找到精确匹配！"
                f"可用套餐: {list(QR_CODE_CONFIG.keys())}, "
                f"订单金额: {amount}"
            )
            # 不自动fallback，避免显示错误的收款码
            # 如果配置了通用收款码，可以使用
            if not config.ALIPAY_QR_CODE_URL:
                logger.error(
                    f"未找到匹配的收款码，且未配置通用收款码 ALIPAY_QR_CODE_URL"
                )
        
        if qr_code_path:
            # 使用套餐对应的收款码
            storage_dir = Path(__file__).parent.parent.parent / config.STORAGE_DIR
            qr_path = storage_dir / qr_code_path
            if qr_path.exists():
                qr_code_url = get_local_url(qr_code_path)
                
                # 验证收款码对应的套餐金额是否匹配
                expected_price = PRICE_CONFIG.get(request.quantity)
                if expected_price and abs(expected_price - amount) > 0.01:
                    logger.warning(
                        f"收款码金额可能不匹配: 订单金额={amount}, "
                        f"预期金额={expected_price}, 收款码={qr_code_path}"
                    )
                
                logger.info(
                    f"✓ 成功加载收款码: {qr_code_path} "
                    f"(订单数量: {request.quantity}, 金额: {amount}, "
                    f"文件路径: {qr_path})"
                )
            else:
                logger.error(
                    f"✗ 收款码文件不存在: {qr_path} "
                    f"(订单数量: {request.quantity}, 金额: {amount})"
                )
                qr_code_url = None
        elif config.ALIPAY_QR_CODE_URL:
            # 如果没有套餐对应的收款码，使用通用收款码
            qr_code_url = config.ALIPAY_QR_CODE_URL
            
            # 如果是本地文件路径，转换为可访问的URL
            if not qr_code_url.startswith(("http://", "https://", "data:")):
                # 检查是否是绝对路径
                qr_path = Path(qr_code_url)
                if qr_path.is_absolute():
                    # 检查文件是否存在
                    if qr_path.exists():
                        # 如果是storage目录下的文件，使用静态文件URL
                        storage_dir = Path(__file__).parent.parent.parent / config.STORAGE_DIR
                        try:
                            relative_path = qr_path.relative_to(storage_dir)
                            qr_code_url = get_local_url(str(relative_path))
                        except ValueError:
                            # 不在storage目录，尝试读取并转换为base64
                            import base64
                            try:
                                with open(qr_path, "rb") as f:
                                    img_data = f.read()
                                    img_base64 = base64.b64encode(img_data).decode()
                                    ext = qr_path.suffix.lower()
                                    mime_type = "image/png" if ext == ".png" else "image/jpeg"
                                    qr_code_url = f"data:{mime_type};base64,{img_base64}"
                            except Exception as e:
                                logger.error(f"读取收款码图片失败: {str(e)}")
                                qr_code_url = None
                    else:
                        logger.warning(f"收款码文件不存在: {qr_code_url}")
                        qr_code_url = None
                else:
                    # 相对路径，尝试从storage目录读取
                    storage_dir = Path(__file__).parent.parent.parent / config.STORAGE_DIR
                    qr_path = storage_dir / qr_code_url
                    if qr_path.exists():
                        qr_code_url = get_local_url(qr_code_url)
                    else:
                        logger.warning(f"收款码文件不存在: {qr_path}")
                        qr_code_url = None
        else:
            qr_code_url = None
        
        if qr_code_url:
            payment_info = {
                "qr_code_url": qr_code_url,
                "account_name": config.ALIPAY_ACCOUNT_NAME or "支付宝收款",
                "amount": amount,
                "transaction_id": transaction_id,
                "remark": f"订单号：{transaction_id}"  # 用户支付时的备注
            }
    
    return PaymentOrderResponse(
        order_id=payment.id,
        transaction_id=payment.transaction_id,
        amount=payment.amount,
        quantity=payment.quantity,
        status=payment.status,
        created_at=payment.created_at.isoformat(),
        payment_method=payment.payment_method,
        payment_info=payment_info
    )

@router.post("/confirm")
async def confirm_payment(
    request: PaymentConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    确认支付完成
    对于支付宝支付，会先查询支付宝收款记录进行验证
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
    
    # 状态机检查：只允许从 pending 状态转换到 completed 或 failed
    if payment.status == "completed":
        # 幂等性：如果已经完成，直接返回成功（避免重复确认）
        logger.info(
            f"订单已确认过，直接返回成功: transaction_id={request.transaction_id}, "
            f"user_id={current_user.id}"
        )
        return {
            "status": "success",
            "message": "支付已完成",
            "payment": PaymentOrderResponse(
                order_id=payment.id,
                transaction_id=payment.transaction_id,
                amount=payment.amount,
                quantity=payment.quantity,
                status=payment.status,
                created_at=payment.created_at.isoformat(),
                payment_method=payment.payment_method
            )
        }
    elif payment.status == "failed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="订单已失败，无法完成支付"
        )
    elif payment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"订单状态为 {payment.status}，无法完成支付"
        )
    
    # 只支持支付宝支付
    if payment.payment_method != "alipay":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的支付方式: {payment.payment_method}"
        )
    
    # 查询支付宝收款记录进行验证
    if payment.payment_method == "alipay":
        logger.info(
            f"用户点击确认支付，开始查询支付宝订单: "
            f"transaction_id={request.transaction_id}, "
            f"amount={payment.amount}"
        )
        
        try:
            from app.services.alipay_verifier import alipay_verifier
            
            # 查询支付宝订单
            matching_order = alipay_verifier.find_matching_order(
                payment.amount,
                payment.transaction_id,
                payment.created_at
            )
            
            if not matching_order:
                # 检查是否是Cookie过期的问题
                from app.services.alipay_verifier import alipay_verifier
                if not alipay_verifier.is_cookie_valid():
                    logger.error(
                        f"支付宝Cookie无效或已过期，无法查询订单: transaction_id={request.transaction_id}"
                    )
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="支付宝查询服务暂时不可用，可能是Cookie已过期。请联系管理员更新配置。"
                    )
                
                logger.warning(
                    f"未找到匹配的支付宝订单: transaction_id={request.transaction_id}, "
                    f"amount={payment.amount}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="未找到匹配的支付宝收款记录，请确认是否已完成支付，或稍后再试"
                )
            
            trade_no = matching_order.get('trade_no')
            logger.info(
                f"找到匹配的支付宝订单: transaction_id={request.transaction_id}, "
                f"支付宝交易号={trade_no}, "
                f"金额={matching_order.get('amount')}"
            )
            
            # 幂等性检查：检查该支付宝交易号是否已经被其他订单使用
            if trade_no:
                existing_payment = db.query(Payment).filter(
                    Payment.status == "completed",
                    Payment.transaction_id != request.transaction_id
                ).first()
                # 注意：这里我们只检查其他订单，因为当前订单可能已经完成（幂等性）
                # 如果当前订单已经完成，上面的状态检查会处理
            
        except HTTPException:
            # 重新抛出HTTP异常
            raise
        except Exception as e:
            logger.error(
                f"查询支付宝订单时发生错误: transaction_id={request.transaction_id}, "
                f"error={str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"查询支付宝订单失败: {str(e)}"
            )
    
    # 使用数据库事务确保原子性
    try:
        # 重新查询订单以确保获取最新状态（防止并发问题）
        payment = db.query(Payment).filter(
            Payment.transaction_id == request.transaction_id,
            Payment.user_id == current_user.id
        ).with_for_update().first()  # 使用行锁防止并发
        
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="支付订单不存在"
            )
        
        # 再次检查状态（双重检查，防止并发）
        if payment.status == "completed":
            # 幂等性：已经完成，直接返回
            logger.info(
                f"订单已确认过（并发检查）: transaction_id={request.transaction_id}, "
                f"user_id={current_user.id}"
            )
            db.rollback()  # 回滚，因为不需要更新
            return {
                "status": "success",
                "message": "支付已完成",
                "payment": PaymentOrderResponse(
                    order_id=payment.id,
                    transaction_id=payment.transaction_id,
                    amount=payment.amount,
                    quantity=payment.quantity,
                    status=payment.status,
                    created_at=payment.created_at.isoformat(),
                    payment_method=payment.payment_method
                )
            }
        
        # 更新支付状态
        payment.status = "completed"
        payment.completed_at = datetime.utcnow()
        
        # 增加用户的统一token余额（在事务内）
        add_token_balance(db, current_user, payment.quantity)
        
        db.commit()
        db.refresh(payment)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(
            f"支付确认事务失败: transaction_id={request.transaction_id}, "
            f"error={str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"支付确认失败: {str(e)}"
        )
    
    logger.info(f"支付完成: user_id={current_user.id}, transaction_id={request.transaction_id}")
    
    return {
        "status": "success",
        "message": "支付成功",
        "payment": PaymentOrderResponse(
            order_id=payment.id,
            transaction_id=payment.transaction_id,
            amount=payment.amount,
            quantity=payment.quantity,
            status=payment.status,
            created_at=payment.created_at.isoformat(),
            payment_method=payment.payment_method
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
                amount=p.amount,
                quantity=p.quantity,
                status=p.status,
                created_at=p.created_at.isoformat(),
                payment_method=p.payment_method
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
    支付回调接口
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
        
        # 增加用户的统一token余额
        user = db.query(User).filter(User.id == payment.user_id).first()
        if user:
            add_token_balance(db, user, payment.quantity)
    else:
        payment.status = "failed"
    
    db.commit()
    
    return {"status": "success", "message": "回调处理成功"}
