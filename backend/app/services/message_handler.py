from datetime import datetime
from typing import Optional
import asyncio

from pymongo import ReturnDocument

from app.services.template_parser import get_template_parser
from app.services.mongo_client import (
    get_data_records_collection,
    get_groups_collection,
    get_users_collection,
    get_messages_collection,
    get_templates_collection,
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
            "template_ids": [],
            "default_template_id": "",
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


def handle_incoming_message(
    text_content: str,
    conversation_id: str,
    sender_staff_id: str,
    sender_name: str,
    message_id: str,
):
    """
    处理接收到的消息：
    1. 保存原始消息到 messages
    2. 尝试匹配模板
    3. 统一保存到 data_records（所有消息都进数据管理）
    4. 匹配模板的消息异步 AI 解析
    5. 返回确认回复
    """
    # 1. 保存原始消息
    store_message(
        conversation_id=conversation_id,
        sender_staff_id=sender_staff_id,
        sender_name=sender_name,
        text=text_content,
        message_id=message_id,
    )

    # 2. 尝试匹配模板
    parser = get_template_parser()
    match_result = parser.match_template(text_content, conversation_id)

    if not match_result:
        # 未匹配模板：保存为 unmatched
        try:
            records_col = get_data_records_collection()
            record_doc = {
                "template_id": "",
                "template_name": "未匹配模板",
                "conversation_id": conversation_id,
                "sender_staff_id": sender_staff_id,
                "sender_name": sender_name,
                "raw_content": text_content,
                "parsed_data": {},
                "parse_status": "unmatched",
                "ai_parse_enabled": False,
                "message_id": message_id,
                "record_date": datetime.utcnow().strftime("%Y-%m-%d"),
                "created_at": datetime.utcnow(),
            }
            records_col.insert_one(record_doc)
            print(f"[MessageHandler] Unmatched message saved from {sender_name}")
        except Exception as e:
            print(f"[MessageHandler] Error saving unmatched record: {e}")
        return None

    # 3. 获取模板详情
    templates_col = get_templates_collection()
    try:
        from bson import ObjectId
        template_doc = templates_col.find_one({"_id": ObjectId(match_result.template_id)})
    except Exception:
        print(f"[MessageHandler] Failed to get template {match_result.template_id}")
        return None

    if not template_doc:
        return None

    from app.models.template import Template
    template_doc["_id"] = str(template_doc["_id"])
    template = Template(**template_doc)

    # 4. 保存数据记录（pending 状态，等待解析）
    try:
        records_col = get_data_records_collection()
        record_doc = {
            "template_id": match_result.template_id,
            "template_name": template.name,
            "conversation_id": conversation_id,
            "sender_staff_id": sender_staff_id,
            "sender_name": sender_name,
            "raw_content": text_content,
            "parsed_data": {},
            "parse_status": "pending",
            "ai_parse_enabled": False,
            "message_id": message_id,
            "record_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "created_at": datetime.utcnow(),
        }
        result = records_col.insert_one(record_doc)
        record_id = str(result.inserted_id)
        print(f"[MessageHandler] Data record saved (pending) from {sender_name} using template '{template.name}'")

        # 5. 触发异步 AI 解析
        asyncio.create_task(_async_parse_record(record_id, text_content, template))

    except Exception as e:
        print(f"[MessageHandler] Error saving data record: {e}")

    # 6. 构建回复（简洁确认）
    return "已记录"


async def _async_parse_record(record_id: str, text_content: str, template):
    """异步解析数据记录"""
    parser = get_template_parser()
    records_col = get_data_records_collection()

    try:
        # 执行 AI 解析（在线程池中运行阻塞调用）
        parsed_data = await asyncio.to_thread(parser.parse_with_template, text_content, template)

        # 更新记录状态
        from bson import ObjectId
        records_col.update_one(
            {"_id": ObjectId(record_id)},
            {"$set": {
                "parsed_data": parsed_data,
                "parse_status": "success" if parsed_data else "failed",
                "ai_parse_enabled": True,
                "updated_at": datetime.utcnow(),
            }}
        )
        print(f"[MessageHandler] Async parse success for record {record_id}")
    except Exception as e:
        # 解析失败
        from bson import ObjectId
        records_col.update_one(
            {"_id": ObjectId(record_id)},
            {"$set": {
                "parse_status": "failed",
                "error_message": str(e),
                "updated_at": datetime.utcnow(),
            }}
        )
        print(f"[MessageHandler] Async parse failed for record {record_id}: {e}")


def save_data_record(
    template_id: str,
    template_name: str,
    conversation_id: str,
    sender_staff_id: str,
    sender_name: str,
    raw_content: str,
    parsed_data: dict,
    parse_status: str = "success",
    message_id: Optional[str] = None,
):
    """手动保存数据记录"""
    records_col = get_data_records_collection()
    record_doc = {
        "template_id": template_id,
        "template_name": template_name,
        "conversation_id": conversation_id,
        "sender_staff_id": sender_staff_id,
        "sender_name": sender_name,
        "raw_content": raw_content,
        "parsed_data": parsed_data,
        "parse_status": parse_status,
        "message_id": message_id,
        "record_date": datetime.utcnow().strftime("%Y-%m-%d"),
        "created_at": datetime.utcnow(),
    }
    result = records_col.insert_one(record_doc)
    return str(result.inserted_id)
