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

from app.services.content_validator import ContentValidator

logger = logging.getLogger(__name__)

# 古诗词古文分析提示词
ANCIENT_TEXT_ANALYSIS_PROMPT = """
你是一位精通古诗词和古文的文学分析专家。请对用户提供的古诗词或古文进行深度分析。

## 重要限制（必须严格遵守）

**本系统专门用于处理古诗词和古文，不接受其他类型的文本。**

1. **只接受古诗词或古文**：
   - 古诗词：包括唐诗、宋词、元曲等古典诗词作品
   - 古文：包括古代散文、文言文等古典文学作品
   - 不接受现代诗歌、现代散文、现代小说等现代文学作品
   - 不接受非文学类文本（如技术文档、新闻、对话等）

2. **如果用户输入的不是古诗词或古文，你必须**：
   - 明确拒绝处理
   - 礼貌地说明本系统只处理古诗词和古文
   - 建议用户输入古诗词或古文内容

3. **验证输入内容**：
   - 检查文本是否包含古诗古文特征（如古典句式、诗词格式、古代意象等）
   - 如果文本明显是现代文本或非文学文本，必须拒绝处理

4. **保持专业性**：
   - 所有分析和生成必须基于古诗词/古文的文学特征
   - 不要偏离古诗词/古文的主题和风格

5. **时代与风格一致性（必须严格遵守）**：
   - 人物的服饰、发型、礼仪、兵器、器物、建筑风格等必须与诗词所处时代相匹配
   - 严禁出现明显的现代元素：如西装、现代发型、现代枪械、汽车、火车、飞机、摩天大楼、霓虹都市、科幻机械等
   - 场景中的建筑与环境必须符合相应朝代的特色（城楼、庭院、长廊、桥梁、乡村、边塞军营等），禁止现代城市街景、现代室内空间
   - 整体画面基调以**国风动画 / 水墨动画 / 中国古典绘画风格**为主，可采用水墨写意、工笔、青绿山水等风格，但不要使用欧美写实、赛博朋克、科幻写实等现代感很强的风格

6. **逻辑与连贯性（必须严格遵守）**：
   - 整个视频中**人物形象必须前后一致**：同一人物在不同镜头中的性别、年龄、脸部特征、服饰主色调和身份气质要保持统一，不得在镜头之间随机变化成完全不同的人
   - 场景切换要有清晰的时间或空间逻辑：如由室内到室外、由黄昏到夜晚、由边塞到家乡，要在 prompt 中给出合理的过渡说明
   - 镜头运镜要符合物理常识和叙事逻辑，避免突然瞬移、频繁无意义旋转、极端眩晕的运动
   - 在描述画面时，要明确主镜头关注的主体是什么，避免在同一时间同时出现互相矛盾的动作或环境

5. **时代与风格一致性（必须严格遵守）**：
   - 人物的服饰、发型、礼仪、兵器、器物、建筑风格等必须与诗词所处时代相匹配
   - 严禁出现明显的现代元素：如西装、现代发型、现代枪械、汽车、火车、飞机、摩天大楼、霓虹都市、科幻机械等
   - 场景中的建筑与环境必须符合相应朝代的特色（城楼、庭院、长廊、桥梁、乡村、边塞军营等），禁止现代城市街景、现代室内空间
   - 整体画面基调以**国风动画 / 水墨动画 / 中国古典绘画风格**为主，可采用水墨写意、工笔、青绿山水等风格，但不要使用欧美写实、赛博朋克、科幻写实等现代感很强的风格

6. **逻辑与连贯性（必须严格遵守）**：
   - 整个视频中**人物形象必须前后一致**：同一人物在不同镜头中的性别、年龄、脸部特征、服饰主色调和身份气质要保持统一，不得在镜头之间随机变化成完全不同的人
   - 场景切换要有清晰的时间或空间逻辑：如由室内到室外、由黄昏到夜晚、由边塞到家乡，要在 prompt 中给出合理的过渡说明
   - 镜头运镜要符合物理常识和叙事逻辑，避免突然瞬移、频繁无意义旋转、极端眩晕的运动
   - 在描述画面时，要明确主镜头关注的主体是什么，避免在同一时间同时出现互相矛盾的动作或环境

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

# 诗词深度分析与分镜生成提示词（图像生成版）
# 设计目标：帮助理解诗句；分镜基于原文物象与意境；支持古诗、词、古文；提示词简短、通用（人物可有可无）
POETRY_ANALYSIS_WITH_STORYBOARD_PROMPT = """
你是古诗词古文分析专家。请分析文本并生成**忠实于原文意境**的分镜提示词（用于图像生成），帮助读者通过画面理解每一句。

## 重要限制（必须严格遵守）

**本系统专门用于处理古诗词和古文，不接受其他类型的文本。**

1. **只接受古诗词或古文**：
   - 古诗：五言、七言等
   - 词：宋词、元曲等（有上下阕/片的按阕或句分镜）
   - 古文：古代散文、文言文（按句或自然段分镜）
   - 不接受现代诗歌、现代散文、非文学类文本

