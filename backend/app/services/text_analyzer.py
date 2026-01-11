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
POETRY_ANALYSIS_WITH_STORYBOARD_PROMPT = """
你是古诗词古文分析专家。请分析文本并生成**忠实于原文意境**的分镜提示词（用于图像生成）。

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
3. **逐句分析，提取**原文实际描述的**场景、动作、意象（重要：必须分析每一句，不能遗漏任何一句）**
4. 根据内容选择最合适的绘画风格
5. **为每一句生成对应的分镜和图像提示词（重要：除了封面，每个分镜必须对应一句原文，不能合并或跳过任何句子）**

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
      "image_prompt": "一幅[朝代]风格的古典画卷封面，体现「[作品核心主题/意境]」。画面上方是大字标题\"[标题]\"，标题下方清晰显示\"[朝代] [作者]\"。背景是[与主题相关的代表性场景]。[选择的绘画风格]，[色调]色调，[氛围]意境，古典书卷气息。\n\n**连环画模式特殊要求**：如果生成模式是连环画，封面必须包含用双引号包裹的文字：\"[标题]\"、\"[朝代] [作者]\"，这些文字会在图像中显示。",
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
      "image_prompt": "[绘画风格]。画面描绘[严格按原文内容：主体+动作+环境]。[朝代]特色，[色调]色调，[氛围]意境。\n\n**连环画模式特殊要求**：如果生成模式是连环画，画面中必须包含用双引号包裹的对应诗句\"[原文]\"，这句文字会在图像中显示。",
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
- **必须逐句分析：line_analysis 数组中的元素数量必须等于原文的句数（按句号、问号、感叹号、换行符分割）**
- **必须逐句生成分镜：storyboards 中除了封面（type="cover"），每个 content 类型的分镜必须对应一句原文，不能合并多句或跳过任何句子**
- **如果原文有 N 句，line_analysis 必须有 N 个元素，storyboards 必须有 1 个封面 + N 个内容分镜，共 N+1 个分镜**

## 连环画模式特殊要求（重要）
如果生成模式是连环画（comics），必须遵循以下规则：
1. **封面（第一张画面）**：
   - image_prompt 中必须包含用双引号包裹的文字：标题、朝代、作者
   - 例如：画面上方显示大标题"[标题]"，下方显示"[朝代] [作者]"
   - 所有需要显示的文字都必须用双引号包裹，例如："示儿"、"宋 陆游"

2. **内容分镜（后续画面）**：
   - 每个内容分镜的 image_prompt 中必须包含用双引号包裹的对应诗句
   - 例如：画面中显示诗句"[原句内容]"
   - 诗句文字必须用双引号包裹，例如："死去元知万事空"
   - 每个分镜只显示对应的那一句，不要显示其他句子

3. **文字显示规范**：
   - 所有需要在图像中显示的文字（标题、朝代、作者、诗句）都必须用双引号包裹
   - 双引号内的文字会在生成的图像中显示出来
   - 封面：显示标题、朝代、作者
   - 内容分镜：显示对应的诗句

## 逐句分析要求（非常重要）
1. **必须区分元信息和诗句内容**：
   - 标题（如"示儿"）、作者信息（如"宋 陆游"）**不是诗句**，不要放入 line_analysis
   - 只对实际的诗词内容进行逐句分析
   - poetry_info.full_text 只包含实际的诗词内容，不包括标题和作者行

2. **断句规则**：
   - 古诗词的句子可以按**句号、问号、感叹号、逗号、分号**分割
   - 例如："床前明月光，疑是地上霜。举头望明月，低头思故乡。"应该断句为4句（逗号和句号都是分句标记）
   - 先对原文进行断句，然后为每一句生成一个 line_analysis 条目

3. **每一句都必须包含完整的分析**：word_explanation（关键字词解释）、interpretation（句意解读）、imagery（意象列表）、emotion（情感）、rhetoric（修辞手法）

4. **不能合并句子**：即使两句意思相近，也必须分开分析

5. **不能跳过句子**：原文有多少句，line_analysis 就必须有多少个元素

6. **示例**：
   - 输入："示儿\n宋 陆游\n死去元知万事空，但悲不见九州同。王师北定中原日，家祭无忘告乃翁。"
   - 标题："示儿"（不分析）
   - 作者："宋 陆游"（不分析）
   - 诗句：4句（"死去元知万事空"、"但悲不见九州同"、"王师北定中原日"、"家祭无忘告乃翁"）
   - line_analysis 必须有4个元素，不包括标题和作者
"""

