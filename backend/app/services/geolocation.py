"""
地理位置解析服务
支持通过IP地址解析地理位置信息
"""
import logging
from typing import Optional, Dict
import httpx
from functools import lru_cache

logger = logging.getLogger(__name__)

# 缓存解析结果，减少API调用
_geo_cache: Dict[str, Dict] = {}

class GeolocationService:
    """地理位置解析服务"""
    
    def __init__(self, use_api: bool = True, api_key: Optional[str] = None):
        """
        初始化地理位置服务
        
        Args:
            use_api: 是否使用第三方API（默认True，使用ipapi.co）
            api_key: API密钥（如果需要）
        """
        self.use_api = use_api
        self.api_key = api_key
        self.api_url = "https://ipapi.co/{ip}/json/"
        
    def get_location(self, ip_address: str) -> Dict[str, Optional[str]]:
        """
        通过IP地址获取地理位置信息
        
        Args:
            ip_address: IP地址
            
        Returns:
            包含国家、城市等信息的字典
        """
        if not ip_address or ip_address in ["127.0.0.1", "localhost", "::1"]:
            return {
                "country": None,
                "city": None,
                "region": None,
                "timezone": None
            }
        
        # 检查缓存
        if ip_address in _geo_cache:
            return _geo_cache[ip_address]
        
        try:
            if self.use_api:
                location = self._get_location_from_api(ip_address)
            else:
                # 如果不使用API，返回空信息
                location = {
                    "country": None,
                    "city": None,
                    "region": None,
                    "timezone": None
                }
            
            # 缓存结果（最多缓存1000个IP）
            if len(_geo_cache) < 1000:
                _geo_cache[ip_address] = location
            
            return location
        except Exception as e:
            logger.warning(f"地理位置解析失败: {ip_address}, 错误: {str(e)}")
            return {
                "country": None,
                "city": None,
                "region": None,
                "timezone": None
            }
    
    def _get_location_from_api(self, ip_address: str) -> Dict[str, Optional[str]]:
        """
        从第三方API获取地理位置信息
        
        Args:
            ip_address: IP地址
            
        Returns:
            地理位置信息字典
        """
        try:
            url = self.api_url.format(ip=ip_address)
            # 添加超时和重试机制
            with httpx.Client(timeout=5.0) as client:
                response = client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "country": data.get("country_name") or data.get("country"),
                        "city": data.get("city"),
                        "region": data.get("region"),
                        "timezone": data.get("timezone")
                    }
                else:
                    logger.warning(f"地理位置API返回错误: {response.status_code}")
                    return {
                        "country": None,
                        "city": None,
                        "region": None,
                        "timezone": None
                    }
        except httpx.TimeoutException:
            logger.warning(f"地理位置API请求超时: {ip_address}")
            return {
                "country": None,
                "city": None,
                "region": None,
                "timezone": None
            }
        except Exception as e:
            logger.error(f"地理位置API请求失败: {str(e)}")
            return {
                "country": None,
                "city": None,
                "region": None,
                "timezone": None
            }

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
