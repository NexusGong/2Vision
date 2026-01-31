"""
视频生成服务
"""
import logging
from typing import Dict, Any, Optional, List
from ark_client import ArkClient
from config import config

logger = logging.getLogger(__name__)


async def generate_video_from_prompt(
    video_prompt: str,
    ark_client: Optional[Any] = None,
    duration: int = -1,  # doubao-seedance-1-5-pro 支持 [4,12] 范围内的整数，或 -1（自动选择）
    fps: int = 24,
    aspect_ratio: str = "16:9"
) -> Dict[str, Any]:
    """
    使用视频prompt生成视频（直接使用已分析好的prompt）
    
    Args:
        video_prompt: 视频生成提示词（已由分析服务生成）
        ark_client: Ark客户端实例
        duration: 视频时长（秒）
            - doubao-seedance-1-5-pro: 支持 [4,12] 范围内的整数，或 -1（自动选择）
            - 其他模型: 根据模型文档确定支持的范围
        fps: 帧率
        aspect_ratio: 宽高比
        
    Returns:
        包含任务ID的字典
    """
    try:
        if not ark_client:
            ark_client = ArkClient()
        
        if not video_prompt or not video_prompt.strip():
            raise ValueError("视频prompt不能为空")
        
        # 创建视频生成任务
        logger.debug("创建视频生成任务...")
        video_task = ark_client.videos_create(
            model=config.VIDEO_MODEL_NAME,
            prompt=video_prompt,
            duration=duration,
            fps=fps,
            aspect_ratio=aspect_ratio
        )
        
        task_id = video_task.get("task_id")
        if not task_id:
            raise ValueError("视频生成任务创建失败")
        
        return {
            "status": "success",
            "task_id": task_id
        }
        
    except Exception as e:
        logger.error(f"视频生成失败: {str(e)}")
        raise Exception(f"视频生成失败: {str(e)}")


async def get_video_generation_status(
    task_id: str,
    ark_client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    查询视频生成任务状态
    
    Args:
        task_id: 任务ID
        ark_client: Ark客户端实例
        
    Returns:
        任务状态信息
    """
    try:
        if not ark_client:
            ark_client = ArkClient()
        
        status = ark_client.videos_get(task_id)
        return status
        
    except Exception as e:
        logger.error(f"查询视频生成任务状态失败: {str(e)}")
        raise Exception(f"查询视频生成任务状态失败: {str(e)}")
