"""
视频生成 API
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services.auth import get_optional_user
from app.services.video_generator import (
    generate_video_from_prompt,
    get_video_generation_status
)
from app.services.task_manager import task_manager, TaskStatus
from ark_client import ArkClient

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/video", tags=["video"])


class VideoGenerateRequest(BaseModel):
    """视频生成请求模型"""
    video_prompt: str  # 视频生成提示词（已由分析服务生成）
    duration: int = -1  # doubao-seedance-1-5-pro 支持 [4,12] 范围内的整数，或 -1（自动选择）
    fps: int = 24
    aspect_ratio: str = "16:9"
    history_id: Optional[str] = None
    message_id: Optional[str] = None


@router.post("/generate")
async def generate_video(
    request: VideoGenerateRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    使用视频prompt生成视频
    
    - 直接使用已分析好的视频prompt创建视频生成任务
    """
    try:
        # 输入验证
        if not request.video_prompt or not request.video_prompt.strip():
            raise HTTPException(status_code=400, detail="视频prompt不能为空")
        
        MAX_PROMPT_LENGTH = 10000
        if len(request.video_prompt) > MAX_PROMPT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"视频prompt长度不能超过 {MAX_PROMPT_LENGTH} 个字符"
            )
        
        logger.info(f"开始视频生成，prompt长度: {len(request.video_prompt)}...")
        
        # 初始化Ark客户端
        try:
            ark_client = ArkClient()
        except Exception as e:
            logger.error(f"视频生成服务不可用: {str(e)}")
            raise HTTPException(status_code=503, detail="视频生成服务暂时不可用，请稍后重试")
        
        # 生成视频
        result = await generate_video_from_prompt(
            video_prompt=request.video_prompt,
            ark_client=ark_client,
            duration=request.duration,
            fps=request.fps,
            aspect_ratio=request.aspect_ratio
        )
        
        logger.info(f"视频生成任务创建成功，task_id: {result.get('task_id')}")
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"视频生成失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="视频生成失败，请稍后重试")


