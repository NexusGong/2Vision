"""
内容验证服务 - 确保只处理古诗古文相关内容
"""
import re
import logging
import sys
import os
from typing import Dict, Any, Optional, Tuple
from enum import Enum

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

logger = logging.getLogger(__name__)


class ContentType(Enum):
    """内容类型"""
    ANCIENT_POETRY = "ancient_poetry"  # 古诗词
    ANCIENT_PROSE = "ancient_prose"  # 古文
    MODERN_TEXT = "modern_text"  # 现代文本
    INVALID = "invalid"  # 无效内容


class ContentValidator:
    """内容验证器"""
    
    # 古诗古文相关关键词
    ANCIENT_KEYWORDS = [
        # 朝代
        "唐", "宋", "元", "明", "清", "汉", "魏", "晋", "南北朝", "隋", "五代", "金",
        # 诗词体裁
        "诗", "词", "赋", "曲", "歌", "行", "引", "吟", "咏", "颂", "赞",
        # 古文体裁
        "论", "说", "记", "传", "序", "跋", "书", "表", "奏", "疏", "策", "议",
        # 古典文学特征词
        "之", "乎", "者", "也", "矣", "哉", "焉", "耳", "欤", "耶",
        # 古典意象
        "月", "风", "花", "雪", "山", "水", "云", "雨", "江", "河", "湖", "海",
        "春", "夏", "秋", "冬", "梅", "兰", "竹", "菊", "松", "柏", "柳", "桃",
        # 古典人物/场景
        "君", "臣", "民", "士", "子", "女", "客", "友", "师", "徒",
        "宫", "殿", "楼", "阁", "亭", "台", "轩", "榭", "寺", "庙", "观", "庵",
    ]
    
    # 现代文本特征词（如果大量出现，可能是现代文本）
    MODERN_KEYWORDS = [
        "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一",
        "一个", "这个", "那个", "什么", "怎么", "为什么", "因为", "所以",
        "但是", "如果", "虽然", "然后", "现在", "今天", "明天", "昨天",
        "电脑", "手机", "网络", "互联网", "软件", "程序", "代码", "数据",
        "公司", "企业", "市场", "经济", "社会", "政治", "科技", "科学",
    ]
    
    # 常见古诗古文作者（部分）
    ANCIENT_AUTHORS = [
        "李白", "杜甫", "白居易", "苏轼", "辛弃疾", "李清照", "陆游", "王维",
        "孟浩然", "王昌龄", "杜牧", "李商隐", "柳永", "欧阳修", "王安石",
        "范仲淹", "文天祥", "陶渊明", "屈原", "曹操", "曹植", "王羲之",
    ]
    
    # 常见古诗古文标题模式
    TITLE_PATTERNS = [
        r"^[\u4e00-\u9fff]{1,10}$",  # 1-10个汉字，可能是标题
        r"^[\u4e00-\u9fff]{1,4}[\s]*[\u4e00-\u9fff]{1,6}$",  # 朝代+作者格式
    ]
    
    @classmethod
    def validate_content(cls, text: str) -> Tuple[bool, str, ContentType]:
        """
        验证内容是否为古诗古文
        
        Args:
            text: 待验证的文本
            
        Returns:
            (is_valid, reason, content_type): 
            - is_valid: 是否为有效的古诗古文内容
            - reason: 验证结果说明
            - content_type: 内容类型
        """
        if not text or not text.strip():
            return False, "文本不能为空", ContentType.INVALID
        
        text = text.strip()
        
        # 1. 长度检查
        if len(text) < 2:
            return False, "文本过短，不符合古诗古文特征", ContentType.INVALID
        
        if len(text) > 10000:
            return False, "文本过长，可能不是古诗古文", ContentType.INVALID
        
        # 2. 字符类型检查（主要应为中文）
        chinese_char_count = len(re.findall(r'[\u4e00-\u9fff]', text))
        total_char_count = len(re.sub(r'\s', '', text))
        
        if total_char_count == 0:
            return False, "文本不包含有效字符", ContentType.INVALID
        
        chinese_ratio = chinese_char_count / total_char_count if total_char_count > 0 else 0
        
        # 古诗古文应该主要是中文，至少配置的最小比例以上
        min_ratio = config.MIN_CHINESE_RATIO if hasattr(config, 'MIN_CHINESE_RATIO') else 0.6
        if chinese_ratio < min_ratio:
            return False, f"中文比例过低（{chinese_ratio:.1%}），不符合古诗古文特征", ContentType.INVALID
        
        # 3. 关键词检测
        ancient_score = cls._calculate_ancient_score(text)
        modern_score = cls._calculate_modern_score(text)
        
        # 4. 格式特征检测
        has_ancient_format = cls._has_ancient_format(text)
        
        # 5. 综合判断
        if has_ancient_format and ancient_score >= 2:
            return True, "检测到古诗古文格式和特征", ContentType.ANCIENT_POETRY
        
        if ancient_score >= 3:
            return True, "检测到大量古诗古文特征词", ContentType.ANCIENT_POETRY
        
        if ancient_score >= 2 and modern_score < 2:
            return True, "检测到古诗古文特征，且现代文本特征较少", ContentType.ANCIENT_POETRY
        
        if modern_score >= 5 and ancient_score < 2:
            return False, "检测到大量现代文本特征，不符合古诗古文要求", ContentType.MODERN_TEXT
        
        if ancient_score >= 1:
            # 可能是古文（散文），特征词较少但格式符合
            return True, "可能是古文内容", ContentType.ANCIENT_PROSE
        
        return False, "未检测到明显的古诗古文特征，请确保输入的是古诗词或古文", ContentType.INVALID
    
    @classmethod
    def _calculate_ancient_score(cls, text: str) -> int:
        """计算古诗古文特征分数"""
        score = 0
        
        # 检查关键词
        text_lower = text.lower()
        for keyword in cls.ANCIENT_KEYWORDS:
            if keyword in text:
                score += 1
        
        # 检查作者名
        for author in cls.ANCIENT_AUTHORS:
            if author in text:
                score += 2
                break
        
        # 检查古典句式（包含"之乎者也"等）
        classical_patterns = [
            r'[\u4e00-\u9fff]+之[\u4e00-\u9fff]+',
            r'[\u4e00-\u9fff]+乎[\u4e00-\u9fff]+',
            r'[\u4e00-\u9fff]+者[\u4e00-\u9fff]+',
            r'[\u4e00-\u9fff]+也[。，]',
            r'[\u4e00-\u9fff]+矣[。，]',
        ]
        for pattern in classical_patterns:
            if re.search(pattern, text):
                score += 1
                break
        
        # 检查诗词格式（对仗、押韵等）
        if cls._has_poetry_format(text):
            score += 2
        
        return score
    
    @classmethod
    def _calculate_modern_score(cls, text: str) -> int:
        """计算现代文本特征分数"""
        score = 0
        
        for keyword in cls.MODERN_KEYWORDS:
            if keyword in text:
                score += 1
        
        # 检查现代标点符号使用
        modern_punctuation = ['.', '!', '?', ',', ';', ':']
        modern_punct_count = sum(1 for char in text if char in modern_punctuation)
        if modern_punct_count > len(text) * 0.1:  # 现代标点超过10%
            score += 2
        
        return score
    
    @classmethod
    def _has_ancient_format(cls, text: str) -> bool:
        """检查是否具有古诗古文格式特征"""
        # 检查是否包含标题+作者+内容的格式
        lines = text.split('\n')
        if len(lines) >= 2:
            # 第一行可能是标题（1-10个汉字）
            first_line = lines[0].strip()
            if re.match(r'^[\u4e00-\u9fff]{1,10}$', first_line):
                # 第二行可能是作者（包含朝代关键词）
                if len(lines) > 1:
                    second_line = lines[1].strip()
                    dynasty_keywords = ['唐', '宋', '元', '明', '清', '汉', '魏', '晋']
                    if any(keyword in second_line for keyword in dynasty_keywords):
                        return True
        
        # 检查是否包含古典标点符号
        ancient_punctuation = ['。', '，', '！', '？', '；', '：', '、']
        ancient_punct_count = sum(1 for char in text if char in ancient_punctuation)
        if ancient_punct_count > 0:
            return True
        
        # 检查是否包含诗词常见的对仗结构
        if cls._has_poetry_format(text):
            return True
        
        return False
    
    @classmethod
    def _has_poetry_format(cls, text: str) -> bool:
        """检查是否具有诗词格式（对仗、押韵等）"""
        # 检查是否有规律的字数（如五言、七言）
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        if len(lines) < 2:
            return False
        
        # 检查是否有相同的字数（排除标题和作者行）
        char_counts = []
        for line in lines:
            # 跳过明显的标题和作者行
            if len(line) <= 15 and (len(line) <= 10 or any(kw in line for kw in ['唐', '宋', '元', '明', '清'])):
                continue
            # 去除标点后计算字数
            clean_line = re.sub(r'[，。！？；：、\s]', '', line)
            if clean_line:
                char_counts.append(len(clean_line))
        
        if len(char_counts) < 2:
            return False
        
        # 检查是否有规律的字数（如都是5字或7字）
        if len(set(char_counts)) <= 2:  # 最多两种字数
            # 检查是否主要是5字或7字（古诗常见）
            common_lengths = [5, 7]
            if any(char_counts.count(length) >= len(char_counts) * 0.6 for length in common_lengths):
                return True
        
        return False
    
    @classmethod
    def enhance_system_prompt(cls, original_prompt: str) -> str:
        """
        增强系统提示词，明确限制只能处理古诗古文
        
        Args:
            original_prompt: 原始系统提示词
            
        Returns:
            增强后的系统提示词
        """
        restriction = """
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
"""
        
        return original_prompt + "\n\n" + restriction


def validate_text_input(text: str) -> Tuple[bool, str]:
    """
    验证文本输入的便捷函数
    
    Args:
        text: 待验证的文本
        
    Returns:
        (is_valid, error_message): 
        - is_valid: 是否有效
        - error_message: 错误信息（如果无效）
    """
    is_valid, reason, content_type = ContentValidator.validate_content(text)
    
    if not is_valid:
        error_message = f"内容验证失败：{reason}"
        if content_type == ContentType.MODERN_TEXT:
            error_message += "。本系统仅支持古诗词和古文，不支持现代文本。"
        elif content_type == ContentType.INVALID:
            error_message += "。请确保输入的是古诗词或古文内容。"
        return False, error_message
    
    return True, ""
