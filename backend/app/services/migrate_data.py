import asyncio
from datetime import datetime
from bson import ObjectId

from app.services.mongo_client import get_db, get_reports_collection, get_templates_collection, get_data_records_collection
from app.models.template import TemplateField, TemplateCreate, TemplateInDB


async def migrate_reports_to_data_records():
    """将旧 reports 数据迁移到 data_records"""
    db = get_db()
    reports_col = db.reports
    data_records_col = db.data_records
    templates_col = db.templates

    # 1. 检查是否有旧数据需要迁移
    old_reports_count = reports_col.count_documents({})
    if old_reports_count == 0:
        print("[Migration] No old reports to migrate")
        return

    print(f"[Migration] Found {old_reports_count} old reports to migrate")

    # 2. 创建默认"日报"模板
    daily_template = templates_col.find_one({"name": "日报"})
    if not daily_template:
        template_doc = {
            "name": "日报",
            "description": "默认日报模板（兼容旧数据）",
            "keywords": ["日报", "今日", "明天", "工作"],
            "fields": [
                {
                    "name": "today_work",
                    "label": "今日工作内容",
                    "field_type": "text",
                    "required": False,
                    "options": [],
                    "description": "",
                    "keywords": ["今日", "今天", "工作"],
                    "default_value": ""
                },
                {
                    "name": "tomorrow_plan",
                    "label": "明日计划",
                    "field_type": "text",
                    "required": False,
                    "options": [],
                    "description": "",
                    "keywords": ["明日", "明天", "计划"],
                    "default_value": ""
                },
                {
                    "name": "problems",
                    "label": "遇到的问题/风险",
                    "field_type": "text",
                    "required": False,
                    "options": [],
                    "description": "",
                    "keywords": ["问题", "风险", "困难"],
                    "default_value": ""
                },
                {
                    "name": "work_hours",
                    "label": "工作时长",
                    "field_type": "number",
                    "required": False,
                    "options": [],
                    "description": "",
                    "keywords": ["时长", "小时", "工时"],
                    "default_value": ""
                },
                {
                    "name": "remarks",
                    "label": "其他备注",
                    "field_type": "text",
                    "required": False,
                    "options": [],
                    "description": "",
                    "keywords": ["备注", "其他"],
                    "default_value": ""
                },
            ],
            "conversation_ids": [],
            "is_active": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        result = templates_col.insert_one(template_doc)
        template_id = str(result.inserted_id)
        print(f"[Migration] Created default '日报' template: {template_id}")
    else:
        template_id = str(daily_template["_id"])
        print(f"[Migration] Using existing '日报' template: {template_id}")

    # 3. 迁移数据
    migrated = 0
    skipped = 0
    for report in reports_col.find({}):
        # 检查是否已迁移
        existing = data_records_col.find_one({"message_id": report.get("message_id")})
        if existing:
            skipped += 1
            continue

        # 将旧 parsed_content 转换为 parsed_data
        parsed_content = report.get("parsed_content", {})
        parsed_data = {}
        if parsed_content:
            parsed_data = {
                "today_work": parsed_content.get("today_work", ""),
                "tomorrow_plan": parsed_content.get("tomorrow_plan", ""),
                "problems": parsed_content.get("problems", ""),
                "work_hours": str(parsed_content.get("work_hours", "")) if parsed_content.get("work_hours") else "",
                "remarks": parsed_content.get("remarks", ""),
            }

        record_doc = {
            "template_id": template_id,
            "template_name": "日报",
            "conversation_id": report.get("conversation_id", ""),
            "sender_staff_id": report.get("sender_staff_id", ""),
            "sender_name": report.get("sender_name", ""),
            "raw_content": report.get("raw_content", ""),
            "parsed_data": parsed_data,
            "parse_status": report.get("parse_status", "pending"),
            "message_id": report.get("message_id"),
            "record_date": report.get("report_date", datetime.utcnow().strftime("%Y-%m-%d")),
            "created_at": report.get("created_at", datetime.utcnow()),
        }
        data_records_col.insert_one(record_doc)
        migrated += 1

    print(f"[Migration] Complete: {migrated} migrated, {skipped} skipped")


if __name__ == "__main__":
    asyncio.run(migrate_reports_to_data_records())