# 诗词深度分析与分镜生成提示词（视频生成版）
POETRY_ANALYSIS_FOR_VIDEO_PROMPT = """
你是古诗词古文分析专家。请分析文本并生成**用于视频生成**的详细分析数据。

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

## 核心原则
1. **分析重点在于视频创作**：需要关注场景的动态变化、时间顺序、镜头运动等视频元素
2. **逐句分析必须完整**：每一句都要分析其视觉场景、动作、情感变化等，为视频分镜提供基础
3. **封面必须包含：标题、朝代、作者，并体现作品核心主题**

## 任务
1. 识别诗词/古文信息（标题、作者、朝代）
2. 分析创作背景和核心主题
3. **逐句分析，提取**原文实际描述的**场景、动作、意象、时间变化、情感变化（重要：必须分析每一句，不能遗漏任何一句）**
4. 分析每句之间的逻辑关系和转场需求
5. **为每一句生成对应的场景描述（重要：除了封面，每个场景必须对应一句原文，不能合并或跳过任何句子）**

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
      "rhetoric": "修辞手法",
      "visual_scene": "视觉场景描述（用于视频）",
      "action": "动作描述（如有）",
      "time_marker": "时间标记（如有）"
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
      "image_prompt": "用于视频封面的画面描述",
      "style_hints": "视觉风格",
      "atmosphere": "整体氛围",
      "color_tone": "主色调",
      "composition": "构图方式"
    },
    {
      "index": 2,
      "type": "content",
      "title": "第一句",
      "text": "原文",
      "scene_description": "这句描绘的具体场景（用于视频分镜）",
      "image_prompt": "画面描述（用于视频生成）",
      "style_hints": "视觉风格",
      "atmosphere": "氛围",
      "color_tone": "色调",
      "composition": "构图",
      "camera_movement": "镜头运动建议",
      "duration_suggestion": "建议时长（秒）"
    }
  ]
}

## 重要提醒
- **封面必须明确显示：标题（大字）、朝代、作者（小字）**
- 封面的 scene_description 和 image_prompt 必须体现作品的核心主题
- **必须逐句分析：line_analysis 数组中的元素数量必须等于原文的句数（按句号、问号、感叹号、换行符分割）**
- **必须逐句生成场景：storyboards 中除了封面（type="cover"），每个 content 类型的分镜必须对应一句原文，不能合并多句或跳过任何句子**
- **如果原文有 N 句，line_analysis 必须有 N 个元素，storyboards 必须有 1 个封面 + N 个内容分镜，共 N+1 个分镜**

## 逐句分析要求（非常重要）
1. **必须严格按照原文的句数进行分析**：先对原文进行断句（按句号、问号、感叹号、换行符分割），然后为每一句生成一个 line_analysis 条目
2. **每一句都必须包含完整的分析**：word_explanation（关键字词解释）、interpretation（句意解读）、imagery（意象列表）、emotion（情感）、rhetoric（修辞手法）、visual_scene（视觉场景，用于视频）
3. **不能合并句子**：即使两句意思相近，也必须分开分析
4. **不能跳过句子**：原文有多少句，line_analysis 就必须有多少个元素
5. **示例**：如果原文是"床前明月光，疑是地上霜。举头望明月，低头思故乡。"，应该断句为4句，line_analysis 必须有4个元素
"""

