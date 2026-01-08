"""
FastAPI 主应用
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.api import auth, text, image, project, video
import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import config

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    title="古诗词古文图像化学习工具 API",
    description="面向学生和教师的古诗词与古文学习图像化理解辅助工具",
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

# 注册路由
app.include_router(auth.router)
app.include_router(text.router)
app.include_router(image.router)
app.include_router(video.router)
app.include_router(project.router)

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "古诗词古文图像化学习工具 API 服务运行中",
        "version": "1.0.0"
    }

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "ancient-text-visualization"
    }

if __name__ == "__main__":
    import uvicorn
    logger.info(f"启动服务，监听地址: {config.API_HOST}:{config.API_PORT}")
    uvicorn.run("app.main:app", host=config.API_HOST, port=config.API_PORT, reload=True)

