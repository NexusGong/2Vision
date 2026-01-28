"""
配置文件
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 获取backend目录的绝对路径
BACKEND_DIR = Path(__file__).parent.absolute()
# .env文件路径（backend目录下的.env）
ENV_FILE = BACKEND_DIR / ".env"

# 加载环境变量，优先使用backend目录下的.env文件
if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE, override=True)
else:
    # 如果backend/.env不存在，尝试从当前目录或父目录加载
    load_dotenv()

class Config:
    """应用配置"""
    # 数据库配置
    DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    
    # 火山引擎配置
    ARK_API_KEY = os.getenv("ARK_API_KEY", "")
    ARK_BASE_URL = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
    MODEL_NAME = os.getenv("MODEL_NAME", "doubao-seed-1-6-251015")
    VISION_MODEL_NAME = os.getenv("VISION_MODEL_NAME", "doubao-seedream-4-0-250828")
    VIDEO_MODEL_NAME = os.getenv("VIDEO_MODEL_NAME", "doubao-seedance-1-5-pro-251215")
    
    # JWT 配置
    # 安全要求：生产环境必须通过环境变量设置强随机 SECRET_KEY
    # 这里仍然提供一个默认值以避免开发环境无法启动，但会在使用默认值时记录警告日志
    SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7天
    
    # API 配置
    API_HOST = os.getenv("API_HOST", "127.0.0.1")
    API_PORT = int(os.getenv("API_PORT", "8000"))
    
    # CORS 配置
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
    
    # 文件上传配置
    MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE", "10485760"))  # 10MB
    ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif"}
    
    # 内容验证配置
    ENABLE_CONTENT_VALIDATION = os.getenv("ENABLE_CONTENT_VALIDATION", "true").lower() == "true"
    CONTENT_VALIDATION_STRICT = os.getenv("CONTENT_VALIDATION_STRICT", "true").lower() == "true"  # 严格模式
    MIN_CHINESE_RATIO = float(os.getenv("MIN_CHINESE_RATIO", "0.6"))  # 最小中文比例
    
    # 文件存储配置
    STORAGE_DIR = os.getenv("STORAGE_DIR", "./storage")  # 文件存储目录
    IMAGES_DIR = os.path.join(STORAGE_DIR, "images")  # 图片存储目录
    VIDEOS_DIR = os.path.join(STORAGE_DIR, "videos")  # 视频存储目录
    STATIC_URL_PREFIX = os.getenv("STATIC_URL_PREFIX", "/static/media")  # 静态文件URL前缀
    
    # 短信服务配置（互亿无线）
    SMS_ENABLED = os.getenv("SMS_ENABLED", "false").lower() == "true"  # 是否启用短信服务
    SMS_ACCOUNT = os.getenv("SMS_ACCOUNT", "")  # APIID
    SMS_PASSWORD = os.getenv("SMS_PASSWORD", "")  # APIKEY
    SMS_TEMPLATE_ID = os.getenv("SMS_TEMPLATE_ID", "1")  # 模板ID，默认使用模板1
    SMS_API_URL = os.getenv("SMS_API_URL", "https://api.ihuyi.com/sms/Submit.json")  # 短信API地址
    SMS_BALANCE_THRESHOLD = float(os.getenv("SMS_BALANCE_THRESHOLD", "0")) if os.getenv("SMS_BALANCE_THRESHOLD") else None  # 短信余额阈值（条数），低于此值发送告警，0或未设置则不检查
    
    # 支付宝收款码配置（简单方案：使用现有收款码）
    ALIPAY_QR_CODE_URL = os.getenv("ALIPAY_QR_CODE_URL", "")  # 支付宝收款码图片URL（可以是本地路径或网络URL）
    ALIPAY_ACCOUNT_NAME = os.getenv("ALIPAY_ACCOUNT_NAME", "")  # 支付宝账号名称（用于显示）
    
    # 支付宝自动验证配置
    ALIPAY_COOKIE = os.getenv("ALIPAY_COOKIE", "")  # 支付宝登录后的完整Cookie
    ALIPAY_CTOKEN = os.getenv("ALIPAY_CTOKEN", "")  # 从Cookie中提取的ctoken（可选，如果提供则直接使用）
    ALIPAY_BILL_USER_ID = os.getenv("ALIPAY_BILL_USER_ID", "")  # 从Cookie中提取的billUserId（可选，如果提供则直接使用）
    ALIPAY_POLLING_INTERVAL = int(os.getenv("ALIPAY_POLLING_INTERVAL", "30"))  # 轮询间隔（秒），默认30秒
    ALIPAY_POLLING_TIMEOUT = int(os.getenv("ALIPAY_POLLING_TIMEOUT", "300"))  # 轮询超时时间（秒），默认5分钟
    
    # 邮件告警配置
    EMAIL_ENABLED = os.getenv("EMAIL_ENABLED", "false").lower() == "true"  # 是否启用邮件告警
    EMAIL_SMTP_HOST = os.getenv("EMAIL_SMTP_HOST", "")  # SMTP服务器地址
    EMAIL_SMTP_PORT = int(os.getenv("EMAIL_SMTP_PORT", "587"))  # SMTP端口（默认587，SSL使用465）
    EMAIL_SMTP_USER = os.getenv("EMAIL_SMTP_USER", "")  # SMTP用户名（通常是邮箱地址）
    EMAIL_SMTP_PASSWORD = os.getenv("EMAIL_SMTP_PASSWORD", "")  # SMTP密码（或授权码）
    EMAIL_FROM = os.getenv("EMAIL_FROM", "")  # 发件人邮箱地址
    EMAIL_TO = os.getenv("EMAIL_TO", "")  # 收件人邮箱地址（支持多个，用逗号分隔）
    EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"  # 是否使用TLS加密（默认true）
    
    # 监控告警配置
    ALERT_THROTTLE_HOURS = float(os.getenv("ALERT_THROTTLE_HOURS", "1.0"))  # 告警限流时间（小时），同一问题在此时间内最多发送1次告警

config = Config()