def basic_segmentation(text: str) -> List[str]:
    """
    基础断句处理 - 智能识别古诗词句子
    支持句号、问号、感叹号、逗号、分号作为分句标记
    自动过滤标题和作者行
    """
    if not text or not text.strip():
        return []
    
    # 先按换行符分割（处理多行诗词）
    lines = text.split('\n')
    segments = []
    
    # 识别可能的标题和作者行（通常较短，且不包含标点或只有简单标点）
    title_pattern = re.compile(r'^[\u4e00-\u9fff]{1,10}$')  # 1-10个汉字，可能是标题
    author_pattern = re.compile(r'^[\u4e00-\u9fff]{1,4}[\s]*[\u4e00-\u9fff]{1,6}$')  # 可能是"朝代 作者"格式
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 跳过明显的标题行（只有1-10个汉字，没有标点）
        if title_pattern.match(line) and len(line) <= 10 and not re.search(r'[，。！？；：]', line):
            continue
        
        # 跳过明显的作者行（格式如"宋 陆游"或"陆游"）
        if author_pattern.match(line) and len(line) <= 15:
            # 进一步检查：如果包含朝代关键词，很可能是作者行
            dynasty_keywords = ['唐', '宋', '元', '明', '清', '汉', '魏', '晋', '南北朝', '隋', '五代', '金']
            if any(keyword in line for keyword in dynasty_keywords):
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
    
    # 如果没有任何分割结果，返回整个文本（去除标题和作者后）
    if not segments:
        # 尝试提取实际内容（去除可能的标题和作者）
        content_lines = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # 跳过明显的标题和作者行
            if title_pattern.match(line) and len(line) <= 10:
                continue
            if author_pattern.match(line) and len(line) <= 15:
                dynasty_keywords = ['唐', '宋', '元', '明', '清', '汉', '魏', '晋', '南北朝', '隋', '五代', '金']
                if any(keyword in line for keyword in dynasty_keywords):
                    continue
            content_lines.append(line)
        
        if content_lines:
            # 合并内容行，然后按标点分割
            content = ' '.join(content_lines)
            # 按句号、问号、感叹号、逗号、分号分割
            parts = re.split(r'[。！？，；]', content)
            for part in parts:
                part = part.strip()
                if part and len(part) >= 2:
                    segments.append(part)
        else:
            # 如果所有行都被过滤了，返回原始文本
            segments = [text.strip()] if text.strip() else []
    
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
    logger.info(f"开始深度分析诗词，模式: {display_mode}，文本长度: {len(text)}")
    
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
        
        # 过滤掉标题和作者行（这些不应该在 line_analysis 中）
        title_pattern = re.compile(r'^[\u4e00-\u9fff]{1,10}$')
        dynasty_keywords = ['唐', '宋', '元', '明', '清', '汉', '魏', '晋', '南北朝', '隋', '五代', '金']
        filtered_lines = []
        
        for line_text in lines:
            line_text = line_text.strip()
            if not line_text or len(line_text) < 2:
                continue
            
            # 跳过明显的标题行
            if title_pattern.match(line_text) and len(line_text) <= 10 and not re.search(r'[，。！？；：]', line_text):
                continue
            
            # 跳过明显的作者行
            if len(line_text) <= 15 and any(keyword in line_text for keyword in dynasty_keywords):
                if re.match(r'^[\u4e00-\u9fff]{1,4}[\s]*[\u4e00-\u9fff]{1,6}$', line_text):
                    continue
            
            filtered_lines.append(line_text)
        
        line_count = len(filtered_lines)
        
        # 构建消息，明确要求逐句分析
        user_content = f"""请分析以下古诗词/古文，并按照{mode_description}生成分镜：

{text}

**重要提示**：
1. **必须区分元信息和诗句内容**：
   - 标题（如"示儿"）、作者信息（如"宋 陆游"）**不是诗句**，不要放入 line_analysis
   - 只对实际的诗词内容进行逐句分析
   - poetry_info.full_text 只包含实际的诗词内容，不包括标题和作者行

2. **断句规则**：
   - 古诗词的句子可以按**句号、问号、感叹号、逗号、分号**分割
   - 例如："床前明月光，疑是地上霜。举头望明月，低头思故乡。"应该断句为4句

3. 原文共有 {line_count} 句实际诗句（已按句号、问号、感叹号、逗号、分号分割，已过滤标题和作者）
4. 你必须为每一句生成一个 line_analysis 条目，共 {line_count} 个（不包括标题和作者）
5. 你必须为每一句生成一个 content 类型的分镜，共 {line_count} 个（不包括封面）
6. 不能合并句子，不能跳过任何句子
7. 每一句的分析必须完整，包含 word_explanation、interpretation、imagery、emotion、rhetoric 等字段
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
    lines = basic_segmentation(original_text)
    
    # 过滤掉标题和作者行（这些不应该在 line_analysis 中）
    # 标题通常是1-10个汉字，作者行通常包含朝代关键词
    filtered_lines = []
    title_pattern = re.compile(r'^[\u4e00-\u9fff]{1,10}$')
    dynasty_keywords = ['唐', '宋', '元', '明', '清', '汉', '魏', '晋', '南北朝', '隋', '五代', '金']
    
    for line_text in lines:
        line_text = line_text.strip()
        if not line_text or len(line_text) < 2:
            continue
        
        # 跳过明显的标题行
        if title_pattern.match(line_text) and len(line_text) <= 10 and not re.search(r'[，。！？；：]', line_text):
            logger.debug(f"跳过标题行: {line_text}")
            continue
        
        # 跳过明显的作者行
        if len(line_text) <= 15 and any(keyword in line_text for keyword in dynasty_keywords):
            # 进一步检查：如果格式像"朝代 作者"，跳过
            if re.match(r'^[\u4e00-\u9fff]{1,4}[\s]*[\u4e00-\u9fff]{1,6}$', line_text):
                logger.debug(f"跳过作者行: {line_text}")
                continue
        
        filtered_lines.append(line_text)
    
    # 使用过滤后的行数作为期望值
    expected_line_count = len(filtered_lines)
    
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
    
    # 确保 line_analysis 存在并补全缺失的句子
    if "line_analysis" not in result:
        result["line_analysis"] = []
    
    # 补全 line_analysis 的新字段
    for line in result["line_analysis"]:
        line.setdefault("visual_scene", "")
    
    # 检查并补全缺失的逐句分析（使用过滤后的行）
    existing_lines = {line.get("line", "").strip() for line in result["line_analysis"]}
    for i, line_text in enumerate(filtered_lines):
        if line_text.strip() not in existing_lines:
            # 添加缺失的句子分析
            result["line_analysis"].append({
                "line_number": len(result["line_analysis"]) + 1,
                "line": line_text.strip(),
                "word_explanation": "待分析",
                "interpretation": "待分析",
                "imagery": [],
                "emotion": "待分析",
                "rhetoric": "待分析",
                "visual_scene": ""
            })
            logger.debug(f"补全缺失的逐句分析: {line_text[:20]}...")
    
    # 重新编号 line_analysis
    for i, line in enumerate(result["line_analysis"]):
        line["line_number"] = i + 1
    
    # 如果 line_analysis 数量不对，重新创建（使用过滤后的行）
    if len(result["line_analysis"]) != expected_line_count:
        logger.warning(f"逐句分析数量不匹配：期望 {expected_line_count} 句（已过滤标题和作者），实际 {len(result['line_analysis'])} 句，重新创建")
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
            for i, line_text in enumerate(filtered_lines)
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
        
        # 检查内容分镜数量：应该有 expected_line_count 个内容分镜（不包括封面）
        content_storyboards = [sb for sb in result["storyboards"] if sb.get("type") == "content"]
        if len(content_storyboards) != expected_line_count:
            logger.warning(f"内容分镜数量不匹配：期望 {expected_line_count} 个，实际 {len(content_storyboards)} 个，补全缺失的分镜")
            
            # 获取已有的内容分镜文本
            existing_texts = {sb.get("text", "").strip() for sb in content_storyboards}
            
            # 为缺失的句子创建分镜（使用过滤后的行）
            for i, line_text in enumerate(filtered_lines):
                if line_text.strip() not in existing_texts:
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
                    logger.info(f"补全缺失的分镜: {line_text[:20]}...")
            
            # 重新排序和编号所有分镜：封面在前，内容分镜按原文顺序排列
            cover_sb = [sb for sb in result["storyboards"] if sb.get("type") == "cover"]
            content_sbs = [sb for sb in result["storyboards"] if sb.get("type") == "content"]
            
            # 按原文顺序排序内容分镜（使用过滤后的行）
            def get_line_index(storyboard):
                text = storyboard.get("text", "").strip()
                try:
                    return filtered_lines.index(text)
                except ValueError:
                    # 如果找不到，尝试匹配部分文本
                    for idx, line in enumerate(filtered_lines):
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


# 视频分析专用提示词（完全独立于图像分析）
# 针对火山引擎 Seedance 1.5 Pro 文生视频（含音频）优化
VIDEO_ANALYSIS_PROMPT = """
你是古诗词视频创作专家，专门为火山引擎 Seedance 1.5 Pro 文生视频模型生成优化提示词。
请分析用户输入的古诗词文本，生成用于视频创作的完整分析数据和视频生成提示词。

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

