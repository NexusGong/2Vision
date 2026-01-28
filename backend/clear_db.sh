#!/bin/bash
# 清空数据库所有表的数据
# 用于演示前重置数据库

DB_FILE="app.db"

if [ ! -f "$DB_FILE" ]; then
    echo "错误：数据库文件 $DB_FILE 不存在"
    exit 1
fi

echo "=========================================="
echo "数据库清空工具"
echo "=========================================="
echo ""
echo "警告：此操作将删除所有表中的数据！"
echo "表结构将保持不变，但所有记录将被删除。"
echo ""
read -p "确认要清空所有数据吗？(输入 'yes' 确认): " confirm

if [ "$confirm" != "yes" ]; then
    echo "操作已取消。"
    exit 0
fi

echo ""
echo "开始清空数据库..."

sqlite3 "$DB_FILE" << 'EOF'
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- 清空所有表的数据
DELETE FROM usage_records;
DELETE FROM user_activity_logs;
DELETE FROM payments;
DELETE FROM annotations;
DELETE FROM image_items;
DELETE FROM projects;
DELETE FROM users;
DELETE FROM feature_usage_details;
DELETE FROM user_behaviors;
DELETE FROM location_statistics;
DELETE FROM usage_statistics;

COMMIT;
PRAGMA foreign_keys=ON;
EOF

if [ $? -eq 0 ]; then
    echo "✓ 数据库清空完成！"
    echo ""
    echo "验证：各表记录数："
    sqlite3 "$DB_FILE" << 'EOF'
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'projects', COUNT(*) FROM projects
UNION ALL
SELECT 'image_items', COUNT(*) FROM image_items
UNION ALL
SELECT 'annotations', COUNT(*) FROM annotations
UNION ALL
SELECT 'usage_records', COUNT(*) FROM usage_records
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'user_activity_logs', COUNT(*) FROM user_activity_logs
UNION ALL
SELECT 'feature_usage_details', COUNT(*) FROM feature_usage_details
UNION ALL
SELECT 'user_behaviors', COUNT(*) FROM user_behaviors
UNION ALL
SELECT 'location_statistics', COUNT(*) FROM location_statistics
UNION ALL
SELECT 'usage_statistics', COUNT(*) FROM usage_statistics;
EOF
    echo ""
    echo "=========================================="
    echo "✓ 所有操作完成！"
    echo "=========================================="
else
    echo ""
    echo "=========================================="
    echo "✗ 操作失败"
    echo "=========================================="
    exit 1
fi
