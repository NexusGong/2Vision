#!/usr/bin/env python3
"""
一次性迁移：为 usage_records 表添加 poem_title 和 timezone 列。
若表已存在且无这些列，运行此脚本后可正常使用新功能。
若使用 create_all 新建表则无需运行。
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sqlalchemy import text
from app.database import engine

def run():
    for col, spec in [
        ("poem_title", "VARCHAR(200)"),
        ("timezone", "VARCHAR(50)"),
    ]:
        try:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE usage_records ADD COLUMN {col} {spec}"))
            print(f"已添加列: {col}")
        except Exception as e:
            err = str(e).lower()
            if "duplicate column" in err or "already exists" in err:
                print(f"列 {col} 已存在，跳过")
            else:
                print(f"添加列 {col} 失败: {e}")
    print("迁移完成")

if __name__ == "__main__":
    run()