## 核心任务

你的任务是：
1. **识别诗词信息**：从用户输入中识别标题、作者、朝代等元信息，以及完整的原文诗句
2. **生成优化视频prompt**：基于诗词内容，生成一个完整、详细、专业的视频生成提示词，符合 Seedance 1.5 Pro 的最佳实践

## Seedance 1.5 Pro Prompt 优化指南

根据火山引擎官方文档，生成视频 prompt 时需遵循以下原则：

### 1. 明确描述画面内容（最重要）
- **主体描述**：明确描述画面中的主体（人物、动物、物品等），使用具体名词
- **动作描述**：详细描述主体的动作、姿态、行为，使用具体动词
- **环境描述**：详细描述场景环境、背景、周围元素，使用具体形容词
- **示例**：不要写"美丽的风景"，要写"青山绿水，古树参天，溪流潺潺，鸟语花香"

### 2. 使用专业视频术语
- **镜头类型**：广角镜头、特写镜头、中景、远景、全景
- **镜头运动**：缓慢推进、缓慢拉远、横移、环绕、俯拍、仰拍、固定机位
- **画面效果**：慢动作、快动作、淡入淡出、渐隐渐显、光影变化
- **示例**："广角镜头缓慢推进，展现远山近水，镜头横移展现全景"

### 3. 强调风格和氛围（具体化）
- **艺术风格**：中国古典绘画风格、水墨画、工笔画、写意画、青绿山水、淡彩、重彩
- **视觉质感**：电影质感、超高清、4K画质、细腻、精致、古朴、典雅
- **色调氛围**：淡雅、浓郁、清冷、温暖、明亮、昏暗、古典、现代
- **示例**："中国古典水墨画风格，电影质感，超高清画质，淡雅色调，古典氛围"