2. **若输入不是古诗词或古文**：明确拒绝并说明仅处理古诗词与古文。

3. **体裁与结构**：
   - 古诗：按句断句（句号、问号、感叹号、逗号、分号）
   - 词：识别上下阕/片，仍按句分镜，可在 line_analysis 中标注「上阕/下阕」
   - 古文：按句或短段分镜，保留层次（如段落、层次）

## 核心原则（分镜为理解服务）

1. **以物象、意象为核心**：每句的 image_prompt 必须围绕该句的**物象、意象**（景、物、动作、氛围）来写，不得遗漏句中出现的景、物、人。
2. **人物可有可无**：句中无人则画景/物；有单人则画单人；有多人则画多人。**禁止**默认「每句都画一个人」或「一个人读/诵全诗」。
3. **image_prompt 简短**：每条 50–120 字为宜。格式：「[风格]。[主体景/物/人]+[状态或动作]+[环境]。」不堆砌形容词，不重复句意。
4. **严格按句一一对应**：除封面外，每个 content 分镜对应一句原文，不合并、不跳过；line_analysis 与 storyboards 的 content 数量一致。
5. **封面**：标题、朝代、作者+作品核心主题；风格与内容、时代匹配（不限于水墨）。

## 风格选择（简要）
山水/田园→青绿或水墨；边塞→工笔重彩；咏物→工笔花鸟；词/抒情→淡雅；古文叙事→可偏连环画。按朝代与内容选，不千篇一律。

## 任务
1. 识别标题、作者、朝代；若为词则标出阕/片。
2. **逐句分析**：每句的 word_explanation、interpretation、**imagery（物象/意象列表，必填）**、emotion、rhetoric。
3. **逐句分镜**：每句一个 content，image_prompt 紧扣该句的**意象与场景**，人物仅在本句明确出现时才写人。

## image_prompt 规范（简短）
- 只写原文有的景、物、人、动作；不臆造。
- 结构：风格+主体（景/物/人）+状态或动作+环境。需显示的文字用双引号包裹。
- 示例（无人物）：「水墨。江上孤舟，雪中蓑笠翁，远山寒林。」
- 示例（有人物）：「工笔。牧童骑黄牛穿林，树荫蝉鸣，夏日山道。」

## JSON 输出

{
  "poetry_info": {
    "title": "标题",
    "author": "作者",
    "dynasty": "朝代",
    "full_text": "完整正文（不含标题、作者行）",
    "genre": "古诗|词|古文",
    "creation_background": "创作背景（50字内）",
    "era_background": "时代背景（50字内）",
    "poet_mood": "情感基调"
  },
  "line_analysis": [
    {
      "line_number": 1,
      "line": "原句",
      "word_explanation": "关键字词解释",
      "interpretation": "句意解读（30字内）",
      "imagery": ["意象/物象1", "意象/物象2"],
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
      "text": "代表主题的一句",
      "scene_description": "封面：标题、朝代、作者+核心意境",
      "image_prompt": "[朝代]风封面。标题\"[标题]\"，副标题\"[朝代] [作者]\"。背景[核心意象]，[风格]，[色调]。",
      "style_hints": "风格",
      "atmosphere": "氛围",
      "color_tone": "色调",
      "composition": "构图"
    },
    {
      "index": 2,
      "type": "content",
      "title": "第一句",
      "text": "原句",
      "scene_description": "本句场景与意象",
      "image_prompt": "[风格]。[本句主体：景/物/人]+[状态或动作]+[环境]。[朝代]感，[色调]。",
      "style_hints": "风格",
      "atmosphere": "氛围",
      "color_tone": "色调",
      "composition": "构图"
    }
  ]
}

## 重要提醒
- 封面须含标题、朝代、作者；内容分镜**必须覆盖每句的物象/意象**，不得出现「一人读/诵全诗」的单一画面设计。
- 连环画模式：需在画面中显示的文字（标题、朝代、作者、本句原文）用双引号包裹。
- 原文 N 句 → line_analysis 共 N 条，storyboards 为 1 封面 + N 个 content。
"""

# 诗词深度分析与分镜生成提示词（视频生成版）
# 与图像版同原则：物象/意象优先、人物可有可无、禁止一人读全诗、支持诗/词/古文、分镜简短
POETRY_ANALYSIS_FOR_VIDEO_PROMPT = """
你是古诗词古文分析专家。请分析文本并生成**用于视频生成**的分镜数据，帮助观众通过画面理解每一句。

## 重要限制（必须严格遵守）

**本系统专门用于处理古诗词和古文，不接受其他类型的文本。**

1. **只接受古诗词或古文**：古诗、词、元曲、古文（古代散文、文言文）；不接受现代文学或非文学文本。
2. **若输入不是古诗词或古文**：明确拒绝并说明仅处理古诗词与古文。
3. **体裁**：古诗按句断句；词可标上下阕/片仍按句分镜；古文按句或短段分镜。

## 核心原则（分镜为理解服务）

