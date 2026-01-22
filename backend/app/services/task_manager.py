"""
后台任务管理器
支持图像生成任务在后台运行，即使前端断开连接也不会停止
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum
import threading

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"      # 等待执行
    RUNNING = "running"      # 执行中
    COMPLETED = "completed"  # 完成
    FAILED = "failed"        # 失败


class Task:
    """任务对象"""
    def __init__(self, task_id: str, task_type: str, params: Dict[str, Any], history_id: str = "", message_id: str = ""):
        self.task_id = task_id
        self.task_type = task_type
        self.params = params
        self.history_id = history_id  # 前端历史记录 ID
        self.message_id = message_id  # 前端消息 ID
        self.status = TaskStatus.PENDING
        self.progress = 0  # 0-100
        self.total_steps = 0
        self.current_step = 0
        self.result: Optional[Dict[str, Any]] = None
        self.error: Optional[str] = None
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.completed_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "task_id": self.task_id,
            "task_type": self.task_type,
            "history_id": self.history_id,
            "message_id": self.message_id,
            "status": self.status.value,
            "progress": self.progress,
            "total_steps": self.total_steps,
            "current_step": self.current_step,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }


class TaskManager:
    """任务管理器（单例）"""
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.tasks: Dict[str, Task] = {}
        self.running_tasks: Dict[str, asyncio.Task] = {}
        self._cleanup_interval = 3600  # 1小时清理一次过期任务
        self._task_ttl = 86400  # 任务保留24小时
        self._cleanup_timer: Optional[threading.Timer] = None
        self._max_concurrent_tasks = 5  # 最大并发任务数
        # 启动后台清理任务
        self._start_cleanup_timer()
    
    def create_task(self, task_type: str, params: Dict[str, Any], history_id: str = "", message_id: str = "") -> str:
        """创建新任务"""
        task_id = str(uuid.uuid4())
        task = Task(task_id, task_type, params, history_id, message_id)
        self.tasks[task_id] = task
        logger.info(f"创建任务: {task_id}, 类型: {task_type}, 历史记录: {history_id}")
        return task_id
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """获取任务"""
        return self.tasks.get(task_id)
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态"""
        task = self.tasks.get(task_id)
        if task:
            return task.to_dict()
        return None
    
    def update_task_progress(self, task_id: str, current_step: int, total_steps: int, partial_result: Any = None):
        """更新任务进度"""
        task = self.tasks.get(task_id)
        if task:
            task.current_step = current_step
            task.total_steps = total_steps
            task.progress = int((current_step / total_steps) * 100) if total_steps > 0 else 0
            task.updated_at = datetime.now()
            if partial_result:
                if task.result is None:
                    task.result = {"data": []}
                if isinstance(partial_result, dict):
                    task.result["data"].append(partial_result)
    
    def complete_task(self, task_id: str, result: Dict[str, Any]):
        """完成任务"""
        task = self.tasks.get(task_id)
        if task:
            task.status = TaskStatus.COMPLETED
            task.progress = 100
            task.result = result
            task.completed_at = datetime.now()
            task.updated_at = datetime.now()
            logger.info(f"任务完成: {task_id}")
            # 清理运行中的任务引用
            if task_id in self.running_tasks:
                del self.running_tasks[task_id]
    
    def fail_task(self, task_id: str, error: str):
        """标记任务失败"""
        task = self.tasks.get(task_id)
        if task:
            task.status = TaskStatus.FAILED
            task.error = error
            task.completed_at = datetime.now()
            task.updated_at = datetime.now()
            logger.error(f"任务失败: {task_id}, 错误: {error}")
            # 清理运行中的任务引用
            if task_id in self.running_tasks:
                del self.running_tasks[task_id]
    
    def start_task(self, task_id: str):
        """标记任务开始运行"""
        task = self.tasks.get(task_id)
        if task:
            task.status = TaskStatus.RUNNING
            task.updated_at = datetime.now()
    
    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = self.tasks.get(task_id)
        if task and task.status == TaskStatus.RUNNING:
            if task_id in self.running_tasks:
                self.running_tasks[task_id].cancel()
                del self.running_tasks[task_id]
            task.status = TaskStatus.FAILED
            task.error = "任务已取消"
            task.updated_at = datetime.now()
            logger.info(f"任务已取消: {task_id}")
            return True
        return False
    
    def cleanup_old_tasks(self):
        """清理过期任务"""
        now = datetime.now()
        expired_tasks = []
        for task_id, task in self.tasks.items():
            # 只清理已完成或失败的任务，运行中的任务不清理
            if task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                if task.completed_at and (now - task.completed_at).total_seconds() > self._task_ttl:
                    expired_tasks.append(task_id)
            # 对于运行中的任务，如果超过24小时未更新，也清理（可能是异常情况）
            elif task.status == TaskStatus.RUNNING:
                if task.updated_at and (now - task.updated_at).total_seconds() > self._task_ttl:
                    logger.warning(f"清理长时间未更新的运行中任务: {task_id}, 最后更新: {task.updated_at}")
                    expired_tasks.append(task_id)
        
        if expired_tasks:
            for task_id in expired_tasks:
                del self.tasks[task_id]
            logger.info(f"清理了 {len(expired_tasks)} 个过期任务")
        
        # 重新启动清理定时器
        self._start_cleanup_timer()
    
    def _start_cleanup_timer(self):
        """启动后台清理定时器"""
        if self._cleanup_timer:
            self._cleanup_timer.cancel()
        
        def cleanup():
            self.cleanup_old_tasks()
        
        self._cleanup_timer = threading.Timer(self._cleanup_interval, cleanup)
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()
    
    def get_active_tasks(self) -> List[Dict[str, Any]]:
        """获取所有活跃任务"""
        return [
            task.to_dict() 
            for task in self.tasks.values() 
            if task.status in [TaskStatus.PENDING, TaskStatus.RUNNING]
        ]
    
    def can_start_new_task(self) -> bool:
        """检查是否可以启动新任务（基于并发限制）"""
        running_count = sum(1 for task in self.tasks.values() if task.status == TaskStatus.RUNNING)
        return running_count < self._max_concurrent_tasks


# 全局任务管理器实例
task_manager = TaskManager()