### 4. 音频元素描述（Seedance 1.5 Pro 支持音频生成）
- **背景音乐**：明确描述音乐类型（古筝、古琴、笛子、二胡、琵琶、箫等）、节奏（缓慢、适中、明快）、情感（悲壮、宁静、激昂、婉约）
- **古诗朗诵**：**必须包含要朗诵的完整诗词原文内容**，同时描述朗诵风格（古典、现代、抑扬顿挫）、节奏（舒缓、适中、明快）、情感表达（深沉、激昂、婉约、豪放）、语音特色（男声、女声、童声、老年声）
- **环境音效**：描述环境声音（鸟鸣、流水、风声、雨声、钟声等）
- **示例**："背景音乐：古筝演奏，节奏缓慢，情感深沉，配合流水声和鸟鸣声。古诗朗诵：男声，古典风格，抑扬顿挫，节奏舒缓，情感深沉，朗诵内容为「床前明月光，疑是地上霜。举头望明月，低头思故乡。」"

### 5. 避免模糊描述
- ❌ 避免：好看、漂亮、优美、美丽、精彩
- ✅ 使用：具体描述，如"青山如黛，碧水如镜，古树苍劲，飞鸟翱翔"

### 6. 视频参数（在 prompt 中明确）
- 时长：根据诗词长度和内容复杂度，建议 15-60 秒
- 节奏：根据诗词韵律，描述视频节奏（缓慢、适中、明快）

