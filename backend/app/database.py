"""
数据库配置和初始化
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import config

# 创建数据库引擎
# 优化连接池配置
connect_args = {}
engine_kwargs = {
    "pool_pre_ping": True,  # 连接前检查连接是否有效
    "echo": False  # 关闭 SQL 日志输出，减少日志量
}

if "sqlite" in config.DATABASE_URL:
    connect_args = {"check_same_thread": False}
    engine_kwargs["connect_args"] = connect_args
else:
    # 其他数据库（如 PostgreSQL）的连接池配置
    engine_kwargs["pool_size"] = 10  # 连接池大小
    engine_kwargs["max_overflow"] = 20  # 最大溢出连接数

engine = create_engine(config.DATABASE_URL, **engine_kwargs)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基础模型类
Base = declarative_base()

def get_db():
    """获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """初始化数据库表"""
    from app.models.user import User
    from app.models.project import Project, ImageItem, Annotation
    from app.models.usage import UsageRecord
    from app.models.payment import Payment
    from app.models.activity import UserActivityLog
    Base.metadata.create_all(bind=engine)

