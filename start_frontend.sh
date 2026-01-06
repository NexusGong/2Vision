#!/bin/bash

# 启动前端服务脚本

echo "启动古诗词古文图像化学习工具前端服务..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 pnpm（Modern.js 项目使用 pnpm）
if ! command -v pnpm &> /dev/null; then
    echo "警告: 未找到 pnpm，正在安装..."
    npm install -g pnpm
fi

# 进入前端目录
cd frontend

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "安装前端依赖..."
    pnpm install
fi

# 启动服务
echo "启动前端服务..."
pnpm dev

