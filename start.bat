@echo off
chcp 65001 >nul
echo ========================================
echo 钉钉日报机器人管理系统 - 启动脚本
echo ========================================
echo.

REM 启动 MongoDB (如果已安装 Docker)
echo [1/3] 检查 MongoDB...
docker ps | findstr ddjqr_mongodb >nul
if %errorlevel% neq 0 (
    echo       MongoDB 容器未运行，尝试启动...
    docker-compose up -d
    if %errorlevel% neq 0 (
        echo       警告: Docker 未安装或 MongoDB 容器启动失败
        echo       请确保 MongoDB 服务已运行 (默认端口 27017)
    ) else (
        echo       MongoDB 容器已启动
    )
) else (
    echo       MongoDB 容器已在运行
)

echo.
echo [2/3] 启动后端服务...
start "后端服务" cmd /k "cd /d d:\ai\ddjqr\backend && .\venv\Scripts\python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8008"

echo.
echo [3/3] 启动前端服务...
start "前端服务" cmd /k "cd /d d:\ai\ddjqr\frontend && npm run dev"

echo.
echo ========================================
echo 服务启动中，请稍候...
echo.
echo 后端 API: http://localhost:8008
echo 前端页面: http://localhost:5177
echo API 文档: http://localhost:8008/docs
echo ========================================
pause