1. **以物象、意象为核心**：每句的 image_prompt 必须围绕该句的**物象、意象**（景、物、动作、氛围）来写，不得遗漏句中出现的景、物、人。
2. **人物可有可无**：句中无人则画景/物；有单人则画单人；有多人则画多人。**严禁**设计「一个人读/诵完整首诗」或「一人贯穿全片朗诵」的画面；每句对应其自身意象与场景，而非同一人在读诗。
3. **分镜提示词简短**：每条 image_prompt 约 50–120 字。格式：「[风格]。[主体景/物/人]+[状态或动作]+[环境]。镜头：[运镜建议]。」
4. **逐句一一对应**：除封面外，每个 content 分镜对应一句原文；line_analysis 与 storyboards 的 content 数量一致。
5. **封面**：标题、朝代、作者+作品核心主题；风格与内容、时代匹配。

## 任务
1. 识别标题、作者、朝代；若为词则标阕/片。
2. **逐句分析**：每句的 word_explanation、interpretation、**imagery（物象/意象列表，必填）**、emotion、rhetoric、visual_scene、action（如有）、time_marker（如有）。
3. **逐句分镜**：每句一个 content；image_prompt 紧扣该句的**意象与场景**，人物仅在本句明确出现时才写人；camera_movement、duration_suggestion 简短。

## JSON 输出

{
  "poetry_info": {
    "title": "标题",
    "author": "作者",
    "dynasty": "朝代",
    "full_text": "完整正文（不含标题、作者行）",
    "genre": "古诗|词|古文",
    "creation_background": "创作背景（50字内）",
    "era_background": "时代背景（50字内）",
    "poet_mood": "情感基调"
  },
  "line_analysis": [
    {
      "line_number": 1,
      "line": "原句",
      "word_explanation": "关键字词解释",
      "interpretation": "句意解读（30字内）",
      "imagery": ["意象/物象1", "意象/物象2"],
      "emotion": "情感",
      "rhetoric": "修辞手法",
      "visual_scene": "本句视觉场景（简短）",
      "action": "动作（如有）",
      "time_marker": "时间（如有）"
    }
  ],
  "storyboards": [
    {
      "index": 1,
      "type": "cover",
      "title": "标题",
      "subtitle": "朝代·作者",
      "text": "代表主题的一句",
      "scene_description": "封面：标题、朝代、作者+核心意境",
      "image_prompt": "[风格]。封面：标题\"[标题]\"，\"[朝代] [作者]\"，[核心意象]。[色调]。",
      "style_hints": "风格",
      "atmosphere": "氛围",
      "color_tone": "色调",
      "composition": "构图"
    },
    {
      "index": 2,
      "type": "content",
      "title": "第一句",
      "text": "原句",
      "scene_description": "本句场景与意象",
      "image_prompt": "[风格]。[本句主体：景/物/人]+[状态或动作]+[环境]。镜头：[推/拉/横移等]，[建议时长]秒。",
      "style_hints": "风格",
      "atmosphere": "氛围",
      "color_tone": "色调",
      "composition": "构图",
      "camera_movement": "简短运镜建议",
      "duration_suggestion": 3
    }
  ]
}

