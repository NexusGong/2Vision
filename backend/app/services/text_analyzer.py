"""
文本分析服务 - 针对古诗词和古文
"""
import json
import logging
import re
from typing import Dict, Any, List, Optional, Literal
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

# 尝试导入 ark_client，如果不存在则创建
try:
    from ark_client import ArkClient
except ImportError:
    # 如果不存在，从基础项目复制
    pass

logger = logging.getLogger(__name__)

# 古诗词古文分析提示词
ANCIENT_TEXT_ANALYSIS_PROMPT = """
你是一位精通古诗词和古文的文学分析专家。请对用户提供的古诗词或古文进行深度分析。

## 分析任务

对文本进行以下分析：

1. **断句处理**：将文本按照语义和韵律进行合理断句
2. **语义分层**：识别文本的层次结构（如：起承转合、上下阕、段落等）
3. **人物与场景识别**：提取文本中出现的人物、场景、意象
4. **时间顺序分析**：识别文本中的时间线索和事件顺序
5. **情感变化分析**：分析文本的情感脉络和变化

## 输出格式

请以JSON格式输出分析结果：

{
  "segments": [
    {
      "index": 1,
      "text": "句段文本",
      "semantic_layer": "层次说明",
      "characters": ["人物1", "人物2"],
      "scenes": ["场景1", "场景2"],
      "time_marker": "时间标记（如有）",
      "emotion": "情感描述",
      "key_imagery": ["核心意象1", "核心意象2"]
    }
  ],
  "overall_structure": {
    "layers": ["层次1", "层次2"],
    "time_sequence": ["时间点1", "时间点2"],
    "emotion_flow": ["情感1", "情感2"]
  },
  "characters": ["人物列表"],
  "scenes": ["场景列表"],
  "key_imagery": ["核心意象列表"]
}

请确保分析准确、深入，尊重原文的多义性和文学价值。
"""

# 诗词深度分析与分镜生成提示词（通用版 - 适配所有古诗词古文风格）
POETRY_ANALYSIS_WITH_STORYBOARD_PROMPT = """
你是古诗词古文分析专家。请分析文本并生成**忠实于原文意境**的分镜提示词。

## 核心原则
1. **image_prompt 必须严格基于原文描述的实际场景，不要臆造不存在的元素**
2. **根据诗词/古文的内容和时代，选择最适合的绘画风格**（不限于水墨）
3. **封面必须包含：标题、朝代、作者，并体现作品核心主题**

## 风格选择指南
根据内容自动选择合适风格：
- 山水田园诗 → 青绿山水、水墨写意
- 边塞诗 → 工笔重彩、雄浑壮阔
- 宫廷/宴饮诗 → 仕女画、富丽堂皇
- 咏物诗 → 工笔花鸟、细腻精致
- 叙事古文 → 连环画风格、人物场景
- 先秦/汉代 → 古朴厚重、青铜纹饰感
- 唐代 → 雍容华贵、色彩鲜明
- 宋代 → 淡雅清丽、意境悠远
- 明清 → 精细写实、文人气息

## 任务
1. 识别诗词/古文信息（标题、作者、朝代）
2. 分析创作背景和核心主题
3. 逐句分析，提取**原文实际描述的**场景、动作、意象
4. 根据内容选择最合适的绘画风格
5. 生成准确的图像提示词

## image_prompt 规范
1. **只描绘原文明确表达的内容**，不添加原文没有的场景或动作
2. 画面主体必须与原文内容一致
3. 用自然语言描述：主体+动作/状态+环境
4. 需要显示的文字用双引号包裹
5. 风格要与内容和时代相匹配

## JSON输出

{
  "poetry_info": {
    "title": "标题",
    "author": "作者",
    "dynasty": "朝代",
    "full_text": "完整文本",
    "creation_background": "创作背景（50字）",
    "era_background": "时代背景（50字）",
    "poet_mood": "作者心情/情感基调"
  },
  "line_analysis": [
    {
      "line_number": 1,
      "line": "原句",
      "word_explanation": "关键字词解释",
      "interpretation": "句意解读（30字）",
      "imagery": ["意象1", "意象2"],
      "emotion": "情感",
      "rhetoric": "修辞手法"
    }
  ],
  "storyboards": [
    {
      "index": 1,
      "type": "cover",
      "title": "标题",
      "subtitle": "朝代·作者",
      "text": "最能代表主题的名句",
      "scene_description": "封面场景：体现作品核心主题的画面，包含标题、朝代、作者信息",
      "image_prompt": "一幅[朝代]风格的古典画卷封面，体现「[作品核心主题/意境]」。画面上方是大字标题\"[标题]\"，标题下方清晰显示\"[朝代] [作者]\"。背景是[与主题相关的代表性场景]。[选择的绘画风格]，[色调]色调，[氛围]意境，古典书卷气息。",
      "style_hints": "根据内容选择的风格",
      "atmosphere": "整体氛围",
      "color_tone": "主色调",
      "composition": "构图方式"
    },
    {
      "index": 2,
      "type": "content",
      "title": "第一句",
      "text": "原文",
      "scene_description": "这句描绘的具体场景",
      "image_prompt": "[绘画风格]。画面描绘[严格按原文内容：主体+动作+环境]。[朝代]特色，[色调]色调，[氛围]意境。",
      "style_hints": "绘画风格",
      "atmosphere": "氛围",
      "color_tone": "色调",
      "composition": "构图"
    }
  ]
}

## 重要提醒
- **封面必须明确显示：标题（大字）、朝代、作者（小字）**
- 封面的 scene_description 和 image_prompt 必须体现作品的核心主题
- 风格选择要与诗词内容和朝代相匹配，不要千篇一律用水墨
- 每个分镜只描绘原文实际写到的内容
"""

