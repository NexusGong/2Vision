"""
项目模型
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Project(Base):
    """项目模型"""
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    original_text = Column(Text, nullable=False)  # 原始文本
    structured_content = Column(JSON)  # 结构化内容（断句、语义分层等）
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 可为空，非登录用户
    session_id = Column(String(100), nullable=True, index=True)  # 非登录用户的会话ID
    is_anonymous = Column(Boolean, default=False)  # 是否为匿名项目
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    owner = relationship("User", back_populates="projects")
    image_items = relationship("ImageItem", back_populates="project", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="project", cascade="all, delete-orphan")

class ImageItem(Base):
    """图像项模型"""
    __tablename__ = "image_items"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    text_segment = Column(Text)  # 对应的文本片段
    segment_index = Column(Integer)  # 句段索引
    image_style = Column(String(100))  # 图像风格
    is_cover = Column(Integer, default=0)  # 是否为封面
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # 关联关系
    project = relationship("Project", back_populates="image_items")

class Annotation(Base):
    """标注模型"""
    __tablename__ = "annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    image_item_id = Column(Integer, ForeignKey("image_items.id"), nullable=True)
    annotation_type = Column(String(50))  # 标注类型：核心意象、情节关系、理解提示等
    content = Column(Text)  # 标注内容
    position = Column(JSON)  # 位置信息（用于前端显示）
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关联关系
    project = relationship("Project", back_populates="annotations")

