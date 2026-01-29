"""
FastAPI 主应用
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import init_db, SessionLocal
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

    # ==============================
    # 自动管理员初始化逻辑（开发环境）
    # ==============================
    from app.models.user import User
    from app.services.auth import create_user, create_user_by_phone, set_user_password

    db = SessionLocal()
    try:
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
                logger.warning(
                    f"[DEV] 已根据 INITIAL_ADMIN_PHONE/USERNAME 将用户 {target_user.username} 提升为管理员"
                )
        else:
            # 当前没有任何管理员用户
            if config.INITIAL_ADMIN_PASSWORD and (config.INITIAL_ADMIN_PHONE or config.INITIAL_ADMIN_USERNAME):
                admin_user = None

                # 优先手机号路径，方便本地调试手机号登录
                if config.INITIAL_ADMIN_PHONE:
                    admin_user = (
                        db.query(User)
                        .filter(User.phone == config.INITIAL_ADMIN_PHONE)
                        .first()
                    )
                    if admin_user:
                        set_user_password(db, admin_user, config.INITIAL_ADMIN_PASSWORD)
                        if not admin_user.is_admin:
                            admin_user.is_admin = True
                            db.commit()
                            db.refresh(admin_user)
                        logger.warning(
                            f"[DEV] 当前无管理员，已将手机号为 {config.INITIAL_ADMIN_PHONE} 的用户 {admin_user.username} 提升为管理员"
                        )
                    else:
                        username = config.INITIAL_ADMIN_USERNAME or config.INITIAL_ADMIN_PHONE
                        admin_user = create_user_by_phone(
                            db,
                            username=username,
                            phone=config.INITIAL_ADMIN_PHONE,
                        )
                        set_user_password(db, admin_user, config.INITIAL_ADMIN_PASSWORD)
                        admin_user.is_admin = True
                        db.commit()
                        db.refresh(admin_user)
                        logger.warning(
                            f"[DEV] 当前无管理员，已自动创建手机号为 {config.INITIAL_ADMIN_PHONE} 的初始管理员用户：{admin_user.username}"
                        )
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
                        logger.warning(
                            f"[DEV] 当前无管理员，已将用户名为 {config.INITIAL_ADMIN_USERNAME} 的用户提升为管理员"
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
                        logger.warning(
                            f"[DEV] 当前无管理员，已自动创建初始管理员用户：{admin_user.username}（邮箱：{email}）"
                        )
            else:
                logger.warning(
                    "[DEV] 当前数据库中没有任何管理员用户，且未完整配置 INITIAL_ADMIN_PHONE/USERNAME 与 INITIAL_ADMIN_PASSWORD，"
                    "无法自动创建初始管理员账号"
                )
    except Exception as e:
        logger.error(f"[DEV] 自动初始化管理员失败: {e}")
    finally:
        db.close()

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

