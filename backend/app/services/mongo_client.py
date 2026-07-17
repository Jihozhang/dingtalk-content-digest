import os
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database
from pymongo.collection import Collection
from app.config import get_settings

_settings = get_settings()

# Global client and db references
_client: MongoClient = None
_db: Database = None


def get_mongo_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(_settings.MONGODB_URI, maxPoolSize=50, minPoolSize=5)
    return _client


def get_db() -> Database:
    global _db
    if _db is None:
        client = get_mongo_client()
        _db = client[_settings.MONGODB_DB_NAME]
        _ensure_indexes(_db)
    return _db


def _ensure_indexes(db: Database):
    """创建必要的索引以优化查询性能"""
    # reports 集合索引
    reports: Collection = db.reports
    reports.create_index([("conversation_id", ASCENDING), ("report_date", DESCENDING)])
    reports.create_index([("sender_staff_id", ASCENDING), ("report_date", DESCENDING)])
    reports.create_index([("report_date", DESCENDING)])
    reports.create_index([("parse_status", ASCENDING)])

    # data_records 集合索引（替代 reports，通用数据记录）
    data_records: Collection = db.data_records
    data_records.create_index([("conversation_id", ASCENDING), ("record_date", DESCENDING)])
    data_records.create_index([("template_id", ASCENDING), ("record_date", DESCENDING)])
    data_records.create_index([("sender_staff_id", ASCENDING), ("record_date", DESCENDING)])
    data_records.create_index([("record_date", DESCENDING)])
    data_records.create_index([("parse_status", ASCENDING)])

    # templates 集合索引（问卷模板）
    templates: Collection = db.templates
    templates.create_index([("is_active", ASCENDING)])
    templates.create_index([("conversation_ids", ASCENDING)])
    templates.create_index([("created_at", DESCENDING)])

    # groups 集合索引（增加 template_ids 字段）
    groups: Collection = db.groups
    groups.create_index([("conversation_id", ASCENDING)], unique=True)
    groups.create_index([("project_id", ASCENDING)])
    groups.create_index([("template_ids", ASCENDING)])

    # users 集合索引
    users: Collection = db.users
    users.create_index([("staff_id", ASCENDING)], unique=True)
    users.create_index([("group_ids", ASCENDING)])

    # ai_summaries 集合索引
    ai_summaries: Collection = db.ai_summaries
    ai_summaries.create_index([("conversation_id", ASCENDING), ("created_at", DESCENDING)])
    ai_summaries.create_index([("status", ASCENDING)])
    ai_summaries.create_index([("created_at", DESCENDING)])

    # messages 集合索引（全量群消息）
    messages: Collection = db.messages
    messages.create_index([("conversation_id", ASCENDING), ("create_time", DESCENDING)])
    messages.create_index([("message_id", ASCENDING)], unique=True, sparse=True)
    messages.create_index([("sender_staff_id", ASCENDING)])

    # digests 集合索引（定时智能汇总）
    digests: Collection = db.digests
    digests.create_index([("conversation_id", ASCENDING), ("created_at", DESCENDING)])
    digests.create_index([("period_type", ASCENDING)])
    digests.create_index([("created_at", DESCENDING)])


def close_mongo_client():
    global _client
    if _client:
        _client.close()
        _client = None


# 便捷获取集合的函数
def get_data_records_collection() -> Collection:
    return get_db().data_records


def get_templates_collection() -> Collection:
    return get_db().templates


def get_reports_collection() -> Collection:
    """兼容旧代码，返回 data_records 集合"""
    return get_db().data_records


def get_groups_collection() -> Collection:
    return get_db().groups


def get_users_collection() -> Collection:
    return get_db().users


def get_messages_collection() -> Collection:
    return get_db().messages


def get_digests_collection() -> Collection:
    return get_db().digests
