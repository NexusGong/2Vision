"""
火山引擎 Ark 客户端
从基础项目复制并适配
"""
try:
    from volcenginesdkarkruntime import Ark
    from volcenginesdkarkruntime.types.images.images import SequentialImageGenerationOptions
    ARK_SDK_AVAILABLE = True
except ImportError:
    # 如果 SDK 不可用，创建一个占位类
    ARK_SDK_AVAILABLE = False
    Ark = None
    SequentialImageGenerationOptions = None
    import warnings
    warnings.warn("volcenginesdkarkruntime 未安装，请使用 'pip install volcengine-python-sdk[ark]' 安装")

from typing import List, Dict, Any, Optional
import os
import logging
import requests
from dotenv import load_dotenv

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 加载环境变量
load_dotenv()

class ArkClient:
    def __init__(self):
        if not ARK_SDK_AVAILABLE:
            raise ImportError("volcenginesdkarkruntime 未安装，请使用 'pip install volcengine-python-sdk[ark]' 安装")
        
        # 从环境变量获取配置
        # 火山引擎 ARK 支持两种认证方式：
        # 1. api_key: 直接使用 API Key（推荐）
        # 2. ak + sk: 使用 Access Key 和 Secret Key
        self.api_key = os.getenv("ARK_API_KEY")
        self.ak = os.getenv("ARK_AK")  # Access Key
        self.sk = os.getenv("ARK_SK")  # Secret Key
        self.base_url = os.getenv("ARK_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3")
        
        # 验证至少有一种认证方式
        if not self.api_key and not (self.ak and self.sk):
            raise ValueError(
                "请设置ARK_API_KEY环境变量，或者同时设置ARK_AK和ARK_SK环境变量。\n"
                "获取方式：访问 https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey"
            )
        
        # 检查 API key 是否为示例值
        if self.api_key and (self.api_key.startswith("your_") or (len(self.api_key) < 20 and not "-" in self.api_key)):
            raise ValueError(
                "ARK_API_KEY 看起来是示例值，请配置真实的 API Key。\n"
                "获取方式：访问 https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey"
            )
        
        # 初始化客户端
        if self.api_key:
            # 使用 API Key 认证
            self.client = Ark(
                base_url=self.base_url,
                api_key=self.api_key
            )
        else:
            # 使用 AK/SK 认证
            self.client = Ark(
                base_url=self.base_url,
                ak=self.ak,
                sk=self.sk
            )
    
    def chat_completion(
        self,
        model: str,
        messages: List[Dict],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        stream: bool = False,
        response_format: Optional[str] = None,
        disable_thinking: bool = False
    ) -> Dict[str, Any]:
        """调用火山方舟聊天模型API"""
        try:
            # 参数验证
            if not messages or len(messages) == 0:
                raise ValueError("messages不能为空")
            
            # 构建请求参数
            request_params = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": stream
            }
            
            if response_format:
                request_params["response_format"] = {"type": response_format}
            
            if disable_thinking:
                request_params["thinking"] = {"type": "disabled"}
            
            response = self.client.chat.completions.create(**request_params)
            
            result = {"status": "success", "content": ""}
            
            if hasattr(response, 'choices') and len(response.choices) > 0:
                choice = response.choices[0]
                if hasattr(choice, 'message') and hasattr(choice.message, 'content'):
                    result["content"] = choice.message.content
            
            return result
            
        except Exception as e:
            logger.error(f"聊天API失败: {str(e)}")
            raise Exception(f"聊天API失败: {str(e)}")
    
    def images_generate(
        self,
        model: str,
        prompt: str,
        image: Optional[List[str]] = None,
        sequential_image_generation: str = "auto",
        response_format: str = "url",
        size: str = "2K",
        stream: bool = False,
        watermark: bool = True
    ) -> Dict[str, Any]:
        """调用火山方舟图片生成API"""
        try:
            if not prompt or len(prompt.strip()) == 0:
                raise ValueError("提示词不能为空")
            
            request_params = {
                "model": model,
                "prompt": prompt,
                "image": image,
                "sequential_image_generation": sequential_image_generation,
                "sequential_image_generation_options": SequentialImageGenerationOptions(max_images=15 - (len(image) if image else 0)), 
                "response_format": response_format,
                "size": size,
                "stream": stream,
                "watermark": watermark
            }
            
            response = self.client.images.generate(**request_params)
            
            result = {"status": "success", "data": []}
            
            if hasattr(response, 'data'):
                for item in response.data:
                    if hasattr(item, 'url'):
                        result["data"].append({"url": item.url})
            
            return result
            
        except Exception as e:
            logger.error(f"图片生成失败: {str(e)}")
            raise Exception(f"图片生成失败: {str(e)}")

    def images_generate_stream(
        self,
        model: str,
        prompt: str,
        image: Optional[List[str]] = None,
        sequential_image_generation: str = "auto",
        response_format: str = "url",
        size: str = "2K",
        watermark: bool = True
    ):
        """流式生成图像"""
        try:
            if not prompt or len(prompt.strip()) == 0:
                raise ValueError("提示词不能为空")
            
            remaining = 15 - (len(image) if image else 0)
            request_params = {
                "model": model,
                "prompt": prompt,
                "image": image,
                "sequential_image_generation": sequential_image_generation,
                "sequential_image_generation_options": SequentialImageGenerationOptions(max_images=remaining),
                "response_format": response_format,
                "size": size,
                "stream": True,
                "watermark": watermark
            }
            
            response = self.client.images.generate(**request_params)
            for event in response:
                if hasattr(event, 'url') and event.url:
                    yield event.url
                    
        except Exception as e:
            logger.error(f"流式图片生成失败: {str(e)}")
            raise Exception(f"流式图片生成失败: {str(e)}")
    
    def videos_create(
        self,
        model: str,
        prompt: str,
        duration: Optional[int] = None,
        aspect_ratio: Optional[str] = None,
        fps: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        创建视频生成任务
        
        根据火山引擎文档：https://www.volcengine.com/docs/82379/1366799?lang=zh
        使用 HTTP 请求直接调用火山引擎视频生成 API
        
        Args:
            model: 视频生成模型名称（如：doubao-seedance-1-5-pro）
            prompt: 视频生成提示词
            duration: 视频时长（秒），可选
                - doubao-seedance-1-5-pro: 支持 [4,12] 范围内的整数，或 -1（自动选择）
                - 其他模型: 根据模型文档确定支持的范围
            aspect_ratio: 视频宽高比，可选（如 "16:9", "9:16", "1:1"）
            fps: 帧率，可选（如 24, 30, 60）
            
        Returns:
            包含 task_id 的响应
        """
        try:
            if not prompt or len(prompt.strip()) == 0:
                raise ValueError("提示词不能为空")
            
            # 根据用户提供的示例代码，使用 content_generation.tasks.create
            # 示例：client.content_generation.tasks.create(
            #     model="doubao-seedance-1-0-pro-250528",
            #     content=[{"text":"... --ratio 16:9","type":"text"}]
            # )
            # 首先尝试使用 SDK 方法
            try:
                if hasattr(self.client, 'content_generation') and hasattr(self.client.content_generation, 'tasks'):
                    logger.info("尝试使用 SDK 的 content_generation.tasks.create 方法")
                    
                    # 构建 content 参数，格式为数组，每个元素包含 text 和 type
                    # 根据示例，参数应该作为 prompt 的一部分，格式如：
                    # "无人机以极快速度穿越复杂障碍或自然奇观，带来沉浸式飞行体验  --duration 5 --camerafixed false --watermark true"
                    # 注意：示例中使用的是 --ratio，但根据文档可能也支持 --aspect_ratio
                    text_content = prompt
                    
                    # 添加参数到 prompt 中
                    # doubao-seedance-1-5-pro 支持 duration 参数：
                    # - 指定具体时长：支持 [4,12] 范围内的任一整数
                    # - 自动选择：设置为 -1，表示由模型在 [4,12] 范围内自主选择合适的视频长度
                    params = []
                    if aspect_ratio:
                        params.append(f"--ratio {aspect_ratio}")
                    # doubao-seedance-1-5-pro 支持 duration 参数（范围 [4,12] 或 -1）
                    if duration is not None:
                        params.append(f"--duration {duration}")
                    if fps:
                        params.append(f"--fps {fps}")
                    
                    if params:
                        text_content = f"{prompt} {' '.join(params)}"
                    
                    content = [{"text": text_content, "type": "text"}]
                    
                    # 根据示例代码，只传递 model 和 content 参数
                    logger.info(f"创建视频生成任务，模型: {model}, prompt长度: {len(prompt)}")
                    logger.debug(f"请求参数: model={model}, content={content}")
                    
                    response = self.client.content_generation.tasks.create(
                        model=model,
                        content=content
                    )
                    
                    result = {"status": "success", "task_id": None}
                    
                    # 根据示例代码，响应对象有 id 属性
                    if hasattr(response, 'id'):
                        result["task_id"] = response.id
                    elif hasattr(response, 'task_id'):
                        result["task_id"] = response.task_id
                    elif isinstance(response, dict):
                        result["task_id"] = (
                            response.get("id") or 
                            response.get("task_id") or 
                            response.get("task") or
                            response.get("taskId")
                        )
                    
                    if result["task_id"]:
                        logger.info(f"使用 SDK 方法创建视频任务成功，task_id: {result['task_id']}")
                        return result
                    else:
                        logger.warning(f"SDK 响应中未找到 task_id，响应: {response}")
                        raise ValueError(f"无法从 SDK 响应中提取 task_id，响应: {response}")
                        
            except AttributeError as e:
                logger.info(f"SDK 不支持 content_generation 属性: {str(e)}，尝试使用 HTTP 请求")
            except Exception as e:
                logger.warning(f"SDK 方法调用失败: {str(e)}，尝试使用 HTTP 请求")
            
            # 如果 SDK 不支持，使用 HTTP 请求
            # 根据日志，SDK 实际使用的端点是 /contents/generations/tasks（复数形式）
            url = f"{self.base_url}/contents/generations/tasks"
            logger.info(f"使用 HTTP 请求创建视频任务，URL: {url}")
            
            # 构建请求头
            headers = {
                "Content-Type": "application/json"
            }
            
            # 设置认证
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            elif self.ak and self.sk:
                logger.warning("使用 AK/SK 认证，视频生成可能需要特殊处理")
                headers["Authorization"] = f"Bearer {self.ak}"
            
            # 构建请求体 - 严格按照示例代码格式
            # 示例：content=[{"text":"... --duration 5 --ratio 16:9","type":"text"}]
            # 根据示例，参数应该作为 prompt 的一部分
            text_content = prompt
            
            # 添加参数到 prompt 中
            # doubao-seedance-1-5-pro 支持 duration 参数：
            # - 指定具体时长：支持 [4,12] 范围内的任一整数
            # - 自动选择：设置为 -1，表示由模型在 [4,12] 范围内自主选择合适的视频长度
            params = []
            if aspect_ratio:
                params.append(f"--ratio {aspect_ratio}")
            # doubao-seedance-1-5-pro 支持 duration 参数（范围 [4,12] 或 -1）
            if duration is not None:
                params.append(f"--duration {duration}")
            if fps:
                params.append(f"--fps {fps}")
            
            if params:
                text_content = f"{prompt} {' '.join(params)}"
            
            request_body = {
                "model": model,
                "content": [{"text": text_content, "type": "text"}],
            }
            
            # 注意：根据示例代码，duration、fps、aspect_ratio 等参数应该作为 prompt 的一部分传递
            
            logger.info(f"创建视频生成任务，模型: {model}, prompt长度: {len(prompt)}")
            
            # 发送 HTTP 请求
            response = requests.post(url, json=request_body, headers=headers, timeout=30)
            
            # 记录响应状态
            logger.info(f"视频生成API响应状态: {response.status_code}")
            
            # 如果状态码不是 2xx，记录详细的错误信息
            if not response.ok:
                error_text = response.text
                logger.error(f"视频生成API错误响应 (状态码: {response.status_code}): {error_text}")
                logger.error(f"请求 URL: {url}")
                logger.error(f"请求头: {headers}")
                logger.error(f"请求体: {request_body}")
                
                try:
                    error_json = response.json()
                    error_msg = error_json.get("error", {}).get("message", error_text) or error_json.get("message", error_text)
                    raise Exception(f"视频生成API错误 (HTTP {response.status_code}): {error_msg}")
                except:
                    raise Exception(f"视频生成API错误: HTTP {response.status_code} - {error_text}")
            
            response_data = response.json()
            
            result = {"status": "success", "task_id": None}
            
            # 提取 task_id - 根据火山引擎 API 响应格式
            if isinstance(response_data, dict):
                result["task_id"] = (
                    response_data.get("task_id") or 
                    response_data.get("id") or 
                    response_data.get("taskId") or
                    response_data.get("task") or
                    (response_data.get("data", {}).get("task_id") if isinstance(response_data.get("data"), dict) else None)
                )
            
            if not result["task_id"]:
                logger.error(f"无法从响应中提取 task_id，完整响应: {response_data}")
                raise ValueError(f"无法从响应中提取 task_id，响应: {response_data}")
            
            logger.info(f"视频生成任务创建成功，task_id: {result['task_id']}")
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"创建视频生成任务失败（HTTP错误）: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    logger.error(f"错误详情: {error_detail}")
                except:
                    logger.error(f"响应内容: {e.response.text}")
            raise Exception(f"创建视频生成任务失败: {str(e)}")
        except Exception as e:
            logger.error(f"创建视频生成任务失败: {str(e)}")
            raise Exception(f"创建视频生成任务失败: {str(e)}")
    
    def videos_get(
        self,
        task_id: str
    ) -> Dict[str, Any]:
        """
        查询视频生成任务状态
        
        根据火山引擎文档：https://www.volcengine.com/docs/82379/1520757?lang=zh
        使用 HTTP 请求直接调用火山引擎视频查询 API
        
        Args:
            task_id: 任务ID
            
        Returns:
            任务状态和结果，包含：
            - status: "pending" | "processing" | "completed" | "failed"
            - task_id: 任务ID
            - video_url: 视频URL（完成时）
            - progress: 进度百分比（0-100）
        """
        try:
            # 先尝试使用 SDK 方法（如果支持）
            # 根据示例，应该使用 content_generation.tasks.get 或类似方法
            try:
                if hasattr(self.client, 'content_generation') and hasattr(self.client.content_generation, 'tasks'):
                    # 根据错误信息 "Tasks.get() takes 1 positional argument but 2 were given"
                    # 说明 get 方法不接受位置参数，可能需要通过其他方式调用
                    # 先尝试使用关键字参数
                    if hasattr(self.client.content_generation.tasks, 'get'):
                        logger.info("尝试使用 SDK 的 content_generation.tasks.get 方法")
                        # 根据示例代码，使用 task_id=task_id 关键字参数
                        response = self.client.content_generation.tasks.get(task_id=task_id)
                    elif hasattr(self.client.content_generation.tasks, 'retrieve'):
                        logger.info("尝试使用 SDK 的 content_generation.tasks.retrieve 方法")
                        try:
                            response = self.client.content_generation.tasks.retrieve(task_id=task_id)
                        except TypeError:
                            try:
                                response = self.client.content_generation.tasks.retrieve(id=task_id)
                            except TypeError:
                                raise AttributeError("无法调用 retrieve 方法")
                    else:
                        raise AttributeError("content_generation.tasks 没有 get 或 retrieve 方法")
                    
                    result = {
                        "status": "pending",
                        "task_id": task_id,
                        "video_url": None,
                        "progress": 0
                    }
                    
                    # 根据文档，响应对象有 status 属性，状态值是 "succeeded", "failed" 等
                    if hasattr(response, 'status'):
                        status = response.status
                        # 状态映射：根据文档，"succeeded" 表示完成
                        if status == "succeeded":
                            result["status"] = "completed"
                        elif status == "failed":
                            result["status"] = "failed"
                        elif status in ["queued", "running", "processing"]:
                            result["status"] = "processing"
                        else:
                            result["status"] = "pending"
                    elif hasattr(response, 'state'):
                        result["status"] = response.state
                    
                    # 提取视频URL - 根据测试，HTTP响应中content是字典，SDK响应中可能是Content对象
                    video_url = None
                    if hasattr(response, 'content') and response.content is not None:
                        # 优先尝试作为对象访问（SDK返回的Content对象）
                        if hasattr(response.content, 'video_url'):
                            try:
                                video_url = response.content.video_url
                                if video_url:
                                    logger.info("从Content对象提取video_url成功")
                            except Exception as e:
                                logger.warning(f"访问Content.video_url失败: {e}")
                        # 如果是字典（HTTP响应）
                        if not video_url and isinstance(response.content, dict):
                            video_url = response.content.get('video_url')
                            if video_url:
                                logger.info("从字典提取video_url成功")
                        # 如果是列表
                        if not video_url and isinstance(response.content, list) and len(response.content) > 0:
                            content_item = response.content[0]
                            if hasattr(content_item, 'video_url'):
                                try:
                                    video_url = content_item.video_url
                                except:
                                    pass
                            if not video_url and isinstance(content_item, dict):
                                video_url = content_item.get("video_url")
                    
                    # 如果 content.video_url 不存在，尝试其他位置（向后兼容）
                    if not video_url:
                        if hasattr(response, 'video_url'):
                            video_url = response.video_url
                        elif hasattr(response, 'url'):
                            video_url = response.url
                        elif hasattr(response, 'videoUrl'):
                            video_url = response.videoUrl
                        elif hasattr(response, 'output'):
                            if hasattr(response.output, 'video_url'):
                                video_url = response.output.video_url
                            elif isinstance(response.output, dict):
                                video_url = response.output.get("video_url") or response.output.get("url")
                    
                    result["video_url"] = video_url
                    # 只在成功提取视频URL或状态为completed/failed时输出日志，减少重复日志
                    if video_url:
                        logger.debug(f"成功提取视频URL")
                    else:
                        # 只在状态为completed或failed时输出警告，避免processing状态时重复输出
                        if result.get("status") in ["completed", "failed"]:
                            if hasattr(response, 'content'):
                                content_type = type(response.content)
                                content_attrs = [attr for attr in dir(response.content) if not attr.startswith('_') and 'url' in attr.lower()]
                                logger.warning(f"未能提取视频URL，content类型: {content_type}, 相关属性: {content_attrs}")
                    
                    # 提取进度
                    if hasattr(response, 'progress'):
                        result["progress"] = response.progress
                    elif hasattr(response, 'percentage'):
                        result["progress"] = response.percentage
                    
                    # 如果响应是字典类型（向后兼容）
                    if isinstance(response, dict):
                        status = response.get("status") or response.get("state")
                        if status == "succeeded":
                            result["status"] = "completed"
                        elif status == "failed":
                            result["status"] = "failed"
                        elif status:
                            result["status"] = status
                        
                        # 优先从 content.video_url 提取（根据文档）
                        if not result.get("video_url"):
                            content_data = response.get("content")
                            if isinstance(content_data, dict):
                                result["video_url"] = content_data.get("video_url")
                            elif isinstance(content_data, list) and len(content_data) > 0:
                                result["video_url"] = content_data[0].get("video_url") if isinstance(content_data[0], dict) else None
                        
                        result["progress"] = (
                            response.get("progress") or 
                            response.get("percentage") or 
                            result.get("progress", 0)
                        )
                    
                    # 只在状态变化或完成时输出日志，减少重复日志
                    if result.get("status") in ["completed", "failed"]:
                        logger.info(f"查询视频任务完成，状态: {result['status']}, video_url: {'已提取' if result.get('video_url') else '未找到'}")
                    else:
                        logger.debug(f"查询视频任务，状态: {result['status']}, video_url: {'已提取' if result.get('video_url') else '未找到'}")
                    return result
            except AttributeError as e:
                logger.info(f"SDK 不支持 content_generation 属性: {str(e)}，使用 HTTP 请求")
            except Exception as e:
                logger.warning(f"SDK 方法调用失败: {str(e)}，尝试使用 HTTP 请求")
            
            # 如果 SDK 不支持，使用 HTTP 请求
            # 根据日志，实际端点应该是 /contents/generations/tasks/{task_id}（复数形式）
            url = f"{self.base_url}/contents/generations/tasks/{task_id}"
            
            # 构建请求头
            headers = {
                "Content-Type": "application/json"
            }
            
            # 设置认证
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            elif self.ak and self.sk:
                headers["Authorization"] = f"Bearer {self.ak}"
            
            # 发送 HTTP 请求
            response = requests.get(url, headers=headers, timeout=30)
            
            # 如果状态码不是 2xx，记录详细的错误信息
            if not response.ok:
                error_text = response.text
                logger.error(f"查询视频任务API错误响应 (状态码: {response.status_code}): {error_text}")
                logger.error(f"请求 URL: {url}")
                logger.error(f"请求头: {headers}")
                
                # 如果是 404，可能是端点路径不对
                if response.status_code == 404:
                    logger.warning("收到 404 错误，可能是 API 端点路径不正确")
                    logger.warning(f"当前使用的 base_url: {self.base_url}")
                    logger.warning("请确认火山引擎视频查询 API 的正确端点路径")
                
                try:
                    error_json = response.json()
                    error_msg = error_json.get("error", {}).get("message", error_text) or error_json.get("message", error_text)
                    raise Exception(f"查询视频任务API错误 (HTTP {response.status_code}): {error_msg}")
                except:
                    raise Exception(f"查询视频任务API错误: HTTP {response.status_code} - {error_text}")
            
            response_data = response.json()
            
            # 只在调试模式下记录完整响应
            if logger.level <= logging.DEBUG:
                import json
                logger.debug(f"视频查询API完整响应: {json.dumps(response_data, indent=2, ensure_ascii=False)}")
            
            result = {
                "status": "pending",
                "task_id": task_id,
                "video_url": None,
                "progress": 0
            }
            
            # 提取状态信息 - 根据火山引擎 API 文档格式
            # 文档说明：任务完成后，视频URL在 content.video_url 字段中
            # 状态为 "succeeded" 表示完成
            if isinstance(response_data, dict):
                # 提取状态 - 根据文档，状态字段为 "status"
                status = response_data.get("status")
                
                # 优先从 content.video_url 提取视频URL（根据文档）
                video_url = None
                content_data = response_data.get("content")
                if isinstance(content_data, dict):
                    # content 是字典，直接获取 video_url
                    video_url = content_data.get("video_url")
                elif isinstance(content_data, list) and len(content_data) > 0:
                    # content 是数组，取第一个元素的 video_url
                    content_item = content_data[0]
                    if isinstance(content_item, dict):
                        video_url = content_item.get("video_url")
                
                # 如果 content.video_url 不存在，尝试其他位置（向后兼容）
                if not video_url:
                    video_url = (
                        response_data.get("video_url") or 
                        response_data.get("url") or 
                        response_data.get("videoUrl")
                    )
                
                # 如果还是没有，尝试从 output 或 result 字段提取
                if not video_url:
                    if isinstance(response_data.get("output"), dict):
                        output = response_data.get("output", {})
                        video_url = output.get("video_url") or output.get("url")
                    elif isinstance(response_data.get("result"), dict):
                        result_data = response_data.get("result", {})
                        video_url = result_data.get("video_url") or result_data.get("url")
                
                result["status"] = status or "pending"
                result["video_url"] = video_url
                result["progress"] = (
                    response_data.get("progress") or 
                    response_data.get("percentage") or 
                    response_data.get("progress_percent") or
                    0
                )
                
                # 状态映射：根据文档，状态值为 "succeeded", "failed", "queued", "running" 等
                if status:
                    status_lower = str(status).lower()
                    if status_lower == "succeeded":  # 文档明确说明 succeeded 表示完成
                        result["status"] = "completed"
                    elif status_lower == "failed":
                        result["status"] = "failed"
                    elif status_lower in ["queued", "running", "processing"]:
                        result["status"] = "processing"
                    elif "complete" in status_lower or "success" in status_lower or "done" in status_lower:
                        result["status"] = "completed"
                    elif "fail" in status_lower or "error" in status_lower:
                        result["status"] = "failed"
                    elif "process" in status_lower or "running" in status_lower or "generating" in status_lower:
                        result["status"] = "processing"
                    else:
                        result["status"] = "pending"
                
                # 提取进度信息（如果有）
                result["progress"] = (
                    response_data.get("progress") or 
                    response_data.get("percentage") or 
                    response_data.get("progress_percent") or
                    0
                )
            
            # 只在完成或失败时输出日志，减少重复日志
            if result.get("status") in ["completed", "failed"]:
                if result.get("video_url"):
                    logger.info(f"查询视频任务完成，状态: {result['status']}, 已提取视频URL")
                else:
                    logger.warning(f"查询视频任务完成，状态: {result['status']}, 但未找到视频URL")
            # processing 状态不输出日志，减少日志量
            return result
            
        except requests.exceptions.RequestException as e:
            logger.error(f"查询视频生成任务失败（HTTP错误）: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_detail = e.response.json()
                    logger.error(f"错误详情: {error_detail}")
                except:
                    logger.error(f"响应内容: {e.response.text}")
            raise Exception(f"查询视频生成任务失败: {str(e)}")
        except Exception as e:
            logger.error(f"查询视频生成任务失败: {str(e)}")
            raise Exception(f"查询视频生成任务失败: {str(e)}")