@router.get("/task/{task_id}")
async def get_video_task_status(
    task_id: str,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    查询视频生成任务状态
    
    注意：task_id 是我们系统的任务ID，不是火山引擎的task_id
    需要先查询任务管理器，获取任务状态和火山引擎的video_task_id
    """
    try:
        # 首先查询我们自己的任务管理器
        task = task_manager.get_task(task_id)
        
        if not task:
            raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
        
        # 如果任务已经完成或失败，直接返回任务管理器中的状态
        if task.status == TaskStatus.COMPLETED:
            return {
                "status": "completed",
                "task_id": task_id,
                "video_url": task.result.get("video_url") if task.result else None,
                "progress": 100
            }
        
        if task.status == TaskStatus.FAILED:
            return {
                "status": "failed",
                "task_id": task_id,
                "video_url": None,
                "progress": task.progress,
                "error": task.error
            }
        
        # 如果任务还在运行中，需要查询火山引擎的video_task_id
        # video_task_id 应该保存在任务的 result 或 params 中
        video_task_id = None
        if task.result and isinstance(task.result, dict):
            video_task_id = task.result.get("video_task_id")
        
        # 如果没有 video_task_id，说明视频创建任务还没有成功创建
        # 返回任务管理器的当前状态
        if not video_task_id:
            return {
                "status": "processing" if task.status == TaskStatus.RUNNING else "pending",
                "task_id": task_id,
                "video_url": None,
                "progress": task.progress
            }
        
        # 如果有 video_task_id，查询火山引擎的任务状态
        try:
            ark_client = ArkClient()
            video_status = await get_video_generation_status(video_task_id, ark_client)
            
            # 合并任务管理器的进度和火山引擎的状态
            return {
                "status": video_status.get("status", "processing"),
                "task_id": task_id,
                "video_url": video_status.get("video_url"),
                "progress": video_status.get("progress", task.progress)
            }
        except Exception as e:
            # 如果查询火山引擎失败，返回任务管理器的状态
            logger.warning(f"查询火山引擎任务状态失败: {str(e)}，返回任务管理器状态")
            return {
                "status": "processing" if task.status == TaskStatus.RUNNING else "pending",
                "task_id": task_id,
                "video_url": None,
                "progress": task.progress
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询视频生成任务状态失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="查询任务状态失败，请稍后重试")


# ============ 异步视频生成 API ============

async def _run_video_generation(task_id: str, params: dict):
    """后台运行视频生成任务"""
    try:
        task_manager.start_task(task_id)
        
        video_prompt = params["video_prompt"]
        duration = params.get("duration", -1)  # doubao-seedance-1-5-pro 默认自动选择
        fps = params.get("fps", 24)
        aspect_ratio = params.get("aspect_ratio", "16:9")
        
        # 初始化 Ark 客户端
        try:
            ark_client = ArkClient()
        except Exception as e:
            logger.error(f"Ark客户端初始化失败: {str(e)}")
            task_manager.fail_task(task_id, f"客户端初始化失败: {str(e)}")
            return
        
        # 更新进度：开始生成
        task_manager.update_task_progress(task_id, 1, 5)
        
        try:
            # 生成视频
            result = await generate_video_from_prompt(
                video_prompt=video_prompt,
                ark_client=ark_client,
                duration=duration,
                fps=fps,
                aspect_ratio=aspect_ratio
            )
            
            video_task_id = result.get("task_id")
            if not video_task_id:
                raise ValueError("视频生成任务创建失败")
            
            logger.info(f"视频生成任务创建成功 - 系统任务ID: {task_id}, 火山引擎任务ID: {video_task_id}")
            
            # 保存 video_task_id 到任务结果中，以便后续查询
            task = task_manager.get_task(task_id)
            if task:
                if task.result is None:
                    task.result = {}
                task.result["video_task_id"] = video_task_id
                logger.info(f"已保存video_task_id到任务结果中: {task.result}")
            else:
                logger.error(f"无法找到任务 {task_id}，无法保存video_task_id")
            
            # 更新进度：任务创建成功
            task_manager.update_task_progress(task_id, 3, 5)
            
            # 轮询视频生成状态
            max_wait_time = 600  # 10分钟超时
            poll_interval = 5  # 每5秒查询一次
            import time
            start_time = time.time()
            
            logger.info(f"开始轮询视频生成状态 - 系统任务ID: {task_id}, 火山引擎任务ID: {video_task_id}")
            poll_count = 0
            last_logged_status = None
            last_logged_progress = -1
            
            while time.time() - start_time < max_wait_time:
                poll_count += 1
                
                try:
                    status = await get_video_generation_status(video_task_id, ark_client)
                    current_status = status.get("status", "pending")
                    progress = status.get("progress", 0)
                    
                    # 只在状态变化、进度变化超过20%、或每20次轮询时输出日志（减少日志频率）
                    should_log = (
                        current_status != last_logged_status or
                        abs(progress - last_logged_progress) >= 20 or
                        poll_count % 20 == 0
                    )
                    
                    if should_log:
                        if current_status in ["completed", "failed"]:
                            logger.info(f"视频任务状态 - 火山引擎任务ID: {video_task_id}, 状态: {current_status}, 进度: {progress}%")
                        else:
                            logger.debug(f"视频任务状态 - 火山引擎任务ID: {video_task_id}, 状态: {current_status}, 进度: {progress}% (第 {poll_count} 次查询)")
                        last_logged_status = current_status
                        last_logged_progress = progress
                    
                    # 更新进度（3-5之间）
                    task_progress = 3 + int((progress / 100) * 2)
                    task_manager.update_task_progress(task_id, task_progress, 5)
                except Exception as poll_error:
                    # 错误日志仍然输出
                    logger.error(f"查询视频任务状态失败 - 火山引擎任务ID: {video_task_id}, 错误: {str(poll_error)}")
                    # 继续轮询，不要因为一次查询失败就停止
                    time.sleep(poll_interval)
                    continue
                
                if current_status == "completed":
                    # 任务完成
                    task_manager.complete_task(task_id, {
                        "status": "success",
                        "video_url": status.get("video_url"),
                        "video_prompt": video_prompt
                    })
                    logger.info(f"视频生成任务完成: {task_id}, 视频URL: {status.get('video_url', '未找到')}")
                    return
                elif current_status == "failed":
                    # 任务失败
                    task_manager.fail_task(task_id, "视频生成失败")
                    logger.error(f"视频生成任务失败: {task_id}")
                    return
                
                # 等待后继续轮询
                time.sleep(poll_interval)
            
            # 超时
            task_manager.fail_task(task_id, "视频生成超时")
            
        except Exception as e:
            logger.error(f"视频生成任务执行失败: {str(e)}")
            task_manager.fail_task(task_id, str(e))
            
    except Exception as e:
        logger.error(f"后台任务失败: {str(e)}")
        task_manager.fail_task(task_id, str(e))


@router.post("/generate_async")
async def generate_video_async(
    request: VideoGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    异步生成视频（后台任务）
    返回 task_id，前端可通过 /api/video/task/{task_id} 查询进度
    """
    try:
        # 输入验证
        if not request.video_prompt or not request.video_prompt.strip():
            raise HTTPException(status_code=400, detail="视频prompt不能为空")
        
        MAX_PROMPT_LENGTH = 10000
        if len(request.video_prompt) > MAX_PROMPT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"视频prompt长度不能超过 {MAX_PROMPT_LENGTH} 个字符"
            )
        
        # 创建任务
        params = {
            "video_prompt": request.video_prompt,
            "duration": request.duration,
            "fps": request.fps,
            "aspect_ratio": request.aspect_ratio
        }
        task_id = task_manager.create_task(
            "video_generation",
            params,
            history_id=request.history_id or "",
            message_id=request.message_id or ""
        )
        
        # 启动后台任务
        background_tasks.add_task(_run_video_generation, task_id, params)
        
        return {
            "status": "accepted",
            "task_id": task_id,
            "message": "视频生成任务已创建，请通过 /api/video/task/{task_id} 查询进度"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建视频生成任务失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="创建任务失败，请稍后重试")
