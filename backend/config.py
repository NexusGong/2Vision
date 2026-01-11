"""
配置文件
"""
import os
from dotenv import load_dotenv

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

config = Config()

