#!/bin/bash

# 抑制 conda anaconda-auth 的警告
# 这个警告来自 conda 基础环境，不影响应用运行
export PYTHONWARNINGS="ignore"

# 启动后端服务脚本

echo "启动古诗词古文图像化学习工具后端服务..."

# 检查 Conda 环境
if ! command -v conda &> /dev/null; then
    echo "错误: 未找到 Conda，请先安装 Conda"
    exit 1
fi

# 激活 Conda 环境
echo "激活 Conda 环境..."
source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate 2vision

# 确保使用 conda 环境中的 Python
export PATH="$(conda info --base)/envs/2vision/bin:$PATH"

# 进入后端目录
cd backend

# 检查环境变量文件（backend目录下的.env）
if [ ! -f .env ]; then
    echo "警告: 未找到 backend/.env 文件，请先配置环境变量"
    echo "可以复制 .env.example 并修改配置"
    exit 1
fi

# 检查依赖
if [ ! -f "requirements.txt" ]; then
    echo "错误: 未找到 requirements.txt"
    exit 1
fi

# 安装依赖（如果需要）
echo "检查 Python 依赖..."
pip install -q -r requirements.txt 2>/dev/null || {
    echo "安装 Python 依赖..."
    pip install -r requirements.txt
}

# 启动服务
echo "启动后端服务..."
# 使用 conda 环境中的 Python
python -m app.main || {
    echo "尝试使用完整路径..."
    "$(conda info --base)/envs/2vision/bin/python" -m app.main
}

