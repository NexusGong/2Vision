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


def generate_filename(url: str, prefix: str = "", suffix: str = "", default_ext: str = "png") -> str:
    """生成文件名（基于URL的哈希值）
    
    Args:
        url: 原始URL（用于计算哈希）
        prefix: 文件名前缀（如 img_、video_）
        suffix: 文件名后缀
        default_ext: 当URL中无法解析出扩展名时使用的默认扩展名（如图片用 png，视频用 mp4）
    """
    url_hash = hashlib.md5(url.encode()).hexdigest()
    ext = get_file_extension_from_url(url, default=default_ext)
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
        filename = generate_filename(video_url, prefix="video_", default_ext="mp4")
        
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


def get_file_path_from_url(url: str) -> Optional[str]:
    """
    从URL获取本地文件路径（使用相对路径）
    
    Args:
        url: 图片URL（如 "/static/media/images/filename.png" 或完整URL）
        
    Returns:
        本地文件绝对路径，如果URL无效则返回None
    """
    if not url:
        return None
    
    # 如果是本地URL，提取相对路径
    if url.startswith(config.STATIC_URL_PREFIX):
        relative_path = url[len(config.STATIC_URL_PREFIX):].lstrip("/")
    elif url.startswith("/static/media/"):
        relative_path = url[len("/static/media/"):]
    else:
        # 如果是外部URL，尝试从original_url生成文件名
        # 但这种情况通常不应该删除，因为文件可能不存在
        return None
    
    # 构建完整路径 - 使用相对路径
    # config.STORAGE_DIR 可能是相对路径，需要转换为绝对路径
    # 从 backend 目录开始计算（__file__ 是 backend/app/services/file_storage.py）
    if os.path.isabs(config.STORAGE_DIR):
        storage_dir = Path(config.STORAGE_DIR)
    else:
        # 相对路径，从backend目录开始
        # __file__ = backend/app/services/file_storage.py
        # parent.parent.parent = backend
        backend_dir = Path(__file__).parent.parent.parent
        storage_dir = backend_dir / config.STORAGE_DIR
    
    # 使用相对路径拼接
    file_path = storage_dir / relative_path
    
    # 确保路径在存储目录内（安全检查）
    try:
        file_path = file_path.resolve()
        storage_dir_resolved = storage_dir.resolve()
        if not str(file_path).startswith(str(storage_dir_resolved)):
            logger.warning(f"路径安全检查失败: {file_path} 不在 {storage_dir_resolved} 内")
            return None
    except Exception as e:
        logger.warning(f"路径解析失败: {e}")
        return None
    
    # 返回绝对路径
    return str(file_path)


def delete_image_file(url: str) -> bool:
    """
    删除本地图片文件（使用相对路径）
    
    Args:
        url: 图片URL（如 "/static/media/images/filename.png"）
        
    Returns:
        是否删除成功
    """
    file_path = get_file_path_from_url(url)
    if not file_path:
        logger.warning(f"无法从URL解析文件路径: {url}")
        return False
    
    try:
        # 获取相对路径用于日志显示
        backend_dir = Path(__file__).parent.parent.parent
        try:
            relative_path = os.path.relpath(file_path, backend_dir)
        except ValueError:
            # 如果无法计算相对路径（跨磁盘等），使用文件名
            relative_path = os.path.basename(file_path)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"图片文件已删除: {relative_path}")
            return True
        else:
            logger.warning(f"图片文件不存在: {relative_path}")
            return False
    except Exception as e:
        logger.error(f"删除图片文件失败: {relative_path if 'relative_path' in locals() else file_path}, 错误: {str(e)}")
        return False


def delete_image_files(urls: list[str]) -> dict[str, bool]:
    """
    批量删除本地图片文件
    
    Args:
        urls: 图片URL列表
        
    Returns:
        删除结果字典，key为URL，value为是否删除成功
    """
    results = {}
    for url in urls:
        if url:
            results[url] = delete_image_file(url)
    return results


def delete_video_file(url: str) -> bool:
    """
    删除本地视频文件（使用相对路径）
    
    Args:
        url: 视频URL（如 "/static/media/videos/filename.mp4"）
        
    Returns:
        是否删除成功
    """
    file_path = get_file_path_from_url(url)
    if not file_path:
        logger.warning(f"无法从URL解析文件路径: {url}")
        return False
    
    try:
        # 获取相对路径用于日志显示
        backend_dir = Path(__file__).parent.parent.parent
        try:
            relative_path = os.path.relpath(file_path, backend_dir)
        except ValueError:
            # 如果无法计算相对路径（跨磁盘等），使用文件名
            relative_path = os.path.basename(file_path)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"视频文件已删除: {relative_path}")
            return True
        else:
            logger.warning(f"视频文件不存在: {relative_path}")
            return False
    except Exception as e:
        logger.error(f"删除视频文件失败: {relative_path if 'relative_path' in locals() else file_path}, 错误: {str(e)}")
        return False


def delete_video_files(urls: list[str]) -> dict[str, bool]:
    """
    批量删除本地视频文件
    
    Args:
        urls: 视频URL列表
        
    Returns:
        删除结果字典，key为URL，value为是否删除成功
    """
    results = {}
    for url in urls:
        if url:
            results[url] = delete_video_file(url)
    return results
