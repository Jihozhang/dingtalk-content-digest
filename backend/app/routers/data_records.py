from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
import csv
import io
import json

from app.models.template import DataRecordCreate, DataRecordUpdate, DataRecordResponse
from app.routers.auth import get_current_user
from app.services.mongo_client import get_data_records_collection
from app.config import get_settings

router = APIRouter(prefix="/data-records", tags=["数据记录"])

settings = get_settings()


def serialize_data_record(doc: dict) -> dict:
    """序列化数据记录文档"""
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("", response_model=List[DataRecordResponse])
async def list_data_records(
    template_id: Optional[str] = Query(None),
    conversation_id: Optional[str] = Query(None),
    sender_staff_id: Optional[str] = Query(None),
    record_date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    parse_status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: str = Depends(get_current_user),
):
    """获取数据记录列表"""
    col = get_data_records_collection()
    query = {}

    if template_id:
        query["template_id"] = template_id
    if conversation_id:
        query["conversation_id"] = conversation_id
    if sender_staff_id:
        query["sender_staff_id"] = sender_staff_id
    if parse_status:
        query["parse_status"] = parse_status

    # 日期范围查询
    if record_date:
        query["record_date"] = record_date
    elif start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["record_date"] = date_query

    skip = (page - 1) * page_size
    cursor = col.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    return [serialize_data_record(doc) for doc in cursor]


@router.post("", response_model=DataRecordResponse)
async def create_data_record(
    record_data: DataRecordCreate,
    current_user: str = Depends(get_current_user),
):
    """创建数据记录（通常由消息处理器自动调用）"""
    col = get_data_records_collection()

    record_dict = record_data.model_dump()
    record_dict["created_at"] = datetime.utcnow()
    record_dict["record_date"] = datetime.utcnow().strftime("%Y-%m-%d")

    result = col.insert_one(record_dict)
    doc = col.find_one({"_id": result.inserted_id})
    return serialize_data_record(doc)


@router.get("/export")
async def export_data_records(
    template_id: Optional[str] = Query(None),
    conversation_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """导出数据记录为 CSV"""
    col = get_data_records_collection()
    query = {}

    if template_id:
        query["template_id"] = template_id
    if conversation_id:
        query["conversation_id"] = conversation_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["record_date"] = date_query

    records = list(col.find(query).sort("created_at", -1))

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有数据可导出",
        )

    # 收集所有字段名
    all_fields = set()
    for r in records:
        all_fields.update(r.get("parsed_data", {}).keys())
    all_fields = sorted(all_fields)

    # 生成 CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # 表头
    headers = ["记录ID", "模板", "群聊", "发送人", "记录日期", "解析状态", "原始内容"] + all_fields
    writer.writerow(headers)

    # 数据行
    for r in records:
        parsed = r.get("parsed_data", {})
        row = [
            str(r.get("_id", "")),
            r.get("template_name", ""),
            r.get("conversation_id", ""),
            r.get("sender_name", r.get("sender_staff_id", "")),
            r.get("record_date", ""),
            r.get("parse_status", ""),
            r.get("raw_content", ""),
        ]
        for f in all_fields:
            row.append(parsed.get(f, ""))
        writer.writerow(row)

    output.seek(0)
    filename = f"data_records_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/export/raw")
async def export_raw_messages(
    template_id: Optional[str] = Query(None),
    conversation_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """导出原始消息为 CSV（不含解析字段）"""
    col = get_data_records_collection()
    query = {}

    if template_id:
        query["template_id"] = template_id
    if conversation_id:
        query["conversation_id"] = conversation_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["record_date"] = date_query

    records = list(col.find(query).sort("created_at", -1))

    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有数据可导出",
        )

    # 生成 CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # 表头
    headers = ["记录ID", "模板", "发送人", "记录日期", "解析状态", "原始内容"]
    writer.writerow(headers)

    # 数据行
    for r in records:
        row = [
            str(r.get("_id", "")),
            r.get("template_name", ""),
            r.get("sender_name", r.get("sender_staff_id", "")),
            r.get("record_date", ""),
            r.get("parse_status", ""),
            r.get("raw_content", ""),
        ]
        writer.writerow(row)

    output.seek(0)
    filename = f"raw_messages_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/stats/overview")
async def get_data_stats(
    template_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """获取数据统计概览"""
    col = get_data_records_collection()
    query = {}

    if template_id:
        query["template_id"] = template_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query["$gte"] = start_date
        if end_date:
            date_query["$lte"] = end_date
        query["record_date"] = date_query

    total = col.count_documents(query)
    success = col.count_documents({**query, "parse_status": "success"})
    failed = col.count_documents({**query, "parse_status": "failed"})
    pending = col.count_documents({**query, "parse_status": "pending"})

    # 按模板统计
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$template_id",
            "template_name": {"$first": "$template_name"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}},
    ]
    template_stats = list(col.aggregate(pipeline))

    # 按日期统计
    date_pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$record_date",
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    date_stats = list(col.aggregate(date_pipeline))

    # 未匹配统计
    unmatched = col.count_documents({**query, "parse_status": "unmatched"})

    return {
        "total": total,
        "success": success,
        "failed": failed,
        "pending": pending,
        "unmatched": unmatched,
        "template_stats": template_stats,
        "date_stats": date_stats,
    }


