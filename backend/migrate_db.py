"""
数据库迁移脚本：添加缺失的字段
"""
import sqlite3
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import config

def migrate_database():
    """迁移数据库，添加新字段"""
    db_path = config.DATABASE_URL.replace("sqlite:///", "")
    
    if not os.path.exists(db_path):
        print(f"数据库文件不存在: {db_path}")
        return
    
    print(f"开始迁移数据库: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 检查并添加缺失的字段
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]
        
        fields_to_add = {
            "nickname": "ALTER TABLE users ADD COLUMN nickname VARCHAR(50)",
            "avatar": "ALTER TABLE users ADD COLUMN avatar TEXT",
            "is_admin": "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0",
            "is_vip": "ALTER TABLE users ADD COLUMN is_vip BOOLEAN DEFAULT 0",
            "vip_expires_at": "ALTER TABLE users ADD COLUMN vip_expires_at DATETIME",
            "free_usage_count": "ALTER TABLE users ADD COLUMN free_usage_count INTEGER DEFAULT 20",
            "total_usage_count": "ALTER TABLE users ADD COLUMN total_usage_count INTEGER DEFAULT 0",
            "total_token_used": "ALTER TABLE users ADD COLUMN total_token_used INTEGER DEFAULT 0",
            "oauth_provider": "ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(20)",
            "oauth_id": "ALTER TABLE users ADD COLUMN oauth_id VARCHAR(100)",
            "updated_at": "ALTER TABLE users ADD COLUMN updated_at DATETIME",
            "phone": "ALTER TABLE users ADD COLUMN phone VARCHAR(20)",  # 手机号字段
            "password_set": "ALTER TABLE users ADD COLUMN password_set BOOLEAN DEFAULT 0",  # 是否设置密码
        }
        
        added_count = 0
        for field_name, sql in fields_to_add.items():
            if field_name not in columns:
                try:
                    cursor.execute(sql)
                    print(f"  ✓ 添加字段: {field_name}")
                    added_count += 1
                except sqlite3.OperationalError as e:
                    print(f"  ✗ 添加字段 {field_name} 失败: {e}")
            else:
                print(f"  - 字段已存在: {field_name}")
        
        # 检查 usage_records 表
        try:
            cursor.execute("PRAGMA table_info(usage_records)")
            usage_columns = [col[1] for col in cursor.fetchall()]
            
            usage_fields_to_add = {
                "user_id": "ALTER TABLE usage_records ADD COLUMN user_id INTEGER",
                "session_id": "ALTER TABLE usage_records ADD COLUMN session_id VARCHAR(100)",
                "usage_type": "ALTER TABLE usage_records ADD COLUMN usage_type VARCHAR(20)",
                "token_used": "ALTER TABLE usage_records ADD COLUMN token_used INTEGER DEFAULT 0",
                "created_at": "ALTER TABLE usage_records ADD COLUMN created_at DATETIME",
                # 新增的详细字段
                "api_endpoint": "ALTER TABLE usage_records ADD COLUMN api_endpoint VARCHAR(200)",
                "api_method": "ALTER TABLE usage_records ADD COLUMN api_method VARCHAR(10)",
                "request_params": "ALTER TABLE usage_records ADD COLUMN request_params TEXT",
                "response_status": "ALTER TABLE usage_records ADD COLUMN response_status INTEGER",
                "started_at": "ALTER TABLE usage_records ADD COLUMN started_at DATETIME",
                "completed_at": "ALTER TABLE usage_records ADD COLUMN completed_at DATETIME",
                "duration_ms": "ALTER TABLE usage_records ADD COLUMN duration_ms INTEGER",
                "response_time_ms": "ALTER TABLE usage_records ADD COLUMN response_time_ms INTEGER",
                "ip_address": "ALTER TABLE usage_records ADD COLUMN ip_address VARCHAR(45)",
                "country": "ALTER TABLE usage_records ADD COLUMN country VARCHAR(100)",
                "city": "ALTER TABLE usage_records ADD COLUMN city VARCHAR(100)",
                "user_agent": "ALTER TABLE usage_records ADD COLUMN user_agent VARCHAR(500)",
                "device_type": "ALTER TABLE usage_records ADD COLUMN device_type VARCHAR(20)",
                "browser": "ALTER TABLE usage_records ADD COLUMN browser VARCHAR(100)",
                "os": "ALTER TABLE usage_records ADD COLUMN os VARCHAR(100)",
                "input_tokens": "ALTER TABLE usage_records ADD COLUMN input_tokens INTEGER DEFAULT 0",
                "output_tokens": "ALTER TABLE usage_records ADD COLUMN output_tokens INTEGER DEFAULT 0",
                "total_tokens": "ALTER TABLE usage_records ADD COLUMN total_tokens INTEGER DEFAULT 0",
                "error_message": "ALTER TABLE usage_records ADD COLUMN error_message TEXT",
                "task_id": "ALTER TABLE usage_records ADD COLUMN task_id VARCHAR(100)",
                "project_id": "ALTER TABLE usage_records ADD COLUMN project_id INTEGER",
                "referer": "ALTER TABLE usage_records ADD COLUMN referer VARCHAR(500)",
                "session_duration": "ALTER TABLE usage_records ADD COLUMN session_duration INTEGER",
            }
            
            for field_name, sql in usage_fields_to_add.items():
                if field_name not in usage_columns:
                    try:
                        cursor.execute(sql)
                        print(f"  ✓ 添加字段到 usage_records: {field_name}")
                        added_count += 1
                    except sqlite3.OperationalError as e:
                        print(f"  ✗ 添加字段 {field_name} 失败: {e}")
        except sqlite3.OperationalError:
            print("  - usage_records 表不存在，将在下次启动时自动创建")
        
        # 检查 payments 表
        try:
            cursor.execute("PRAGMA table_info(payments)")
            payment_columns = [col[1] for col in cursor.fetchall()]
            
            payment_fields_to_add = {
                "user_id": "ALTER TABLE payments ADD COLUMN user_id INTEGER",
                "payment_type": "ALTER TABLE payments ADD COLUMN payment_type VARCHAR(50)",
                "amount": "ALTER TABLE payments ADD COLUMN amount FLOAT",
                "quantity": "ALTER TABLE payments ADD COLUMN quantity INTEGER",
                "status": "ALTER TABLE payments ADD COLUMN status VARCHAR(50) DEFAULT 'pending'",
                "payment_method": "ALTER TABLE payments ADD COLUMN payment_method VARCHAR(50) DEFAULT 'simulate'",
                "transaction_id": "ALTER TABLE payments ADD COLUMN transaction_id VARCHAR(255)",
                "created_at": "ALTER TABLE payments ADD COLUMN created_at DATETIME",
                "completed_at": "ALTER TABLE payments ADD COLUMN completed_at DATETIME",
            }
            
            for field_name, sql in payment_fields_to_add.items():
                if field_name not in payment_columns:
                    try:
                        cursor.execute(sql)
                        print(f"  ✓ 添加字段到 payments: {field_name}")
                        added_count += 1
                    except sqlite3.OperationalError as e:
                        print(f"  ✗ 添加字段 {field_name} 失败: {e}")
        except sqlite3.OperationalError:
            print("  - payments 表不存在，将在下次启动时自动创建")
        
        # 检查 projects 表
        try:
            cursor.execute("PRAGMA table_info(projects)")
            project_columns = [col[1] for col in cursor.fetchall()]
            
            project_fields_to_add = {
                "session_id": "ALTER TABLE projects ADD COLUMN session_id VARCHAR(100)",
                "is_anonymous": "ALTER TABLE projects ADD COLUMN is_anonymous BOOLEAN DEFAULT 0",
            }
            
            for field_name, sql in project_fields_to_add.items():
                if field_name not in project_columns:
                    try:
                        cursor.execute(sql)
                        print(f"  ✓ 添加字段到 projects: {field_name}")
                        added_count += 1
                    except sqlite3.OperationalError as e:
                        print(f"  ✗ 添加字段 {field_name} 失败: {e}")
        except sqlite3.OperationalError:
            print("  - projects 表不存在，将在下次启动时自动创建")
        
        # 检查 user_activity_logs 表，如果不存在则创建，如果存在则检查并添加缺失字段
        try:
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_activity_logs'")
            if not cursor.fetchone():
                # 创建 user_activity_logs 表
                cursor.execute("""
                    CREATE TABLE user_activity_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER,
                        session_id VARCHAR(100),
                        activity_type VARCHAR(50) NOT NULL,
                        activity_detail TEXT,
                        ip_address VARCHAR(45),
                        user_agent VARCHAR(500),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users(id)
                    )
                """)
                print("  ✓ 创建表: user_activity_logs")
                added_count += 1
            else:
                print("  - user_activity_logs 表已存在，检查缺失字段...")
                # 检查表结构并添加缺失字段
                cursor.execute("PRAGMA table_info(user_activity_logs)")
                activity_columns = [col[1] for col in cursor.fetchall()]
                
                activity_fields_to_add = {
                    "activity_type": "ALTER TABLE user_activity_logs ADD COLUMN activity_type VARCHAR(50) NOT NULL DEFAULT 'unknown'",
                    "activity_detail": "ALTER TABLE user_activity_logs ADD COLUMN activity_detail TEXT",
                    "ip_address": "ALTER TABLE user_activity_logs ADD COLUMN ip_address VARCHAR(45)",
                    "user_agent": "ALTER TABLE user_activity_logs ADD COLUMN user_agent VARCHAR(500)",
                    "created_at": "ALTER TABLE user_activity_logs ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
                }
                
                for field_name, sql in activity_fields_to_add.items():
                    if field_name not in activity_columns:
                        try:
                            # 对于 NOT NULL 字段，需要先添加允许 NULL，然后更新数据，最后设置 NOT NULL
                            if "NOT NULL" in sql and field_name == "activity_type":
                                # 先添加允许 NULL 的列
                                cursor.execute("ALTER TABLE user_activity_logs ADD COLUMN activity_type VARCHAR(50)")
                                # 更新现有数据
                                cursor.execute("UPDATE user_activity_logs SET activity_type = 'unknown' WHERE activity_type IS NULL")
                                # 注意：SQLite 不支持直接修改列约束，所以这里先添加允许 NULL 的列
                                print(f"  ✓ 添加字段到 user_activity_logs: {field_name} (注意：SQLite 限制，该字段允许 NULL)")
                            else:
                                cursor.execute(sql)
                                print(f"  ✓ 添加字段到 user_activity_logs: {field_name}")
                            added_count += 1
                        except sqlite3.OperationalError as e:
                            print(f"  ✗ 添加字段 {field_name} 失败: {e}")
        except sqlite3.OperationalError as e:
            print(f"  ✗ 处理 user_activity_logs 表失败: {e}")
        
        conn.commit()
        
        if added_count > 0:
            print(f"\n✓ 迁移完成！共添加 {added_count} 个字段")
        else:
            print("\n✓ 数据库已是最新版本，无需迁移")
            
    except Exception as e:
        conn.rollback()
        print(f"\n✗ 迁移失败: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database()
