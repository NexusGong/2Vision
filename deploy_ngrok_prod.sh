#!/bin/bash

# ============================================
# ngrok 公网单端口部署脚本（推荐）
# ============================================
# 特点：
#   - 前后端通过同一端口提供服务
#   - 只需要一个 ngrok 隧道
#   - 一个公网 URL 搞定所有
# 
# 使用方法: ./deploy_ngrok_prod.sh
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  🌐 2Vision - ngrok 公网部署（单端口模式）                    ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  前后端合并服务，只需一个 URL 即可访问完整应用               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查依赖
check_dependencies() {
    echo -e "${BLUE}📋 检查依赖...${NC}"
    
    # 检查 ngrok
    if ! command -v ngrok &> /dev/null; then
        echo -e "${RED}❌ 未找到 ngrok${NC}"
        echo ""
        echo "安装方法:"
        echo -e "  ${YELLOW}brew install ngrok${NC}"
        echo ""
        echo "安装后配置 authtoken:"
        echo -e "  ${YELLOW}ngrok config add-authtoken <你的token>${NC}"
        echo "  获取: https://dashboard.ngrok.com/get-started/your-authtoken"
        exit 1
    fi
    echo -e "   ${GREEN}✓ ngrok${NC}"
    
    # 检查 conda
    if ! command -v conda &> /dev/null; then
        echo -e "${RED}❌ 未找到 conda${NC}"
        exit 1
    fi
    echo -e "   ${GREEN}✓ conda${NC}"
    
    # 检查 pnpm
    if ! command -v pnpm &> /dev/null; then
        echo -e "${YELLOW}⚠ 未找到 pnpm，正在安装...${NC}"
        npm install -g pnpm
    fi
    echo -e "   ${GREEN}✓ pnpm${NC}"
}

# 构建前端
build_frontend() {
    echo ""
    echo -e "${BLUE}🔨 构建前端...${NC}"
    
    cd "$SCRIPT_DIR/frontend"
    
    # 检查 node_modules
    if [ ! -d "node_modules" ]; then
        echo "   安装依赖..."
        pnpm install
    fi
    
    # 构建
    echo "   编译中..."
    pnpm build
    
    if [ -d "dist" ]; then
        echo -e "   ${GREEN}✓ 前端构建完成${NC}"
    else
        echo -e "   ${RED}❌ 前端构建失败${NC}"
        exit 1
    fi
    
    cd "$SCRIPT_DIR"
}

# 启动生产服务
start_prod_server() {
    echo ""
    echo -e "${BLUE}🚀 启动生产服务...${NC}"
    
    cd "$SCRIPT_DIR/backend"
    
    # 激活 Conda 环境
    source "$(conda info --base)/etc/profile.d/conda.sh"
    conda activate 2vision
    
    # 设置环境变量
    export API_HOST="0.0.0.0"
    export CORS_ORIGINS="*"
    export PYTHONWARNINGS="ignore"
    
    # 后台启动生产模式
    python -m app.main_prod > /tmp/2vision_prod.log 2>&1 &
    BACKEND_PID=$!
    
    cd "$SCRIPT_DIR"
    
    # 等待启动
    echo -n "   等待服务启动"
    for i in {1..15}; do
        sleep 1
        echo -n "."
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            echo ""
            echo -e "   ${GREEN}✓ 服务已启动 (PID: $BACKEND_PID)${NC}"
            return 0
        fi
    done
    
    echo ""
    echo -e "   ${RED}❌ 服务启动失败${NC}"
    echo "   查看日志: cat /tmp/2vision_prod.log"
    exit 1
}

# 启动 ngrok
start_ngrok() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}   🎉 服务启动成功！${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "本地访问: ${CYAN}http://localhost:8000${NC}"
    echo ""
    echo -e "${YELLOW}正在启动 ngrok 隧道...${NC}"
    echo ""
    echo "提示: ngrok 启动后会显示公网 URL"
    echo "      将该 URL 分享给他人即可访问您的应用"
    echo ""
    echo "按 Ctrl+C 停止服务"
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # 启动 ngrok（只需要后端端口）
    ngrok http 8000 --log=stdout
}

# 清理
cleanup() {
    echo ""
    echo -e "${YELLOW}正在停止服务...${NC}"
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ 服务已停止${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 主函数
main() {
    print_banner
    check_dependencies
    build_frontend
    start_prod_server
    start_ngrok
}

main
