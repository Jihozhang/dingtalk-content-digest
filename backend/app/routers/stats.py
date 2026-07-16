from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query

from app.models.report import DailyStats, GroupStats, UserStats
from app.routers.auth import get_current_user
from app.services.mongo_client import get_reports_collection, get_groups_collection, get_users_collection

router = APIRouter(prefix="/stats", tags=["统计报表"])


@router.get("/daily")
async def get_daily_stats(
    start_date: Optional[str] = Query(None, description="开始日期 (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="结束日期 (YYYY-MM-DD)"),
    current_user: str = Depends(get_current_user),
):
    """获取每日日报统计"""
    collection = get_reports_collection()

    # 默认最近 30 天
    if not end_date:
        end_date = datetime.utcnow().strftime("%Y-%m-%d")
    if not start_date:
        start = datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=30)
        start_date = start.strftime("%Y-%m-%d")

    pipeline = [
        {
            "$match": {
                "report_date": {"$gte": start_date, "$lte": end_date}
            }
        },
        {
            "$group": {
                "_id": "$report_date",
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
    current_user: str = Depends(get_current_user),
):
    """获取各群聊日报统计"""
    reports_col = get_reports_collection()
    groups_col = get_groups_collection()
    users_col = get_users_collection()

    # 获取所有群聊
    groups = list(groups_col.find({"is_active": True}))

    stats = []
    for group in groups:
        conv_id = group["conversation_id"]
        total_reports = reports_col.count_documents({"conversation_id": conv_id})

        # 估算成员数（从 users 集合中统计）
        member_count = users_col.count_documents({"group_ids": conv_id})

        # 计算提交率（最近 7 天）
        week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
        recent_reports = reports_col.count_documents({
            "conversation_id": conv_id,
            "report_date": {"$gte": week_ago}
        })
        submission_rate = round((recent_reports / max(member_count, 1)) * 100, 2) if member_count > 0 else 0

        stats.append(GroupStats(
            group_id=str(group["_id"]),
            group_name=group.get("name", "未知群聊"),
            total_reports=total_reports,
            member_count=member_count,
            submission_rate=submission_rate,
        ))

    return stats


@router.get("/users")
async def get_user_stats(
    conversation_id: Optional[str] = Query(None, description="按群聊筛选"),
    current_user: str = Depends(get_current_user),
):
    """获取员工活跃度统计"""
    reports_col = get_reports_collection()
    users_col = get_users_collection()

    query = {}
    if conversation_id:
        query["group_ids"] = conversation_id

    users = list(users_col.find(query))

    stats = []
    for user in users:
        staff_id = user["staff_id"]
        total_reports = reports_col.count_documents({"sender_staff_id": staff_id})
        success_parse_count = reports_col.count_documents({
            "sender_staff_id": staff_id,
            "parse_status": "success"
        })

        # 获取最近提交日期
        last_report = reports_col.find_one(
            {"sender_staff_id": staff_id},
            sort=[("report_date", -1)]
        )
        last_report_date = last_report["report_date"] if last_report else None

        # 计算活跃天数（有记录的不同日期数）和消息数
        active_days = len(reports_col.distinct("report_date", {"sender_staff_id": staff_id}))
        message_count = reports_col.count_documents({"sender_staff_id": staff_id})

        stats.append(UserStats(
            staff_id=staff_id,
            name=user.get("name", "未知用户"),
            total_reports=total_reports,
            success_parse_count=success_parse_count,
            last_report_date=last_report_date,
            message_count=message_count,
            active_days=active_days,
        ))

    # 按提交数量排序
    stats.sort(key=lambda x: x.total_reports, reverse=True)
    return stats


@router.get("/overview")
async def get_overview_stats(
    current_user: str = Depends(get_current_user),
):
    """获取概览统计"""
    reports_col = get_reports_collection()
    groups_col = get_groups_collection()
    users_col = get_users_collection()

    today = datetime.utcnow().strftime("%Y-%m-%d")
    week_ago = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")

    total_reports = reports_col.count_documents({})
    today_reports = reports_col.count_documents({"report_date": today})
    week_reports = reports_col.count_documents({"report_date": {"$gte": week_ago}})
    pending_parses = reports_col.count_documents({"parse_status": "pending"})
    success_parses = reports_col.count_documents({"parse_status": "success"})
    failed_parses = reports_col.count_documents({"parse_status": "failed"})

    total_groups = groups_col.count_documents({"is_active": True})
    total_users = users_col.count_documents({})

    return {
        "total_reports": total_reports,
        "today_reports": today_reports,
        "week_reports": week_reports,
        "pending_parses": pending_parses,
        "success_parses": success_parses,
        "failed_parses": failed_parses,
        "total_groups": total_groups,
        "total_users": total_users,
    }
