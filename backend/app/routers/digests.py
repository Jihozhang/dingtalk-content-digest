from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.digest import DigestResponse, DigestCreate
from app.routers.auth import get_current_user
from app.services.mongo_client import get_digests_collection
from app.services.ai_digest import get_digest_generator
from app.services.scheduler import get_scheduler_status, run_daily_digest, run_weekly_digest

router = APIRouter(prefix="/digests", tags=["定时智能汇总"])


def serialize(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.post("", response_model=DigestResponse)
async def create_digest(
    data: DigestCreate,
    current_user: str = Depends(get_current_user),
):
    """手动创建一个汇总任务（后台异步生成）。"""
    generator = get_digest_generator()
    digest_id = generator.create_and_run(
        conversation_id=data.conversation_id,
        start_date=data.start_date,
        end_date=data.end_date,
        period_type=data.period_type or "custom",
    )
    doc = get_digests_collection().find_one({"_id": ObjectId(digest_id)})
    return serialize(doc)


@router.get("", response_model=List[DigestResponse])
async def list_digests(
    conversation_id: Optional[str] = Query(None),
    period_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: str = Depends(get_current_user),
):
    """汇总任务列表。"""
    col = get_digests_collection()
    query: dict = {}
    if conversation_id:
        query["conversation_id"] = conversation_id
    if period_type:
        query["period_type"] = period_type
    if status_filter:
        query["status"] = status_filter

    skip = (page - 1) * page_size
    cursor = col.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    return [serialize(doc) for doc in cursor]


@router.get("/scheduler/status")
async def scheduler_status(current_user: str = Depends(get_current_user)):
    """查询调度器状态与下次运行时间。"""
    return get_scheduler_status()


@router.post("/scheduler/run-daily")
async def trigger_daily(current_user: str = Depends(get_current_user)):
    """手动触发一次每日汇总（对所有激活群）。"""
    run_daily_digest()
    return {"message": "每日汇总已触发"}


@router.post("/scheduler/run-weekly")
async def trigger_weekly(current_user: str = Depends(get_current_user)):
    """手动触发一次每周汇总（对所有激活群）。"""
    run_weekly_digest()
    return {"message": "每周汇总已触发"}


@router.get("/{digest_id}", response_model=DigestResponse)
async def get_digest(
    digest_id: str,
    current_user: str = Depends(get_current_user),
):
    """汇总任务详情。"""
    try:
        oid = ObjectId(digest_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的任务 ID")

    doc = get_digests_collection().find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return serialize(doc)


@router.post("/{digest_id}/push")
async def push_digest(
    digest_id: str,
    current_user: str = Depends(get_current_user),
):
    """将指定汇总回推到群聊。"""
    try:
        oid = ObjectId(digest_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的任务 ID")

    col = get_digests_collection()
    doc = col.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    if doc.get("status") != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="任务未完成，无法回推")

    from app.services.dingtalk_chat import get_chat_client
    generator = get_digest_generator()
    text = generator._build_push_text(doc)
    ok = get_chat_client().send_group_message(doc["conversation_id"], text)
    if not ok:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="回推失败，请检查机器人权限与 RobotCode 配置")

    col.update_one({"_id": oid}, {"$set": {"pushed": True}})
    return {"message": "已回推到群聊"}


@router.delete("/{digest_id}")
async def delete_digest(
    digest_id: str,
    current_user: str = Depends(get_current_user),
):
    """删除汇总任务。"""
    try:
        oid = ObjectId(digest_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的任务 ID")

    result = get_digests_collection().delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return {"message": "任务已删除"}
