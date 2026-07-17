import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import auth, reports, groups, stats, ai_summary, content_stats, digests, templates, data_records
from app.services.mongo_client import close_mongo_client
from app.services.dingtalk_stream import get_stream_manager
from app.services.message_handler import handle_incoming_message
from app.services.scheduler import start_scheduler, stop_scheduler

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化
    print("[App] Starting up...")

    # 初始化 MongoDB 连接
    from app.services.mongo_client import get_db
    get_db()
    print("[App] MongoDB connected")

    # 启动钉钉 Stream 连接（如果配置了钉钉凭据）
    if settings.DINGTALK_APP_KEY and settings.DINGTALK_APP_SECRET:
        manager = get_stream_manager()
        manager.start()
        print("[App] DingTalk Stream client started")
    else:
        print("[App] DingTalk credentials not configured, skipping Stream client")

    # 启动定时任务调度器（每日/每周汇总、消息回填）
    start_scheduler()

    yield

    # 关闭时清理
    print("[App] Shutting down...")
    stop_scheduler()
    close_mongo_client()
    get_stream_manager().stop()
    print("[App] Cleanup complete")


app = FastAPI(
    title="钉钉日报机器人管理系统",
    description="自动收集、解析和管理钉钉群聊日报数据",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(ai_summary.router, prefix="/api")
app.include_router(content_stats.router, prefix="/api")
app.include_router(digests.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(data_records.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "钉钉日报机器人管理系统 API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    """健康检查接口"""
    try:
        from app.services.mongo_client import get_db
        get_db().command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    # Stream 连接状态
    stream_status = "not_configured"
    if settings.DINGTALK_APP_KEY and settings.DINGTALK_APP_SECRET:
        manager = get_stream_manager()
        stream_status = "running" if manager._running else "stopped"

    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "database": db_status,
        "stream": stream_status,
        "dingtalk_configured": bool(settings.DINGTALK_APP_KEY and settings.DINGTALK_APP_SECRET),
        "ai_configured": bool(settings.DEEPSEEK_API_KEY),
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }


@app.post("/api/debug/dingtalk-test")
async def test_dingtalk_connection():
    """测试钉钉连接"""
    if not settings.DINGTALK_APP_KEY or not settings.DINGTALK_APP_SECRET:
        return {"success": False, "error": "钉钉凭据未配置"}

    try:
        import dingtalk_stream
        credential = dingtalk_stream.Credential(
            settings.DINGTALK_APP_KEY,
            settings.DINGTALK_APP_SECRET
        )
        client = dingtalk_stream.DingTalkStreamClient(credential)
        token = client.get_access_token()
        return {
            "success": True,
            "token_prefix": token[:10] + "..." if token else None,
            "message": "钉钉 Access Token 获取成功",
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/debug/simulate-message")
async def simulate_message(
    text: str = "今日工作：完成了测试任务\n明日计划：继续开发\n工作时长：8小时",
    conversation_id: str = "test-conversation-123",
    sender_staff_id: str = "test-user-456",
    sender_name: str = "测试用户",
):
    """模拟接收钉钉消息，用于测试日报解析和存储"""
    from app.services.message_handler import handle_incoming_message
    try:
        handle_incoming_message(
            text_content=text,
            conversation_id=conversation_id,
            sender_staff_id=sender_staff_id,
            sender_name=sender_name,
            message_id="test-msg-" + __import__("datetime").datetime.utcnow().strftime("%Y%m%d%H%M%S"),
        )
        return {"success": True, "message": "消息已处理并存储"}
    except Exception as e:
        return {"success": False, "error": str(e)}
