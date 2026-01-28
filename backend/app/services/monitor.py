"""
API监控服务
用于监控API调用错误、Cookie状态等，并发送告警邮件
"""
import logging
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from collections import defaultdict
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config
from app.services.email_notifier import email_notifier

logger = logging.getLogger(__name__)


class AlertMonitor:
    """告警监控器"""
    
    def __init__(self):
        self.throttle_hours = config.ALERT_THROTTLE_HOURS
        # 记录最近发送的告警：{alert_key: last_sent_time}
        self._alert_history: Dict[str, float] = {}
        # 记录错误计数：{alert_key: count}
        self._error_counts: Dict[str, int] = defaultdict(int)
    
    def check_and_alert(
        self,
        alert_type: str,
        title: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        severity: str = "WARNING",
        alert_key: Optional[str] = None
    ) -> bool:
        """
        检查并发送告警（带限流）
        
        Args:
            alert_type: 告警类型（API_ERROR, COOKIE_EXPIRED等）
            title: 告警标题
            message: 告警消息
            details: 详细信息
            severity: 严重程度
            alert_key: 告警唯一标识（用于限流），如果不提供则使用alert_type
        
        Returns:
            是否发送了告警邮件
        """
        # 生成告警唯一标识
        if alert_key is None:
            alert_key = alert_type
        
        # 检查是否需要限流
        if self._should_throttle(alert_key):
            self._error_counts[alert_key] += 1
            logger.debug(f"告警限流中: {alert_key} (已累计 {self._error_counts[alert_key]} 次错误)")
            return False
        
        # 发送告警
        try:
            # 如果有累计错误，添加到消息中
            error_count = self._error_counts.get(alert_key, 0)
            if error_count > 0:
                message += f"\n\n注意：此问题在过去 {self.throttle_hours} 小时内已累计发生 {error_count + 1} 次。"
                self._error_counts[alert_key] = 0  # 重置计数
            
            success = email_notifier.send_alert_email(
                alert_type=alert_type,
                title=title,
                message=message,
                details=details,
                severity=severity
            )
            
            if success:
                # 记录发送时间
                self._alert_history[alert_key] = time.time()
                logger.info(f"告警邮件已发送: {alert_type} - {title}")
                return True
            else:
                logger.warning(f"告警邮件发送失败: {alert_type} - {title}")
                return False
                
        except Exception as e:
            logger.error(f"发送告警时发生错误: {str(e)}", exc_info=True)
            return False
    
    def _should_throttle(self, alert_key: str) -> bool:
        """
        检查是否应该限流（同一告警在限流时间内不重复发送）
        
        Args:
            alert_key: 告警唯一标识
        
        Returns:
            True表示应该限流（不发送），False表示可以发送
        """
        if alert_key not in self._alert_history:
            return False
        
        last_sent_time = self._alert_history[alert_key]
        elapsed_hours = (time.time() - last_sent_time) / 3600
        
        return elapsed_hours < self.throttle_hours
    
    def record_api_error(
        self,
        api_name: str,
        endpoint: str,
        error_message: str,
        error_code: Optional[str] = None,
        additional_details: Optional[Dict[str, Any]] = None
    ):
        """
        记录API错误并发送告警
        
        Args:
            api_name: API名称（如：火山引擎、短信服务等）
            endpoint: API端点
            error_message: 错误消息
            error_code: 错误代码
            additional_details: 额外详细信息
        """
        # 确定告警类型
        if "火山引擎" in api_name or "ark" in api_name.lower():
            if "image" in endpoint.lower() or "图像" in endpoint.lower():
                alert_type = "IMAGE_ERROR"
            elif "video" in endpoint.lower() or "视频" in endpoint.lower():
                alert_type = "VIDEO_ERROR"
            elif "chat" in endpoint.lower() or "text" in endpoint.lower() or "文本" in endpoint.lower():
                alert_type = "TEXT_ERROR"
            else:
                alert_type = "API_ERROR"
        elif "短信" in api_name or "sms" in api_name.lower():
            alert_type = "SMS_ERROR"
        else:
            alert_type = "API_ERROR"
        
        # 构建详细信息
        details = {
            "API名称": api_name,
            "API端点": endpoint,
            "错误消息": error_message
        }
        
        if error_code:
            details["错误代码"] = error_code
        
        if additional_details:
            details.update(additional_details)
        
        # 生成告警唯一标识（用于限流）
        alert_key = f"{alert_type}:{api_name}:{endpoint}"
        
        # 发送告警
        self.check_and_alert(
            alert_type=alert_type,
            title=f"{api_name} API调用失败",
            message=f"API调用失败: {endpoint}\n错误信息: {error_message}",
            details=details,
            severity="ERROR",
            alert_key=alert_key
        )
    
    def check_alipay_cookie(self, is_valid: bool, error_message: Optional[str] = None):
        """
        检查支付宝Cookie状态并发送告警
        
        Args:
            is_valid: Cookie是否有效
            error_message: 错误消息（如果Cookie无效）
        """
        if is_valid:
            return
        
        # Cookie无效，发送告警
        details = {
            "Cookie状态": "已过期或无效",
            "检测时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        if error_message:
            details["错误信息"] = error_message
        
        self.check_and_alert(
            alert_type="COOKIE_EXPIRED",
            title="支付宝Cookie已过期",
            message="支付宝自动验证功能的Cookie已过期或无效，需要更新Cookie配置。",
            details=details,
            severity="WARNING",
            alert_key="COOKIE_EXPIRED:ALIPAY"
        )
    
    def check_balance_low(self, service_name: str, current_balance: Optional[float] = None, threshold: Optional[float] = None):
        """
        检查余额是否不足并发送告警
        
        Args:
            service_name: 服务名称（如：火山引擎API、短信服务等）
            current_balance: 当前余额
            threshold: 余额阈值（低于此值发送告警）
        """
        if current_balance is None or threshold is None:
            return
        
        if current_balance >= threshold:
            return
        
        details = {
            "服务名称": service_name,
            "当前余额": f"{current_balance:.0f}" if isinstance(current_balance, float) and current_balance.is_integer() else str(current_balance),
            "余额阈值": f"{threshold:.0f}" if isinstance(threshold, float) and threshold.is_integer() else str(threshold),
            "余额单位": "条" if "短信" in service_name else "未知"
        }
        
        # 根据余额情况设置严重程度
        if current_balance <= 0:
            severity = "CRITICAL"
            message = f"{service_name} 余额已用完（当前余额: {current_balance}），请立即充值！"
        elif current_balance < threshold * 0.5:
            severity = "ERROR"
            message = f"{service_name} 余额严重不足（当前余额: {current_balance}，阈值: {threshold}），请尽快充值。"
        else:
            severity = "WARNING"
            message = f"{service_name} 余额不足（当前余额: {current_balance}，阈值: {threshold}），请及时充值。"
        
        self.check_and_alert(
            alert_type="BALANCE_LOW",
            title=f"{service_name} 余额不足",
            message=message,
            details=details,
            severity=severity,
            alert_key=f"BALANCE_LOW:{service_name}"
        )
    
    def cleanup_old_alerts(self, max_age_hours: int = 24):
        """
        清理过期的告警记录（防止内存泄漏）
        
        Args:
            max_age_hours: 最大保留时间（小时）
        """
        current_time = time.time()
        expired_keys = [
            key for key, last_sent_time in self._alert_history.items()
            if (current_time - last_sent_time) > (max_age_hours * 3600)
        ]
        
        for key in expired_keys:
            del self._alert_history[key]
            if key in self._error_counts:
                del self._error_counts[key]
        
        if expired_keys:
            logger.debug(f"清理了 {len(expired_keys)} 条过期告警记录")


# 全局监控器实例
alert_monitor = AlertMonitor()
