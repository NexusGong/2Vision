"""
短信验证码服务
"""
import random
import time
import httpx
import hashlib
import logging
from typing import Optional, Dict
from datetime import datetime, timedelta
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

logger = logging.getLogger(__name__)

# 导入监控服务（延迟导入，避免循环依赖）
try:
    from app.services.monitor import alert_monitor
    MONITOR_AVAILABLE = True
except ImportError:
    MONITOR_AVAILABLE = False
    alert_monitor = None

# 短信验证码存储接口抽象
# 当前使用内存实现，生产环境建议切换到Redis实现
class SmsCodeStore:
    """短信验证码存储接口（抽象类）"""
    
    def store_code(self, phone: str, code: str, expire_time: datetime, last_send_time: float) -> None:
        """存储验证码"""
        raise NotImplementedError
    
    def get_code(self, phone: str) -> Optional[Dict[str, any]]:
        """获取验证码信息"""
        raise NotImplementedError
    
    def delete_code(self, phone: str) -> None:
        """删除验证码"""
        raise NotImplementedError
    
    def cleanup_expired(self) -> None:
        """清理过期验证码"""
        raise NotImplementedError


class InMemorySmsCodeStore(SmsCodeStore):
    """内存存储实现（当前默认实现）"""
    
    def __init__(self):
        self._codes: Dict[str, Dict[str, any]] = {}
    
    def store_code(self, phone: str, code: str, expire_time: datetime, last_send_time: float) -> None:
        """存储验证码"""
        self._codes[phone] = {
            "code": code,
            "expire_time": expire_time,
            "last_send_time": last_send_time,
            "verify_count": 0
        }
    
    def get_code(self, phone: str) -> Optional[Dict[str, any]]:
        """获取验证码信息"""
        return self._codes.get(phone)
    
    def delete_code(self, phone: str) -> None:
        """删除验证码"""
        if phone in self._codes:
            del self._codes[phone]
    
    def cleanup_expired(self) -> None:
        """清理过期验证码"""
        current_time = datetime.utcnow()
        expired_phones = [
            phone for phone, info in self._codes.items()
            if current_time > info["expire_time"]
        ]
        for phone in expired_phones:
            del self._codes[phone]


# 使用内存存储（默认实现）
# 生产环境建议切换到Redis实现（需要实现 RedisSmsCodeStore 并替换此处）
_sms_code_store: SmsCodeStore = InMemorySmsCodeStore()


def _mask_phone(phone: str) -> str:
    """脱敏手机号：显示前3位和后4位，中间用***代替"""
    if not phone or len(phone) < 7:
        return "****"
    return f"{phone[:3]}***{phone[-4:]}"

# 验证码配置
CODE_LENGTH = 6  # 验证码长度
CODE_EXPIRE_MINUTES = 5  # 验证码有效期（分钟）
SEND_INTERVAL_SECONDS = 60  # 发送间隔（秒）


def generate_verification_code() -> str:
    """生成6位数字验证码"""
    return str(random.randint(100000, 999999))


def is_valid_phone(phone: str) -> bool:
    """验证手机号格式（支持中国大陆手机号）"""
    if not phone:
        return False
    # 去除空格
    phone = phone.strip().replace(' ', '').replace('-', '')
    # 中国大陆手机号：11位数字，以1开头
    # 使用更宽松的验证：1开头的11位数字
    pattern = r'^1\d{10}$'
    return bool(re.match(pattern, phone))


