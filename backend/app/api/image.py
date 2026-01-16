"""
图像生成API路由
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Literal
from sqlalchemy.orm import Session
import json
import asyncio
from app.database import get_db
from app.services.auth import get_current_user, get_optional_user
from app.models.user import User
from app.services.usage_manager import check_usage_limit, record_usage
from app.services.image_generator import (
    generate_images_for_segments,
    generate_storybook_images_stream,
    generate_images_from_storyboards
)
from app.services.text_analyzer import generate_image_prompt_for_storyboard
from app.services.task_manager import task_manager, TaskStatus
from ark_client import ArkClient
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/image", tags=["图像生成"])

class ImageGenerateRequest(BaseModel):
    """图像生成请求模型"""
    segments: List[dict]
    original_text: str
    size: str = "2048x2048"
    reference_images: Optional[List[str]] = None


class PoetryInfoModel(BaseModel):
    """诗词基本信息模型"""
    title: str
    author: str
    dynasty: str
    full_text: str
    creation_background: Optional[str] = ""
    era_background: Optional[str] = ""


class StoryboardModel(BaseModel):
    """分镜数据模型"""
    index: int
    type: str  # "cover" 或 "content"
    title: str
    subtitle: Optional[str] = None
    text: str
    scene_description: Optional[str] = ""
    image_prompt: str
    style_hints: Optional[str] = ""


class StoryboardGenerateRequest(BaseModel):
    """基于分镜的图像生成请求模型"""
    poetry_info: PoetryInfoModel
    storyboards: List[StoryboardModel]
    mode: Literal["storybook", "comics"] = "storybook"
    size: str = "2048x2048"
    reference_images: Optional[List[str]] = None
    history_id: Optional[str] = ""  # 前端历史记录 ID
    message_id: Optional[str] = ""  # 前端消息 ID

@router.post("/generate")
async def generate_images(
    request: ImageGenerateRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """生成图像"""
    try:
        # 初始化Ark客户端
        try:
            ark_client = ArkClient()
        except Exception as e:
            logger.error(f"图像生成服务不可用: {str(e)}")
            raise HTTPException(status_code=503, detail="图像生成服务暂时不可用，请稍后重试")
        
        # 生成图像
        image_results = await generate_images_for_segments(
            segments=request.segments,
            original_text=request.original_text,
            ark_client=ark_client,
            size=request.size,
            reference_images=request.reference_images
        )
        
        return {
            "status": "success",
            "data": image_results
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"图像生成失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="图像生成失败，请稍后重试")

@router.post("/generate_stream")
async def generate_images_stream(
    request: ImageGenerateRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """流式生成图像"""
    try:
        # 初始化Ark客户端
        try:
            ark_client = ArkClient()
        except Exception as e:
            logger.error(f"图像生成服务不可用: {str(e)}")
            raise HTTPException(status_code=503, detail="图像生成服务暂时不可用，请稍后重试")
        
        async def event_generator():
            yield f"event: image-generation\ndata: {json.dumps({'status': 'start'}, ensure_ascii=False)}\n\n"
            
            async for image_result in generate_storybook_images_stream(
                segments=request.segments,
                original_text=request.original_text,
                ark_client=ark_client,
                size=request.size,
                reference_images=request.reference_images
            ):
                payload = {"status": "content", "data": image_result}
                yield f"event: image-generation\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0)
            
            yield f"event: image-generation\ndata: {json.dumps({'status': 'end'}, ensure_ascii=False)}\n\n"
        
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache"}
        )
    except Exception as e:
        logger.error(f"流式图像生成失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="流式图像生成失败，请稍后重试")


@router.post("/generate_from_storyboard")
async def generate_from_storyboard(
    request: StoryboardGenerateRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    基于用户确认/编辑后的分镜数据生成图像
    
    - 接收完整的诗词信息和分镜列表
    - 根据分镜中的 image_prompt 和 style_hints 生成图像
    - 封面和内容页使用不同的生成策略
    """
    try:
        # 验证分镜数据
        if not request.storyboards:
            raise HTTPException(status_code=400, detail="分镜数据不能为空")
        
        logger.info(f"开始基于分镜生成图像，共 {len(request.storyboards)} 个分镜")
        
        # 初始化Ark客户端
        try:
            ark_client = ArkClient()
        except Exception as e:
            logger.error(f"图像生成服务不可用: {str(e)}")
            raise HTTPException(status_code=503, detail="图像生成服务暂时不可用，请稍后重试")
        
        # 转换分镜数据为字典格式
        storyboards_dict = [sb.model_dump() for sb in request.storyboards]
        poetry_info_dict = request.poetry_info.model_dump()
        
        # 生成图像
        image_results = await generate_images_from_storyboards(
            storyboards=storyboards_dict,
            poetry_info=poetry_info_dict,
            mode=request.mode,
            ark_client=ark_client,
            size=request.size,
            reference_images=request.reference_images
        )
        
        logger.info(f"图像生成完成，成功生成 {len([r for r in image_results if r.get('image_url')])} 张图像")
        
        return {
            "status": "success",
            "data": image_results,
            "poetry_info": poetry_info_dict
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"基于分镜生成图像失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"图像生成失败: {str(e)}")


# ============ 后台任务相关 API ============

async def _run_storyboard_generation(task_id: str, params: dict, db: Session, user: Optional[User], session_id: Optional[str]):
    """后台运行分镜图像生成任务"""
    try:
        task_manager.start_task(task_id)
        
        ark_client = ArkClient()
        storyboards = params["storyboards"]
        poetry_info = params["poetry_info"]
        mode = params["mode"]
        size = params["size"]
        reference_images = params.get("reference_images")
        
        total_steps = len(storyboards)
        image_results = []
        
        # 记录使用（在生成完成后）
        token_used = 0  # 可以根据实际消耗计算
        
        for i, storyboard in enumerate(storyboards):
            try:
                from app.services.text_analyzer import generate_image_prompt_for_storyboard as gen_prompt
                
                image_prompt = storyboard.get("image_prompt", "")
                if not image_prompt:
                    image_prompt = gen_prompt(storyboard, poetry_info, mode)
                else:
                    style_hints = storyboard.get("style_hints", "")
                    if style_hints and style_hints not in image_prompt:
                        image_prompt = f"{image_prompt}\n风格：{style_hints}"
                    
                    if mode == "storybook" and "竖版" not in image_prompt:
                        image_prompt = f"{image_prompt}\n画面要求：竖版构图，意境深远"
                    elif mode == "comics" and "方形" not in image_prompt:
                        image_prompt = f"{image_prompt}\n画面要求：方形构图，叙事清晰"
                
                image_result = ark_client.images_generate(
                    model="doubao-seedream-4-0-250828",
                    prompt=image_prompt,
                    image=reference_images if reference_images else None,
                    sequential_image_generation="auto" if i > 0 else "disabled",
                    response_format="url",
                    size=size,
                    stream=False,
                    watermark=True
                )
                
                image_urls = [item.get("url", "") for item in image_result.get("data", [])]
                
                original_url = image_urls[0] if image_urls else ""
                local_url = original_url
                
                # 下载并保存图片到本地
                if original_url:
                    from app.services.file_storage import download_and_save_image, get_local_url
                    local_path = await download_and_save_image(original_url)
                    if local_path:
                        local_url = get_local_url(local_path)
                        logger.info(f"图片已保存到本地: {local_path}, URL: {local_url}")
                
                result_item = {
                    "storyboard_index": storyboard.get("index", i + 1),
                    "storyboard_type": storyboard.get("type", "content"),
                    "image_url": local_url,
                    "original_url": original_url,  # 保留原始URL作为备份
                    "text": storyboard.get("text", ""),
                    "title": storyboard.get("title", ""),
                    "is_cover": storyboard.get("type") == "cover"
                }
                image_results.append(result_item)
                
                # 更新进度
                task_manager.update_task_progress(task_id, i + 1, total_steps, result_item)
                
            except Exception as e:
                logger.error(f"分镜 {i+1} 生成失败: {str(e)}")
                image_results.append({
                    "storyboard_index": storyboard.get("index", i + 1),
                    "storyboard_type": storyboard.get("type", "content"),
                    "image_url": "",
                    "text": storyboard.get("text", ""),
                    "title": storyboard.get("title", ""),
                    "is_cover": storyboard.get("type") == "cover",
                    "error": str(e)
                })
                task_manager.update_task_progress(task_id, i + 1, total_steps)
        
        # 任务完成，记录使用
        try:
            record_usage(db, "image", token_used, user, session_id)
        except Exception as e:
            logger.error(f"记录使用失败: {str(e)}")
        
        task_manager.complete_task(task_id, {
            "status": "success",
            "data": image_results,
            "poetry_info": poetry_info
        })
        
    except Exception as e:
        logger.error(f"后台任务失败: {str(e)}")
        task_manager.fail_task(task_id, str(e))


@router.post("/generate_from_storyboard_async")
async def generate_from_storyboard_async(
    request: StoryboardGenerateRequest,
    background_tasks: BackgroundTasks,
    http_request: Request,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    异步生成图像（后台任务）
    返回 task_id，前端可通过 /task/{task_id} 查询进度
    """
    try:
        if not request.storyboards:
            raise HTTPException(status_code=400, detail="分镜数据不能为空")
        
        # 获取session_id（非登录用户）
        session_id = http_request.headers.get("X-Session-Id")
        
        # 检查使用次数限制
        allowed, error_msg = check_usage_limit(db, current_user, session_id)
        if not allowed:
            raise HTTPException(status_code=403, detail=error_msg)
        
        # 创建任务
        params = {
            "storyboards": [sb.model_dump() for sb in request.storyboards],
            "poetry_info": request.poetry_info.model_dump(),
            "mode": request.mode,
            "size": request.size,
            "reference_images": request.reference_images,
            "user_id": current_user.id if current_user else None,
            "session_id": session_id
        }
        task_id = task_manager.create_task(
            "storyboard_generation", 
            params, 
            history_id=request.history_id or "",
            message_id=request.message_id or ""
        )
        
        # 启动后台任务
        background_tasks.add_task(_run_storyboard_generation, task_id, params, db, current_user, session_id)
        
        return {
            "status": "accepted",
            "task_id": task_id,
            "message": "任务已创建，请通过 /api/image/task/{task_id} 查询进度"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建后台任务失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="创建任务失败，请稍后重试")


@router.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """查询任务状态"""
    task_status = task_manager.get_task_status(task_id)
    if not task_status:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task_status


@router.delete("/task/{task_id}")
async def cancel_task(task_id: str):
    """取消任务"""
    success = task_manager.cancel_task(task_id)
    if success:
        return {"status": "cancelled", "task_id": task_id}
    raise HTTPException(status_code=400, detail="任务无法取消（可能已完成或不存在）")


@router.get("/tasks/active")
async def get_active_tasks():
    """获取所有活跃任务"""
    return {"tasks": task_manager.get_active_tasks()}

