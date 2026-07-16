from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.ai_summary import (
    AISummaryTaskResponse,
    AISummaryTaskCreate,
    AISummaryTaskListParams,
)
from app.routers.auth import get_current_user
from app.services.mongo_client import get_db
from app.services.ai_summarizer import get_summarizer

router = APIRouter(prefix="/ai-summaries", tags=["AI 日报汇总"])


def serialize_task(doc: dict) -> dict:
    """序列化 AI 汇总任务文档"""
    doc["_id"] = str(doc["_id"])
    # 确保 generated_reports 中的 applied 字段存在
    for report in doc.get("generated_reports", []):
        if "applied" not in report:
            report["applied"] = False
    return doc


@router.post("", response_model=AISummaryTaskResponse)
async def create_summary_task(
    task_data: AISummaryTaskCreate,
    current_user: str = Depends(get_current_user),
):
    """创建 AI 汇总任务"""
    summarizer = get_summarizer()
    task_id = summarizer.create_task(task_data)

    db = get_db()
    doc = db.ai_summaries.find_one({"_id": ObjectId(task_id)})
    return serialize_task(doc)


@router.get("", response_model=List[AISummaryTaskResponse])
async def list_summary_tasks(
    conversation_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: str = Depends(get_current_user),
):
    """获取 AI 汇总任务列表"""
    db = get_db()
    query = {}
    if conversation_id:
        query["conversation_id"] = conversation_id
    if status:
        query["status"] = status

    skip = (page - 1) * page_size
    cursor = db.ai_summaries.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    return [serialize_task(doc) for doc in cursor]


@router.get("/{task_id}", response_model=AISummaryTaskResponse)
async def get_summary_task(
    task_id: str,
    current_user: str = Depends(get_current_user),
):
    """获取单个 AI 汇总任务详情"""
    db = get_db()
    try:
        doc = db.ai_summaries.find_one({"_id": ObjectId(task_id)})
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的任务 ID")

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    return serialize_task(doc)


@router.post("/{task_id}/apply")
async def apply_summary_reports(
    task_id: str,
    report_indices: Optional[List[int]] = None,
    current_user: str = Depends(get_current_user),
):
    """
    将 AI 生成的日报应用到正式日报表

    Args:
        report_indices: 要入库的报告索引列表，不传则全部入库
    """
    summarizer = get_summarizer()
    try:
        count = summarizer.apply_reports(task_id, report_indices)
        return {"message": f"成功入库 {count} 条日报", "applied_count": count}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.delete("/{task_id}")
async def delete_summary_task(
    task_id: str,
    current_user: str = Depends(get_current_user),
):
    """删除 AI 汇总任务"""
    db = get_db()
    try:
        obj_id = ObjectId(task_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的任务 ID")

    result = db.ai_summaries.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")

    return {"message": "任务已删除"}
