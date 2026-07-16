#!/bin/bash
set -e

echo "========================================"
echo "钉钉日报机器人管理系统 - 启动脚本"
echo "========================================"
echo ""

# 启动 MongoDB (如果已安装 Docker)
echo "[1/3] 检查 MongoDB..."
if ! docker ps | grep -q ddjqr_mongodb; then
    echo "      MongoDB 容器未运行，尝试启动..."
    if ! docker-compose up -d; then
        echo "      警告: Docker 未安装或 MongoDB 容器启动失败"
        echo "      请确保 MongoDB 服务已运行 (默认端口 27017)"
    else
        echo "      MongoDB 容器已启动"
    fi
else
    echo "      MongoDB 容器已在运行"
fi

echo ""
echo "[2/3] 启动后端服务..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8008 &
BACKEND_PID=$!
cd ..

echo ""
echo "[3/3] 启动前端服务..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "========================================"
echo "服务已启动:"
echo "  后端 API: http://localhost:8008"
echo "  前端页面: http://localhost:5177"
echo "  API 文档: http://localhost:8008/docs"
echo "========================================"
echo ""
echo "按 Ctrl+C 停止所有服务"
wait