def basic_segmentation(text: str) -> List[str]:
    """基础断句处理"""
    # 按标点符号断句
    segments = re.split(r'[。！？；\n]', text)
    # 过滤空字符串
    segments = [s.strip() for s in segments if s.strip()]
    return segments

async def analyze_ancient_text(
    text: str,
    ark_client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    分析古诗词或古文
    
    Args:
        text: 原始文本
        ark_client: Ark客户端实例
        
    Returns:
        结构化分析结果
    """
    logger.info(f"开始分析文本，长度: {len(text)}")
    
    # 如果没有ark_client，使用基础断句
    if not ark_client:
        logger.warning("未提供Ark客户端，使用基础断句")
        segments = basic_segmentation(text)
        return {
            "segments": [
                {
                    "index": i + 1,
                    "text": seg,
                    "semantic_layer": "未分析",
                    "characters": [],
                    "scenes": [],
                    "time_marker": None,
                    "emotion": "未分析",
                    "key_imagery": []
                }
                for i, seg in enumerate(segments)
            ],
            "overall_structure": {
                "layers": [],
                "time_sequence": [],
                "emotion_flow": []
            },
            "characters": [],
            "scenes": [],
            "key_imagery": []
        }
    
    try:
        # 构建消息
        messages = [
            {"role": "system", "content": ANCIENT_TEXT_ANALYSIS_PROMPT},
            {"role": "user", "content": f"请分析以下古诗词/古文：\n\n{text}"}
        ]
        
        # 调用模型
        result = ark_client.chat_completion(
            model=config.MODEL_NAME,
            messages=messages,
            stream=False,
            response_format='json_object',
            disable_thinking=True
        )
        
        # 解析结果
        content = result.get("content", "{}")
        analysis_result = json.loads(content)
        
        logger.info("文本分析完成")
        return analysis_result
        
    except json.JSONDecodeError as e:
        logger.error(f"解析分析结果失败: {str(e)}")
        # 返回基础分析结果
        segments = basic_segmentation(text)
        return {
            "segments": [
                {
                    "index": i + 1,
                    "text": seg,
                    "semantic_layer": "解析失败",
                    "characters": [],
                    "scenes": [],
                    "time_marker": None,
                    "emotion": "解析失败",
                    "key_imagery": []
                }
                for i, seg in enumerate(segments)
            ],
            "overall_structure": {
                "layers": [],
                "time_sequence": [],
                "emotion_flow": []
            },
            "characters": [],
            "scenes": [],
            "key_imagery": []
        }
    except Exception as e:
        logger.error(f"分析文本时发生错误: {str(e)}")
        raise

def generate_image_prompt_for_segment(segment: Dict[str, Any], original_text: str) -> str:
    """
    为句段生成图像提示词
    
    Args:
        segment: 句段分析结果
        original_text: 原始文本
        
    Returns:
        图像生成提示词
    """
    text = segment.get("text", "")
    characters = segment.get("characters", [])
    scenes = segment.get("scenes", [])
    key_imagery = segment.get("key_imagery", [])
    emotion = segment.get("emotion", "")
    
    prompt_parts = []
    
    # 基础描述
    prompt_parts.append(f"根据以下古诗词/古文句段生成图像：{text}")
    
    # 人物
    if characters:
        prompt_parts.append(f"人物：{', '.join(characters)}")
    
    # 场景
    if scenes:
        prompt_parts.append(f"场景：{', '.join(scenes)}")
    
    # 核心意象
    if key_imagery:
        prompt_parts.append(f"核心意象：{', '.join(key_imagery)}")
    
    # 情感
    if emotion:
        prompt_parts.append(f"情感氛围：{emotion}")
    
    # 风格要求
    prompt_parts.append("风格：中国古典绘画风格，具有诗意和文学性，画面优美典雅")
    
    return "\n".join(prompt_parts)


async def analyze_poetry_with_storyboard(
    text: str,
    mode: Literal["storybook", "comics"] = "storybook",
    ark_client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    深度分析古诗词/古文并生成分镜脚本
    
    Args:
        text: 用户输入的诗词文本
        mode: 生成模式，storybook（故事书）或 comics（连环画）
        ark_client: Ark客户端实例
        
    Returns:
        包含诗词信息、逐句分析和分镜数据的结构化结果
    """
    logger.info(f"开始深度分析诗词，模式: {mode}，文本长度: {len(text)}")
    
    # 如果没有ark_client，返回基础结构
    if not ark_client:
        logger.warning("未提供Ark客户端，返回基础分析结果")
        return _create_basic_poetry_analysis(text, mode)
    
    try:
        # 构建消息，添加模式说明
        mode_description = "故事书模式：竖版画面，画面细腻优美，强调意境" if mode == "storybook" else "连环画模式：方形画面，画面生动有趣，强调叙事"
        
        messages = [
            {"role": "system", "content": POETRY_ANALYSIS_WITH_STORYBOARD_PROMPT},
            {"role": "user", "content": f"请分析以下古诗词/古文，并按照{mode_description}生成分镜：\n\n{text}"}
        ]
        
        # 调用模型（减少 max_tokens 提高速度）
        result = ark_client.chat_completion(
            model=config.MODEL_NAME,
            messages=messages,
            stream=False,
            response_format='json_object',
            disable_thinking=True,
            max_tokens=2500
        )
        
        # 解析结果
        content = result.get("content", "{}")
        analysis_result = json.loads(content)
        
        # 验证和补全结果结构
        analysis_result = _validate_and_complete_analysis(analysis_result, text, mode)
        
        logger.info(f"诗词分析完成，生成 {len(analysis_result.get('storyboards', []))} 个分镜")
        return analysis_result
        
    except json.JSONDecodeError as e:
        logger.error(f"解析分析结果失败: {str(e)}")
        return _create_basic_poetry_analysis(text, mode)
    except Exception as e:
        logger.error(f"分析诗词时发生错误: {str(e)}")
        raise


def _create_basic_poetry_analysis(text: str, mode: str) -> Dict[str, Any]:
    """
    创建基础的诗词分析结果（当无法调用模型时使用）
    """
    segments = basic_segmentation(text)
    title = segments[0][:10] if segments else "未知诗词"
    
    # 根据模式设置不同的风格
    if mode == "storybook":
        style = "水墨写意"
        atmosphere = "宁静淡雅"
        color_tone = "水墨黑白为主，点缀淡彩"
        composition = "留白构图"
    else:
        style = "工笔重彩"
        atmosphere = "生动活泼"
        color_tone = "色彩丰富明快"
        composition = "饱满构图"
    
    # 创建基础分镜 - 封面
    cover_prompt = f'一幅展现「{title}」意境的古典画卷封面。画面中央是用毛笔书写的标题"{title}"，字体飘逸洒脱，下方有小字署名"待查·作者"。背景是古典山水或花鸟元素，营造出诗意的氛围。整体采用{style}风格，色调{color_tone}，柔和的光影效果，画面{atmosphere}。'
    
    storyboards = [
        {
            "index": 1,
            "type": "cover",
            "title": title,
            "subtitle": "作者 · 朝代待查",
            "text": segments[0] if segments else "",
            "scene_description": "古典诗词封面，以山水或花鸟为背景，中央展示诗词标题和作者信息",
            "image_prompt": cover_prompt,
            "style_hints": style,
            "atmosphere": atmosphere,
            "color_tone": color_tone,
            "composition": composition
        }
    ]
    
    # 为每个句段创建分镜
    for i, seg in enumerate(segments):
        content_prompt = f'一幅展现「{seg}」意境的{style}画作。画面描绘这句诗词所表达的场景和意境，{atmosphere}的氛围。采用中国古典绘画风格，色调{color_tone}，{composition}，整体意境优美深远。'
        
        storyboards.append({
            "index": i + 2,
            "type": "content",
            "title": f"第{i + 1}句",
            "text": seg,
            "scene_description": f"描绘「{seg}」的场景，展现诗句中的意象和情感",
            "image_prompt": content_prompt,
            "style_hints": style,
            "atmosphere": atmosphere,
            "color_tone": color_tone,
            "composition": composition,
            "era_elements": "待补充时代元素",
            "time_of_day": "待分析",
            "weather": "待分析"
        })
    
    return {
        "poetry_info": {
            "title": title,
            "author": "待查",
            "dynasty": "待查",
            "full_text": "\n".join(segments),
            "creation_background": "暂无背景信息，请手动补充",
            "era_background": "暂无时代背景信息，请手动补充",
            "poet_mood": "待分析",
            "era_visual_elements": {
                "clothing": "待补充",
                "architecture": "待补充",
                "objects": [],
                "nature": "待补充"
            }
        },
        "line_analysis": [
            {
                "line_number": i + 1,
                "line": seg,
                "word_explanation": "待分析",
                "interpretation": "待分析",
                "imagery": [],
                "emotion": "待分析",
                "rhetoric": "待分析",
                "visual_scene": "待分析"
            }
            for i, seg in enumerate(segments)
        ],
        "storyboards": storyboards
    }


def _validate_and_complete_analysis(result: Dict[str, Any], original_text: str, mode: str) -> Dict[str, Any]:
    """
    验证并补全分析结果的结构
    """
    # 确保 poetry_info 存在并补全字段
    if "poetry_info" not in result:
        result["poetry_info"] = {
            "title": original_text[:10],
            "author": "未知",
            "dynasty": "未知",
            "full_text": original_text,
            "creation_background": "",
            "era_background": ""
        }
    
    # 补全 poetry_info 的新字段
    poetry_info = result["poetry_info"]
    poetry_info.setdefault("poet_mood", "")
    poetry_info.setdefault("era_visual_elements", {
        "clothing": "",
        "architecture": "",
        "objects": [],
        "nature": ""
    })
    
    # 确保 line_analysis 存在
    if "line_analysis" not in result:
        result["line_analysis"] = []
    
    # 补全 line_analysis 的新字段
    for line in result["line_analysis"]:
        line.setdefault("visual_scene", "")
    
    # 根据模式设置默认风格
    if mode == "storybook":
        default_style = "水墨写意"
        default_atmosphere = "宁静淡雅"
        default_color_tone = "水墨黑白为主"
        default_composition = "留白构图"
    else:
        default_style = "工笔重彩"
        default_atmosphere = "生动活泼"
        default_color_tone = "色彩丰富"
        default_composition = "饱满构图"
    
    # 确保 storyboards 存在且有封面
    if "storyboards" not in result or not result["storyboards"]:
        result["storyboards"] = _create_basic_poetry_analysis(original_text, mode)["storyboards"]
    else:
        # 检查是否有封面
        has_cover = any(sb.get("type") == "cover" for sb in result["storyboards"])
        if not has_cover:
            title = result["poetry_info"].get("title", "诗词")
            author = result["poetry_info"].get("author", "未知")
            dynasty = result["poetry_info"].get("dynasty", "未知")
            
            cover_prompt = f'一幅展现「{title}」意境的古典画卷封面。画面中央是用毛笔书写的标题"{title}"，字体飘逸洒脱，下方有小字署名"{dynasty}·{author}"。背景是古典山水或花鸟元素，营造出诗意的氛围。整体采用{default_style}风格，色调{default_color_tone}，柔和的光影效果，画面{default_atmosphere}。'
            
            cover = {
                "index": 1,
                "type": "cover",
                "title": title,
                "subtitle": f"{author} · {dynasty}",
                "text": "",
                "scene_description": "古典诗词封面，展示标题和作者信息",
                "image_prompt": cover_prompt,
                "style_hints": default_style,
                "atmosphere": default_atmosphere,
                "color_tone": default_color_tone,
                "composition": default_composition
            }
            result["storyboards"].insert(0, cover)
            # 重新编号
            for i, sb in enumerate(result["storyboards"]):
                sb["index"] = i + 1
    
    # 确保每个分镜都有必要的字段
    for sb in result["storyboards"]:
        sb.setdefault("index", 1)
        sb.setdefault("type", "content")
        sb.setdefault("title", "")
        sb.setdefault("text", "")
        sb.setdefault("scene_description", "")
        sb.setdefault("image_prompt", "")
        sb.setdefault("style_hints", default_style)
        sb.setdefault("atmosphere", default_atmosphere)
        sb.setdefault("color_tone", default_color_tone)
        sb.setdefault("composition", default_composition)
        
        # 内容页特有字段
        if sb.get("type") == "content":
            sb.setdefault("era_elements", "")
            sb.setdefault("time_of_day", "")
            sb.setdefault("weather", "")
    
    return result


def generate_image_prompt_for_storyboard(
    storyboard: Dict[str, Any],
    poetry_info: Dict[str, Any],
    mode: str = "storybook"
) -> str:
    """
    为分镜生成最终的图像提示词
    
    Args:
        storyboard: 分镜数据
        poetry_info: 诗词基本信息
        mode: 生成模式
        
    Returns:
        完整的图像生成提示词
    """
    prompt_parts = []
    
    # 基础提示词
    base_prompt = storyboard.get("image_prompt", "")
    if base_prompt:
        prompt_parts.append(base_prompt)
    
    # 添加场景描述
    scene_desc = storyboard.get("scene_description", "")
    if scene_desc and scene_desc not in base_prompt:
        prompt_parts.append(f"场景：{scene_desc}")
    
    # 添加风格提示
    style_hints = storyboard.get("style_hints", "")
    if style_hints:
        prompt_parts.append(f"风格：{style_hints}")
    
    # 根据模式添加额外的风格要求
    if mode == "storybook":
        prompt_parts.append("画面要求：竖版构图，细腻精美，意境深远，色彩淡雅，水墨风格")
    else:
        prompt_parts.append("画面要求：方形构图，生动活泼，叙事清晰，色彩丰富，连环画风格")
    
    # 添加诗词背景信息帮助生成
    if storyboard.get("type") == "cover":
        title = poetry_info.get("title", "")
        author = poetry_info.get("author", "")
        dynasty = poetry_info.get("dynasty", "")
        prompt_parts.append(f"封面需要体现：{title}，{dynasty}{author}，古典书卷气息")
    
    return "\n".join(prompt_parts)