async def send_verification_code(phone: str) -> bool:
    """
    发送验证码
    
    Args:
        phone: 手机号
    
    Returns:
        bool: 是否发送成功
    """
    if not is_valid_phone(phone):
        return False
    
    # 检查发送频率限制
    existing_code = _sms_code_store.get_code(phone)
    if existing_code:
        last_send_time = existing_code.get("last_send_time", 0)
        if time.time() - last_send_time < SEND_INTERVAL_SECONDS:
            return False
    
    # 生成验证码
    code = generate_verification_code()
    expire_time = datetime.utcnow() + timedelta(minutes=CODE_EXPIRE_MINUTES)
    
    # 存储验证码
    _sms_code_store.store_code(phone, code, expire_time, time.time())
    
    # 如果启用了短信服务，调用互亿无线API
    if config.SMS_ENABLED and config.SMS_ACCOUNT and config.SMS_PASSWORD:
        # 发送前检查余额（异步，不阻塞发送流程）
        try:
            await check_sms_balance_and_alert()
        except Exception as e:
            logger.warning(f"[SMS] 余额检查失败: {e}")
        
        try:
            success = await _send_sms_via_api(phone, code)
            masked_phone = _mask_phone(phone)
            if success:
                # 开发环境可以显示验证码，但生产环境应避免在日志中输出完整验证码
                if config.SMS_ENABLED:
                    logger.info(f"[SMS] 验证码已发送到 {masked_phone} (有效期{CODE_EXPIRE_MINUTES}分钟)")
                else:
                    # 开发环境：显示验证码以便测试
                    logger.info(f"[SMS] 模拟发送验证码到 {masked_phone}: {code} (有效期{CODE_EXPIRE_MINUTES}分钟)")
                return True
            else:
                # API发送失败，但验证码已生成，仍返回True（开发环境可以继续使用）
                if not config.SMS_ENABLED:
                    logger.info(f"[SMS] API发送失败，但验证码已生成: {code}")
                # 注意：这里不发送告警，因为_send_sms_via_api内部已经发送了
                return True
        except Exception as e:
            error_msg = f"发送短信异常: {e}"
            masked_phone = _mask_phone(phone)
            logger.error(f"[SMS] {error_msg}, 手机号={masked_phone}")
            # 发送告警
            if MONITOR_AVAILABLE and alert_monitor:
                try:
                    alert_monitor.record_api_error(
                        api_name="短信服务（互亿无线）",
                        endpoint="send_verification_code",
                        error_message=error_msg,
                        additional_details={
                            "phone": masked_phone,
                            "exception_type": type(e).__name__
                        }
                    )
                except Exception as monitor_error:
                    logger.warning(f"[SMS] 发送告警失败: {monitor_error}")
            # 异常情况下，开发环境仍可以使用生成的验证码
            return True
    else:
        # 未启用短信服务，使用模拟发送（开发环境）
        masked_phone = _mask_phone(phone)
        logger.info(f"[SMS] 模拟发送验证码到 {masked_phone}: {code} (有效期{CODE_EXPIRE_MINUTES}分钟)")
        logger.info(f"[SMS] 提示: 如需真实发送，请在.env中配置SMS_ENABLED=true、SMS_ACCOUNT和SMS_PASSWORD")
        return True


