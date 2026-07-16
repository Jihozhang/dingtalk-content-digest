import threading
import time
from datetime import datetime
from typing import Optional

from app.config import get_settings
from app.models.ai_summary import AISummaryTaskCreate, AISummaryTaskInDB, AIReportItem
from app.services.mongo_client import get_db
from app.services.dingtalk_chat import get_chat_client
from app.services.ai_parser import get_ai_parser
from app.services.message_handler import handle_incoming_message

_settings = get_settings()


class AISummarizer:
    """AI 汇总任务协调器"""

    def __init__(self):
        self._lock = threading.Lock()

    def create_task(self, task_data: AISummaryTaskCreate) -> str:
        """创建汇总任务，返回任务 ID"""
        db = get_db()
        task = AISummaryTaskInDB(
            conversation_id=task_data.conversation_id,
            start_date=task_data.start_date,
            end_date=task_data.end_date,
            task_name=task_data.task_name,
            status="pending",
        )
        task_dict = task.model_dump()
        task_dict["created_at"] = datetime.utcnow()
        result = db.ai_summaries.insert_one(task_dict)
        task_id = str(result.inserted_id)

        # 启动后台线程处理任务
        thread = threading.Thread(
            target=self._process_task,
            args=(task_id, task_data.conversation_id, task_data.start_date, task_data.end_date),
            daemon=True,
        )
        thread.start()

        return task_id

    def _process_task(self, task_id: str, conversation_id: str, start_date: str, end_date: str):
        """后台处理汇总任务"""
        db = get_db()

        # 更新状态为处理中
        db.ai_summaries.update_one(
            {"_id": __import__("bson").ObjectId(task_id)},
            {"$set": {"status": "processing", "updated_at": datetime.utcnow()}},
        )

        try:
            # 1. 获取群聊历史消息
            chat_client = get_chat_client()

            # 转换日期为时间戳（毫秒）
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            start_time_ms = int(start_dt.timestamp() * 1000)
            end_time_ms = int((end_dt.replace(hour=23, minute=59, second=59)).timestamp() * 1000)

            messages = chat_client.get_chat_messages(
                conversation_id=conversation_id,
                start_time=start_time_ms,
                end_time=end_time_ms,
                max_results=500,
            )

            # 获取群成员映射
            members = chat_client.get_group_members(conversation_id)
            for msg in messages:
                staff_id = msg.get("sender_staff_id", "")
                if staff_id in members:
                    msg["sender_name"] = members[staff_id]

            if not messages:
                db.ai_summaries.update_one(
                    {"_id": __import__("bson").ObjectId(task_id)},
                    {
                        "$set": {
                            "status": "completed",
                            "completed_at": datetime.utcnow(),
                            "raw_message_count": 0,
                            "generated_reports": [],
                        }
                    },
                )
                return

            # 2. 调用 AI 解析
            ai_parser = get_ai_parser()
            parsed_reports = ai_parser.parse_chat_messages(messages)

            # 转换为 AIReportItem 列表
            report_items = []
            for report in parsed_reports:
                item = AIReportItem(
                    sender_name=report.get("sender_name", ""),
                    sender_staff_id=report.get("sender_staff_id", ""),
                    today_work=report.get("today_work", ""),
                    tomorrow_plan=report.get("tomorrow_plan", ""),
                    problems=report.get("problems", ""),
                    work_hours=report.get("work_hours"),
                    remarks=report.get("remarks", ""),
                    applied=False,
                )
                report_items.append(item)

            # 3. 更新任务状态为完成
            db.ai_summaries.update_one(
                {"_id": __import__("bson").ObjectId(task_id)},
                {
                    "$set": {
                        "status": "completed",
                        "completed_at": datetime.utcnow(),
                        "raw_message_count": len(messages),
                        "generated_reports": [r.model_dump() for r in report_items],
                    }
                },
            )

            print(f"[AI Summarizer] Task {task_id} completed with {len(report_items)} reports")

        except Exception as e:
            print(f"[AI Summarizer] Task {task_id} failed: {e}")
            import traceback
            traceback.print_exc()

            db.ai_summaries.update_one(
                {"_id": __import__("bson").ObjectId(task_id)},
                {
                    "$set": {
                        "status": "failed",
                        "completed_at": datetime.utcnow(),
                        "error_message": str(e),
                    }
                },
            )

    def apply_reports(self, task_id: str, report_indices: Optional[list] = None) -> int:
        """
        将 AI 生成的日报应用到正式日报表

        Args:
            task_id: 任务 ID
            report_indices: 要入库的报告索引列表，None 表示全部入库

        Returns:
            成功入库的数量
        """
        db = get_db()
        task = db.ai_summaries.find_one({"_id": __import__("bson").ObjectId(task_id)})
        if not task:
            raise ValueError("任务不存在")

        if task["status"] != "completed":
            raise ValueError("任务未完成，无法入库")

        reports = task.get("generated_reports", [])
        applied_count = 0

        for i, report in enumerate(reports):
            if report_indices is not None and i not in report_indices:
                continue

            if report.get("applied", False):
                continue

            try:
                handle_incoming_message(
                    text_content=self._build_raw_content(report),
                    conversation_id=task["conversation_id"],
                    sender_staff_id=report.get("sender_staff_id", f"ai-user-{i}"),
                    sender_name=report.get("sender_name", "AI解析用户"),
                    message_id=f"ai-{task_id}-{i}",
                )

                # 标记为已入库
                report["applied"] = True
                applied_count += 1

            except Exception as e:
                print(f"[AI Summarizer] Apply report {i} failed: {e}")

        # 更新任务中的 applied 状态
        db.ai_summaries.update_one(
            {"_id": __import__("bson").ObjectId(task_id)},
            {"$set": {"generated_reports": reports}},
        )

        return applied_count

    def _build_raw_content(self, report: dict) -> str:
        """从 AI 解析结果构建原始消息内容"""
        parts = []
        if report.get("today_work"):
            parts.append(f"今日工作：{report['today_work']}")
        if report.get("tomorrow_plan"):
            parts.append(f"明日计划：{report['tomorrow_plan']}")
        if report.get("problems"):
            parts.append(f"遇到的问题：{report['problems']}")
        if report.get("work_hours") is not None:
            parts.append(f"工作时长：{report['work_hours']}小时")
        if report.get("remarks"):
            parts.append(f"备注：{report['remarks']}")
        return "\n".join(parts)


# 全局单例
_summarizer: Optional[AISummarizer] = None


def get_summarizer() -> AISummarizer:
    global _summarizer
    if _summarizer is None:
        _summarizer = AISummarizer()
    return _summarizer
