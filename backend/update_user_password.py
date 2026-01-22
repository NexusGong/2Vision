#!/usr/bin/env python3
"""
更新用户密码脚本
用法: python update_user_password.py <phone> <new_password>
"""
import sys
import os

# 添加backend目录到路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 导入所有模型以确保关系正确初始化
from app.models import user, usage, project, payment, activity
from app.database import SessionLocal
from app.models.user import User
from app.services.auth import get_password_hash, set_user_password

def update_user_password(phone: str, new_password: str):
    """更新用户密码"""
    db = SessionLocal()
    try:
        # 查找用户
        user = db.query(User).filter(User.phone == phone).first()
        
        if not user:
            print(f"错误: 未找到手机号为 {phone} 的用户")
            return False
        
        print(f"找到用户: ID={user.id}, 用户名={user.username}, 手机号={user.phone}")
        print(f"当前 password_set={user.password_set}")
        
        # 设置新密码
        set_user_password(db, user, new_password)
        
        print(f"✓ 密码已更新为: {new_password}")
        print(f"✓ password_set 已设置为: {user.password_set}")
        
        return True
        
    except Exception as e:
        print(f"错误: {str(e)}")
        db.rollback()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("用法: python update_user_password.py <phone> <new_password>")
        print("示例: python update_user_password.py 15012346321 1111")
        sys.exit(1)
    
    phone = sys.argv[1]
    new_password = sys.argv[2]
    
    # 去除手机号中的空格和特殊字符
    phone = phone.strip().replace(' ', '').replace('-', '')
    
    print(f"正在更新用户密码...")
    print(f"手机号: {phone}")
    print(f"新密码: {new_password}")
    print("-" * 50)
    
    success = update_user_password(phone, new_password)
    
    if success:
        print("-" * 50)
        print("✓ 密码更新成功！")
        sys.exit(0)
    else:
        print("-" * 50)
        print("✗ 密码更新失败！")
        sys.exit(1)
