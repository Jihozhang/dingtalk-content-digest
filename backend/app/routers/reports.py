from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
import io
import csv

from app.models.report import ReportResponse, ReportUpdate, ReportCreate, ParsedContent
from app.routers.auth import get_current_user
from app.services.mongo_client import get_reports_collection, get_groups_collection, get_users_collection

router = APIRouter(prefix="/reports", tags=["日报管理"])


def serialize_report(doc: dict) -> dict:
    """将 MongoDB 文档序列化为 API 响应格式"""
    doc["_id"] = str(doc["_id"])
    
    # 确保必要字段存在
    if "created_at" not in doc:
        doc["created_at"] = __import__("datetime").datetime.utcnow().isoformat()
    
    if "parsed_content" in doc and isinstance(doc["parsed_content"], dict):
        try:
            # 确保 work_hours 是 float 或 None
            pc = doc["parsed_content"]
            if "work_hours" in pc and pc["work_hours"] is not None:
                try:
                    pc["work_hours"] = float(pc["work_hours"])
                except (ValueError, TypeError):
                    pc["work_hours"] = None
            doc["parsed_content"] = ParsedContent(**pc).model_dump()
        except Exception as e:
            # 如果解析失败，保留原始字典
            print(f"[SerializeReport] Warning: failed to parse parsed_content: {e}")
            doc["parsed_content"] = {
                "today_work": doc["parsed_content"].get("today_work", ""),
                "tomorrow_plan": doc["parsed_content"].get("tomorrow_plan", ""),
                "problems": doc["parsed_content"].get("problems", ""),
                "work_hours": None,
                "remarks": doc["parsed_content"].get("remarks", ""),
            }
    return doc


@router.get("", response_model=List[ReportResponse])
async def list_reports(
    conversation_id: Optional[str] = Query(None, description="按群聊筛选"),
    sender_staff_id: Optional[str] = Query(None, description="按员工筛选"),
    report_date: Optional[str] = Query(None, description="按日期筛选 (YYYY-MM-DD)"),
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    parse_status: Optional[str] = Query(None, description="解析状态筛选"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    current_user: str = Depends(get_current_user),
):
    """获取日报列表，支持多种筛选条件"""
    collection = get_reports_collection()
    query = {}

    if conversation_id:
        query["conversation_id"] = conversation_id
    if sender_staff_id:
        query["sender_staff_id"] = sender_staff_id
    if report_date:
        query["report_date"] = report_date
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["report_date"] = date_query
    if parse_status:
        query["parse_status"] = parse_status

    skip = (page - 1) * page_size
    cursor = collection.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    try:
        reports = [serialize_report(doc) for doc in cursor]
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"序列化失败: {str(e)}")
    return reports


@router.get("/count")
async def count_reports(
    conversation_id: Optional[str] = Query(None),
    report_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """获取日报数量统计"""
    collection = get_reports_collection()
    query = {}
    if conversation_id:
        query["conversation_id"] = conversation_id
    if report_date:
        query["report_date"] = report_date
    count = collection.count_documents(query)
    return {"count": count}


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str, current_user: str = Depends(get_current_user)):
    """获取单条日报详情"""
    collection = get_reports_collection()
    try:
        doc = collection.find_one({"_id": ObjectId(report_id)})
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的日报 ID")

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="日报不存在")

    return serialize_report(doc)


@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: str,
    update_data: ReportUpdate,
    current_user: str = Depends(get_current_user),
):
    """更新日报（主要用于人工修正解析结果）"""
    collection = get_reports_collection()
    try:
        obj_id = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的日报 ID")

    update_dict = {k: v for k, v in update_data.model_dump(exclude_unset=True).items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="没有提供更新数据")

    update_dict["updated_at"] = datetime.utcnow()

    result = collection.update_one({"_id": obj_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="日报不存在")

    doc = collection.find_one({"_id": obj_id})
    return serialize_report(doc)


@router.delete("/{report_id}")
async def delete_report(report_id: str, current_user: str = Depends(get_current_user)):
    """删除日报"""
    collection = get_reports_collection()
    try:
        obj_id = ObjectId(report_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的日报 ID")

    result = collection.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="日报不存在")

    return {"message": "日报已删除"}


@router.get("/export/csv")
async def export_reports_csv(
    conversation_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """导出日报为 CSV 格式"""
    collection = get_reports_collection()
    query = {}
    if conversation_id:
        query["conversation_id"] = conversation_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["report_date"] = date_query

    cursor = collection.find(query).sort("created_at", -1)

    # 获取群聊名称映射
    groups_col = get_groups_collection()
    group_map = {g["conversation_id"]: g.get("name", "未知群聊") for g in groups_col.find()}

    # 生成 CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "日报ID", "日期", "群聊", "发送人", "发送人ID",
        "今日工作", "明日计划", "遇到的问题", "工作时长", "备注",
        "解析状态", "创建时间"
    ])

    for doc in cursor:
        parsed = doc.get("parsed_content", {})
        writer.writerow([
            str(doc["_id"]),
            doc.get("report_date", ""),
            group_map.get(doc.get("conversation_id", ""), "未知群聊"),
            doc.get("sender_name", ""),
            doc.get("sender_staff_id", ""),
            parsed.get("today_work", ""),
            parsed.get("tomorrow_plan", ""),
            parsed.get("problems", ""),
            parsed.get("work_hours", ""),
            parsed.get("remarks", ""),
            doc.get("parse_status", ""),
            doc.get("created_at", "").isoformat() if isinstance(doc.get("created_at"), datetime) else "",
        ])

    output.seek(0)
    filename = f"reports_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
