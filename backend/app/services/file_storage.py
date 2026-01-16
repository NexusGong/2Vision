"""
文件存储服务
用于下载和保存图片、视频到本地存储
"""
import os
import httpx
import logging
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
import hashlib
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

logger = logging.getLogger(__name__)


def ensure_storage_dirs():
    """确保存储目录存在"""
    os.makedirs(config.IMAGES_DIR, exist_ok=True)
    os.makedirs(config.VIDEOS_DIR, exist_ok=True)
    logger.info(f"存储目录已创建: {config.IMAGES_DIR}, {config.VIDEOS_DIR}")


def get_file_extension_from_url(url: str, default: str = "png") -> str:
    """从URL中提取文件扩展名"""
    try:
        parsed = urlparse(url)
        path = parsed.path
        if path:
            ext = os.path.splitext(path)[1]
            if ext:
                return ext.lstrip(".")
    except Exception as e:
        logger.warning(f"无法从URL提取扩展名: {e}")
    return default


def generate_filename(url: str, prefix: str = "", suffix: str = "") -> str:
    """生成文件名（基于URL的哈希值）"""
    # 使用URL的哈希值作为文件名，避免重复下载
    url_hash = hashlib.md5(url.encode()).hexdigest()
    ext = get_file_extension_from_url(url)
    
    filename = f"{prefix}{url_hash}{suffix}.{ext}" if prefix or suffix else f"{url_hash}.{ext}"
    return filename


async def download_and_save_image(image_url: str, project_id: Optional[int] = None) -> Optional[str]:
    """
    下载图片并保存到本地
    
    Args:
        image_url: 图片URL
        project_id: 项目ID（可选，用于组织文件）
        
    Returns:
        本地文件路径（相对于存储目录）或None（如果下载失败）
    """
    if not image_url or not image_url.startswith(("http://", "https://")):
        logger.warning(f"无效的图片URL: {image_url}")
        return None
    
    try:
        ensure_storage_dirs()
        
        # 生成文件名
        filename = generate_filename(image_url, prefix="img_")
        
        # 如果指定了项目ID，可以按项目组织文件（可选）
        if project_id:
            project_dir = os.path.join(config.IMAGES_DIR, f"project_{project_id}")
            os.makedirs(project_dir, exist_ok=True)
            file_path = os.path.join(project_dir, filename)
            relative_path = f"images/project_{project_id}/{filename}"
        else:
            file_path = os.path.join(config.IMAGES_DIR, filename)
            relative_path = f"images/{filename}"
        
        # 如果文件已存在，直接返回
        if os.path.exists(file_path):
            logger.info(f"图片已存在，跳过下载: {relative_path}")
            return relative_path
        
        # 下载图片
        logger.info(f"开始下载图片: {image_url[:100]}...")
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()
            
            # 保存文件
            with open(file_path, "wb") as f:
                f.write(response.content)
            
            logger.info(f"图片下载成功: {relative_path}")
            return relative_path
            
    except httpx.TimeoutException:
        logger.error(f"下载图片超时: {image_url[:100]}...")
        return None
    except httpx.RequestError as e:
        logger.error(f"下载图片请求失败: {image_url[:100]}..., 错误: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"下载图片失败: {image_url[:100]}..., 错误: {str(e)}")
        return None


async def download_and_save_video(video_url: str, project_id: Optional[int] = None) -> Optional[str]:
    """
    下载视频并保存到本地
    
    Args:
        video_url: 视频URL
        project_id: 项目ID（可选，用于组织文件）
        
    Returns:
        本地文件路径（相对于存储目录）或None（如果下载失败）
    """
    if not video_url or not video_url.startswith(("http://", "https://")):
        logger.warning(f"无效的视频URL: {video_url}")
        return None
    
    try:
        ensure_storage_dirs()
        
        # 生成文件名
        filename = generate_filename(video_url, prefix="video_", default="mp4")
        
        # 如果指定了项目ID，可以按项目组织文件（可选）
        if project_id:
            project_dir = os.path.join(config.VIDEOS_DIR, f"project_{project_id}")
            os.makedirs(project_dir, exist_ok=True)
            file_path = os.path.join(project_dir, filename)
            relative_path = f"videos/project_{project_id}/{filename}"
        else:
            file_path = os.path.join(config.VIDEOS_DIR, filename)
            relative_path = f"videos/{filename}"
        
        # 如果文件已存在，直接返回
        if os.path.exists(file_path):
            logger.info(f"视频已存在，跳过下载: {relative_path}")
            return relative_path
        
        # 下载视频（流式下载，因为视频文件可能很大）
        logger.info(f"开始下载视频: {video_url[:100]}...")
        async with httpx.AsyncClient(timeout=300.0) as client:
            async with client.stream("GET", video_url) as response:
                response.raise_for_status()
                
                # 流式保存文件
                with open(file_path, "wb") as f:
                    async for chunk in response.aiter_bytes():
                        f.write(chunk)
            
            logger.info(f"视频下载成功: {relative_path}")
            return relative_path
            
    except httpx.TimeoutException:
        logger.error(f"下载视频超时: {video_url[:100]}...")
        return None
    except httpx.RequestError as e:
        logger.error(f"下载视频请求失败: {video_url[:100]}..., 错误: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"下载视频失败: {video_url[:100]}..., 错误: {str(e)}")
        return None


def get_local_url(relative_path: str) -> str:
    """
    获取本地文件的访问URL
    
    Args:
        relative_path: 相对于存储目录的文件路径（如 "images/filename.png"）
        
    Returns:
        完整的访问URL（如 "/static/media/images/filename.png"）
    """
    if not relative_path:
        return ""
    
    # 确保路径使用正斜杠
    relative_path = relative_path.replace("\\", "/")
    
    # 构建URL
    url = f"{config.STATIC_URL_PREFIX}/{relative_path}"
    return url
