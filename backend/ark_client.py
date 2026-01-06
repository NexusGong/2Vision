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

