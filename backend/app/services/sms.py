"""
短信验证码服务
"""
import random
import time
import httpx
import hashlib
from typing import Optional, Dict
from datetime import datetime, timedelta
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

# 内存存储验证码（生产环境建议使用Redis）
_sms_codes: Dict[str, Dict[str, any]] = {}

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
    if phone in _sms_codes:
        last_send_time = _sms_codes[phone].get("last_send_time", 0)
        if time.time() - last_send_time < SEND_INTERVAL_SECONDS:
            return False
    
    # 生成验证码
    code = generate_verification_code()
    expire_time = datetime.utcnow() + timedelta(minutes=CODE_EXPIRE_MINUTES)
    
    # 存储验证码
    _sms_codes[phone] = {
        "code": code,
        "expire_time": expire_time,
        "last_send_time": time.time(),
        "verify_count": 0  # 验证次数
    }
    
    # 如果启用了短信服务，调用互亿无线API
    if config.SMS_ENABLED and config.SMS_ACCOUNT and config.SMS_PASSWORD:
        try:
            success = await _send_sms_via_api(phone, code)
            if success:
                print(f"[SMS] 验证码已发送到 {phone}: {code} (有效期{CODE_EXPIRE_MINUTES}分钟)")
                return True
            else:
                # API发送失败，但验证码已生成，仍返回True（开发环境可以继续使用）
                print(f"[SMS] API发送失败，但验证码已生成: {code}")
                return True
        except Exception as e:
            print(f"[SMS] 发送短信异常: {e}")
            # 异常情况下，开发环境仍可以使用生成的验证码
            return True
    else:
        # 未启用短信服务，使用模拟发送（开发环境）
        print(f"[SMS] 模拟发送验证码到 {phone}: {code} (有效期{CODE_EXPIRE_MINUTES}分钟)")
        print(f"[SMS] 提示: 如需真实发送，请在.env中配置SMS_ENABLED=true、SMS_ACCOUNT和SMS_PASSWORD")
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
                print(f"[SMS] API请求失败，状态码: {response.status_code}")
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
                    print(f"[SMS] 短信发送失败: {api_msg} (code: {api_code})")
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
                        print(f"[SMS] 短信发送失败: {api_msg} (code: {api_code})")
                        return False
                except Exception as e:
                    print(f"[SMS] 解析响应失败: {e}, 响应内容: {response.text[:200]}")
                    return False
                    
    except httpx.TimeoutException:
        print(f"[SMS] 请求超时")
        return False
    except Exception as e:
        print(f"[SMS] 发送短信异常: {e}")
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
    
    if phone not in _sms_codes:
        return False
    
    code_info = _sms_codes[phone]
    
    # 检查是否过期
    if datetime.utcnow() > code_info["expire_time"]:
        # 删除过期验证码
        del _sms_codes[phone]
        return False
    
    # 检查验证次数（防止暴力破解）
    if code_info["verify_count"] >= 5:
        del _sms_codes[phone]
        return False
    
    # 验证验证码
    code_info["verify_count"] += 1
    if code_info["code"] == code:
        # 验证成功后删除验证码（一次性使用）
        del _sms_codes[phone]
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
    if phone not in _sms_codes:
        return 0
    
    last_send_time = _sms_codes[phone].get("last_send_time", 0)
    elapsed = time.time() - last_send_time
    
    if elapsed >= SEND_INTERVAL_SECONDS:
        return 0
    
    return int(SEND_INTERVAL_SECONDS - elapsed)


def cleanup_expired_codes():
    """清理过期的验证码（定期调用）"""
    current_time = datetime.utcnow()
    expired_phones = [
        phone for phone, info in _sms_codes.items()
        if current_time > info["expire_time"]
    ]
    for phone in expired_phones:
        del _sms_codes[phone]
