"""
FastAPI 主应用
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import init_db
from app.api import auth, text, image, project, video
import sys
import os
import logging
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import config

# 配置日志 - 只记录警告和错误，减少INFO日志
logging.basicConfig(
    level=logging.WARNING,  # 只记录WARNING及以上级别
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
# uvicorn的访问日志也设置为WARNING级别
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info("初始化数据库...")
    init_db()
    logger.info("数据库初始化完成")
    yield
    # 关闭时执行（如果需要）

# 创建FastAPI应用
app = FastAPI(
    title="2Vision古诗词古文图像化学习工具 API",
    description="古诗词与古文学习图像化理解辅助工具",
    version="1.0.0",
    lifespan=lifespan
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加使用追踪中间件
from app.middleware.usage_tracker import UsageTrackerMiddleware
app.add_middleware(UsageTrackerMiddleware)

# 注册路由
app.include_router(auth.router)
app.include_router(text.router)
app.include_router(image.router)
app.include_router(video.router)
app.include_router(project.router)

# 注册新路由
from app.api import user, payment, admin
app.include_router(user.router)
app.include_router(payment.router)
app.include_router(admin.router)

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "2Vision古诗词古文图像化学习工具 API 服务运行中",
        "version": "1.0.0"
    }

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "ancient-text-visualization"
    }

# 挂载媒体文件目录（图片和视频）
storage_dir = Path(__file__).parent.parent / config.STORAGE_DIR
if storage_dir.exists():
    app.mount(config.STATIC_URL_PREFIX, StaticFiles(directory=str(storage_dir)), name="media")
    logger.info(f"已挂载媒体文件目录: {storage_dir}")
else:
    # 如果目录不存在，创建它
    storage_dir.mkdir(parents=True, exist_ok=True)
    app.mount(config.STATIC_URL_PREFIX, StaticFiles(directory=str(storage_dir)), name="media")
    logger.info(f"已创建并挂载媒体文件目录: {storage_dir}")

if __name__ == "__main__":
    import uvicorn
    logger.info(f"启动服务，监听地址: {config.API_HOST}:{config.API_PORT}")
    uvicorn.run("app.main:app", host=config.API_HOST, port=config.API_PORT, reload=True)

