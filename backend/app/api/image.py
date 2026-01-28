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
from app.services.usage_manager import check_token_balance, record_usage
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

async def _run_storyboard_generation(task_id: str, params: dict, db: Optional[Session], user: Optional[User], session_id: Optional[str]):
    """后台运行分镜图像生成任务"""
    # 在后台任务中创建新的数据库会话，避免使用传入的会话（可能已关闭）
    from app.database import SessionLocal
    task_db = SessionLocal()
    
    try:
        task_manager.start_task(task_id)
        
        ark_client = ArkClient()
        storyboards = params["storyboards"]
        poetry_info = params["poetry_info"]
        mode = params["mode"]
        size = params["size"]
        reference_images = params.get("reference_images")
        
        total_steps = len(storyboards)
        
        # 计算token消耗（统一token系统）
        # 图像生成：文本分析3,993 tokens + 图片生成等价40,000 tokens = 43,993 tokens/分镜
        # 但根据统一token定价，图像生成等价76,685 tokens/分镜
        IMAGE_TOKENS_PER_STORYBOARD = 76685  # 统一token定价下的图像生成token
        token_used = IMAGE_TOKENS_PER_STORYBOARD * len(storyboards)
        
        # 第一阶段：生成所有图片（不下载）
        generation_results = []
        logger.info(f"开始生成 {total_steps} 张图片...")
        
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
                
                text_content = storyboard.get("text", "")
                # 调试：检查文本字段
                if not text_content and storyboard.get("type") != "cover":
                    logger.warning(f"分镜 {i+1} (非封面) 的 text 字段为空: storyboard={storyboard}")
                
                generation_results.append({
                    "storyboard_index": storyboard.get("index", i + 1),
                    "storyboard_type": storyboard.get("type", "content"),
                    "original_url": original_url,
                    "text": text_content,
                    "title": storyboard.get("title", ""),
                    "is_cover": storyboard.get("type") == "cover"
                })
                
                # 更新进度（生成阶段）
                task_manager.update_task_progress(task_id, i + 1, total_steps, {
                    "storyboard_index": storyboard.get("index", i + 1),
                    "status": "generating"
                })
                
            except Exception as e:
                logger.error(f"分镜 {i+1} 生成失败: {str(e)}")
                generation_results.append({
                    "storyboard_index": storyboard.get("index", i + 1),
                    "storyboard_type": storyboard.get("type", "content"),
                    "original_url": "",
                    "text": storyboard.get("text", ""),
                    "title": storyboard.get("title", ""),
                    "is_cover": storyboard.get("type") == "cover",
                    "error": str(e)
                })
                task_manager.update_task_progress(task_id, i + 1, total_steps)
        
        logger.info(f"图片生成完成，开始批量下载...")
        
        # 第二阶段：整理结果（不再下载到本地，直接使用远程URL）
        image_results = []
        
        for i, result in enumerate(generation_results):
            original_url = result.get("original_url", "")
            # 不再进行本地下载，直接使用原始URL 作为展示用地址
            local_url = original_url
            
            result_item = {
                "storyboard_index": result.get("storyboard_index"),
                "storyboard_type": result.get("storyboard_type"),
                "image_url": local_url,
                "original_url": original_url,  # 保留原始URL（与 image_url 一致，用于前端回退逻辑）
                "text": result.get("text", ""),
                "title": result.get("title", ""),
                "is_cover": result.get("is_cover", False)
            }
            
            # 调试：检查文本字段
            if not result_item.get("text"):
                logger.warning(f"分镜 {i+1} 的 text 字段为空: storyboard_index={result_item.get('storyboard_index')}, is_cover={result_item.get('is_cover')}")
            
            image_results.append(result_item)
            
            # 更新进度（下载阶段）
            task_manager.update_task_progress(task_id, i + 1, total_steps, result_item)
        
        # 检查是否所有图片都成功生成（至少有一张图片有URL）
        success_count = sum(1 for r in image_results if r.get("image_url") or r.get("original_url"))
        if success_count == 0:
            logger.error(f"图片生成失败：没有成功生成任何图片")
            task_manager.fail_task(task_id, "图片生成失败：没有成功生成任何图片")
            return
        
        # 任务成功完成，记录使用（使用新的数据库会话）
        # 只有在成功生成至少一张图片后才扣除次数
        try:
            # 如果传入了 user_id，需要从数据库重新获取用户对象
            task_user = None
            if params.get("user_id"):
                from app.models.user import User
                task_user = task_db.query(User).filter(User.id == params["user_id"]).first()
            record_usage(task_db, "image", token_used, task_user, params.get("session_id"))
            task_db.commit()
            logger.info(f"成功记录使用次数: 用户ID={task_user.id if task_user else None}, 成功生成 {success_count}/{total_steps} 张图片")
        except Exception as e:
            logger.error(f"记录使用失败: {str(e)}")
            task_db.rollback()
        
        # 调试：检查最终返回的数据
        for i, result_item in enumerate(image_results):
            if not result_item.get("text") and not result_item.get("is_cover"):
                logger.warning(f"最终结果中分镜 {i+1} (非封面) 的 text 字段为空: {result_item}")
        
        task_manager.complete_task(task_id, {
            "status": "success",
            "data": image_results,
            "poetry_info": poetry_info
        })
        
        logger.info(f"任务完成，返回 {len(image_results)} 个结果，其中包含文本的分镜数: {sum(1 for r in image_results if r.get('text'))}")
        
    except Exception as e:
        logger.error(f"后台任务失败: {str(e)}", exc_info=True)
        # 任务失败时不扣除次数
        task_manager.fail_task(task_id, str(e))
    finally:
        # 确保数据库会话被关闭
        try:
            task_db.close()
        except Exception as e:
            logger.error(f"关闭数据库会话失败: {str(e)}")


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
        
        # 估算需要的token数量（统一token系统）
        # 图像生成：每个分镜等价76,685 tokens（统一token定价）
        IMAGE_TOKENS_PER_STORYBOARD = 76685
        required_tokens = IMAGE_TOKENS_PER_STORYBOARD
        
        # 检查统一token余额
        allowed, error_msg = check_token_balance(db, current_user, session_id, required_tokens)
        if not allowed:
            raise HTTPException(status_code=403, detail=error_msg)
        
        # 检查并发任务限制
        if not task_manager.can_start_new_task():
            raise HTTPException(status_code=503, detail="当前任务队列已满，请稍后再试")
        
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
        
        # 启动后台任务（不传递 db 和 current_user，在任务内部创建新的会话）
        background_tasks.add_task(_run_storyboard_generation, task_id, params, None, None, session_id)
        
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
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        task_status = task_manager.get_task_status(task_id)
        if not task_status:
            logger.warning(f"任务不存在: {task_id}")
            raise HTTPException(status_code=404, detail="任务不存在或已过期")
        return task_status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询任务状态失败: {task_id}, 错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查询任务状态失败: {str(e)}")


