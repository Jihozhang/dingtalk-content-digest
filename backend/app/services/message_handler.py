from datetime import datetime
from typing import Optional

from pymongo import ReturnDocument

from app.services.report_parser import ReportParser
from app.services.mongo_client import (
    get_reports_collection,
    get_groups_collection,
    get_users_collection,
    get_messages_collection,
)


def ensure_group_and_user(conversation_id: str, sender_staff_id: str, sender_name: str):
    """确保群聊记录与用户记录存在（幂等 upsert）"""
    # 确保群聊记录存在
    groups_col = get_groups_collection()
    if not groups_col.find_one({"conversation_id": conversation_id}):
        groups_col.insert_one({
            "conversation_id": conversation_id,
            "name": f"群聊-{conversation_id[-8:]}",
            "project_name": None,
            "project_id": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "member_count": 0,
            "is_active": True,
        })

    # 确保用户记录存在
    if sender_staff_id:
        users_col = get_users_collection()
        users_col.update_one(
            {"staff_id": sender_staff_id},
            {
                "$set": {
                    "name": sender_name or f"用户-{sender_staff_id[-6:]}",
                    "staff_id": sender_staff_id,
                    "updated_at": datetime.utcnow(),
                },
                "$addToSet": {"group_ids": conversation_id},
                "$setOnInsert": {"created_at": datetime.utcnow()},
            },
            upsert=True,
        )


def store_message(
    conversation_id: str,
    sender_staff_id: str,
    sender_name: str,
    text: str,
    create_time: int = 0,
    message_id: Optional[str] = None,
    msg_type: str = "text",
    source: str = "stream",
) -> bool:
    """
    将一条群消息落库到 messages 集合（按 message_id 去重）。

    Returns:
        True 表示新插入，False 表示已存在或写入失败。
    """
    if not conversation_id or not text:
        return False

    try:
        messages_col = get_messages_collection()
        doc = {
            "conversation_id": conversation_id,
            "sender_staff_id": sender_staff_id or "",
            "sender_name": sender_name or "",
            "text": text,
            "msg_type": msg_type,
            "create_time": int(create_time) if create_time else int(datetime.utcnow().timestamp() * 1000),
            "message_id": message_id,
            "source": source,
        }

        if message_id:
            # 按 message_id 去重：不存在才插入
            result = messages_col.find_one_and_update(
                {"message_id": message_id},
                {
                    "$setOnInsert": {**doc, "created_at": datetime.utcnow()},
                },
                upsert=True,
                return_document=ReturnDocument.BEFORE,
            )
            inserted = result is None
        else:
            doc["created_at"] = datetime.utcnow()
            messages_col.insert_one(doc)
            inserted = True

        # 同步群聊/用户记录
        ensure_group_and_user(conversation_id, sender_staff_id, sender_name)
        return inserted

    except Exception as e:
        print(f"[MessageHandler] Error storing message: {e}")
        return False


def handle_incoming_message(text_content: str, conversation_id: str,
                            sender_staff_id: str, sender_name: str, message_id: str):
    """处理接收到的消息：解析日报并存储"""
    try:
        # 解析日报
        report = ReportParser.create_report(
            text=text_content,
            conversation_id=conversation_id,
            sender_staff_id=sender_staff_id,
            sender_name=sender_name,
            message_id=message_id,
        )

        # 存储到 MongoDB
        reports_col = get_reports_collection()
        report_dict = report.model_dump()
        report_dict["report_date"] = datetime.utcnow().strftime("%Y-%m-%d")
        report_dict["created_at"] = datetime.utcnow()
        reports_col.insert_one(report_dict)

        # 确保群聊与用户记录存在
        ensure_group_and_user(conversation_id, sender_staff_id, sender_name)

        print(f"[MessageHandler] Report saved from {sender_name} in group {conversation_id}")

    except Exception as e:
        print(f"[MessageHandler] Error handling message: {e}")