## 重要提醒
- **禁止**整片出现「一人读/诵全诗」的单一画面设计；每句分镜须体现该句的物象与意境。
- 原文 N 句 → line_analysis 共 N 条，storyboards 为 1 封面 + N 个 content。
"""

def basic_segmentation(text: str) -> List[str]:
    """
    基础断句处理 - 智能识别古诗词句子
    支持句号、问号、感叹号、逗号、分号作为分句标记
    不进行任何过滤，保留所有内容，由AI在prompt中区分标题、作者和诗句
    """
    if not text or not text.strip():
        return []
    
    # 先按换行符分割（处理多行诗词）
    lines = text.split('\n')
    segments = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 按句号、问号、感叹号分割（主要分句标记）
        main_parts = re.split(r'[。！？]', line)
        for main_part in main_parts:
            main_part = main_part.strip()
            if not main_part:
                continue
            
            # 如果包含逗号或分号，进一步分割（古诗词中逗号、分号也可以分句）
            if re.search(r'[，；]', main_part):
                # 按逗号、分号分割
                sub_parts = re.split(r'[，；]', main_part)
                for sub_part in sub_parts:
                    sub_part = sub_part.strip()
                    if sub_part and len(sub_part) >= 2:  # 至少2个字符才作为一句
                        segments.append(sub_part)
            else:
                # 没有逗号、分号，直接作为一句
                if len(main_part) >= 2:  # 至少2个字符才作为一句
                    segments.append(main_part)
    
    # 如果没有任何分割结果，返回所有非空行
    if not segments:
        for line in lines:
            line = line.strip()
            if line and len(line) >= 2:
                segments.append(line)
    
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
    logger.debug(f"开始分析文本，长度: {len(text)}")
    
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
        # 增强系统提示词（添加内容限制）
        enhanced_prompt = ContentValidator.enhance_system_prompt(ANCIENT_TEXT_ANALYSIS_PROMPT)
        
        # 构建消息
        messages = [
            {"role": "system", "content": enhanced_prompt},
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
        
        logger.debug("文本分析完成")
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
    generation_type: Literal["image", "video"] = "image",
    ark_client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    深度分析古诗词/古文并生成分镜脚本
    
    Args:
        text: 用户输入的诗词文本
        mode: 生成模式，storybook（故事书）或 comics（连环画）
        generation_type: 生成类型，image（图像）或 video（视频）
        ark_client: Ark客户端实例
        
    Returns:
        包含诗词信息、逐句分析和分镜数据的结构化结果
    """
    # 当生成类型是video时，模式应该显示为video
    display_mode = "video" if generation_type == "video" else mode
    logger.debug(f"开始深度分析诗词，模式: {display_mode}，文本长度: {len(text)}")
    
    # 如果没有ark_client，返回基础结构
    if not ark_client:
        logger.warning("未提供Ark客户端，返回基础分析结果")
        return _create_basic_poetry_analysis(text, mode)
    
    try:
        # 根据生成类型选择不同的prompt
        if generation_type == "video":
            system_prompt = POETRY_ANALYSIS_FOR_VIDEO_PROMPT
            mode_description = "视频生成模式：需要关注场景的动态变化、时间顺序、镜头运动等视频元素"
        else:
            system_prompt = POETRY_ANALYSIS_WITH_STORYBOARD_PROMPT
            mode_description = "故事书模式：竖版画面，画面细腻优美，强调意境" if mode == "storybook" else "连环画模式：方形画面，画面生动有趣，强调叙事"
        
        # 增强系统提示词（添加内容限制）
        system_prompt = ContentValidator.enhance_system_prompt(system_prompt)
        
        # 先进行断句，明确告诉模型有多少句
        lines = basic_segmentation(text)
        line_count = len(lines)
        
        # 构建消息，明确要求逐句分析
        user_content = f"""请分析以下古诗词/古文，并按照{mode_description}生成分镜：

{text}

**重要提示**：
1. **必须严格区分元信息和诗句内容**：
   - 标题（如"示儿"）、作者信息（如"宋 陆游"）**不是诗句**，不要放入 line_analysis
   - 只对实际的诗词内容进行逐句分析
   - poetry_info.full_text 只包含实际的诗词内容，不包括标题和作者行
   - 你必须自己识别并区分标题、作者和诗句内容

2. **断句规则**：
   - 古诗词的句子可以按**句号、问号、感叹号、逗号、分号**分割
   - 例如："床前明月光，疑是地上霜。举头望明月，低头思故乡。"应该断句为4句
   - 标题和作者行不参与断句

3. **原文断句结果**：
   - 按句号、问号、感叹号、逗号、分号分割后，共有 {line_count} 个句子片段
   - 你需要自己识别哪些是标题、哪些是作者、哪些是实际诗句
   - 只对实际诗句进行 line_analysis，标题和作者行要排除

4. **输出要求**：
   - 你必须为每一句实际诗句生成一个 line_analysis 条目（不包括标题和作者）
   - 你必须为每一句实际诗句生成一个 content 类型的分镜（不包括封面）
   - 不能合并句子，不能跳过任何实际诗句
   - 每一句的分析必须完整，包含 word_explanation、interpretation、imagery、emotion、rhetoric 等字段
"""
        
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ]
        
        # 调用模型（增加 max_tokens 确保完整输出）
        result = ark_client.chat_completion(
            model=config.MODEL_NAME,
            messages=messages,
            stream=False,
            response_format='json_object',
            disable_thinking=True,
            max_tokens=4000  # 增加token数量，确保逐句分析完整
        )
        
        # 解析结果
        content = result.get("content", "{}")
        analysis_result = json.loads(content)
        
        # 验证和补全结果结构
        analysis_result = _validate_and_complete_analysis(analysis_result, text, mode)
        
        logger.debug(f"诗词分析完成，生成 {len(analysis_result.get('storyboards', []))} 个分镜")
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
    if mode == "comics":
        # 连环画模式：必须用双引号包裹文字以便在图像中显示
        cover_prompt = f'一幅展现「{title}」意境的连环画封面。画面上方显示大标题"{title}"，标题下方显示"待查 作者"。背景是{style}风格的场景，体现作品主题。整体采用{style}风格，色调{color_tone}，画面{atmosphere}。所有文字（标题、朝代、作者）都用双引号包裹以便在图像中显示。'
    else:
        # 故事书模式：传统风格
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
        if mode == "comics":
            # 连环画模式：必须包含用双引号包裹的诗句文字
            content_prompt = f'一幅展现「{seg}」意境的{style}画作。画面描绘这句诗词所表达的场景和意境，{atmosphere}的氛围。画面中必须显示对应的诗句："{seg}"，文字用双引号包裹以便在图像中显示。采用中国古典绘画风格，色调{color_tone}，{composition}，整体意境优美深远。'
        else:
            # 故事书模式：传统风格
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
    验证并补全分析结果的结构，确保逐句分析和逐句生成
    """
    # 先进行基础断句，确定原文有多少句
    # 不进行任何过滤，保留所有内容，由AI在prompt中自己识别标题、作者和诗句
    lines = basic_segmentation(original_text)
    
    # 清理空行和过短的行
    cleaned_lines = [line.strip() for line in lines if line.strip() and len(line.strip()) >= 2]
    
    # 期望的句子数量：由AI自己识别并返回实际诗句数量
    # 我们不再预设期望值，而是根据AI返回的line_analysis数量来验证
    
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
    
    # 补全 poetry_info 的新字段（含可选 genre：古诗|词|古文）
    poetry_info = result["poetry_info"]
    poetry_info.setdefault("poet_mood", "")
    poetry_info.setdefault("genre", "")
    poetry_info.setdefault("era_visual_elements", {
        "clothing": "",
        "architecture": "",
        "objects": [],
        "nature": ""
    })
    
    # 确保 line_analysis 存在并补全缺失的句子
    if "line_analysis" not in result:
        result["line_analysis"] = []
    
    # 补全 line_analysis 的新字段
    for line in result["line_analysis"]:
        line.setdefault("visual_scene", "")
    
    # 重新编号 line_analysis
    for i, line in enumerate(result["line_analysis"]):
        line["line_number"] = i + 1
    
    # 验证 line_analysis 是否合理（至少应该有内容）
    if len(result["line_analysis"]) == 0:
        logger.warning(f"逐句分析为空，AI可能没有正确识别诗句内容。原文断句后有 {len(cleaned_lines)} 个句子片段")
        # 如果AI完全没有返回分析，使用清理后的行作为基础
        result["line_analysis"] = [
            {
                "line_number": i + 1,
                "line": line_text.strip(),
                "word_explanation": "待分析",
                "interpretation": "待分析",
                "imagery": [],
                "emotion": "待分析",
                "rhetoric": "待分析",
                "visual_scene": ""
            }
            for i, line_text in enumerate(cleaned_lines)
        ]
    
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
            
            # 根据模式生成不同的封面提示词
            if mode == "comics":
                # 连环画模式：必须用双引号包裹文字以便在图像中显示
                cover_prompt = f'一幅展现「{title}」意境的连环画封面。画面上方显示大标题"{title}"，标题下方显示"{dynasty} {author}"。背景是{default_style}风格的场景，体现作品主题。整体采用{default_style}风格，色调{default_color_tone}，画面{default_atmosphere}。所有文字（标题、朝代、作者）都用双引号包裹以便在图像中显示。'
            else:
                # 故事书模式：传统风格
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
        
        # 检查内容分镜数量：应该与 line_analysis 数量一致
        content_storyboards = [sb for sb in result["storyboards"] if sb.get("type") == "content"]
        expected_content_count = len(result.get("line_analysis", []))
        if len(content_storyboards) != expected_content_count:
            logger.warning(f"内容分镜数量不匹配：期望 {expected_content_count} 个（基于line_analysis），实际 {len(content_storyboards)} 个，补全缺失的分镜")
            
            # 获取已有的内容分镜文本
            existing_texts = {sb.get("text", "").strip() for sb in content_storyboards}
            
            # 为缺失的句子创建分镜（使用line_analysis中的句子）
            line_analysis_lines = [line.get("line", "").strip() for line in result.get("line_analysis", [])]
            for i, line_text in enumerate(line_analysis_lines):
                if line_text and line_text.strip() not in existing_texts:
                    # 创建缺失的分镜
                    if mode == "comics":
                        # 连环画模式：必须包含用双引号包裹的诗句文字
                        content_prompt = f'一幅展现「{line_text.strip()}」意境的{default_style}画作。画面描绘这句诗词所表达的场景和意境，{default_atmosphere}的氛围。画面中必须显示对应的诗句："{line_text.strip()}"，文字用双引号包裹以便在图像中显示。采用中国古典绘画风格，色调{default_color_tone}，{default_composition}，整体意境优美深远。'
                    else:
                        # 故事书模式：传统风格
                        content_prompt = f'一幅展现「{line_text.strip()}」意境的{default_style}画作。画面描绘这句诗词所表达的场景和意境，{default_atmosphere}的氛围。采用中国古典绘画风格，色调{default_color_tone}，{default_composition}，整体意境优美深远。'
                    
                    new_storyboard = {
                        "index": len(result["storyboards"]) + 1,
                        "type": "content",
                        "title": f"第{i + 1}句",
                        "text": line_text.strip(),
                        "scene_description": f"描绘「{line_text.strip()}」的场景，展现诗句中的意象和情感",
                        "image_prompt": content_prompt,
                        "style_hints": default_style,
                        "atmosphere": default_atmosphere,
                        "color_tone": default_color_tone,
                        "composition": default_composition,
                        "era_elements": "",
                        "time_of_day": "",
                        "weather": ""
                    }
                    result["storyboards"].append(new_storyboard)
                    logger.debug(f"补全缺失的分镜: {line_text[:20]}...")
            
            # 重新排序和编号所有分镜：封面在前，内容分镜按原文顺序排列
            cover_sb = [sb for sb in result["storyboards"] if sb.get("type") == "cover"]
            content_sbs = [sb for sb in result["storyboards"] if sb.get("type") == "content"]
            
            # 按原文顺序排序内容分镜（使用line_analysis中的顺序）
            line_analysis_lines = [line.get("line", "").strip() for line in result.get("line_analysis", [])]
            def get_line_index(storyboard):
                text = storyboard.get("text", "").strip()
                try:
                    return line_analysis_lines.index(text)
                except ValueError:
                    # 如果找不到，尝试匹配部分文本
                    for idx, line in enumerate(line_analysis_lines):
                        if text in line or line in text:
                            return idx
                    return 999
            
            content_sbs.sort(key=get_line_index)
            
            # 重新组合：封面 + 按顺序的内容分镜
            result["storyboards"] = cover_sb + content_sbs
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
    # 以分镜中的 image_prompt 为主，尽量简短，避免冗长拼接
    base_prompt = storyboard.get("image_prompt", "").strip()
    if not base_prompt:
        base_prompt = storyboard.get("scene_description", "")
    parts = [base_prompt] if base_prompt else []
    
    style_hints = storyboard.get("style_hints", "").strip()
    if style_hints and style_hints not in base_prompt:
        parts.append(f"风格：{style_hints}")
    
    # 模式仅补一句简短要求，不堆砌长句
    if mode == "storybook":
        parts.append("竖版构图，意境深远。")
    else:
        parts.append("方形构图，叙事清晰。")
    
    if storyboard.get("type") == "cover":
        title = poetry_info.get("title", "")
        author = poetry_info.get("author", "")
        dynasty = poetry_info.get("dynasty", "")
        if title or author:
            parts.append(f"封面含：{title}，{dynasty}{author}。")
    
    return "\n".join(parts)


# 视频分析专用提示词（完全独立于图像分析）
# 针对火山引擎 Seedance 1.5 Pro 文生视频（含音频）优化；目标：帮助理解诗句，分镜按意象/句，提示词简短，人物可有可无
VIDEO_ANALYSIS_PROMPT = """
你是古诗词古文视频创作专家，为火山引擎 Seedance 1.5 Pro 文生视频（含音频）生成**简短、分镜式**的视频提示词，帮助观众通过画面理解每一句。

