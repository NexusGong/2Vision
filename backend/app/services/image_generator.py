"""
图像生成服务
"""
import logging
import asyncio
from typing import List, Dict, Any, Optional, Literal
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config
from app.services.text_analyzer import generate_image_prompt_for_segment, generate_image_prompt_for_storyboard
from app.services.file_storage import download_and_save_image, get_local_url

logger = logging.getLogger(__name__)

async def generate_images_for_segments(
    segments: List[Dict[str, Any]],
    original_text: str,
    ark_client: Optional[Any] = None,
    size: str = "2048x2048",
    reference_images: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    为多个句段生成图像
    
    Args:
        segments: 句段列表
        original_text: 原始文本
        ark_client: Ark客户端实例
        size: 图像尺寸
        reference_images: 参考图像列表
        
    Returns:
        生成的图像信息列表
    """
    if not ark_client:
        raise ValueError("需要提供Ark客户端")
    
    logger.debug(f"开始生成 {len(segments)} 张图像")
    
    image_results = []
    
    # 为每个句段生成图像
    for i, segment in enumerate(segments):
        try:
            # 生成图像提示词
            image_prompt = generate_image_prompt_for_segment(segment, original_text)
            
            # 如果是第一个句段，可以考虑作为封面
            if i == 0:
                image_prompt = f"根据以下古诗词/古文生成封面图：{original_text}\n\n{image_prompt}\n风格：中国古典绘画风格，封面设计，具有诗意和文学性"
            
            # 调用图像生成API
            image_result = ark_client.images_generate(
                model=config.VISION_MODEL_NAME,
                prompt=image_prompt,
                image=reference_images if reference_images else None,
                sequential_image_generation="auto" if i > 0 else "disabled",
                response_format="url",
                size=size,
                stream=False,
                watermark=True
            )
            
            # 提取图像URL
            image_urls = [item.get("url", "") for item in image_result.get("data", [])]
            
            if image_urls:
                original_url = image_urls[0]
                # 下载并保存图片到本地
                local_path = await download_and_save_image(original_url)
                if local_path:
                    # 使用本地URL
                    local_url = get_local_url(local_path)
                    logger.debug(f"图片已保存到本地: {local_path}, URL: {local_url}")
                    image_results.append({
                        "segment_index": segment.get("index", i + 1),
                        "image_url": local_url,
                        "original_url": original_url,  # 保留原始URL作为备份
                        "text_segment": segment.get("text", ""),
                        "is_cover": i == 0
                    })
                else:
                    # 下载失败，使用原始URL
                    logger.warning(f"图片下载失败，使用原始URL: {original_url[:100]}...")
                    image_results.append({
                        "segment_index": segment.get("index", i + 1),
                        "image_url": original_url,
                        "text_segment": segment.get("text", ""),
                        "is_cover": i == 0
                    })
            else:
                logger.warning(f"句段 {i+1} 未返回图像")
                image_results.append({
                    "segment_index": segment.get("index", i + 1),
                    "image_url": "",
                    "text_segment": segment.get("text", ""),
                    "is_cover": i == 0
                })
                
        except Exception as e:
            logger.error(f"句段 {i+1} 生成失败: {str(e)}")
            image_results.append({
                "segment_index": segment.get("index", i + 1),
                "image_url": "",
                "text_segment": segment.get("text", ""),
                "is_cover": i == 0,
                "error": str(e)
            })
    
    success_count = len([r for r in image_results if r.get('image_url')])
    logger.debug(f"完成: {success_count}/{len(segments)} 张")
    return image_results

async def generate_storybook_images_stream(
    segments: List[Dict[str, Any]],
    original_text: str,
    ark_client: Optional[Any] = None,
    size: str = "2048x2048",
    reference_images: Optional[List[str]] = None
):
    """
    流式生成图像（用于实时返回）
    """
    if not ark_client:
        raise ValueError("需要提供Ark客户端")
    
    for i, segment in enumerate(segments):
        try:
            # 生成图像提示词
            image_prompt = generate_image_prompt_for_segment(segment, original_text)
            
            if i == 0:
                image_prompt = f"根据以下古诗词/古文生成封面图：{original_text}\n\n{image_prompt}\n风格：中国古典绘画风格，封面设计"
            
            for url in ark_client.images_generate_stream(
                model=config.VISION_MODEL_NAME,
                prompt=image_prompt,
                image=reference_images if reference_images else None,
                sequential_image_generation="auto" if i > 0 else "disabled",
                response_format="url",
                size=size,
                watermark=True
            ):
                yield {
                    "segment_index": segment.get("index", i + 1),
                    "image_url": url,
                    "text_segment": segment.get("text", ""),
                    "is_cover": i == 0
                }
                await asyncio.sleep(0.01)
                
        except Exception as e:
            logger.error(f"流式生成失败: {str(e)}")
            yield {
                "segment_index": segment.get("index", i + 1),
                "image_url": "",
                "text_segment": segment.get("text", ""),
                "is_cover": i == 0,
                "error": str(e)
            }


async def generate_images_from_storyboards(
    storyboards: List[Dict[str, Any]],
    poetry_info: Dict[str, Any],
    mode: Literal["storybook", "comics"] = "storybook",
    ark_client: Optional[Any] = None,
    size: str = "2048x2048",
    reference_images: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    基于用户确认/编辑后的分镜数据生成图像
    
    Args:
        storyboards: 分镜数据列表
        poetry_info: 诗词基本信息
        mode: 生成模式 (storybook/comics)
        ark_client: Ark客户端实例
        size: 图像尺寸
        reference_images: 参考图像列表
        
    Returns:
        生成的图像信息列表
    """
    if not ark_client:
        raise ValueError("需要提供Ark客户端")
    
    logger.debug(f"生成 {len(storyboards)} 个分镜 ({mode}模式)")
    
    # 第一阶段：生成所有图片（不下载）
    generation_results = []
    
    logger.debug(f"开始生成 {len(storyboards)} 张图片...")
    for i, storyboard in enumerate(storyboards):
        try:
            # 使用分镜中的 image_prompt，或者生成新的
            image_prompt = storyboard.get("image_prompt", "")
            
            if not image_prompt:
                image_prompt = generate_image_prompt_for_storyboard(storyboard, poetry_info, mode)
            else:
                # 增强提示词
                style_hints = storyboard.get("style_hints", "")
                if style_hints and style_hints not in image_prompt:
                    image_prompt = f"{image_prompt}\n风格：{style_hints}"
                
                # 根据模式添加额外要求
                if mode == "storybook" and "竖版" not in image_prompt:
                    image_prompt = f"{image_prompt}\n画面要求：竖版构图，意境深远"
                elif mode == "comics" and "方形" not in image_prompt:
                    image_prompt = f"{image_prompt}\n画面要求：方形构图，叙事清晰"
            
            storyboard_type = storyboard.get("type", "content")
            storyboard_index = storyboard.get("index", i + 1)
            is_cover = storyboard_type == "cover"
            
            # 调用图像生成API
            image_result = ark_client.images_generate(
                model=config.VISION_MODEL_NAME,
                prompt=image_prompt,
                image=reference_images if reference_images else None,
                sequential_image_generation="auto" if i > 0 else "disabled",
                response_format="url",
                size=size,
                stream=False,
                watermark=True
            )
            
            image_urls = [item.get("url", "") for item in image_result.get("data", [])]
            
            if image_urls:
                original_url = image_urls[0]
                generation_results.append({
                    "storyboard_index": storyboard_index,
                    "storyboard_type": storyboard_type,
                    "original_url": original_url,
                    "text": storyboard.get("text", ""),
                    "title": storyboard.get("title", ""),
                    "is_cover": is_cover
                })
            else:
                logger.warning(f"分镜 {storyboard_index} 未返回图像")
                generation_results.append({
                    "storyboard_index": storyboard_index,
                    "storyboard_type": storyboard_type,
                    "original_url": "",
                    "text": storyboard.get("text", ""),
                    "title": storyboard.get("title", ""),
                    "is_cover": is_cover
                })
                
        except Exception as e:
            logger.error(f"分镜 {storyboard.get('index', i + 1)} 生成失败: {str(e)}")
            generation_results.append({
                "storyboard_index": storyboard.get("index", i + 1),
                "storyboard_type": storyboard.get("type", "content"),
                "original_url": "",
                "text": storyboard.get("text", ""),
                "title": storyboard.get("title", ""),
                "is_cover": storyboard.get("type") == "cover",
                "error": str(e)
            })
    
    logger.debug(f"图片生成完成，开始批量下载...")
    
    # 第二阶段：批量下载所有图片
    image_results = []
    for result in generation_results:
        original_url = result.get("original_url", "")
        
        if original_url:
            # 下载并保存图片到本地
            local_path = await download_and_save_image(original_url)
            if local_path:
                # 使用本地URL
                local_url = get_local_url(local_path)
                logger.debug(f"图片已保存到本地: {local_path}, URL: {local_url}")
                image_results.append({
                    "storyboard_index": result.get("storyboard_index"),
                    "storyboard_type": result.get("storyboard_type"),
                    "image_url": local_url,
                    "original_url": original_url,  # 保留原始URL作为备份
                    "text": result.get("text", ""),
                    "title": result.get("title", ""),
                    "is_cover": result.get("is_cover", False)
                })
            else:
                # 下载失败，使用原始URL
                logger.warning(f"图片下载失败，使用原始URL: {original_url[:100]}...")
                image_results.append({
                    "storyboard_index": result.get("storyboard_index"),
                    "storyboard_type": result.get("storyboard_type"),
                    "image_url": original_url,
                    "original_url": original_url,
                    "text": result.get("text", ""),
                    "title": result.get("title", ""),
                    "is_cover": result.get("is_cover", False)
                })
        else:
            # 没有原始URL，直接添加结果
            image_results.append({
                "storyboard_index": result.get("storyboard_index"),
                "storyboard_type": result.get("storyboard_type"),
                "image_url": "",
                "original_url": "",
                "text": result.get("text", ""),
                "title": result.get("title", ""),
                "is_cover": result.get("is_cover", False),
                "error": result.get("error", "")
            })
    
    success_count = len([r for r in image_results if r.get('image_url')])
    logger.debug(f"完成: 生成 {len(generation_results)} 张，成功下载 {success_count} 张")
    return image_results