@router.delete("/task/{task_id}")
async def cancel_task(task_id: str):
    """取消任务"""
    success = task_manager.cancel_task(task_id)
    if success:
        return {"status": "cancelled", "task_id": task_id}
    raise HTTPException(status_code=400, detail="任务无法取消（可能已完成或不存在）")


class DeleteImagesRequest(BaseModel):
    """删除图片请求模型"""
    image_urls: List[str]


@router.post("/delete")
async def delete_images(
    request: DeleteImagesRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    批量删除图片文件
    
    Args:
        request: 删除图片请求，包含图片URL列表
        
    Returns:
        删除结果
    """
    try:
        from app.services.file_storage import delete_image_files
        
        image_urls = request.image_urls
        
        if not image_urls:
            return {
                "status": "success",
                "message": "没有需要删除的图片",
                "deleted_count": 0
            }
        
        results = delete_image_files(image_urls)
        deleted_count = sum(1 for success in results.values() if success)
        
        logger.info(f"删除图片请求: 共 {len(image_urls)} 张，成功删除 {deleted_count} 张")
        
        return {
            "status": "success",
            "message": f"成功删除 {deleted_count}/{len(image_urls)} 张图片",
            "deleted_count": deleted_count,
            "total_count": len(image_urls),
            "results": results
        }
    except Exception as e:
        logger.error(f"删除图片失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"删除图片失败: {str(e)}")


@router.get("/tasks/active")
async def get_active_tasks():
    """获取所有活跃任务"""
    return {"tasks": task_manager.get_active_tasks()}