## 重要限制

**只接受古诗词或古文**（古诗、词、元曲、古文）；不接受现代文学或非文学文本。若非古诗词/古文，明确拒绝并说明。

## 核心原则（与分镜设计一致）

1. **以物象、意象为核心**：画面按句/按意象分镜，每句对应其景、物或人，不得遗漏原文物象。
2. **人物可有可无**：句中无人则只写景/物；有单人写单人，有多人写多人。**严禁**设计「一个人读/诵完整首诗」或「一人贯穿全片朗诵」的画面；画面应随句切换意象与场景，而非同一人在读诗。
3. **video_prompt 简短**：总长建议 150–280 字。结构：画面（按句/意象分段，每段一句概括）+ 风格 + 镜头/转场 + 背景音乐 + 古诗朗诵（**必须含完整诗词原文**）+ 环境音效。用具体名词、动词，避免冗长形容词。
4. **支持古诗、词、古文**：词可标上下阕；古文按句或短段；体裁在 poetry_info 中可标 genre（古诗/词/古文）。

## 任务

1. 识别标题、作者、朝代、完整正文（full_text 不含标题、作者行）。
2. 生成 video_prompt：按句或按意象描述画面变化，再写风格、运镜、音乐、**朗诵（含完整原文）**、音效。总长 150–280 字。

