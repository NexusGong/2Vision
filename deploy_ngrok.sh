#!/bin/bash

# ============================================
# ngrok 公网临时部署脚本（推荐方案）
# ============================================
# 使用方法: 
#   ./deploy_ngrok.sh        # 开发模式（双隧道）
#   ./deploy_ngrok.sh prod   # 生产模式（后端服务静态文件）
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       🚀 2Vision - ngrok 公网临时部署                         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 检查 ngrok
check_ngrok() {
    if ! command -v ngrok &> /dev/null; then
        echo -e "${RED}❌ 未找到 ngrok${NC}"
        echo ""
        echo "请先安装 ngrok:"
        echo -e "  ${YELLOW}brew install ngrok${NC}"
        echo "  或访问: https://ngrok.com/download"
        echo ""
        echo "安装后请配置 authtoken:"
        echo -e "  ${YELLOW}ngrok config add-authtoken <你的token>${NC}"
        echo "  获取 token: https://dashboard.ngrok.com/get-started/your-authtoken"
        exit 1
    fi
    echo -e "${GREEN}✓ ngrok 已安装${NC}"
}

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}正在清理...${NC}"
    
    # 停止后台进程
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    if [ ! -z "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null || true
    fi
    
    echo -e "${GREEN}✓ 服务已停止${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 启动后端
start_backend() {
    echo -e "${BLUE}📦 启动后端服务...${NC}"
    
    cd "$SCRIPT_DIR/backend"
    
    # 激活 Conda 环境
    source "$(conda info --base)/etc/profile.d/conda.sh"
    conda activate 2vision
    
    # 设置环境变量
    export API_HOST="0.0.0.0"
    export CORS_ORIGINS="*"
    export PYTHONWARNINGS="ignore"
    
    # 后台启动
    python -m app.main > /tmp/2vision_backend.log 2>&1 &
    BACKEND_PID=$!
    
    cd "$SCRIPT_DIR"
    
    # 等待启动
    echo -n "   等待后端启动"
    for i in {1..10}; do
        sleep 1
        echo -n "."
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            echo ""
            echo -e "   ${GREEN}✓ 后端服务已启动 (PID: $BACKEND_PID)${NC}"
            return 0
        fi
    done
    
    echo ""
    echo -e "   ${RED}❌ 后端启动失败${NC}"
    echo "   查看日志: cat /tmp/2vision_backend.log"
    exit 1
}

# 启动前端（开发模式）
start_frontend_dev() {
    echo -e "${BLUE}🎨 启动前端服务（开发模式）...${NC}"
    
    cd "$SCRIPT_DIR/frontend"
    
    # 检查 node_modules
    if [ ! -d "node_modules" ]; then
        echo "   安装前端依赖..."
        pnpm install
    fi
    
    # 后台启动
    pnpm dev > /tmp/2vision_frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    cd "$SCRIPT_DIR"
    
    # 等待启动
    echo -n "   等待前端启动"
    for i in {1..15}; do
        sleep 1
        echo -n "."
        if curl -s http://localhost:8080 > /dev/null 2>&1; then
            echo ""
            echo -e "   ${GREEN}✓ 前端服务已启动 (PID: $FRONTEND_PID)${NC}"
            return 0
        fi
    done
    
    echo ""
    echo -e "   ${RED}❌ 前端启动失败${NC}"
    echo "   查看日志: cat /tmp/2vision_frontend.log"
    exit 1
}

# 启动双隧道模式
start_ngrok_dual() {
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}⚠️  重要提示：双隧道模式${NC}"
    echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "由于使用开发模式，前后端需要分别暴露。"
    echo ""
    echo -e "${YELLOW}请按以下步骤操作：${NC}"
    echo ""
    echo "1. 在当前终端，将启动前端隧道"
    echo ""
    echo "2. 请打开新终端，运行后端隧道："
    echo -e "   ${GREEN}ngrok http 8000${NC}"
    echo ""
    echo "3. 获取后端公网地址后，需要修改前端代理配置"
    echo "   或者使用下方的一键双隧道命令..."
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # 使用 ngrok 配置文件启动双隧道
    if [ -f "$SCRIPT_DIR/ngrok.yml" ]; then
        echo -e "${GREEN}使用配置文件启动双隧道...${NC}"
        echo ""
        ngrok start --all --config "$SCRIPT_DIR/ngrok.yml"
    else
        echo -e "${YELLOW}启动前端隧道（端口 8080）...${NC}"
        echo ""
        ngrok http 8080
    fi
}

# 主函数
main() {
    check_ngrok
    echo ""
    
    MODE=${1:-"dev"}
    
    if [ "$MODE" = "prod" ]; then
        echo -e "${YELLOW}生产模式暂不支持，请使用开发模式${NC}"
        echo "运行: ./deploy_ngrok.sh"
        exit 1
    fi
    
    # 开发模式
    start_backend
    start_frontend_dev
    
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}   🎉 本地服务启动成功！${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
    echo ""
    echo "本地访问地址:"
    echo -e "  前端: ${CYAN}http://localhost:8080${NC}"
    echo -e "  后端: ${CYAN}http://localhost:8000${NC}"
    echo ""
    
    start_ngrok_dual
}

main "$@"
