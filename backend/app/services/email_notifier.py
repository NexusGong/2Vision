"""
邮件通知服务
用于发送API监控告警邮件
"""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from typing import Optional, List
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

logger = logging.getLogger(__name__)


class EmailNotifier:
    """邮件通知器"""
    
    def __init__(self):
        self.enabled = config.EMAIL_ENABLED
        self.smtp_host = config.EMAIL_SMTP_HOST
        self.smtp_port = config.EMAIL_SMTP_PORT
        self.smtp_user = config.EMAIL_SMTP_USER
        self.smtp_password = config.EMAIL_SMTP_PASSWORD
        self.email_from = config.EMAIL_FROM
        self.email_to = config.EMAIL_TO
        self.use_tls = config.EMAIL_USE_TLS
        
        if not self.enabled:
            logger.debug("邮件通知服务未启用")
            return
        
        # 验证配置
        if not all([self.smtp_host, self.smtp_user, self.smtp_password, self.email_from, self.email_to]):
            logger.warning("邮件配置不完整，邮件通知功能将无法使用")
            self.enabled = False
    
    def send_alert_email(
        self,
        alert_type: str,
        title: str,
        message: str,
        details: Optional[dict] = None,
        severity: str = "WARNING"
    ) -> bool:
        """
        发送告警邮件
        
        Args:
            alert_type: 告警类型（API_ERROR, COOKIE_EXPIRED, BALANCE_LOW, SMS_ERROR等）
            title: 邮件标题
            message: 告警消息
            details: 详细信息字典
            severity: 严重程度（INFO, WARNING, ERROR, CRITICAL）
        
        Returns:
            是否发送成功
        """
        if not self.enabled:
            return False
        
        try:
            # 格式化邮件内容
            html_content = self._format_alert_message(
                alert_type=alert_type,
                title=title,
                message=message,
                details=details,
                severity=severity
            )
            
            # 创建邮件
            msg = MIMEMultipart('alternative')
            msg['From'] = self.email_from
            msg['To'] = self.email_to
            msg['Subject'] = f"[{severity}] {title}"
            
            # 添加HTML内容
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # 发送邮件
            return self._send_email(msg)
            
        except Exception as e:
            logger.error(f"发送告警邮件失败: {str(e)}", exc_info=True)
            return False
    
    def _format_alert_message(
        self,
        alert_type: str,
        title: str,
        message: str,
        details: Optional[dict] = None,
        severity: str = "WARNING"
    ) -> str:
        """
        格式化告警消息为HTML格式
        
        Args:
            alert_type: 告警类型
            title: 标题
            message: 消息内容
            details: 详细信息
            severity: 严重程度
        
        Returns:
            HTML格式的邮件内容
        """
        # 严重程度颜色映射
        severity_colors = {
            "INFO": "#2196F3",
            "WARNING": "#FF9800",
            "ERROR": "#F44336",
            "CRITICAL": "#D32F2F"
        }
        
        # 告警类型中文映射
        alert_type_names = {
            "API_ERROR": "API调用错误",
            "COOKIE_EXPIRED": "Cookie过期",
            "BALANCE_LOW": "余额不足",
            "SMS_ERROR": "短信发送失败",
            "VIDEO_ERROR": "视频生成错误",
            "IMAGE_ERROR": "图像生成错误",
            "TEXT_ERROR": "文本分析错误"
        }
        
        color = severity_colors.get(severity, "#FF9800")
        type_name = alert_type_names.get(alert_type, alert_type)
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # 构建HTML内容
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .header {{
                    background-color: {color};
                    color: white;
                    padding: 15px;
                    border-radius: 5px 5px 0 0;
                }}
                .content {{
                    background-color: #f9f9f9;
                    padding: 20px;
                    border: 1px solid #ddd;
                    border-top: none;
                    border-radius: 0 0 5px 5px;
                }}
                .alert-type {{
                    font-size: 14px;
                    color: #666;
                    margin-bottom: 10px;
                }}
                .message {{
                    background-color: white;
                    padding: 15px;
                    border-left: 4px solid {color};
                    margin: 15px 0;
                }}
                .details {{
                    background-color: white;
                    padding: 15px;
                    margin-top: 15px;
                    border-radius: 3px;
                }}
                .details table {{
                    width: 100%;
                    border-collapse: collapse;
                }}
                .details th {{
                    text-align: left;
                    padding: 8px;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #ddd;
                }}
                .details td {{
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                }}
                .footer {{
                    margin-top: 20px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #666;
                }}
                .solution {{
                    background-color: #E3F2FD;
                    padding: 15px;
                    margin-top: 15px;
                    border-radius: 3px;
                    border-left: 4px solid #2196F3;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2 style="margin: 0;">{title}</h2>
            </div>
            <div class="content">
                <div class="alert-type">
                    <strong>告警类型:</strong> {type_name} ({alert_type})<br>
                    <strong>严重程度:</strong> {severity}<br>
                    <strong>发生时间:</strong> {current_time}
                </div>
                
                <div class="message">
                    <strong>告警信息:</strong><br>
                    {message}
                </div>
        """
        
        # 添加详细信息
        if details:
            html += """
                <div class="details">
                    <strong>详细信息:</strong>
                    <table>
            """
            for key, value in details.items():
                # 对敏感信息进行脱敏处理
                display_value = self._mask_sensitive_info(key, value)
                html += f"""
                        <tr>
                            <th>{key}</th>
                            <td>{display_value}</td>
                        </tr>
                """
            html += """
                    </table>
                </div>
            """
        
        # 添加建议解决方案
        solution = self._get_solution(alert_type)
        if solution:
            html += f"""
                <div class="solution">
                    <strong>建议解决方案:</strong><br>
                    {solution}
                </div>
            """
        
        html += """
            </div>
            <div class="footer">
                <p>此邮件由系统自动发送，请勿直接回复。</p>
                <p>如有疑问，请检查系统日志或联系管理员。</p>
            </div>
        </body>
        </html>
        """
        
        return html
    
    def _mask_sensitive_info(self, key: str, value: any) -> str:
        """
        对敏感信息进行脱敏处理
        
        Args:
            key: 字段名
            value: 字段值
        
        Returns:
            脱敏后的值
        """
        if value is None:
            return "N/A"
        
        value_str = str(value)
        
        # 需要脱敏的字段
        sensitive_keys = ['password', 'token', 'key', 'secret', 'cookie', 'api_key']
        
        if any(sensitive in key.lower() for sensitive in sensitive_keys):
            if len(value_str) > 8:
                return value_str[:4] + "****" + value_str[-4:]
            else:
                return "****"
        
        return value_str
    
    def _get_solution(self, alert_type: str) -> str:
        """
        根据告警类型返回建议解决方案
        
        Args:
            alert_type: 告警类型
        
        Returns:
            解决方案文本
        """
        solutions = {
            "API_ERROR": """
            1. 检查API Key是否正确配置<br>
            2. 确认API服务是否正常运行<br>
            3. 检查网络连接是否正常<br>
            4. 查看API余额是否充足<br>
            5. 查看后端日志获取详细错误信息
            """,
            "COOKIE_EXPIRED": """
            1. 访问支付宝商家中心 (https://b.alipay.com)<br>
            2. 登录后打开浏览器开发者工具 (F12)<br>
            3. 在Console中输入 document.cookie 并回车<br>
            4. 复制完整的cookie字符串<br>
            5. 更新 .env 文件中的 ALIPAY_COOKIE 配置<br>
            6. 重启后端服务
            """,
            "BALANCE_LOW": """
            1. 登录服务商控制台检查余额<br>
            2. 如余额不足，请及时充值<br>
            3. 检查服务使用量是否异常<br>
            4. 考虑优化服务调用频率<br>
            5. 对于短信服务，请访问互亿无线用户中心充值
            """,
            "SMS_ERROR": """
            1. 检查短信服务配置是否正确<br>
            2. 确认SMS_ACCOUNT和SMS_PASSWORD是否正确<br>
            3. 检查短信服务商账户余额<br>
            4. 确认短信模板ID是否正确<br>
            5. 查看短信服务商控制台的错误信息
            """,
            "VIDEO_ERROR": """
            1. 检查视频生成API配置<br>
            2. 确认视频模型名称是否正确<br>
            3. 检查视频生成参数是否有效<br>
            4. 查看API返回的详细错误信息
            """,
            "IMAGE_ERROR": """
            1. 检查图像生成API配置<br>
            2. 确认图像模型名称是否正确<br>
            3. 检查图像生成参数是否有效<br>
            4. 查看API返回的详细错误信息
            """,
            "TEXT_ERROR": """
            1. 检查文本分析API配置<br>
            2. 确认文本模型名称是否正确<br>
            3. 检查输入文本是否符合要求<br>
            4. 查看API返回的详细错误信息
            """
        }
        
        return solutions.get(alert_type, "请查看系统日志获取详细错误信息，或联系管理员。")
    
    def _send_email(self, msg: MIMEMultipart, max_retries: int = 3) -> bool:
        """
        发送邮件（带重试机制）
        
        Args:
            msg: 邮件消息对象
            max_retries: 最大重试次数
        
        Returns:
            是否发送成功
        """
        for attempt in range(max_retries):
            try:
                # 创建SMTP连接
                if self.use_tls:
                    server = smtplib.SMTP(self.smtp_host, self.smtp_port)
                    server.starttls()
                else:
                    server = smtplib.SMTP_SSL(self.smtp_host, self.smtp_port)
                
                # 登录
                server.login(self.smtp_user, self.smtp_password)
                
                # 发送邮件
                server.send_message(msg)
                server.quit()
                
                logger.debug(f"告警邮件发送成功: {msg['Subject']}")
                return True
                
            except smtplib.SMTPAuthenticationError as e:
                logger.error(f"SMTP认证失败: {str(e)}")
                return False
            except smtplib.SMTPException as e:
                logger.warning(f"SMTP错误 (尝试 {attempt + 1}/{max_retries}): {str(e)}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(2 ** attempt)  # 指数退避
                else:
                    logger.error(f"邮件发送失败，已重试 {max_retries} 次")
                    return False
            except Exception as e:
                logger.error(f"发送邮件时发生未知错误: {str(e)}", exc_info=True)
                return False
        
        return False


# 全局邮件通知器实例
email_notifier = EmailNotifier()
