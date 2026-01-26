"""
支付轮询服务
后台自动轮询待支付订单，查询支付宝收款记录并自动确认支付
"""
import asyncio
import logging
import threading
from datetime import datetime, timedelta
from typing import Dict, Set
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.payment import Payment
from app.models.user import User
from app.services.alipay_verifier import alipay_verifier
from app.services.usage_manager import add_token_balance
from config import config

logger = logging.getLogger(__name__)


class PaymentPoller:
    """支付轮询器（单例）"""
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.is_running = False
        self.polling_tasks: Dict[str, asyncio.Task] = {}
        self.polling_interval = config.ALIPAY_POLLING_INTERVAL
        self.polling_timeout = config.ALIPAY_POLLING_TIMEOUT
    
    def start_polling(self, transaction_id: str, amount: float, created_at: datetime):
        """
        开始轮询指定订单
        
        Args:
            transaction_id: 交易ID
            amount: 订单金额
            created_at: 订单创建时间
        """
        if transaction_id in self.polling_tasks:
            logger.warning(f"订单 {transaction_id} 已在轮询中")
            return
        
        # 创建异步任务
        task = asyncio.create_task(
            self._poll_payment(transaction_id, amount, created_at)
        )
        self.polling_tasks[transaction_id] = task
        logger.info(f"开始轮询订单: {transaction_id}, 金额={amount}")
    
    def stop_polling(self, transaction_id: str):
        """停止轮询指定订单"""
        if transaction_id in self.polling_tasks:
            task = self.polling_tasks[transaction_id]
            task.cancel()
            del self.polling_tasks[transaction_id]
            logger.info(f"停止轮询订单: {transaction_id}")
    
    async def _poll_payment(
        self,
        transaction_id: str,
        amount: float,
        created_at: datetime
    ):
        """
        轮询支付状态
        
        Args:
            transaction_id: 交易ID
            amount: 订单金额
            created_at: 订单创建时间
        """
        start_time = datetime.now()
        poll_count = 0
        
        try:
            while True:
                # 检查是否超时
                elapsed = (datetime.now() - start_time).total_seconds()
                if elapsed > self.polling_timeout:
                    logger.warning(
                        f"订单 {transaction_id} 轮询超时 ({self.polling_timeout}秒)，停止轮询"
                    )
                    break
                
                # 检查订单状态（可能已被手动确认）
                db = next(get_db())
                try:
                    payment = db.query(Payment).filter(
                        Payment.transaction_id == transaction_id
                    ).first()
                    
                    if not payment:
                        logger.warning(f"订单 {transaction_id} 不存在，停止轮询")
                        break
                    
                    if payment.status != "pending":
                        logger.info(
                            f"订单 {transaction_id} 状态已变为 {payment.status}，停止轮询"
                        )
                        break
                    
                    # 查询支付宝订单
                    poll_count += 1
                    logger.debug(
                        f"第{poll_count}次查询订单 {transaction_id} "
                        f"(已轮询 {elapsed:.0f}秒)"
                    )
                    
                    try:
                        matching_order = alipay_verifier.find_matching_order(
                            amount, transaction_id, created_at
                        )
                    except Exception as e:
                        logger.error(
                            f"查询支付宝订单时发生异常: {str(e)}, "
                            f"订单={transaction_id}"
                        )
                        # 检查是否是cookie过期
                        if "cookie" in str(e).lower() or "auth" in str(e).lower():
                            logger.warning(
                                f"订单 {transaction_id} 查询失败，可能是Cookie已过期，"
                                f"请检查ALIPAY_COOKIE配置"
                            )
                        # 继续轮询，不中断
                        matching_order = None
                    
                    if matching_order:
                        # 找到匹配的订单，确认支付
                        match_info = (
                            f"交易号={matching_order.get('trade_no', 'N/A')}, "
                            f"金额={matching_order.get('amount', 'N/A')}, "
                            f"匹配度={matching_order.get('match_score', 1)}"
                        )
                        if matching_order.get('memo_match'):
                            match_info += ", 备注匹配=是"
                        
                        logger.info(
                            f"订单 {transaction_id} 找到匹配的支付宝订单: {match_info}"
                        )
                        
                        # 更新支付状态
                        payment.status = "completed"
                        payment.completed_at = datetime.utcnow()
                        
                        # 增加用户的token余额
                        user = db.query(User).filter(User.id == payment.user_id).first()
                        if user:
                            add_token_balance(db, user, payment.quantity)
                            logger.info(
                                f"订单 {transaction_id} 支付确认成功，"
                                f"用户 {user.id} ({user.email or user.username}) "
                                f"获得 {payment.quantity} tokens"
                            )
                        else:
                            logger.error(f"订单 {transaction_id} 的用户不存在")
                        
                        db.commit()
                        break
                    
                except Exception as e:
                    logger.error(
                        f"轮询订单 {transaction_id} 时发生错误: {str(e)}",
                        exc_info=True
                    )
                    try:
                        db.rollback()
                    except:
                        pass
                finally:
                    try:
                        db.close()
                    except:
                        pass
                
                # 等待指定间隔后再次查询
                await asyncio.sleep(self.polling_interval)
        
        except asyncio.CancelledError:
            logger.info(f"订单 {transaction_id} 的轮询任务已取消")
        except Exception as e:
            logger.error(
                f"订单 {transaction_id} 轮询任务异常: {str(e)}",
                exc_info=True
            )
        finally:
            # 清理任务
            if transaction_id in self.polling_tasks:
                del self.polling_tasks[transaction_id]
                logger.debug(f"已清理订单 {transaction_id} 的轮询任务")
    
    def get_active_polling_count(self) -> int:
        """获取当前正在轮询的订单数量"""
        return len(self.polling_tasks)


# 全局轮询器实例
payment_poller = PaymentPoller()