@router.get("/{record_id}", response_model=DataRecordResponse)
async def get_data_record(
    record_id: str,
    current_user: str = Depends(get_current_user),
):
    """获取单条数据记录"""
    col = get_data_records_collection()
    try:
        doc = col.find_one({"_id": ObjectId(record_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的记录 ID",
        )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="记录不存在",
        )

    return serialize_data_record(doc)


@router.put("/{record_id}", response_model=DataRecordResponse)
async def update_data_record(
    record_id: str,
    record_data: DataRecordUpdate,
    current_user: str = Depends(get_current_user),
):
    """更新数据记录"""
    col = get_data_records_collection()
    try:
        obj_id = ObjectId(record_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的记录 ID",
        )

    existing = col.find_one({"_id": obj_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="记录不存在",
        )

    update_fields = {}
    if record_data.parsed_data is not None:
        update_fields["parsed_data"] = record_data.parsed_data
    if record_data.parse_status is not None:
        update_fields["parse_status"] = record_data.parse_status

    if update_fields:
        col.update_one({"_id": obj_id}, {"$set": update_fields})

    doc = col.find_one({"_id": obj_id})
    return serialize_data_record(doc)


@router.delete("/{record_id}")
async def delete_data_record(
    record_id: str,
    current_user: str = Depends(get_current_user),
):
    """删除数据记录"""
    col = get_data_records_collection()
    try:
        obj_id = ObjectId(record_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的记录 ID",
        )

    result = col.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="记录不存在",
        )

    return {"message": "记录已删除"}


@router.post("/{record_id}/ai-parse")
async def ai_parse_record(
    record_id: str,
    current_user: str = Depends(get_current_user),
):
    """对未匹配模板的消息进行通用 AI 解析"""
    col = get_data_records_collection()

    try:
        obj_id = ObjectId(record_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的记录 ID",
        )

    record = col.find_one({"_id": obj_id})
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="记录不存在",
        )

    # 检查是否已解析成功
    if record.get("parse_status") == "success" and record.get("parsed_data"):
        return {
            "message": "记录已解析，无需重复解析",
            "parsed_data": record.get("parsed_data", {}),
        }

    # 调用通用 AI 解析
    try:
        parsed_data = await _general_ai_parse(record.get("raw_content", ""))

        # 更新记录
        col.update_one(
            {"_id": obj_id},
            {"$set": {
                "parsed_data": parsed_data,
                "parse_status": "success",
                "template_name": "AI 智能解析",
                "ai_parse_enabled": True,
                "updated_at": datetime.utcnow(),
            }}
        )

        return {
            "message": "AI 解析成功",
            "parsed_data": parsed_data,
        }
    except Exception as e:
        # 解析失败，更新状态
        col.update_one(
            {"_id": obj_id},
            {"$set": {
                "parse_status": "failed",
                "error_message": str(e),
                "updated_at": datetime.utcnow(),
            }}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI 解析失败: {str(e)}",
        )


async def _general_ai_parse(text: str) -> dict:
    """通用 AI 解析：不依赖模板，直接让 AI 从消息中提取结构化信息"""
    if not settings.DEEPSEEK_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DeepSeek API Key 未配置",
        )

    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        api_key=settings.DEEPSEEK_API_KEY,
        base_url=settings.DEEPSEEK_API_BASE or "https://api.deepseek.com",
    )

    prompt = f"""你是一个专业的数据提取助手。请分析以下消息，提取关键信息并以 JSON 格式输出。

尽量识别消息中的要素：时间、地点、人物、事件、数量、状态、物品、动作等。

消息内容：
{text}

要求：
1. 用中文作为 JSON 键名
2. 值为空字符串 "" 表示未识别到该要素
3. 对于时间，统一输出 YYYY-MM-DD 或 HH:MM 格式
4. 对于数量，只输出数字
5. 不要添加任何解释，只输出 JSON

输出格式：
{{"要素1": "值1", "要素2": "值2", ...}}"""

    response = await client.chat.completions.create(
        model=settings.DEEPSEEK_MODEL or "deepseek-chat",
        messages=[
            {"role": "system", "content": "你是一个数据提取助手，只输出 JSON 格式数据。"},
            {"role": "user", "content": prompt},
        ],
        temperature=0.1,
        max_tokens=2000,
    )

    content = response.choices[0].message.content

    # 提取 JSON
    import re
    json_match = re.search(r'\{{.*\}}', content, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # 如果 JSON 解析失败，返回原始内容
    return {"raw_parse_result": content}