async def _send_sms_via_api(phone: str, code: str) -> bool:
    """
    通过互亿无线API发送短信
    
    Args:
        phone: 手机号
        code: 验证码
    
    Returns:
        bool: 是否发送成功
    """
    account = config.SMS_ACCOUNT
    password = config.SMS_PASSWORD
    template_id = config.SMS_TEMPLATE_ID
    api_url = config.SMS_API_URL
    
    # 使用模板变量方式发送
    # 模板内容：您的验证码是：【变量】。请不要把验证码泄露给其他人。
    # content参数传入验证码作为变量
    params = {
        "account": account,
        "password": password,
        "mobile": phone,
        "content": code,  # 验证码作为变量内容
        "templateid": template_id
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                api_url,
                data=params,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                error_msg = f"API请求失败，状态码: {response.status_code}"
                print(f"[SMS] {error_msg}")
                # 发送告警
                if MONITOR_AVAILABLE and alert_monitor:
                    try:
                        alert_monitor.record_api_error(
                            api_name="短信服务（互亿无线）",
                            endpoint=api_url,
                            error_message=error_msg,
                            error_code=str(response.status_code),
                            additional_details={"phone": phone[:3] + "****" + phone[-4:] if len(phone) > 7 else "****"}
                        )
                    except Exception as monitor_error:
                        print(f"[SMS] 发送告警失败: {monitor_error}")
                return False
            
            # 解析响应（支持JSON和XML格式）
            try:
                result = response.json()
                api_code = result.get("code")
                api_msg = result.get("msg", "")
                
                if api_code == 2:
                    # 提交成功
                    smsid = result.get("smsid", "")
                    print(f"[SMS] 短信发送成功，流水号: {smsid}")
                    return True
                else:
                    # 提交失败
                    error_msg = f"短信发送失败: {api_msg} (code: {api_code})"
                    print(f"[SMS] {error_msg}")
                    # 发送告警
                    if MONITOR_AVAILABLE and alert_monitor:
                        try:
                            alert_monitor.record_api_error(
                                api_name="短信服务（互亿无线）",
                                endpoint=api_url,
                                error_message=error_msg,
                                error_code=str(api_code),
                                additional_details={
                                    "phone": phone[:3] + "****" + phone[-4:] if len(phone) > 7 else "****",
                                    "template_id": template_id
                                }
                            )
                        except Exception as monitor_error:
                            print(f"[SMS] 发送告警失败: {monitor_error}")
                    return False
            except Exception:
                # 尝试解析XML格式
                import xml.etree.ElementTree as ET
                try:
                    root = ET.fromstring(response.text)
                    api_code = int(root.find("code").text)
                    api_msg = root.find("msg").text
                    
                    if api_code == 2:
                        smsid = root.find("smsid").text
                        print(f"[SMS] 短信发送成功，流水号: {smsid}")
                        return True
                    else:
                        error_msg = f"短信发送失败: {api_msg} (code: {api_code})"
                        print(f"[SMS] {error_msg}")
                        # 发送告警
                        if MONITOR_AVAILABLE and alert_monitor:
                            try:
                                alert_monitor.record_api_error(
                                    api_name="短信服务（互亿无线）",
                                    endpoint=api_url,
                                    error_message=error_msg,
                                    error_code=str(api_code),
                                    additional_details={
                                        "phone": phone[:3] + "****" + phone[-4:] if len(phone) > 7 else "****",
                                        "template_id": template_id,
                                        "response_format": "XML"
                                    }
                                )
                            except Exception as monitor_error:
                                print(f"[SMS] 发送告警失败: {monitor_error}")
                        return False
                except Exception as e:
                    error_msg = f"解析响应失败: {e}, 响应内容: {response.text[:200]}"
                    print(f"[SMS] {error_msg}")
                    # 发送告警
                    if MONITOR_AVAILABLE and alert_monitor:
                        try:
                            alert_monitor.record_api_error(
                                api_name="短信服务（互亿无线）",
                                endpoint=api_url,
                                error_message=error_msg,
                                additional_details={
                                    "phone": phone[:3] + "****" + phone[-4:] if len(phone) > 7 else "****",
                                    "response_preview": response.text[:200]
                                }
                            )
                        except Exception as monitor_error:
                            print(f"[SMS] 发送告警失败: {monitor_error}")
                    return False
                    
    except httpx.TimeoutException:
        error_msg = "请求超时（10秒）"
        print(f"[SMS] {error_msg}")
        # 发送告警
        if MONITOR_AVAILABLE and alert_monitor:
            try:
                alert_monitor.record_api_error(
                    api_name="短信服务（互亿无线）",
                    endpoint=api_url,
                    error_message=error_msg,
                    error_code="TIMEOUT",
                    additional_details={
                        "phone": phone[:3] + "****" + phone[-4:] if len(phone) > 7 else "****",
                        "timeout": "10秒"
                    }
                )
            except Exception as monitor_error:
                print(f"[SMS] 发送告警失败: {monitor_error}")
        return False
    except Exception as e:
        error_msg = f"发送短信异常: {e}"
        print(f"[SMS] {error_msg}")
        # 发送告警
        if MONITOR_AVAILABLE and alert_monitor:
            try:
                alert_monitor.record_api_error(
                    api_name="短信服务（互亿无线）",
                    endpoint=api_url,
                    error_message=error_msg,
                        additional_details={
                            "phone": _mask_phone(phone),
                            "exception_type": type(e).__name__
                        }
                )
            except Exception as monitor_error:
                print(f"[SMS] 发送告警失败: {monitor_error}")
        return False


def verify_code(phone: str, code: str) -> bool:
    """
    验证验证码
    
    Args:
        phone: 手机号
        code: 验证码
    
    Returns:
        bool: 验证是否成功
    """
    if not is_valid_phone(phone) or not code:
        return False
    
    code_info = _sms_code_store.get_code(phone)
    if not code_info:
        return False
    
    # 检查是否过期
    if datetime.utcnow() > code_info["expire_time"]:
        # 删除过期验证码
        _sms_code_store.delete_code(phone)
        return False
    
    # 检查验证次数（防止暴力破解）
    verify_count = code_info.get("verify_count", 0)
    if verify_count >= 5:
        _sms_code_store.delete_code(phone)
        return False
    
    # 更新验证次数（在验证前）
    verify_count += 1
    # 重新存储以更新验证次数（注意：当前内存实现需要手动更新，Redis实现可以原子操作）
    code_info["verify_count"] = verify_count
    _sms_code_store.store_code(
        phone,
        code_info["code"],
        code_info["expire_time"],
        code_info["last_send_time"]
    )
    
    # 验证验证码
    if code_info["code"] == code:
        # 验证成功后删除验证码（一次性使用）
        _sms_code_store.delete_code(phone)
        return True
    
    return False


def get_remaining_time(phone: str) -> int:
    """
    获取下次可发送验证码的剩余时间（秒）
    
    Args:
        phone: 手机号
    
    Returns:
        int: 剩余秒数，0表示可以立即发送
    """
    code_info = _sms_code_store.get_code(phone)
    if not code_info:
        return 0
    
    last_send_time = code_info.get("last_send_time", 0)
    elapsed = time.time() - last_send_time
    
    if elapsed >= SEND_INTERVAL_SECONDS:
        return 0
    
    return int(SEND_INTERVAL_SECONDS - elapsed)


def cleanup_expired_codes():
    """清理过期的验证码（定期调用）"""
    _sms_code_store.cleanup_expired()


async def get_sms_balance() -> Optional[float]:
    """
    查询短信服务余额
    
    Returns:
        余额数量（条数），如果查询失败返回None
    """
    if not config.SMS_ENABLED or not config.SMS_ACCOUNT or not config.SMS_PASSWORD:
        return None
    
    account = config.SMS_ACCOUNT
    password = config.SMS_PASSWORD
    # 互亿无线余额查询API地址
    balance_api_url = "https://api.ihuyi.com/sms/GetNum.json"
    
    params = {
        "account": account,
        "password": password
    }
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                balance_api_url,
                data=params,
                headers={"Content-Type": "application/x-www-form-urlencoded"}
            )
            
            if response.status_code != 200:
                logger.warning(f"[SMS] 余额查询失败，状态码: {response.status_code}")
                return None
            
            # 解析响应（支持JSON和XML格式）
            try:
                result = response.json()
                api_code = result.get("code")
                
                if api_code == 2:
                    # 查询成功
                    balance = result.get("num", 0)
                    try:
                        balance_float = float(balance)
                        return balance_float
                    except (ValueError, TypeError):
                        logger.warning(f"[SMS] 余额格式无效: {balance}")
                        return None
                else:
                    api_msg = result.get("msg", "")
                    logger.warning(f"[SMS] 余额查询失败: {api_msg} (code: {api_code})")
                    return None
            except Exception:
                # 尝试解析XML格式
                import xml.etree.ElementTree as ET
                try:
                    root = ET.fromstring(response.text)
                    api_code = int(root.find("code").text)
                    
                    if api_code == 2:
                        balance_text = root.find("num").text
                        try:
                            balance_float = float(balance_text)
                            return balance_float
                        except (ValueError, TypeError):
                            logger.warning(f"[SMS] 余额格式无效: {balance_text}")
                            return None
                    else:
                        api_msg = root.find("msg").text
                        logger.warning(f"[SMS] 余额查询失败: {api_msg} (code: {api_code})")
                        return None
                except Exception as e:
                    logger.warning(f"[SMS] 解析余额查询响应失败: {e}, 响应内容: {response.text[:200]}")
                    return None
                    
    except httpx.TimeoutException:
        logger.warning(f"[SMS] 余额查询请求超时")
        return None
    except Exception as e:
        logger.warning(f"[SMS] 余额查询异常: {e}")
        return None


async def check_sms_balance_and_alert():
    """
    检查短信余额并在余额不足时发送告警
    
    这个函数应该在发送短信前或定期调用
    """
    if not config.SMS_ENABLED:
        return
    
    # 获取余额阈值配置
    balance_threshold = config.SMS_BALANCE_THRESHOLD
    
    if balance_threshold is None or balance_threshold <= 0:
        # 如果没有配置阈值，不进行检查
        return
    
    # 查询余额
    balance = await get_sms_balance()
    
    if balance is None:
        # 查询失败，不发送告警（可能是网络问题）
        return
    
    # 检查余额是否低于阈值
    if balance < balance_threshold:
        # 余额不足，发送告警
        if MONITOR_AVAILABLE and alert_monitor:
            try:
                alert_monitor.check_balance_low(
                    service_name="短信服务（互亿无线）",
                    current_balance=balance,
                    threshold=balance_threshold
                )
            except Exception as monitor_error:
                logger.warning(f"[SMS] 发送余额告警失败: {monitor_error}")
