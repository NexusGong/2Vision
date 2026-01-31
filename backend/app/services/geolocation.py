"""
地理位置解析服务
支持通过IP地址解析地理位置信息；多数据源优先使用更准确的 ip-api.com，失败时回退 ipapi.co。
"""
import logging
from typing import Optional, Dict
import httpx

logger = logging.getLogger(__name__)

# 缓存解析结果，减少API调用（最多 1000 条）
_geo_cache: Dict[str, Dict] = {}
_MAX_CACHE_SIZE = 1000

# 空结果占位，避免重复请求失败 IP
_EMPTY_LOCATION = {
    "country": None,
    "city": None,
    "region": None,
    "timezone": None,
}


class GeolocationService:
    """地理位置解析服务（多数据源：ip-api.com 主源，ipapi.co 备用）"""

    def __init__(self, use_api: bool = True, api_key: Optional[str] = None):
        """
        初始化地理位置服务

        Args:
            use_api: 是否使用第三方 API（默认 True）
            api_key: 预留，可选 API 密钥（如未来接入 ipinfo 等）
        """
        self.use_api = use_api
        self.api_key = api_key
        # 主源：ip-api.com，免费、无 key、城市级精度较好（限 45 次/分钟）
        self._primary_url = "http://ip-api.com/json/{ip}?fields=status,country,regionName,city,timezone"
        # 备用：ipapi.co
        self._fallback_url = "https://ipapi.co/{ip}/json/"

    def get_location(self, ip_address: str) -> Dict[str, Optional[str]]:
        """
        通过 IP 地址获取地理位置信息（多源，优先更准确的数据源）

        Args:
            ip_address: IP 地址

        Returns:
            包含 country、city、region、timezone 的字典
        """
        if not ip_address or ip_address.strip() in ("127.0.0.1", "localhost", "::1"):
            return _EMPTY_LOCATION.copy()

        ip_address = ip_address.strip()
        if ip_address in _geo_cache:
            return _geo_cache[ip_address]

        location = _EMPTY_LOCATION.copy()
        if self.use_api:
            location = self._get_location_multi_source(ip_address)

        if len(_geo_cache) < _MAX_CACHE_SIZE:
            _geo_cache[ip_address] = location

        return location

    def _get_location_multi_source(self, ip_address: str) -> Dict[str, Optional[str]]:
        """多数据源：先 ip-api.com，失败再试 ipapi.co"""
        # 1. 主源：ip-api.com（国内/国际城市级精度较好）
        loc = self._fetch_ip_api_com(ip_address)
        if loc is not None:
            return loc
        # 2. 备用：ipapi.co
        loc = self._fetch_ipapi_co(ip_address)
        if loc is not None:
            return loc
        logger.warning(f"地理位置解析失败（多源均不可用）: {ip_address}")
        return _EMPTY_LOCATION.copy()

    def _fetch_ip_api_com(self, ip_address: str) -> Optional[Dict[str, Optional[str]]]:
        """从 ip-api.com 获取（主源，免费无 key，精度较好）"""
        try:
            url = self._primary_url.format(ip=ip_address)
            with httpx.Client(timeout=5.0) as client:
                response = client.get(url)
                if response.status_code != 200:
                    return None
                data = response.json()
                if data.get("status") != "success":
                    return None
                return {
                    "country": data.get("country") or None,
                    "city": data.get("city") or None,
                    "region": data.get("regionName") or data.get("region") or None,
                    "timezone": data.get("timezone") or None,
                }
        except httpx.TimeoutException:
            logger.debug(f"ip-api.com 超时: {ip_address}")
            return None
        except Exception as e:
            logger.debug(f"ip-api.com 请求失败: {ip_address}, {e}")
            return None

    def _fetch_ipapi_co(self, ip_address: str) -> Optional[Dict[str, Optional[str]]]:
        """从 ipapi.co 获取（备用）"""
        try:
            url = self._fallback_url.format(ip=ip_address)
            with httpx.Client(timeout=5.0) as client:
                response = client.get(url)
                if response.status_code != 200:
                    return None
                data = response.json()
                err = data.get("error")
                if err is True or (isinstance(data.get("reason"), str) and "reserved" in data.get("reason", "").lower()):
                    return None
                return {
                    "country": data.get("country_name") or data.get("country") or None,
                    "city": data.get("city") or None,
                    "region": data.get("region") or data.get("region_code") or None,
                    "timezone": data.get("timezone") or None,
                }
        except httpx.TimeoutException:
            logger.debug(f"ipapi.co 超时: {ip_address}")
            return None
        except Exception as e:
            logger.debug(f"ipapi.co 请求失败: {ip_address}, {e}")
            return None

# 全局实例
_geolocation_service: Optional[GeolocationService] = None

def get_geolocation_service() -> GeolocationService:
    """获取地理位置服务实例（单例模式）"""
    global _geolocation_service
    if _geolocation_service is None:
        _geolocation_service = GeolocationService(use_api=True)
    return _geolocation_service

def get_location(ip_address: str) -> Dict[str, Optional[str]]:
    """
    便捷函数：获取IP地址的地理位置
    
    Args:
        ip_address: IP地址
        
    Returns:
        地理位置信息字典
    """
    service = get_geolocation_service()
    return service.get_location(ip_address)
