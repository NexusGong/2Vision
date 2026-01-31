"""
页面访问记录 API（公开，无需登录）
用于记录用户进入网站的行为，便于统计“仅访问未使用”用户
"""
import logging
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from user_agents import parse

from app.database import get_db
from app.models.visit import PageVisit
from app.services.geolocation import get_location
from app.services.auth import get_optional_user
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["访问记录"])


def _get_client_ip(request: Request) -> str:
    """获取客户端 IP"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    if request.client:
        return request.client.host
    return "unknown"


def _parse_device(user_agent_str: str) -> dict:
    """从 User-Agent 解析设备类型等信息"""
    if not user_agent_str:
        return {"device_type": "unknown", "browser": None, "os": None}
    try:
        ua = parse(user_agent_str)
        device = "mobile" if ua.is_mobile else ("tablet" if ua.is_tablet else "desktop")
        browser = f"{ua.browser.family} {ua.browser.version_string}".strip() if ua.browser else None
        os_str = f"{ua.os.family} {ua.os.version_string}".strip() if ua.os else None
        return {"device_type": device, "browser": browser, "os": os_str}
    except Exception as e:
        logger.warning("User-Agent 解析失败: %s", e)
        return {"device_type": "unknown", "browser": None, "os": None}


class VisitRecordRequest(BaseModel):
    """记录访问请求体"""
    session_id: str | None = None


@router.post("/visit")
async def record_visit(
    request: Request,
    body: VisitRecordRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """
    记录一次页面访问（进入网站即调用，无需登录）。
    用于统计总访问数与“仅访问未使用”用户（IP、设备、地理位置等）。
    """
    ip = _get_client_ip(request)
    ua_str = request.headers.get("User-Agent") or ""
    parsed = _parse_device(ua_str)
    geo = get_location(ip)
    session_id = (body.session_id if body else None) or None
    user_id = current_user.id if current_user else None

    visit = PageVisit(
        session_id=session_id,
        user_id=user_id,
        ip_address=ip,
        user_agent=ua_str[:500] if ua_str else None,
        device_type=parsed.get("device_type"),
        browser=parsed.get("browser"),
        os=parsed.get("os"),
        country=geo.get("country"),
        region=geo.get("region"),
        city=geo.get("city"),
        timezone=geo.get("timezone"),
    )
    db.add(visit)
    db.commit()
    return {"status": "ok", "message": "访问已记录"}
