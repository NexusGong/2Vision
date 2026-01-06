"""
项目管理API路由
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from app.database import get_db
from app.services.auth import get_current_user
from app.models.user import User
from app.models.project import Project, ImageItem, Annotation
from app.services.editor import (
    update_image_item,
    update_segment_mapping,
    create_annotation,
    update_annotation,
    delete_annotation
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/project", tags=["项目管理"])

class ProjectCreate(BaseModel):
    """项目创建模型"""
    title: str
    original_text: str
    structured_content: Optional[Dict[str, Any]] = None

class ProjectUpdate(BaseModel):
    """项目更新模型"""
    title: Optional[str] = None
    structured_content: Optional[Dict[str, Any]] = None

class ImageItemCreate(BaseModel):
    """图像项创建模型"""
    image_url: str
    text_segment: Optional[str] = None
    segment_index: Optional[int] = None
    image_style: Optional[str] = None
    is_cover: int = 0

class AnnotationCreate(BaseModel):
    """标注创建模型"""
    image_item_id: Optional[int] = None
    annotation_type: str
    content: str
    position: Optional[Dict[str, Any]] = None

class AnnotationUpdate(BaseModel):
    """标注更新模型"""
    content: Optional[str] = None
    position: Optional[Dict[str, Any]] = None

@router.post("/create")
async def create_project(
    project_data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """创建项目"""
    try:
        # 输入验证
        if not project_data.title or not project_data.title.strip():
            raise HTTPException(status_code=400, detail="项目标题不能为空")
        
        if not project_data.original_text or not project_data.original_text.strip():
            raise HTTPException(status_code=400, detail="文本内容不能为空")
        
        # 限制标题长度
        MAX_TITLE_LENGTH = 200
        if len(project_data.title) > MAX_TITLE_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"标题长度不能超过 {MAX_TITLE_LENGTH} 个字符"
            )
        
        # 限制文本长度
        MAX_TEXT_LENGTH = 50000
        if len(project_data.original_text) > MAX_TEXT_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"文本长度不能超过 {MAX_TEXT_LENGTH} 个字符"
            )
        
        # 清理输入
        import re
        cleaned_title = re.sub(r'[^\u4e00-\u9fff\w\s\.,;:!?。，、；：！？]', '', project_data.title)[:MAX_TITLE_LENGTH]
        
        project = Project(
            title=cleaned_title,
            original_text=project_data.original_text,
            structured_content=project_data.structured_content,
            user_id=current_user.id
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        
        return {
            "status": "success",
            "data": {
                "id": project.id,
                "title": project.title,
                "created_at": project.created_at.isoformat()
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"创建项目失败: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"创建项目失败: {str(e)}")

@router.get("/list")
async def list_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取用户的项目列表"""
    projects = db.query(Project).filter(Project.user_id == current_user.id).all()
    return {
        "status": "success",
        "data": [
            {
                "id": p.id,
                "title": p.title,
                "original_text": p.original_text,
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat()
            }
            for p in projects
        ]
    }

@router.get("/{project_id}")
async def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取项目详情"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 获取图像项
    image_items = db.query(ImageItem).filter(ImageItem.project_id == project_id).all()
    # 获取标注
    annotations = db.query(Annotation).filter(Annotation.project_id == project_id).all()
    
    return {
        "status": "success",
        "data": {
            "id": project.id,
            "title": project.title,
            "original_text": project.original_text,
            "structured_content": project.structured_content,
            "image_items": [
                {
                    "id": item.id,
                    "image_url": item.image_url,
                    "text_segment": item.text_segment,
                    "segment_index": item.segment_index,
                    "image_style": item.image_style,
                    "is_cover": item.is_cover
                }
                for item in image_items
            ],
            "annotations": [
                {
                    "id": ann.id,
                    "image_item_id": ann.image_item_id,
                    "annotation_type": ann.annotation_type,
                    "content": ann.content,
                    "position": ann.position
                }
                for ann in annotations
            ],
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat()
        }
    }

@router.put("/{project_id}")
async def update_project(
    project_id: int,
    project_data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新项目"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if project_data.title is not None:
        project.title = project_data.title
    if project_data.structured_content is not None:
        project.structured_content = project_data.structured_content
    
    db.commit()
    db.refresh(project)
    
    return {"status": "success", "message": "项目更新成功"}

@router.post("/{project_id}/image")
async def add_image_item(
    project_id: int,
    image_data: ImageItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """添加图像项"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    image_item = ImageItem(
        project_id=project_id,
        image_url=image_data.image_url,
        text_segment=image_data.text_segment,
        segment_index=image_data.segment_index,
        image_style=image_data.image_style,
        is_cover=image_data.is_cover
    )
    db.add(image_item)
    db.commit()
    db.refresh(image_item)
    
    return {"status": "success", "data": {"id": image_item.id}}

@router.put("/image/{image_item_id}")
async def update_image(
    image_item_id: int,
    image_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新图像项"""
    image_item = db.query(ImageItem).filter(ImageItem.id == image_item_id).first()
    if not image_item:
        raise HTTPException(status_code=404, detail="图像项不存在")
    
    # 检查权限
    project = db.query(Project).filter(Project.id == image_item.project_id).first()
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问")
    
    updated_item = update_image_item(
        db,
        image_item_id,
        image_url=image_data.get("image_url"),
        text_segment=image_data.get("text_segment"),
        image_style=image_data.get("image_style")
    )
    
    return {"status": "success", "data": {"id": updated_item.id}}

@router.post("/{project_id}/annotation")
async def add_annotation(
    project_id: int,
    annotation_data: AnnotationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """添加标注"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    annotation = create_annotation(
        db,
        project_id,
        annotation_data.image_item_id,
        annotation_data.annotation_type,
        annotation_data.content,
        annotation_data.position
    )
    
    return {"status": "success", "data": {"id": annotation.id}}

@router.put("/annotation/{annotation_id}")
async def update_annotation_endpoint(
    annotation_id: int,
    annotation_data: AnnotationUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新标注"""
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")
    
    # 检查权限
    project = db.query(Project).filter(Project.id == annotation.project_id).first()
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问")
    
    updated_annotation = update_annotation(
        db,
        annotation_id,
        content=annotation_data.content,
        position=annotation_data.position
    )
    
    return {"status": "success", "data": {"id": updated_annotation.id}}

@router.delete("/annotation/{annotation_id}")
async def delete_annotation_endpoint(
    annotation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除标注"""
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")
    
    # 检查权限
    project = db.query(Project).filter(Project.id == annotation.project_id).first()
    if project.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问")
    
    delete_annotation(db, annotation_id)
    
    return {"status": "success", "message": "标注删除成功"}

@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除项目"""
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    db.delete(project)
    db.commit()
    
    return {"status": "success", "message": "项目删除成功"}

