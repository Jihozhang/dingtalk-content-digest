"""群内容统计路由：基于 messages 集合的多维聚合。

所有按天/按小时的分组均使用东八区(+08:00)时区，日期入参格式 YYYY-MM-DD。
"""
import re
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from collections import Counter

from fastapi import APIRouter, Depends, Query

from app.routers.auth import get_current_user
from app.services.mongo_client import get_messages_collection, get_groups_collection

router = APIRouter(prefix="/content", tags=["群内容统计"])

CN_TZ = timezone(timedelta(hours=8))
TZ_STR = "+08:00"

# 轻量中文停用词（用于关键词统计）
STOPWORDS = {
    "的", "了", "是", "我", "你", "他", "她", "它", "们", "这", "那", "有", "在",
    "和", "就", "都", "而", "及", "与", "着", "或", "一个", "没有", "我们", "你们",
    "他们", "自己", "这个", "那个", "什么", "怎么", "可以", "这样", "那样", "已经",
    "还是", "但是", "所以", "因为", "如果", "现在", "今天", "明天", "一下", "一些",
    "这些", "那些", "不是", "就是", "还有", "然后", "OK", "ok", "好的", "谢谢",
}


def _date_to_ms(date_str: str, end: bool = False) -> int:
    """将 YYYY-MM-DD 按东八区转换为毫秒时间戳。"""
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=CN_TZ)
    if end:
        dt = dt.replace(hour=23, minute=59, second=59, microsecond=999000)
    return int(dt.timestamp() * 1000)


def _build_match(
    conversation_id: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> dict:
    """构建时间/群聊过滤条件。默认最近 30 天。"""
    match: dict = {}
    if conversation_id:
        match["conversation_id"] = conversation_id

    if not end_date:
        end_date = datetime.now(CN_TZ).strftime("%Y-%m-%d")
    if not start_date:
        start = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start.strftime("%Y-%m-%d")

    match["create_time"] = {
        "$gte": _date_to_ms(start_date),
        "$lte": _date_to_ms(end_date, end=True),
    }
    return match


@router.get("/overview")
async def content_overview(
    conversation_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """内容概览：总消息数、活跃用户数、今日消息数、覆盖天数。"""
    col = get_messages_collection()
    match = _build_match(conversation_id, start_date, end_date)

    total_messages = col.count_documents(match)
    active_users = len(col.distinct("sender_staff_id", match))

    today = datetime.now(CN_TZ).strftime("%Y-%m-%d")
    today_match = dict(match)
    today_match["create_time"] = {
        "$gte": _date_to_ms(today),
        "$lte": _date_to_ms(today, end=True),
    }
    today_messages = col.count_documents(today_match)

    # 覆盖天数
    day_docs = list(col.aggregate([
        {"$match": match},
        {"$group": {"_id": {"$dateToString": {
            "format": "%Y-%m-%d", "date": {"$toDate": "$create_time"}, "timezone": TZ_STR}}}},
        {"$count": "days"},
    ]))
    active_days = day_docs[0]["days"] if day_docs else 0

    return {
        "total_messages": total_messages,
        "active_users": active_users,
        "today_messages": today_messages,
        "active_days": active_days,
        "avg_messages_per_day": round(total_messages / active_days, 1) if active_days else 0,
    }


@router.get("/volume")
async def message_volume(
    conversation_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """按天消息量趋势。"""
    col = get_messages_collection()
    match = _build_match(conversation_id, start_date, end_date)

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$toDate": "$create_time"}, "timezone": TZ_STR}},
            "message_count": {"$sum": 1},
            "users": {"$addToSet": "$sender_staff_id"},
        }},
        {"$project": {
            "message_count": 1,
            "active_users": {"$size": "$users"},
        }},
        {"$sort": {"_id": 1}},
    ]
    results = list(col.aggregate(pipeline))
    return [
        {"date": r["_id"], "message_count": r["message_count"], "active_users": r["active_users"]}
        for r in results
    ]