## 输出格式（JSON）

{
  "poetry_info": {
    "title": "标题",
    "author": "作者",
    "dynasty": "朝代",
    "full_text": "完整正文（不含标题、作者行）",
    "genre": "古诗|词|古文（可选）",
    "creation_background": "创作背景（50字内）",
    "era_background": "时代背景（50字内）",
    "poet_mood": "情感基调"
  },
  "video_prompt_data": {
    "video_prompt": "简短分镜式视频提示词（150-280字）：按句/意象描述画面变化 + 风格 + 运镜 + 背景音乐 + 古诗朗诵（必须含完整诗词原文）+ 环境音效。禁止一人读全诗画面。",
    "scene_description": "主要场景简述（50字内）",
    "visual_style": "视觉风格（30字内）",
    "background_music": "背景音乐（30字内）",
    "narration_style": "古诗朗诵要求，必须包含要朗诵的完整诗词原文（50字内）",
    "transitions": "转场（20字内）",
    "camera_movement": "镜头运动（30字内）",
    "duration_suggestion": 15
  }
}

## 重要要求

1. full_text 只包含正文，不含标题、作者行。
2. video_prompt 必须：按句/意象分镜描述画面；**古诗朗诵部分必须包含要朗诵的完整诗词原文**；禁止「一人读全诗」画面；总长 150–280 字。
3. 忠实原文物象与意境；风格、音乐、朗诵与情感基调一致。
"""


async def analyze_poetry_for_video(
    text: str,
    ark_client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    专门用于视频生成的诗词分析函数（完全独立于图像分析）
    
    流程：
    1. 识别原文诗句（区分标题、作者和诗句内容）
    2. 生成完整视频prompt（直接生成，不需要逐句分析）
    
    Args:
        text: 用户输入的诗词文本
        ark_client: Ark客户端实例
        
    Returns:
        包含诗词信息和视频prompt数据的结构化结果
        （不包含 storyboards 和 line_analysis）
    """
    logger.debug(f"开始视频专用诗词分析，文本长度: {len(text)}")
    
    # 如果没有ark_client，返回基础结构
    if not ark_client:
        logger.warning("未提供Ark客户端，返回基础分析结果")
        return _create_basic_video_analysis(text)
    
    try:
        # 增强系统提示词（添加内容限制）
        enhanced_prompt = ContentValidator.enhance_system_prompt(VIDEO_ANALYSIS_PROMPT)
        
        # 构建消息
        user_content = f"""请分析以下古诗词/古文，按 Seedance 1.5 Pro 文生视频（含音频）要求生成**简短、分镜式**的 video_prompt：

{text}

**重要提示**：
1. 区分标题、作者与正文：poetry_info.full_text 只含正文，不含标题、作者行。
2. video_prompt 须简短（150–280 字）：按句/意象描述画面变化，再写风格、运镜、背景音乐、古诗朗诵（**必须含完整诗词原文**）、环境音效。
3. **禁止**「一个人读/诵完整首诗」的画面设计；画面应随句切换意象与场景（景、物、人按原文可有可无）。
4. 忠实原文物象与意境。
"""
        
        messages = [
            {"role": "system", "content": enhanced_prompt},
            {"role": "user", "content": user_content}
        ]
        
        # 调用模型（增加 max_tokens 确保完整输出）
        result = ark_client.chat_completion(
            model=config.MODEL_NAME,
            messages=messages,
            stream=False,
            response_format='json_object',
            disable_thinking=True,
            max_tokens=4000  # 增加token数量，确保完整输出
        )
        
        # 解析结果
        content = result.get("content", "{}")
        analysis_result = json.loads(content)
        
        # 验证和补全结果结构
        analysis_result = _validate_and_complete_video_analysis(analysis_result, text)
        
        logger.debug(f"视频分析完成，video_prompt长度: {len(analysis_result.get('video_prompt_data', {}).get('video_prompt', ''))}")
        return analysis_result
        
    except json.JSONDecodeError as e:
        logger.error(f"解析分析结果失败: {str(e)}")
        return _create_basic_video_analysis(text)
    except Exception as e:
        logger.error(f"分析诗词时发生错误: {str(e)}")
        raise


