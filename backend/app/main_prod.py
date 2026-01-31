"""
FastAPI 主应用 - 生产模式
包含静态文件服务，用于 ngrok 单端口部署
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from app.database import init_db, SessionLocal
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

    # ==============================
    # 自动管理员初始化逻辑（生产）
    # ==============================
    from app.models.user import User
    from app.services.auth import create_user, create_user_by_phone, set_user_password

    db = SessionLocal()
    try:
        # 1. 检查是否已经有管理员用户
        existing_admin = db.query(User).filter(User.is_admin == True).first()

        if existing_admin:
            # 已存在管理员：
            # 如果配置了 INITIAL_ADMIN_PHONE 或 INITIAL_ADMIN_USERNAME，则尝试确保对应用户也是管理员
            target_user = None
            if config.INITIAL_ADMIN_PHONE:
                target_user = (
                    db.query(User)
                    .filter(User.phone == config.INITIAL_ADMIN_PHONE)
                    .first()
                )
            if not target_user and config.INITIAL_ADMIN_USERNAME:
                target_user = (
                    db.query(User)
                    .filter(User.username == config.INITIAL_ADMIN_USERNAME)
                    .first()
                )

            if target_user and not target_user.is_admin:
                target_user.is_admin = True
                db.commit()
                logger.info(
                    f"已根据 INITIAL_ADMIN_PHONE/USERNAME 将用户 {target_user.username} 提升为管理员"
                )
            # 已有管理员就不再自动创建新用户
        else:
            # 2. 当前没有任何管理员用户
            if config.INITIAL_ADMIN_PASSWORD and (config.INITIAL_ADMIN_PHONE or config.INITIAL_ADMIN_USERNAME):
                admin_user = None

                # 优先按手机号处理（适配你当前“手机号登录”的使用方式）
                if config.INITIAL_ADMIN_PHONE:
                    admin_user = (
                        db.query(User)
                        .filter(User.phone == config.INITIAL_ADMIN_PHONE)
                        .first()
                    )
                    if admin_user:
                        # 已存在该手机号用户，补充密码并提为管理员
                        set_user_password(db, admin_user, config.INITIAL_ADMIN_PASSWORD)
                        if not admin_user.is_admin:
                            admin_user.is_admin = True
                            db.commit()
                            db.refresh(admin_user)
                        logger.info(
                            f"当前无管理员，已将手机号为 {config.INITIAL_ADMIN_PHONE} 的用户 {admin_user.username} 提升为管理员"
                        )
                    else:
                        # 不存在该手机号用户，创建一个新用户（用户名用配置的 INITIAL_ADMIN_USERNAME 或手机号）
                        username = config.INITIAL_ADMIN_USERNAME or config.INITIAL_ADMIN_PHONE
                        admin_user = create_user_by_phone(
                            db,
                            username=username,
                            phone=config.INITIAL_ADMIN_PHONE,
                        )
                        # 设置为你配置的密码（覆盖随机密码）
                        set_user_password(db, admin_user, config.INITIAL_ADMIN_PASSWORD)
                        admin_user.is_admin = True
                        db.commit()
                        db.refresh(admin_user)
                        logger.info(
                            f"当前无管理员，已自动创建手机号为 {config.INITIAL_ADMIN_PHONE} 的初始管理员用户：{admin_user.username}"
                        )
                # 如果没有配置手机号，但配置了用户名，也支持按用户名创建/提升（备用路径）
                elif config.INITIAL_ADMIN_USERNAME:
                    admin_user = (
                        db.query(User)
                        .filter(User.username == config.INITIAL_ADMIN_USERNAME)
                        .first()
                    )
                    if admin_user:
                        set_user_password(db, admin_user, config.INITIAL_ADMIN_PASSWORD)
                        if not admin_user.is_admin:
                            admin_user.is_admin = True
                            db.commit()
                            db.refresh(admin_user)
                        logger.info(
                            f"当前无管理员，已将用户名为 {config.INITIAL_ADMIN_USERNAME} 的用户提升为管理员"
                        )
                    else:
                        email = f"{config.INITIAL_ADMIN_USERNAME}@admin.local"
                        admin_user = create_user(
                            db,
                            username=config.INITIAL_ADMIN_USERNAME,
                            email=email,
                            password=config.INITIAL_ADMIN_PASSWORD,
                        )
                        admin_user.is_admin = True
                        db.commit()
                        db.refresh(admin_user)
                        logger.info(
                            f"当前无管理员，已自动创建初始管理员用户：{admin_user.username}（邮箱：{email}）"
                        )
            else:
                logger.warning(
                    "当前数据库中没有任何管理员用户，且未完整配置 INITIAL_ADMIN_PHONE/USERNAME 与 INITIAL_ADMIN_PASSWORD，"
                    "无法自动创建初始管理员账号"
                )
    except Exception as e:
        logger.error(f"自动初始化管理员失败: {e}")
    finally:
        db.close()
    
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
# 安全配置：从环境变量读取允许的来源，生产环境应限制为前端域名
# 如果 CORS_ORIGINS 环境变量未设置或为 "*"，则允许所有来源（开发模式）
# 生产环境建议设置为具体的前端域名，如：https://yourdomain.com,https://www.yourdomain.com
allowed_origins = config.CORS_ORIGINS
if allowed_origins == ["*"]:
    # 如果配置为 "*"，检查是否有更具体的配置
    cors_env = os.getenv("CORS_ORIGINS", "*")
    if cors_env != "*":
        allowed_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip()]
    else:
        # 保持 "*" 以兼容现有配置，但记录警告
        logger.warning(
            "CORS配置为允许所有来源（*），生产环境建议限制为具体的前端域名。"
            "可通过设置 CORS_ORIGINS 环境变量来限制来源。"
        )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===========================
# 使用追踪中间件 & 业务路由
# ===========================
try:
    # 使用追踪中间件（用于统计与监控）
    from app.middleware.usage_tracker import UsageTrackerMiddleware

    app.add_middleware(UsageTrackerMiddleware)
    logger.info("已加载 UsageTrackerMiddleware")
except Exception as e:
    # 中间件加载失败不影响主流程，只记录日志
    logger.warning(f"加载 UsageTrackerMiddleware 失败: {e}")

# 注册 API 路由（必须在静态文件之前）
app.include_router(auth.router)
app.include_router(text.router)
app.include_router(image.router)
app.include_router(video.router)
app.include_router(project.router)

# 注册用户、支付、管理后台及自举路由（生产环境也需要）
try:
    from app.api import user, payment, admin, admin_bootstrap, visit

    app.include_router(user.router)
    app.include_router(payment.router)
    app.include_router(admin.router)
    app.include_router(visit.router)
    app.include_router(admin_bootstrap.router)
    logger.info("已注册用户、支付、管理后台及自举路由")
except Exception as e:
    logger.error(f"注册用户/支付/管理后台路由失败: {e}")

@app.get("/api/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "ancient-text-visualization",
        "mode": "production"
    }

# 先挂载后端静态资源目录（收款码等），再挂载前端 /static，否则 /static/assets/* 会被前端吞掉导致 404
STATIC_ASSETS_DIR = Path(__file__).parent / "static"
if STATIC_ASSETS_DIR.exists():
    app.mount("/static/assets", StaticFiles(directory=str(STATIC_ASSETS_DIR)), name="assets")
    logger.info(f"已挂载后端静态资源目录: {STATIC_ASSETS_DIR}")

# 挂载前端静态资源目录（必须在 /static/assets 之后，避免 /static 优先匹配）
if FRONTEND_DIST_DIR.exists():
    static_dir = FRONTEND_DIST_DIR / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
        logger.info("已挂载前端静态资源目录")

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
