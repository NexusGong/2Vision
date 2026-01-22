"""
FastAPI 主应用 - 生产模式
包含静态文件服务，用于 ngrok 单端口部署
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from app.database import init_db
from app.api import auth, text, image, project, video
import sys
import os
import logging
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import config

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 前端构建目录
FRONTEND_DIST_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("初始化数据库...")
    init_db()
    logger.info("数据库初始化完成")
    
    # 检查前端静态文件
    if FRONTEND_DIST_DIR.exists():
        logger.info(f"前端静态文件目录: {FRONTEND_DIST_DIR}")
    else:
        logger.warning(f"前端静态文件目录不存在: {FRONTEND_DIST_DIR}")
        logger.warning("请先运行 'cd frontend && pnpm build' 构建前端")
    
    yield

# 创建FastAPI应用
app = FastAPI(
    title="2Vision古诗词古文图像化学习工具 API",
    description="古诗词与古文学习图像化理解辅助工具（生产模式）",
    version="1.0.0",
    lifespan=lifespan
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产模式允许所有来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册 API 路由（必须在静态文件之前）
app.include_router(auth.router)
app.include_router(text.router)
app.include_router(image.router)
app.include_router(video.router)
app.include_router(project.router)

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "ancient-text-visualization",
        "mode": "production"
    }

# 挂载静态资源目录
if FRONTEND_DIST_DIR.exists():
    static_dir = FRONTEND_DIST_DIR / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
        logger.info("已挂载静态资源目录")

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

# 处理前端路由 - 返回 index.html（SPA 支持）
@app.get("/{full_path:path}")
async def serve_frontend(request: Request, full_path: str):
    """
    服务前端静态文件
    对于非 API 路径，返回 index.html（支持 SPA 路由）
    """
    # 跳过 API 路径
    if full_path.startswith("api/"):
        return {"error": "Not found"}
    
    if not FRONTEND_DIST_DIR.exists():
        return HTMLResponse(
            content="""
            <html>
            <head><title>2Vision - 构建中</title></head>
            <body style="font-family: system-ui; padding: 50px; text-align: center;">
                <h1>🚧 前端尚未构建</h1>
                <p>请先运行以下命令构建前端：</p>
                <pre style="background: #f5f5f5; padding: 20px; display: inline-block;">
cd frontend
pnpm install
pnpm build
                </pre>
                <p>然后重新启动服务</p>
            </body>
            </html>
            """,
            status_code=503
        )
    
    # 尝试查找请求的文件
    file_path = FRONTEND_DIST_DIR / full_path
    
    # 如果是文件且存在，直接返回
    if file_path.is_file():
        return FileResponse(str(file_path))
    
    # 否则返回 index.html（SPA 路由支持）
    index_path = FRONTEND_DIST_DIR / "html" / "main" / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    
    # 兜底：尝试其他可能的 index.html 位置
    alt_index = FRONTEND_DIST_DIR / "index.html"
    if alt_index.exists():
        return FileResponse(str(alt_index))
    
    return HTMLResponse(content="<h1>404 - Page Not Found</h1>", status_code=404)

if __name__ == "__main__":
    import uvicorn
    
    # 生产模式配置
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    
    logger.info(f"🚀 启动生产模式服务")
    logger.info(f"   监听地址: {host}:{port}")
    logger.info(f"   前端目录: {FRONTEND_DIST_DIR}")
    
    uvicorn.run(
        "app.main_prod:app", 
        host=host, 
        port=port, 
        reload=False,  # 生产模式不需要热重载
        workers=1
    )
