"""定时智能汇总服务：读取群消息 -> DeepSeek 生成结构化摘要 -> 写入 digests。"""
import json
import re
import threading
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from bson import ObjectId
from openai import OpenAI

from app.config import get_settings
from app.models.digest import DigestInDB
from app.services.mongo_client import get_messages_collection, get_digests_collection, get_groups_collection

_settings = get_settings()

CN_TZ = timezone(timedelta(hours=8))


def _date_to_ms(date_str: str, end: bool = False) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=CN_TZ)
    if end:
        dt = dt.replace(hour=23, minute=59, second=59, microsecond=999000)
    return int(dt.timestamp() * 1000)


class AIDigestGenerator:
    """群内容智能汇总生成器"""

    SYSTEM_PROMPT = """你是一位专业的团队沟通分析助手。请阅读以下群聊聊天记录，输出该时间段的群内容汇总。

要求：
1. overview: 用 2-4 句话概括本时段群内讨论的整体情况
2. hot_topics: 提炼 3-6 个热点话题，每个包含 title(话题标题) 和 summary(话题摘要)
3. todos: 提取需要跟进的待办事项，每个包含 content(事项) 和 owner(负责人，如无则留空)
4. risks: 列出讨论中暴露的问题、风险或阻塞（字符串数组，如无则空数组）
5. key_conclusions: 列出达成的关键结论或决定（字符串数组，如无则空数组）
6. 只输出 JSON，不要任何解释性文字

输出格式：
{
  "overview": "...",
  "hot_topics": [{"title": "...", "summary": "..."}],
  "todos": [{"content": "...", "owner": "..."}],
  "risks": ["..."],
  "key_conclusions": ["..."]
}"""

    def __init__(self):
        self.client = OpenAI(
            api_key=_settings.DEEPSEEK_API_KEY,
            base_url=_settings.DEEPSEEK_API_BASE,
        )
        self.model = _settings.DEEPSEEK_MODEL

    # ---------- 对外入口 ----------

    def create_and_run(self, conversation_id: str, start_date: str, end_date: str,
                       period_type: str = "custom") -> str:
        """创建汇总任务并在后台线程处理，返回 digest_id。"""
        digest_id = self._create_pending(conversation_id, start_date, end_date, period_type)
        thread = threading.Thread(
            target=self._process,
            args=(digest_id, conversation_id, start_date, end_date),
            daemon=True,
        )
        thread.start()
        return digest_id

    def run_sync(self, conversation_id: str, start_date: str, end_date: str,
                 period_type: str = "daily") -> str:
        """同步生成汇总（供调度器调用），返回 digest_id。"""
        digest_id = self._create_pending(conversation_id, start_date, end_date, period_type)
        self._process(digest_id, conversation_id, start_date, end_date)
        return digest_id

    # ---------- 内部逻辑 ----------

    def _create_pending(self, conversation_id: str, start_date: str, end_date: str,
                        period_type: str) -> str:
        db_col = get_digests_collection()
        group = get_groups_collection().find_one({"conversation_id": conversation_id})
        group_name = group.get("name", "") if group else ""

        digest = DigestInDB(
            conversation_id=conversation_id,
            period_type=period_type,
            start_date=start_date,
            end_date=end_date,
            status="pending",
            group_name=group_name,
        )
        doc = digest.model_dump(by_alias=True)
        doc.pop("_id", None)
        result = db_col.insert_one(doc)
        return str(result.inserted_id)

    def _process(self, digest_id: str, conversation_id: str, start_date: str, end_date: str):
        db_col = get_digests_collection()
        oid = ObjectId(digest_id)
        db_col.update_one({"_id": oid}, {"$set": {"status": "processing", "updated_at": datetime.utcnow()}})

        try:
            messages = self._fetch_messages(conversation_id, start_date, end_date)

            if not messages:
                db_col.update_one({"_id": oid}, {"$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow(),
                    "raw_message_count": 0,
                    "overview": "该时间段内无群聊消息记录。",
                }})
                return

            result = self._summarize(messages)

            update = {
                "status": "completed",
                "completed_at": datetime.utcnow(),
                "raw_message_count": len(messages),
                "overview": result.get("overview", ""),
                "hot_topics": result.get("hot_topics", []),
                "todos": result.get("todos", []),
                "risks": result.get("risks", []),
                "key_conclusions": result.get("key_conclusions", []),
            }
            db_col.update_one({"_id": oid}, {"$set": update})
            print(f"[AI Digest] Task {digest_id} completed with {len(messages)} messages")

            # 可选：回推到群
            if _settings.DIGEST_PUSH_TO_GROUP:
                self._push_to_group(digest_id, conversation_id, update)

        except Exception as e:
            print(f"[AI Digest] Task {digest_id} failed: {e}")
            import traceback
            traceback.print_exc()
            db_col.update_one({"_id": oid}, {"$set": {
                "status": "failed",
                "completed_at": datetime.utcnow(),
                "error_message": str(e),
            }})

    def _fetch_messages(self, conversation_id: str, start_date: str, end_date: str) -> List[dict]:
        col = get_messages_collection()
        cursor = col.find({
            "conversation_id": conversation_id,
            "create_time": {
                "$gte": _date_to_ms(start_date),
                "$lte": _date_to_ms(end_date, end=True),
            },
        }).sort("create_time", 1).limit(1000)
        return list(cursor)

    def _summarize(self, messages: List[dict]) -> dict:
        if not _settings.DEEPSEEK_API_KEY:
            raise ValueError("DeepSeek API Key 未配置")

        chat_text = self._format_messages(messages)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": f"聊天记录：\n{chat_text}"},
            ],
            temperature=0.3,
            max_tokens=4000,
        )
        content = response.choices[0].message.content
        return self._extract_json(content)

    def _format_messages(self, messages: List[dict]) -> str:
        lines = []
        for msg in messages:
            sender = msg.get("sender_name") or msg.get("sender_staff_id") or "未知用户"
            text = msg.get("text", "")
            ct = msg.get("create_time", 0)
            try:
                ts = datetime.fromtimestamp(int(ct) / 1000, CN_TZ).strftime("%m-%d %H:%M")
            except Exception:
                ts = ""
            lines.append(f"[{ts}] {sender}: {text}")
        return "\n".join(lines)

    def _extract_json(self, content: str) -> dict:
        # 直接解析
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        # markdown 代码块
        for match in re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", content):
            try:
                return json.loads(match.strip())
            except json.JSONDecodeError:
                continue
        # 花括号片段
        for match in re.findall(r"\{[\s\S]*\}", content):
            try:
                return json.loads(match)
            except json.JSONDecodeError:
                continue
        print(f"[AI Digest] Failed to extract JSON from: {content[:200]}")
        return {"overview": content[:500], "hot_topics": [], "todos": [], "risks": [], "key_conclusions": []}

    def _push_to_group(self, digest_id: str, conversation_id: str, data: dict):
        try:
            from app.services.dingtalk_chat import get_chat_client
            text = self._build_push_text(data)
            ok = get_chat_client().send_group_message(conversation_id, text)
            if ok:
                get_digests_collection().update_one(
                    {"_id": ObjectId(digest_id)}, {"$set": {"pushed": True}}
                )
        except Exception as e:
            print(f"[AI Digest] Push to group failed: {e}")

    def _build_push_text(self, data: dict) -> str:
        parts = ["📊 群内容智能汇总", "", data.get("overview", "")]
        topics = data.get("hot_topics", [])
        if topics:
            parts.append("\n🔥 热点话题：")
            for t in topics:
                parts.append(f"· {t.get('title', '')}：{t.get('summary', '')}")
        todos = data.get("todos", [])
        if todos:
            parts.append("\n✅ 待办事项：")
            for t in todos:
                owner = f"（{t.get('owner')}）" if t.get("owner") else ""
                parts.append(f"· {t.get('content', '')}{owner}")
        risks = data.get("risks", [])
        if risks:
            parts.append("\n⚠️ 风险/问题：")
            for r in risks:
                parts.append(f"· {r}")
        return "\n".join(parts)


# 全局单例
_digest_generator: Optional[AIDigestGenerator] = None


def get_digest_generator() -> AIDigestGenerator:
    global _digest_generator
    if _digest_generator is None:
        _digest_generator = AIDigestGenerator()
    return _digest_generator
