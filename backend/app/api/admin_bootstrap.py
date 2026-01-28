"""
管理员自举 API（用于线上首次创建管理员账号）

⚠️ 安全提示：
- 只有在环境变量 ADMIN_BOOTSTRAP_TOKEN 设置了非空值时，此接口才有效
- 使用完成后，强烈建议在线上删除 ADMIN_BOOTSTRAP_TOKEN 或移除本路由
"""
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.auth import get_current_user
from app.models.user import User
from config import config
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin-bootstrap", tags=["AdminBootstrap"])


@router.post("/promote_me")
async def promote_me(
    x_admin_token: str | None = Header(default=None, alias="X-Admin-Token"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    将当前登录用户提升为管理员。

    调用方式（示例）：
    - Header:
      - Authorization: Bearer <登录token>
      - X-Admin-Token: <ADMIN_BOOTSTRAP_TOKEN 的值>
    """
    # 未配置自举 Token 时视为禁用
    if not config.ADMIN_BOOTSTRAP_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="管理员自举功能已禁用",
        )

    # 校验自举 Token
    if not x_admin_token or x_admin_token != config.ADMIN_BOOTSTRAP_TOKEN:
        logger.warning(
            "管理员自举尝试失败：token 不匹配，user_id=%s, username=%s",
            current_user.id,
            current_user.username,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="无权限",
        )

    if current_user.is_admin:
        return {
            "status": "success",
            "message": "当前用户已是管理员",
        }

    current_user.is_admin = True
    db.commit()
    db.refresh(current_user)

    logger.info(
        "管理员自举成功：user_id=%s, username=%s 被提升为管理员",
        current_user.id,
        current_user.username,
    )

    return {
        "status": "success",
        "message": "已将当前用户设为管理员",
    }

