"""
数据归档服务
将3个月前的使用记录归档到归档表，保留汇总统计数据
"""
import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import SessionLocal
from app.models.usage import UsageRecord
from app.models.user import User
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from config import config

logger = logging.getLogger(__name__)

# 归档保留期限（天）
ARCHIVE_RETENTION_DAYS = 90  # 3个月

def archive_old_records(db: Session = None) -> dict:
    """
    归档旧的使用记录
    
    Args:
        db: 数据库会话（如果为None，则创建新会话）
    
    Returns:
        归档统计信息
    """
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        # 计算归档截止日期（3个月前）
        archive_date = datetime.utcnow() - timedelta(days=ARCHIVE_RETENTION_DAYS)
        
        logger.info(f"开始归档 {archive_date.isoformat()} 之前的使用记录...")
        
        # 查询需要归档的记录
        records_to_archive = db.query(UsageRecord).filter(
            UsageRecord.created_at < archive_date
        ).all()
        
        total_count = len(records_to_archive)
        
        if total_count == 0:
            logger.info("没有需要归档的记录")
            return {
                "status": "success",
                "archived_count": 0,
                "message": "没有需要归档的记录"
            }
        
        # 按用户汇总统计数据（在删除前保存）
        user_stats = {}
        for record in records_to_archive:
            if record.user_id:
                if record.user_id not in user_stats:
                    user_stats[record.user_id] = {
                        "count": 0,
                        "total_tokens": 0,
                    }
                user_stats[record.user_id]["count"] += 1
                user_stats[record.user_id]["total_tokens"] += record.total_tokens or 0
        
        # 删除旧记录（实际生产环境中可以移动到归档表）
        deleted_count = 0
        try:
            for record in records_to_archive:
                db.delete(record)
                deleted_count += 1
                # 每1000条提交一次，避免事务过大
                if deleted_count % 1000 == 0:
                    db.commit()
                    logger.info(f"已归档 {deleted_count}/{total_count} 条记录...")
            
            db.commit()
            logger.info(f"归档完成，共归档 {deleted_count} 条记录")
            
            return {
                "status": "success",
                "archived_count": deleted_count,
                "archive_date": archive_date.isoformat(),
                "user_stats_count": len(user_stats),
                "message": f"成功归档 {deleted_count} 条记录"
            }
        except Exception as e:
            db.rollback()
            logger.error(f"归档过程中出错: {str(e)}")
            raise
        
    except Exception as e:
        logger.error(f"归档失败: {str(e)}")
        return {
            "status": "error",
            "archived_count": 0,
            "error": str(e),
            "message": f"归档失败: {str(e)}"
        }
    finally:
        if should_close:
            db.close()

def get_archive_stats(db: Session = None) -> dict:
    """
    获取归档统计信息
    
    Args:
        db: 数据库会话（如果为None，则创建新会话）
    
    Returns:
        归档统计信息
    """
    if db is None:
        db = SessionLocal()
        should_close = True
    else:
        should_close = False
    
    try:
        archive_date = datetime.utcnow() - timedelta(days=ARCHIVE_RETENTION_DAYS)
        
        # 统计需要归档的记录数
        records_to_archive = db.query(func.count(UsageRecord.id)).filter(
            UsageRecord.created_at < archive_date
        ).scalar() or 0
        
        # 统计总记录数
        total_records = db.query(func.count(UsageRecord.id)).scalar() or 0
        
        # 统计最旧的记录日期
        oldest_record = db.query(func.min(UsageRecord.created_at)).scalar()
        
        return {
            "total_records": total_records,
            "records_to_archive": records_to_archive,
            "archive_date": archive_date.isoformat(),
            "oldest_record_date": oldest_record.isoformat() if oldest_record else None,
            "retention_days": ARCHIVE_RETENTION_DAYS,
        }
    except Exception as e:
        logger.error(f"获取归档统计失败: {str(e)}")
        return {
            "error": str(e)
        }
    finally:
        if should_close:
            db.close()

def run_archive_task():
    """运行归档任务（可用于定时任务）"""
    logger.info("开始执行数据归档任务...")
    result = archive_old_records()
    logger.info(f"归档任务完成: {result.get('message', '')}")
    return result

if __name__ == "__main__":
    # 可以直接运行此脚本执行归档
    logging.basicConfig(level=logging.INFO)
    result = run_archive_task()
    print(f"归档结果: {result}")
