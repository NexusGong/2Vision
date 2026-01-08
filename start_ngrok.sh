#!/bin/bash

# ============================================
# 🌐 2Vision - ngrok 一键启动脚本（实时日志版）
# ============================================
# 特点：
#   - 一键启动所有服务
#   - 实时显示后端和 ngrok 日志
#   - 自动清理进程
# 
# 使用方法: ./start_ngrok.sh
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 日志文件
LOG_FILE="/tmp/2vision_backend.log"

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  🌐 2Vision - ngrok 公网部署（实时日志版）                    ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  一键启动，实时查看所有日志                                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查依赖
check_dependencies() {
    echo -e "${BLUE}📋 检查依赖...${NC}"
    
    local missing=0
    
    if ! command -v ngrok &> /dev/null; then
        echo -e "   ${RED}❌ ngrok${NC}"
        missing=1
    else
        echo -e "   ${GREEN}✓ ngrok${NC}"
    fi
    
    if ! command -v conda &> /dev/null; then
        echo -e "   ${RED}❌ conda${NC}"
        missing=1
    else
        echo -e "   ${GREEN}✓ conda${NC}"
    fi
    
    if ! command -v pnpm &> /dev/null; then
        echo -e "   ${YELLOW}⚠ pnpm 未安装，正在安装...${NC}"
        npm install -g pnpm
    else
        echo -e "   ${GREEN}✓ pnpm${NC}"
    fi
    
    if [ $missing -eq 1 ]; then
        echo ""
        echo -e "${RED}请先安装缺失的依赖${NC}"
        exit 1
    fi
}

# 检查并构建前端
check_and_build_frontend() {
    echo ""
    echo -e "${BLUE}🔨 检查前端构建...${NC}"
    
    cd "$SCRIPT_DIR/frontend"
    
    # 检查是否需要构建
    if [ ! -d "dist" ] || [ "dist" -ot "src" ] 2>/dev/null; then
        echo "   前端未构建或需要重新构建"
        
        if [ ! -d "node_modules" ]; then
            echo "   安装依赖..."
            pnpm install
        fi
        
        echo "   编译中..."
        pnpm build
        
        if [ ! -d "dist" ]; then
            echo -e "   ${RED}❌ 前端构建失败${NC}"
            exit 1
        fi
        echo -e "   ${GREEN}✓ 前端构建完成${NC}"
    else
        echo -e "   ${GREEN}✓ 前端已构建，跳过${NC}"
    fi
    
    cd "$SCRIPT_DIR"
}

# 启动后端服务（后台运行，输出到日志）
start_backend() {
    echo ""
    echo -e "${BLUE}🚀 启动后端服务...${NC}"
    
    # 检查端口是否被占用
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "   ${YELLOW}⚠ 端口 8000 已被占用，尝试停止旧进程...${NC}"
        pkill -f "app.main_prod" || true
        sleep 2
    fi
    
    cd "$SCRIPT_DIR/backend"
    
    # 激活 Conda 环境
    source "$(conda info --base)/etc/profile.d/conda.sh"
    conda activate 2vision
    
    # 设置环境变量
    export API_HOST="0.0.0.0"
    export CORS_ORIGINS="*"
    export PYTHONWARNINGS="ignore"
    
    # 清空旧日志
    > "$LOG_FILE"
    
    # 后台启动，输出到日志文件
    nohup python -m app.main_prod >> "$LOG_FILE" 2>&1 &
    BACKEND_PID=$!
    
    cd "$SCRIPT_DIR"
    
    # 等待启动
    echo -n "   等待服务启动"
    for i in {1..15}; do
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
    echo "   查看日志: tail -f $LOG_FILE"
    exit 1
}

# 显示实时日志和启动 ngrok
start_with_logs() {
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}   🎉 服务启动成功！${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "本地访问: ${CYAN}http://localhost:8000${NC}"
    echo ""
    echo -e "${YELLOW}提示:${NC}"
    echo "  - 下方将实时显示后端日志（${BLUE}[BACKEND]${NC}）和 ngrok 日志（${CYAN}[NGROK]${NC}）"
    echo "  - ngrok 公网 URL 会显示在日志中，查找 ${GREEN}https://xxx.ngrok-free.app${NC}"
    echo "  - 按 ${BOLD}Ctrl+C${NC} 停止所有服务"
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}   实时日志输出${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # 启动 ngrok（后台，输出带标记）
    (
        sleep 2
        ngrok http 8000 --log=stdout 2>&1 | while IFS= read -r line; do
            # 提取公网 URL
            if echo "$line" | grep -q "started tunnel\|url="; then
                echo -e "${GREEN}[NGROK]${NC} ${CYAN}$line${NC}"
            elif echo "$line" | grep -q "ngrok-free.app"; then
                echo -e "${GREEN}[NGROK]${NC} ${BOLD}${GREEN}公网地址: $line${NC}"
            else
                echo -e "${CYAN}[NGROK]${NC} $line"
            fi
        done
    ) &
    NGROK_PID=$!
    
    # 实时显示后端日志（带标记）
    tail -f "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
        echo -e "${BLUE}[BACKEND]${NC} $line"
    done &
    TAIL_PID=$!
    
    # 等待任一进程结束
    wait $TAIL_PID 2>/dev/null || wait $NGROK_PID 2>/dev/null || true
}

# 清理函数
cleanup() {
    echo ""
    echo ""
    echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}   正在停止所有服务...${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════════════${NC}"
    
    # 停止 tail
    pkill -P $$ -f "tail -f" 2>/dev/null || true
    
    # 停止后端
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        echo -e "   ${GREEN}✓ 后端服务已停止${NC}"
    fi
    
    # 停止 ngrok
    pkill -f "ngrok http" 2>/dev/null || true
    if [ ! -z "$NGROK_PID" ]; then
        kill $NGROK_PID 2>/dev/null || true
    fi
    echo -e "   ${GREEN}✓ ngrok 已停止${NC}"
    
    echo ""
    echo -e "${GREEN}✓ 所有服务已停止${NC}"
    exit 0
}

# 捕获中断信号
trap cleanup SIGINT SIGTERM

# 主函数
main() {
    print_banner
    check_dependencies
    check_and_build_frontend
    start_backend
    start_with_logs
}

main