@router.get("/active-hours")
async def active_hours(
    conversation_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """24 小时活跃时段分布（东八区）。"""
    col = get_messages_collection()
    match = _build_match(conversation_id, start_date, end_date)

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": {"$hour": {"date": {"$toDate": "$create_time"}, "timezone": TZ_STR}},
            "message_count": {"$sum": 1},
        }},
    ]
    counts = {r["_id"]: r["message_count"] for r in col.aggregate(pipeline)}
    return [{"hour": h, "message_count": counts.get(h, 0)} for h in range(24)]


@router.get("/participants")
async def participants(
    conversation_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    current_user: str = Depends(get_current_user),
):
    """成员参与度排名。"""
    col = get_messages_collection()
    match = _build_match(conversation_id, start_date, end_date)

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$sender_staff_id",
            "sender_name": {"$last": "$sender_name"},
            "message_count": {"$sum": 1},
            "last_message_time": {"$max": "$create_time"},
            "days": {"$addToSet": {"$dateToString": {
                "format": "%Y-%m-%d", "date": {"$toDate": "$create_time"}, "timezone": TZ_STR}}},
        }},
        {"$project": {
            "sender_name": 1,
            "message_count": 1,
            "last_message_time": 1,
            "active_days": {"$size": "$days"},
        }},
        {"$sort": {"message_count": -1}},
        {"$limit": limit},
    ]
    results = list(col.aggregate(pipeline))
    return [
        {
            "sender_staff_id": r["_id"] or "",
            "sender_name": r.get("sender_name") or "未知用户",
            "message_count": r["message_count"],
            "active_days": r["active_days"],
            "last_message_time": r.get("last_message_time"),
        }
        for r in results
    ]


def _tokenize(text: str) -> List[str]:
    """轻量分词：英文按词，中文按 2-gram 切分。"""
    tokens: List[str] = []
    # 英文单词（长度>=2）
    for w in re.findall(r"[a-zA-Z]{2,}", text):
        tokens.append(w.lower())
    # 中文连续片段
    for run in re.findall(r"[\u4e00-\u9fff]+", text):
        if len(run) == 1:
            continue
        for i in range(len(run) - 1):
            tokens.append(run[i:i + 2])
    return tokens


@router.get("/keywords")
async def keywords(
    conversation_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    sample_size: int = Query(2000, ge=100, le=10000, description="参与分词的最大消息条数"),
    current_user: str = Depends(get_current_user),
):
    """高频关键词统计（轻量分词，非精确）。"""
    col = get_messages_collection()
    match = _build_match(conversation_id, start_date, end_date)

    cursor = col.find(match, {"text": 1}).sort("create_time", -1).limit(sample_size)
    counter: Counter = Counter()
    for doc in cursor:
        for tok in _tokenize(doc.get("text", "")):
            if tok in STOPWORDS:
                continue
            counter[tok] += 1

    return [{"word": w, "count": c} for w, c in counter.most_common(limit)]


@router.get("/group-activity")
async def group_activity(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    current_user: str = Depends(get_current_user),
):
    """各群活跃度对比。"""
    col = get_messages_collection()
    groups_col = get_groups_collection()
    match = _build_match(None, start_date, end_date)

    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$conversation_id",
            "message_count": {"$sum": 1},
            "users": {"$addToSet": "$sender_staff_id"},
            "last_message_time": {"$max": "$create_time"},
        }},
        {"$project": {
            "message_count": 1,
            "active_users": {"$size": "$users"},
            "last_message_time": 1,
        }},
        {"$sort": {"message_count": -1}},
    ]
    results = list(col.aggregate(pipeline))

    # 群名映射
    name_map = {
        g["conversation_id"]: g.get("name", "未知群聊")
        for g in groups_col.find({}, {"conversation_id": 1, "name": 1})
    }

    return [
        {
            "conversation_id": r["_id"],
            "group_name": name_map.get(r["_id"], f"群聊-{str(r['_id'])[-8:]}"),
            "message_count": r["message_count"],
            "active_users": r["active_users"],
            "last_message_time": r.get("last_message_time"),
        }
        for r in results
    ]
