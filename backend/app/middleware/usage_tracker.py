"""
使用追踪中间件
自动收集API请求的详细信息
"""
import time
import json
import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from user_agents import parse
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.usage import UsageRecord
from app.services.geolocation import get_location
from app.services.auth import get_user_by_username
from jose import JWTError, jwt
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

logger = logging.getLogger(__name__)

class UsageTrackerMiddleware(BaseHTTPMiddleware):
    """使用追踪中间件"""
    
    # 需要追踪的API路径前缀
    TRACKED_PREFIXES = [
        "/api/image",
        "/api/video",
        "/api/text",
        "/api/project",
    ]
    
    # 排除的路径（健康检查等）
    EXCLUDED_PATHS = [
        "/api/health",
        "/",
        "/docs",
        "/openapi.json",
        "/redoc",
    ]
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.app = app
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """处理请求并记录使用数据"""
        
        # 检查是否需要追踪
        if not self._should_track(request):
            return await call_next(request)
        
        # 记录开始时间
        start_time = time.time()
        started_at = time.time()
        
        # 提取请求信息
        ip_address = self._get_client_ip(request)
        user_agent_str = request.headers.get("user-agent", "")
        referer = request.headers.get("referer")
        api_endpoint = str(request.url.path)
        api_method = request.method
        
        # 解析User-Agent
        device_info = self._parse_user_agent(user_agent_str)
        
        # 获取地理位置（异步，不阻塞）
        location_info = {}
        try:
            location_info = get_location(ip_address)
        except Exception as e:
            logger.warning(f"地理位置解析失败: {str(e)}")
        
        # 获取用户信息（如果已登录）
        user = None
        try:
            # 尝试从token获取用户
            authorization = request.headers.get("authorization")
            if authorization and authorization.startswith("Bearer "):
                token = authorization.replace("Bearer ", "")
                try:
                    payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
                    username = payload.get("sub")
                    if username:
                        db = SessionLocal()
                        try:
                            user = get_user_by_username(db, username=username)
                        finally:
                            db.close()
                except JWTError:
                    pass
        except Exception:
            pass
        
        # 获取session_id
        session_id = request.headers.get("X-Session-Id")
        
        # 准备请求参数（只记录关键参数，避免存储过大）
        # 注意：读取请求体会消耗body，所以这里不读取，改为从URL参数获取
        request_params = None
        try:
            # 从查询参数获取关键信息
            query_params = dict(request.query_params)
            if query_params:
                filtered_params = {}
                for key in ["mode", "size", "duration", "fps", "aspect_ratio"]:
                    if key in query_params:
                        filtered_params[key] = query_params[key]
                if filtered_params:
                    request_params = json.dumps(filtered_params, ensure_ascii=False)
        except Exception:
            pass
        
        # 执行请求
        response_status = 200
        error_message = None
        try:
            response = await call_next(request)
            response_status = response.status_code
            return response
        except Exception as e:
            response_status = 500
            error_message = str(e)
            raise
        finally:
            # 记录结束时间和耗时
            completed_at = time.time()
            duration_ms = int((completed_at - start_time) * 1000)
            
            # 异步记录使用数据（不阻塞响应）
            # 只在出错时记录日志，减少日志输出
            try:
                self._record_usage_async(
                    user_id=user.id if user else None,
                    session_id=session_id,
                    usage_type=self._get_usage_type(api_endpoint),
                    api_endpoint=api_endpoint,
                    api_method=api_method,
                    request_params=request_params,
                    response_status=response_status,
                    started_at=started_at,
                    completed_at=completed_at,
                    duration_ms=duration_ms,
                    response_time_ms=duration_ms,
                    ip_address=ip_address,
                    country=location_info.get("country"),
                    city=location_info.get("city"),
                    user_agent=user_agent_str[:500],  # 限制长度
                    device_type=device_info.get("device_type"),
                    browser=device_info.get("browser"),
                    os=device_info.get("os"),
                    referer=referer[:500] if referer else None,
                    error_message=error_message[:1000] if error_message else None,
                )
            except Exception as e:
                # 只在出错时记录日志
                logger.error(f"记录使用数据失败: {str(e)}")
    
    def _should_track(self, request: Request) -> bool:
        """判断是否需要追踪该请求"""
        path = request.url.path
        
        # 排除的路径
        if path in self.EXCLUDED_PATHS:
            return False
        
        # 只追踪指定的API前缀
        for prefix in self.TRACKED_PREFIXES:
            if path.startswith(prefix):
                return True
        
        return False
    
    def _get_client_ip(self, request: Request) -> str:
        """获取客户端IP地址"""
        # 优先从X-Forwarded-For获取（如果使用代理）
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # 取第一个IP（原始客户端IP）
            return forwarded_for.split(",")[0].strip()
        
        # 从X-Real-IP获取
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # 从客户端获取
        if request.client:
            return request.client.host
        
        return "unknown"
    
    def _parse_user_agent(self, user_agent_str: str) -> dict:
        """解析User-Agent获取设备信息"""
        try:
            ua = parse(user_agent_str)
            return {
                "device_type": "mobile" if ua.is_mobile else ("tablet" if ua.is_tablet else "desktop"),
                "browser": f"{ua.browser.family} {ua.browser.version_string}".strip() if ua.browser else None,
                "os": f"{ua.os.family} {ua.os.version_string}".strip() if ua.os else None,
            }
        except Exception as e:
            logger.warning(f"User-Agent解析失败: {str(e)}")
            return {
                "device_type": None,
                "browser": None,
                "os": None,
            }
    
    def _get_usage_type(self, api_endpoint: str) -> str:
        """根据API端点确定使用类型"""
        if "/image" in api_endpoint:
            return "image"
        elif "/video" in api_endpoint:
            return "video"
        elif "/text" in api_endpoint:
            return "text"
        elif "/project" in api_endpoint:
            return "project"
        else:
            return "other"
    
    def _record_usage_async(self, **kwargs):
        """异步记录使用数据（在实际应用中可以使用后台任务队列）"""
        # 这里使用同步方式记录，在实际生产环境中应该使用异步任务队列
        # 为了避免阻塞，使用独立的数据库会话
        db: Session = SessionLocal()
        try:
            from datetime import datetime
            usage_record = UsageRecord(
                user_id=kwargs.get("user_id"),
                session_id=kwargs.get("session_id"),
                usage_type=kwargs.get("usage_type", "other"),
                api_endpoint=kwargs.get("api_endpoint"),
                api_method=kwargs.get("api_method"),
                request_params=kwargs.get("request_params"),
                response_status=kwargs.get("response_status"),
                started_at=datetime.fromtimestamp(kwargs.get("started_at", time.time())),
                completed_at=datetime.fromtimestamp(kwargs.get("completed_at", time.time())),
                duration_ms=kwargs.get("duration_ms"),
                response_time_ms=kwargs.get("response_time_ms"),
                ip_address=kwargs.get("ip_address"),
                country=kwargs.get("country"),
                city=kwargs.get("city"),
                user_agent=kwargs.get("user_agent"),
                device_type=kwargs.get("device_type"),
                browser=kwargs.get("browser"),
                os=kwargs.get("os"),
                referer=kwargs.get("referer"),
                error_message=kwargs.get("error_message"),
            )
            db.add(usage_record)
            db.commit()
        except Exception as e:
            # 只在出错时记录日志
            logger.error(f"记录使用数据到数据库失败: {str(e)}")
            db.rollback()
        finally:
            db.close()
