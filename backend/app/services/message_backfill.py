"""消息回填服务：通过钉钉漫游消息接口拉取历史消息，补全 messages 集合。

用于捕获机器人未实时收到（未被 @）的普通群聊内容。受钉钉「群消息读取」
权限与接口频控限制，若权限不足则该服务拉取不到数据，系统会退化为仅依赖
Stream 实时采集的消息。
"""
import time
from datetime import datetime, timedelta
from typing import Optional, List

from app.config import get_settings
from app.services.dingtalk_chat import get_chat_client
from app.services.message_handler import store_message
from app.services.mongo_client import get_groups_collection

_settings = get_settings()


def backfill_group(
    conversation_id: str,
    start_time_ms: Optional[int] = None,
    end_time_ms: Optional[int] = None,
    max_results: Optional[int] = None,
) -> dict:
    """
    回填单个群聊的历史消息。

    Returns:
        {"fetched": 拉取消息数, "inserted": 新增落库数}
    """
    chat_client = get_chat_client()
    max_results = max_results or _settings.BACKFILL_MAX_RESULTS

    # 默认回填最近 1 天
    if end_time_ms is None:
        end_time_ms = int(datetime.utcnow().timestamp() * 1000)
    if start_time_ms is None:
        start_time_ms = int((datetime.utcnow() - timedelta(days=1)).timestamp() * 1000)

    messages = chat_client.get_chat_messages(
        conversation_id=conversation_id,
        start_time=start_time_ms,
        end_time=end_time_ms,
        max_results=max_results,
    )

    # 群成员映射：staff_id -> name
    members = chat_client.get_group_members(conversation_id)

    inserted = 0
    for msg in messages:
        staff_id = msg.get("sender_staff_id", "")
        sender_name = members.get(staff_id, msg.get("sender_name", "")) if staff_id else msg.get("sender_name", "")
        create_time = msg.get("create_time", 0)
        try:
            create_time = int(create_time)
        except (TypeError, ValueError):
            create_time = 0

        ok = store_message(
            conversation_id=conversation_id,
            sender_staff_id=staff_id,
            sender_name=sender_name,
            text=msg.get("text", ""),
            create_time=create_time,
            message_id=msg.get("message_id") or None,
            msg_type="text",
            source="backfill",
        )
        if ok:
            inserted += 1

    return {"fetched": len(messages), "inserted": inserted}


def backfill_all_groups(
    start_time_ms: Optional[int] = None,
    end_time_ms: Optional[int] = None,
) -> dict:
    """回填所有激活群聊的历史消息。"""
    groups_col = get_groups_collection()
    groups: List[dict] = list(groups_col.find({"is_active": True}))

    total_fetched = 0
    total_inserted = 0
    group_results = []

    for group in groups:
        conv_id = group.get("conversation_id")
        if not conv_id:
            continue
        try:
            result = backfill_group(conv_id, start_time_ms, end_time_ms)
            total_fetched += result["fetched"]
            total_inserted += result["inserted"]
            group_results.append({"conversation_id": conv_id, **result})
        except Exception as e:
            print(f"[Backfill] Group {conv_id} failed: {e}")
            group_results.append({"conversation_id": conv_id, "error": str(e)})
        # 轻微限速，避免触发钉钉接口频控
        time.sleep(0.5)

    print(f"[Backfill] Done. groups={len(groups)} fetched={total_fetched} inserted={total_inserted}")
    return {
        "group_count": len(groups),
        "total_fetched": total_fetched,
        "total_inserted": total_inserted,
        "groups": group_results,
    }
