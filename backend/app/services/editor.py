"""
编辑服务
"""
import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.project import Project, ImageItem, Annotation

logger = logging.getLogger(__name__)

def update_image_item(
    db: Session,
    image_item_id: int,
    image_url: Optional[str] = None,
    text_segment: Optional[str] = None,
    image_style: Optional[str] = None
) -> ImageItem:
    """
    更新图像项
    
    Args:
        db: 数据库会话
        image_item_id: 图像项ID
        image_url: 新的图像URL
        text_segment: 新的文本片段
        image_style: 新的图像风格
        
    Returns:
        更新后的图像项
    """
    image_item = db.query(ImageItem).filter(ImageItem.id == image_item_id).first()
    if not image_item:
        raise ValueError(f"图像项 {image_item_id} 不存在")
    
    if image_url is not None:
        image_item.image_url = image_url
    if text_segment is not None:
        image_item.text_segment = text_segment
    if image_style is not None:
        image_item.image_style = image_style
    
    db.commit()
    db.refresh(image_item)
    
    logger.info(f"图像项 {image_item_id} 更新成功")
    return image_item

def update_segment_mapping(
    db: Session,
    project_id: int,
    mappings: Dict[int, int]
) -> Project:
    """
    更新句段对应关系
    
    Args:
        db: 数据库会话
        project_id: 项目ID
        mappings: 映射关系 {segment_index: image_item_id}
        
    Returns:
        更新后的项目
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise ValueError(f"项目 {project_id} 不存在")
    
    # 更新图像项的segment_index
    for segment_index, image_item_id in mappings.items():
        image_item = db.query(ImageItem).filter(
            ImageItem.id == image_item_id,
            ImageItem.project_id == project_id
        ).first()
        if image_item:
            image_item.segment_index = segment_index
            # 更新对应的文本片段
            structured_content = project.structured_content or {}
            segments = structured_content.get("segments", [])
            if segment_index <= len(segments):
                image_item.text_segment = segments[segment_index - 1].get("text", "")
    
    db.commit()
    db.refresh(project)
    
    logger.info(f"项目 {project_id} 的句段对应关系更新成功")
    return project

def create_annotation(
    db: Session,
    project_id: int,
    image_item_id: Optional[int],
    annotation_type: str,
    content: str,
    position: Optional[Dict[str, Any]] = None
) -> Annotation:
    """
    创建标注
    
    Args:
        db: 数据库会话
        project_id: 项目ID
        image_item_id: 图像项ID（可选）
        annotation_type: 标注类型
        content: 标注内容
        position: 位置信息
        
    Returns:
        创建的标注
    """
    annotation = Annotation(
        project_id=project_id,
        image_item_id=image_item_id,
        annotation_type=annotation_type,
        content=content,
        position=position or {}
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    
    logger.info(f"标注创建成功: {annotation.id}")
    return annotation

def update_annotation(
    db: Session,
    annotation_id: int,
    content: Optional[str] = None,
    position: Optional[Dict[str, Any]] = None
) -> Annotation:
    """
    更新标注
    
    Args:
        db: 数据库会话
        annotation_id: 标注ID
        content: 新的标注内容
        position: 新的位置信息
        
    Returns:
        更新后的标注
    """
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise ValueError(f"标注 {annotation_id} 不存在")
    
    if content is not None:
        annotation.content = content
    if position is not None:
        annotation.position = position
    
    db.commit()
    db.refresh(annotation)
    
    logger.info(f"标注 {annotation_id} 更新成功")
    return annotation

def delete_annotation(db: Session, annotation_id: int) -> bool:
    """
    删除标注
    
    Args:
        db: 数据库会话
        annotation_id: 标注ID
        
    Returns:
        是否删除成功
    """
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        return False
    
    db.delete(annotation)
    db.commit()
    
    logger.info(f"标注 {annotation_id} 删除成功")
    return True