## 重要说明

**用户输入可能包含**：
- 标题（如："示儿"）
- 作者信息（如："宋 陆游" 或 "陆游"）
- 完整的诗句内容

**你必须**：
1. 区分元信息（标题、作者、朝代）和诗句内容
2. 只对**诗句本身**进行分析，不要将标题、作者等当作诗句
3. 如果输入包含标题和作者，将它们提取到 poetry_info 中，不要放入诗句分析
4. 诗句是指实际的诗词内容，通常以句号、问号、感叹号结尾

## 输出格式

请严格按照以下JSON格式输出：

{
  "poetry_info": {
    "title": "诗词标题（从输入中识别，如果没有则为空字符串）",
    "author": "作者姓名（从输入中识别，如果没有则为空字符串）",
    "dynasty": "朝代（从输入中识别，如果没有则为空字符串）",
    "full_text": "完整的原文诗句（只包含诗句内容，不包括标题和作者，按原格式保留换行）",
    "creation_background": "创作背景（50-100字，如果无法确定则说明）",
    "era_background": "时代背景（50-100字，如果无法确定则说明）",
    "poet_mood": "作者心情/情感基调（如：思乡、悲壮、宁静、激昂、婉约等）"
  },
    "video_prompt_data": {
    "video_prompt": "完整的、详细的视频生成prompt，这是最终会传入 Seedance 1.5 Pro 模型的完整提示词。必须包含：\n1. 画面主体、动作、环境的详细具体描述（最重要）\n2. 视觉风格、色调、氛围的具体描述\n3. 镜头类型和镜头运动的具体描述（使用专业术语）\n4. 背景音乐的具体描述（乐器、节奏、情感）\n5. 古诗朗诵的具体描述（**必须包含要朗诵的完整诗词原文内容**，以及风格、节奏、情感、语音特色）\n6. 环境音效的具体描述\n7. 转场效果的具体描述\n要求：使用具体描述，避免模糊词汇，使用专业术语，长度建议300-600字",
    "scene_description": "主要场景的详细描述（连贯完整，使用具体描述，80-150字）",
    "visual_style": "视觉风格描述（详细，包括艺术风格、色调、氛围、质感等，50-80字）",
    "background_music": "背景音乐要求：乐器类型、风格、情感、节奏、具体效果等（详细，50-80字）",
    "narration_style": "古诗朗诵要求：**必须包含要朗诵的完整诗词原文内容**，以及风格、节奏、情感表达、语调、语音特色（男声/女声）、具体效果等（详细，80-120字）",
    "transitions": "转场效果描述（详细，使用专业术语，30-50字）",
    "camera_movement": "镜头运动描述（详细，使用专业术语如广角、特写、推进、拉远、横移、环绕等，50-80字）",
    "duration_suggestion": 15
  }
}

## 重要要求

1. **区分元信息和诗句**：标题、作者、朝代等信息不要当作诗句分析，只提取到 poetry_info 中
2. **full_text 只包含诗句**：poetry_info.full_text 字段只包含实际的诗词内容，不包括标题和作者行
3. **video_prompt 要详细专业**：这是最终传入 Seedance 1.5 Pro 模型的提示词，必须：
   - 使用具体描述，避免模糊词汇
   - 使用专业视频术语（镜头类型、镜头运动等）
   - 明确描述画面主体、动作、环境
   - 详细描述音频元素（背景音乐、朗诵、音效）
   - **古诗朗诵部分必须包含要朗诵的完整诗词原文内容**（这是关键，否则无法生成朗诵音频）
   - 强调风格和氛围，使用具体艺术风格词汇
   - 长度建议 300-600 字，确保完整详细
