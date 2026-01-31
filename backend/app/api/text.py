"""
文本分析API路由
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.auth import get_current_user, get_optional_user
from app.models.user import User
from app.services.text_analyzer import analyze_ancient_text, analyze_poetry_with_storyboard
from app.services.task_manager import task_manager, TaskStatus
from app.services.content_validator import validate_text_input, ContentValidator
from ark_client import ArkClient
from typing import Optional, Literal, List
import logging
import re

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/text", tags=["文本分析"])

class TextAnalysisRequest(BaseModel):
    """文本分析请求模型"""
    text: str

class TextAnalysisResponse(BaseModel):
    """文本分析响应模型"""
    status: str
    data: dict


class PoetryAnalysisRequest(BaseModel):
    """诗词深度分析请求模型"""
    text: str
    mode: Literal["storybook", "comics"] = "storybook"
    generation_type: Optional[Literal["image", "video"]] = "image"  # 生成类型
    history_id: Optional[str] = ""  # 前端历史记录 ID
    message_id: Optional[str] = ""  # 前端消息 ID


class PoetryInfo(BaseModel):
    """诗词基本信息"""
    title: str
    author: str
    dynasty: str
    full_text: str
    creation_background: str
    era_background: str


class LineAnalysis(BaseModel):
    """逐句分析"""
    line_number: int
    line: str
    word_explanation: str
    interpretation: str
    imagery: List[str]
    emotion: str
    rhetoric: str


class Storyboard(BaseModel):
    """分镜数据"""
    index: int
    type: str  # "cover" 或 "content"
    title: str
    subtitle: Optional[str] = None
    text: str
    scene_description: str
    image_prompt: str
    style_hints: str


class PoetryAnalysisResponse(BaseModel):
    """诗词深度分析响应模型"""
    status: str
    data: dict

@router.post("/analyze", response_model=TextAnalysisResponse)
async def analyze_text(
    request: TextAnalysisRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """分析古诗词或古文"""
    try:
        # 输入验证：检查文本长度
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="文本不能为空")
        
        # 限制文本长度（防止过长的输入）
        MAX_TEXT_LENGTH = 10000
        if len(request.text) > MAX_TEXT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"文本长度不能超过 {MAX_TEXT_LENGTH} 个字符"
            )
        
        # 清理输入：移除潜在的危险字符（保留中文、标点等）
        cleaned_text = re.sub(r'[^\u4e00-\u9fff\w\s\.,;:!?。，、；：！？\n\r\t]', '', request.text)
        
        # 内容验证：确保是古诗古文（如果启用）
        from config import config
        if hasattr(config, 'ENABLE_CONTENT_VALIDATION') and config.ENABLE_CONTENT_VALIDATION:
            is_valid, error_message = validate_text_input(cleaned_text)
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_message)
        
        # 初始化Ark客户端
        try:
            ark_client = ArkClient()
        except Exception as e:
            logger.warning(f"Ark客户端初始化失败: {str(e)}，将使用基础分析")
            ark_client = None
        
        # 执行分析
        analysis_result = await analyze_ancient_text(cleaned_text, ark_client)
        
        return {
            "status": "success",
            "data": analysis_result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"文本分析失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="文本分析失败，请稍后重试")


@router.post("/analyze_poetry", response_model=PoetryAnalysisResponse)
async def analyze_poetry(
    request: PoetryAnalysisRequest,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    深度分析古诗词/古文并生成分镜脚本
    
    - 查询诗词完整版本、作者、朝代
    - 分析创作背景和时代背景
    - 逐字逐句细致分析
    - 生成用于图像创作的分镜数据
    """
    try:
        # 输入验证：检查文本长度
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="文本不能为空")
        
        # 限制文本长度
        MAX_TEXT_LENGTH = 5000
        if len(request.text) > MAX_TEXT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"文本长度不能超过 {MAX_TEXT_LENGTH} 个字符"
            )
        
        # 清理输入：保留中文、标点、数字、字母
        cleaned_text = re.sub(
            r'[^\u4e00-\u9fff\w\s\.,;:!?。，、；：！？""''（）【】《》\n\r\t\-]',
            '',
            request.text
        )
        
        # 内容验证：确保是古诗古文（如果启用）
        from config import config
        if hasattr(config, 'ENABLE_CONTENT_VALIDATION') and config.ENABLE_CONTENT_VALIDATION:
            is_valid, error_message = validate_text_input(cleaned_text)
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_message)
        
        logger.debug(f"开始诗词分析，模式: {request.mode}，生成类型: {request.generation_type or 'image'}，文本: {cleaned_text[:50]}...")
        
        # 初始化Ark客户端
        try:
            ark_client = ArkClient()
        except Exception as e:
            logger.warning(f"Ark客户端初始化失败: {str(e)}，将使用基础分析")
            ark_client = None
        
        # 执行深度分析
        generation_type = request.generation_type or "image"
        
        # 视频模式使用独立的分析函数
        if generation_type == "video":
            from app.services.text_analyzer import analyze_poetry_for_video
            analysis_result = await analyze_poetry_for_video(
                text=cleaned_text,
                ark_client=ark_client
            )
            # 视频分析结果已经包含 video_prompt_data，不需要额外生成
            logger.debug(f"视频专用分析完成，生成 {len(analysis_result.get('line_analysis', []))} 个逐句分析")
        else:
            # 图像模式使用原有的分析函数
            analysis_result = await analyze_poetry_with_storyboard(
                text=cleaned_text,
                mode=request.mode,
                generation_type=generation_type,
                ark_client=ark_client
            )
            logger.debug(f"诗词分析完成，生成 {len(analysis_result.get('storyboards', []))} 个分镜")
        
        return {
            "status": "success",
            "data": analysis_result
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"诗词分析失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="诗词分析失败，请稍后重试")


# ============ 异步文本分析 API ============

async def _run_poetry_analysis(task_id: str, params: dict):
    """后台运行诗词分析任务"""
    try:
        task_manager.start_task(task_id)
        
        text = params["text"]
        mode = params["mode"]
        
        # 初始化 Ark 客户端
        try:
            ark_client = ArkClient()
        except Exception as e:
            logger.warning(f"Ark客户端初始化失败: {str(e)}")
            ark_client = None
        
        # 更新进度：开始分析
        task_manager.update_task_progress(task_id, 1, 3)
        
        # 执行分析
        generation_type = params.get("generation_type", "image")
        
        # 视频模式使用独立的分析函数
        if generation_type == "video":
            from app.services.text_analyzer import analyze_poetry_for_video
            analysis_result = await analyze_poetry_for_video(
                text=text,
                ark_client=ark_client
            )
            # 视频分析结果已经包含 video_prompt_data，不需要额外生成
            logger.debug("视频专用分析完成")
        else:
            # 图像模式使用原有的分析函数
            analysis_result = await analyze_poetry_with_storyboard(
                text=text,
                mode=mode,
                generation_type=generation_type,
                ark_client=ark_client
            )
        
        # 更新进度：分析完成
        task_manager.update_task_progress(task_id, 3, 3)
        
        # 任务完成
        task_manager.complete_task(task_id, {
            "status": "success",
            "data": analysis_result
        })
        
        logger.debug(f"诗词分析任务完成: {task_id}")
        
    except Exception as e:
        logger.error(f"诗词分析任务失败: {str(e)}")
        task_manager.fail_task(task_id, str(e))


@router.post("/analyze_poetry_async")
async def analyze_poetry_async(
    request: PoetryAnalysisRequest,
    background_tasks: BackgroundTasks,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """
    异步深度分析古诗词/古文（后台任务）
    返回 task_id，前端可通过 /api/text/task/{task_id} 查询进度
    """
    try:
        # 输入验证
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="文本不能为空")
        
        MAX_TEXT_LENGTH = 5000
        if len(request.text) > MAX_TEXT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"文本长度不能超过 {MAX_TEXT_LENGTH} 个字符"
            )
        
        # 清理输入
        cleaned_text = re.sub(
            r'[^\u4e00-\u9fff\w\s\.,;:!?。，、；：！？""''（）【】《》\n\r\t\-]',
            '',
            request.text
        )
        
        # 内容验证：确保是古诗古文（如果启用）
        from config import config
        if hasattr(config, 'ENABLE_CONTENT_VALIDATION') and config.ENABLE_CONTENT_VALIDATION:
            is_valid, error_message = validate_text_input(cleaned_text)
            if not is_valid:
                raise HTTPException(status_code=400, detail=error_message)
        
        # 创建任务
        params = {
            "text": cleaned_text,
            "mode": request.mode,
            "generation_type": request.generation_type or "image"
        }
        task_id = task_manager.create_task(
            "poetry_analysis", 
            params,
            history_id=request.history_id or "",
            message_id=request.message_id or ""
        )
        
        # 启动后台任务
        background_tasks.add_task(_run_poetry_analysis, task_id, params)
        
        return {
            "status": "accepted",
            "task_id": task_id,
            "message": "分析任务已创建，请通过 /api/text/task/{task_id} 查询进度"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建分析任务失败: {str(e)}")
        # 不泄露内部错误详情
        raise HTTPException(status_code=500, detail="创建任务失败，请稍后重试")


@router.get("/task/{task_id}")
async def get_analysis_task_status(task_id: str):
    """查询文本分析任务状态"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        task_status = task_manager.get_task_status(task_id)
        if not task_status:
            logger.warning(f"文本分析任务不存在: {task_id}")
            raise HTTPException(status_code=404, detail="任务不存在或已过期")
        return task_status
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"查询文本分析任务状态失败: {task_id}, 错误: {str(e)}")
        raise HTTPException(status_code=500, detail=f"查询任务状态失败: {str(e)}")