def _create_basic_video_analysis(text: str) -> Dict[str, Any]:
    """
    创建基础的视频分析结果（当无法调用模型时使用）
    """
    # 简单提取标题（第一行）和诗句内容
    lines = text.strip().split('\n')
    title = lines[0].strip() if lines else "未知诗词"
    # 假设从第二行开始是诗句（如果只有一行，则整行都是诗句）
    poetry_lines = lines[1:] if len(lines) > 1 else lines
    
    return {
        "poetry_info": {
            "title": title if len(lines) > 1 else "",
            "author": "待查",
            "dynasty": "待查",
            "full_text": "\n".join(poetry_lines),
            "creation_background": "暂无背景信息，请手动补充",
            "era_background": "暂无时代背景信息，请手动补充",
            "poet_mood": "待分析"
        },
        "video_prompt_data": {
            "video_prompt": f"根据古诗词《{title}》创作视频，展现诗词意境，包含场景、画面、风格、音乐、朗诵等要素",
            "scene_description": "古典诗词意境场景",
            "visual_style": "中国古典绘画风格",
            "background_music": "古典音乐，节奏适中，意境深远",
            "narration_style": "古典诗词朗诵风格，节奏与诗词韵律相匹配",
            "transitions": "淡入淡出，自然流畅",
            "camera_movement": "缓慢推进，展现诗词意境",
            "duration_suggestion": 15
        }
    }