4. **忠实原文**：所有分析必须忠实于原诗词的意境和内容
5. **连贯性**：video_prompt 要体现场景之间的连贯性和整体性，形成一个完整的视频描述
6. **音频同步**：确保背景音乐、朗诵、音效与画面内容和情感基调相匹配
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
    logger.info(f"开始视频专用诗词分析，文本长度: {len(text)}")
    
    # 如果没有ark_client，返回基础结构
    if not ark_client:
        logger.warning("未提供Ark客户端，返回基础分析结果")
        return _create_basic_video_analysis(text)
    
    try:
        # 增强系统提示词（添加内容限制）
        enhanced_prompt = ContentValidator.enhance_system_prompt(VIDEO_ANALYSIS_PROMPT)
        
        # 构建消息
        user_content = f"""请分析以下古诗词文本，按照 Seedance 1.5 Pro 文生视频（含音频）的要求生成完整的视频生成提示词：

{text}

**重要提示**：
1. 请仔细区分标题、作者信息和诗句内容
2. 标题和作者信息只提取到 poetry_info 中，不要当作诗句
3. poetry_info.full_text 只包含实际的诗词内容，不包括标题和作者行
4. video_prompt_data.video_prompt 是最终会传入 Seedance 1.5 Pro 模型的完整提示词，必须：
   - 使用具体描述，避免模糊词汇（如"好看"、"漂亮"等）
   - 明确描述画面主体、动作、环境（使用具体名词、动词、形容词）
   - 使用专业视频术语（广角镜头、特写、推进、拉远、横移、环绕等）
   - 详细描述视觉风格、色调、氛围（使用具体艺术风格词汇）
   - 详细描述背景音乐（乐器类型、节奏、情感）
   - **详细描述古诗朗诵，必须包含要朗诵的完整诗词原文内容**（这是关键，否则无法生成朗诵音频），以及风格、节奏、情感、语音特色
   - 描述环境音效（鸟鸣、流水、风声等）
   - 长度建议 300-600 字，确保完整详细
5. 所有描述必须忠实于原诗词的意境和内容
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
        
        logger.info(f"视频分析完成，video_prompt长度: {len(analysis_result.get('video_prompt_data', {}).get('video_prompt', ''))}")
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
        
        video_prompt_data["video_prompt"] = f"""根据古诗词《{title}》（{dynasty}·{author}）创作视频。

画面内容：广角镜头展现古典诗词意境场景，画面主体包括{full_text[:30]}等元素，镜头缓慢推进，展现远山近水、古树苍劲、飞鸟翱翔等具体画面，中景展现人物或景物细节，特写镜头捕捉关键意象，画面构图精美，层次丰富。

视觉风格：中国古典水墨画风格，{dynasty}时代特色，电影质感，超高清画质，色调淡雅，氛围深远，画面细腻精致，体现古典文学的美感。

背景音乐：{music_desc}。

古诗朗诵：{narration_desc}。

镜头运动：广角镜头缓慢推进，展现全景，镜头横移展现不同场景，中景固定机位展现主体，特写镜头捕捉细节，镜头环绕展现整体氛围，俯拍和仰拍交替展现层次。

转场效果：淡入淡出，渐隐渐显，自然流畅，光影变化柔和。

环境音效：鸟鸣声、流水声、风声等自然音效，与画面内容同步。

整体要求：画面精美，音画同步，体现古典文学的美感，视频节奏与诗词韵律相匹配，情感表达{emotion}。"""
        logger.warning("video_prompt 为空或太短，已生成符合 Seedance 1.5 Pro 要求的基础版本")
    
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


