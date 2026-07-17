from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from app.models.report import DailyStats, GroupStats, UserStats
from app.routers.auth import get_current_user
from app.services.mongo_client import (
    get_data_records_collection,
    get_groups_collection,
    get_users_collection,
    get_templates_collection,
)

router = APIRouter(prefix="/stats", tags=["统计报表"])


@router.get("/daily")
async def get_daily_stats(
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    template_id: Optional[str] = Query(None, description="按模板筛选"),
    current_user: str = Depends(get_current_user),
):
    """获取每日数据记录统计（支持按模板筛选）"""
    collection = get_data_records_collection()

    # 默认最近 30 天
    if not end_date:
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
    if not start_date:
        start = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start.strftime("%Y-%m-%d")

    match_stage = {
        "record_date": {"$gte": start_date, "$lte": end_date}
    }
    if template_id:
        match_stage["template_id"] = template_id

    pipeline = [
        {"$match": match_stage},
        {
            "$group": {
                "_id": "$record_date",
                "total_reports": {"$sum": 1},
                "success_parse_count": {
                    "$sum": {"$cond": [{"$eq": ["$parse_status", "success"]}, 1, 0]}
                },
                "failed_parse_count": {
                    "$sum": {"$cond": [{"$eq": ["$parse_status", "failed"]}, 1, 0]}
                },
            }
        },
        {"$sort": {"_id": 1}},
    ]

    results = list(collection.aggregate(pipeline))
    return [
        DailyStats(
            date=r["_id"],
            total_reports=r["total_reports"],
            success_parse_count=r.get("success_parse_count", 0),
            failed_parse_count=r.get("failed_parse_count", 0),
        )
        for r in results
    ]


@router.get("/groups")
async def get_group_stats(
    template_id: Optional[str] = Query(None, description="按模板筛选"),
    current_user: str = Depends(get_current_user),
):
    """获取各群聊数据记录统计"""
    records_col = get_data_records_collection()
    groups_col = get_groups_collection()
    users_col = get_users_collection()

    # 获取所有群聊
    groups = list(groups_col.find({"is_active": True}))

    stats = []
    for group in groups:
        conv_id = group["conversation_id"]
        query = {"conversation_id": conv_id}
        if template_id:
            query["template_id"] = template_id

        total_reports = records_col.count_documents(query)

        # 估算成员数
        member_count = users_col.count_documents({"group_ids": conv_id})

        # 计算提交率（最近 7 天）
        week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
        recent_query = {**query, "record_date": {"$gte": week_ago}}
        recent_reports = records_col.count_documents(recent_query)
        submission_rate = round((recent_reports / max(member_count, 1)) * 100, 2) if member_count > 0 else 0

        # 获取绑定的模板名称
        template_names = []
        for tid in group.get("template_ids", []):
            t = get_templates_collection().find_one({"_id": __import__("bson").ObjectId(tid)})
            if t:
                template_names.append(t.get("name", ""))

        stats.append({
            "group_id": str(group["_id"]),
            "group_name": group.get("name", "未知群聊"),
            "total_reports": total_reports,
            "member_count": member_count,
            "submission_rate": submission_rate,
            "template_names": template_names,
        })

    return stats


@router.get("/users")
async def get_user_stats(
    conversation_id: Optional[str] = Query(None, description="按群聊筛选"),
    template_id: Optional[str] = Query(None, description="按模板筛选"),
    current_user: str = Depends(get_current_user),
):
    """获取员工活跃度统计"""
    records_col = get_data_records_collection()
    users_col = get_users_collection()

    query = {}
    if conversation_id:
        query["group_ids"] = conversation_id

    users = list(users_col.find(query))

    stats = []
    for user in users:
        staff_id = user["staff_id"]
        record_query = {"sender_staff_id": staff_id}
        if template_id:
            record_query["template_id"] = template_id

        total_reports = records_col.count_documents(record_query)
        success_parse_count = records_col.count_documents({
            **record_query,
            "parse_status": "success"
        })

        # 获取最近提交日期
        last_record = records_col.find_one(
            record_query,
            sort=[("record_date", -1)]
        )
        last_report_date = last_record["record_date"] if last_record else None

        # 计算活跃天数和消息数
        active_days = len(records_col.distinct("record_date", record_query))
        message_count = total_records = records_col.count_documents(record_query)

        stats.append({
            "staff_id": staff_id,
            "name": user.get("name", "未知用户"),
            "total_reports": total_reports,
            "success_parse_count": success_parse_count,
            "last_report_date": last_report_date,
            "message_count": message_count,
            "active_days": active_days,
        })

    # 按提交数量排序
    stats.sort(key=lambda x: x["total_reports"], reverse=True)
    return stats


@router.get("/overview")
async def get_overview_stats(
    current_user: str = Depends(get_current_user),
):
    """获取概览统计"""
    records_col = get_data_records_collection()
    groups_col = get_groups_collection()
    users_col = get_users_collection()
    templates_col = get_templates_collection()

    today = datetime.utcnow().strftime("%Y-%m-%d")
    week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")

    total_records = records_col.count_documents({})
    today_records = records_col.count_documents({"record_date": today})
    week_records = records_col.count_documents({"record_date": {"$gte": week_ago}})
    pending_parses = records_col.count_documents({"parse_status": "pending"})
    success_parses = records_col.count_documents({"parse_status": "success"})
    failed_parses = records_col.count_documents({"parse_status": "failed"})

    total_groups = groups_col.count_documents({"is_active": True})
    total_users = users_col.count_documents({})
    total_templates = templates_col.count_documents({"is_active": True})

    # 按模板统计
    template_pipeline = [
        {"$group": {
            "_id": "$template_id",
            "template_name": {"$first": "$template_name"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"count": -1}},
    ]
    template_stats = list(records_col.aggregate(template_pipeline))

    return {
        "total_records": total_records,
        "today_records": today_records,
        "week_records": week_records,
        "pending_parses": pending_parses,
        "success_parses": success_parses,
        "failed_parses": failed_parses,
        "total_groups": total_groups,
        "total_users": total_users,
        "total_templates": total_templates,
        "template_stats": template_stats,
    }


@router.get("/templates")
async def get_template_stats(
    current_user: str = Depends(get_current_user),
):
    """获取各模板统计"""
    records_col = get_data_records_collection()
    templates_col = get_templates_collection()

    templates = list(templates_col.find({"is_active": True}))

    stats = []
    for template in templates:
        template_id = str(template["_id"])
        total = records_col.count_documents({"template_id": template_id})
        success = records_col.count_documents({"template_id": template_id, "parse_status": "success"})
        failed = records_col.count_documents({"template_id": template_id, "parse_status": "failed"})

        # 最近7天
        week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
        week_count = records_col.count_documents({
            "template_id": template_id,
            "record_date": {"$gte": week_ago}
        })

        stats.append({
            "template_id": template_id,
            "template_name": template.get("name", "未命名"),
            "total_records": total,
            "success_count": success,
            "failed_count": failed,
            "week_count": week_count,
            "field_count": len(template.get("fields", [])),
        })

    return stats