def _validate_and_complete_video_analysis(result: Dict[str, Any], original_text: str) -> Dict[str, Any]:
    """
    验证并补全视频分析结果的结构
    （视频分析不需要 line_analysis 和 storyboards）
    """
    # 确保 poetry_info 存在并补全字段
    if "poetry_info" not in result:
        result["poetry_info"] = {
            "title": "",
            "author": "",
            "dynasty": "",
            "full_text": original_text,
            "creation_background": "",
            "era_background": "",
            "poet_mood": ""
        }
    
    poetry_info = result["poetry_info"]
    poetry_info.setdefault("title", "")
    poetry_info.setdefault("author", "")
    poetry_info.setdefault("dynasty", "")
    poetry_info.setdefault("full_text", original_text)
    poetry_info.setdefault("genre", "")  # 可选：古诗|词|古文
    poetry_info.setdefault("creation_background", "")
    poetry_info.setdefault("era_background", "")
    poetry_info.setdefault("poet_mood", "")
    
    # 确保 video_prompt_data 存在并补全字段
    if "video_prompt_data" not in result:
        result["video_prompt_data"] = {}
    
    video_prompt_data = result["video_prompt_data"]
    
    # 如果 video_prompt 为空或太短，生成一个基础的（符合 Seedance 1.5 Pro 要求）
    if not video_prompt_data.get("video_prompt") or len(video_prompt_data.get("video_prompt", "")) < 50:
        title = poetry_info.get("title", "")
        author = poetry_info.get("author", "")
        dynasty = poetry_info.get("dynasty", "")
        full_text = poetry_info.get("full_text", original_text)
        emotion = poetry_info.get("poet_mood", "宁静")
        
        # 根据情感选择音乐和朗诵风格
        music_map = {
            "悲壮": "古筝或二胡演奏，节奏缓慢，情感深沉，配合低沉的鼓声",
            "宁静": "古琴或笛子演奏，节奏舒缓，意境深远，配合流水声和鸟鸣声",
            "激昂": "古筝或琵琶演奏，节奏明快，气势磅礴，配合鼓声和号角声",
            "婉约": "古筝或箫演奏，节奏轻柔，情感细腻，配合风声和雨声",
            "豪放": "古筝或鼓乐，节奏强烈，气势恢宏，配合雷鸣声和风声"
        }
        music_desc = music_map.get(emotion, "古筝演奏，节奏适中，意境深远，配合自然音效")
        
        narration_map = {
            "悲壮": "男声，古典风格，抑扬顿挫，节奏缓慢，情感深沉，语调低沉",
            "宁静": "男声或女声，古典风格，节奏舒缓，情感宁静，语调平和",
            "激昂": "男声，古典风格，抑扬顿挫，节奏明快，情感激昂，语调高亢",
            "婉约": "女声，古典风格，节奏轻柔，情感细腻，语调婉转",
            "豪放": "男声，古典风格，节奏明快，情感豪放，语调洪亮"
        }
        narration_style = narration_map.get(emotion, "男声，古典风格，节奏适中，情感表达，语调自然")
        
        # 构建完整的朗诵描述，必须包含诗词原文
        narration_desc = f"{narration_style}，朗诵内容为「{full_text}」"
        
        # 简短分镜式 fallback：按意象/句描述画面，不默认「一人读全诗」
        video_prompt_data["video_prompt"] = f"""古诗词《{title}》（{dynasty}·{author}）视频。画面按句切换意象与场景：每句对应其景、物或人（句中无人则只拍景/物），不出现一人读全诗。风格：国风水墨/工笔，{dynasty}时代建筑与服饰，淡雅色调。镜头：缓慢推进、横移、特写关键意象。背景音乐：{music_desc}。古诗朗诵：{narration_desc}。转场：淡入淡出。环境音效：鸟鸣、流水、风声等与诗意一致。情感基调：{emotion}。"""
        logger.warning("video_prompt 为空或太短，已生成简短分镜式 fallback")
    
    video_prompt_data.setdefault("scene_description", video_prompt_data.get("scene_description", "古典诗词意境场景"))
    video_prompt_data.setdefault("visual_style", video_prompt_data.get("visual_style", "中国古典绘画风格"))
    video_prompt_data.setdefault("background_music", video_prompt_data.get("background_music", "古典音乐，节奏适中"))
    
    # 确保 narration_style 包含诗词原文（如果没有的话）
    narration_style = video_prompt_data.get("narration_style", "古典诗词朗诵风格")
    full_text = poetry_info.get("full_text", "")
    if full_text and full_text not in narration_style:
        # 如果 narration_style 中没有包含诗词原文，添加进去
        video_prompt_data["narration_style"] = f"{narration_style}，朗诵内容为「{full_text}」"
    else:
        video_prompt_data.setdefault("narration_style", f"古典诗词朗诵风格，朗诵内容为「{full_text}」" if full_text else "古典诗词朗诵风格")
    
    # 确保 video_prompt 中的古诗朗诵部分包含诗词原文
    video_prompt = video_prompt_data.get("video_prompt", "")
    if video_prompt and full_text:
        # 检查 video_prompt 中的古诗朗诵部分是否包含诗词原文
        if "古诗朗诵" in video_prompt and full_text not in video_prompt:
            # 如果古诗朗诵部分存在但不包含诗词原文，添加进去
            import re
            # 尝试找到古诗朗诵部分并添加诗词原文
            narration_pattern = r"(古诗朗诵[：:].*?)(?=\n|镜头运动|转场效果|环境音效|整体要求|$)"
            match = re.search(narration_pattern, video_prompt, re.DOTALL)
            if match:
                narration_part = match.group(1)
                if full_text not in narration_part:
                    # 在古诗朗诵部分末尾添加诗词原文
                    new_narration = f"{narration_part.rstrip('。')}，朗诵内容为「{full_text}」。"
                    video_prompt_data["video_prompt"] = video_prompt.replace(narration_part, new_narration)
    
    video_prompt_data.setdefault("transitions", video_prompt_data.get("transitions", "淡入淡出，自然流畅"))
    video_prompt_data.setdefault("camera_movement", video_prompt_data.get("camera_movement", "缓慢推进，展现诗词意境"))
    video_prompt_data.setdefault("duration_suggestion", video_prompt_data.get("duration_suggestion", 15))
    
    return result


