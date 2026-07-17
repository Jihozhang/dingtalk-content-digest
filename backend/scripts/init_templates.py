"""
初始化常用模板脚本
运行方式: python -m backend.scripts.init_templates
或在项目根目录: python backend/scripts/init_templates.py
"""

import asyncio
import sys
from pathlib import Path

# 添加 backend 到路径
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.mongo_client import get_templates_collection
from app.models.template import TemplateInDB
from datetime import datetime


# ==================== 预置模板定义 ====================

TEMPLATES = [
    {
        "name": "日报",
        "description": "每日工作汇报模板，记录今日工作、明日计划、遇到的问题等",
        "keywords": ["日报", "今日工作", "工作总结", "工作汇报"],
        "fields": [
            {
                "name": "today_work",
                "label": "今日工作",
                "field_type": "text",
                "required": True,
                "options": [],
                "description": "今天完成的主要工作内容",
                "keywords": ["今日", "今天", "完成", "做了"],
                "default_value": "",
            },
            {
                "name": "tomorrow_plan",
                "label": "明日计划",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "明天计划开展的工作",
                "keywords": ["明日", "明天", "计划", "打算"],
                "default_value": "",
            },
            {
                "name": "problems",
                "label": "遇到的问题",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "今天工作中遇到的困难或问题",
                "keywords": ["问题", "困难", "阻碍", "遇到"],
                "default_value": "",
            },
            {
                "name": "work_hours",
                "label": "工时",
                "field_type": "number",
                "required": False,
                "options": [],
                "description": "今日工作时长（小时）",
                "keywords": ["工时", "小时", "时长", "时间"],
                "default_value": "",
            },
            {
                "name": "remarks",
                "label": "备注",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "其他需要补充说明的内容",
                "keywords": ["备注", "补充", "其他"],
                "default_value": "",
            },
        ],
        "conversation_ids": [],
        "is_active": True,
    },
    {
        "name": "出库记录",
        "description": "物资出库登记模板，记录出库物品、数量、领用人等信息",
        "keywords": ["出库", "领用", "物资", "领取"],
        "fields": [
            {
                "name": "item_name",
                "label": "物品名称",
                "field_type": "text",
                "required": True,
                "options": [],
                "description": "出库物品的名称",
                "keywords": ["物品", "名称", "东西", "产品"],
                "default_value": "",
            },
            {
                "name": "quantity",
                "label": "数量",
                "field_type": "number",
                "required": True,
                "options": [],
                "description": "出库数量",
                "keywords": ["数量", "个数", "多少"],
                "default_value": "",
            },
            {
                "name": "unit",
                "label": "单位",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "计量单位（个/件/箱/千克等）",
                "keywords": ["单位", "个", "件", "箱"],
                "default_value": "个",
            },
            {
                "name": "recipient",
                "label": "领用人",
                "field_type": "text",
                "required": True,
                "options": [],
                "description": "领取物品的人员姓名",
                "keywords": ["领用人", "领取人", "申请人", "经手人"],
                "default_value": "",
            },
            {
                "name": "department",
                "label": "使用部门",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "物品使用部门",
                "keywords": ["部门", "使用", "所属"],
                "default_value": "",
            },
            {
                "name": "purpose",
                "label": "用途",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "物品使用目的或用途说明",
                "keywords": ["用途", "目的", "用于", "使用"],
                "default_value": "",
            },
            {
                "name": "out_date",
                "label": "出库日期",
                "field_type": "date",
                "required": False,
                "options": [],
                "description": "物品出库日期",
                "keywords": ["日期", "时间", "出库日期"],
                "default_value": "",
            },
        ],
        "conversation_ids": [],
        "is_active": True,
    },
    {
        "name": "入库记录",
        "description": "物资入库登记模板，记录入库物品、数量、供应商等信息",
        "keywords": ["入库", "采购", "进货", "收货"],
        "fields": [
            {
                "name": "item_name",
                "label": "物品名称",
                "field_type": "text",
                "required": True,
                "options": [],
                "description": "入库物品的名称",
                "keywords": ["物品", "名称", "东西", "产品"],
                "default_value": "",
            },
            {
                "name": "quantity",
                "label": "数量",
                "field_type": "number",
                "required": True,
                "options": [],
                "description": "入库数量",
                "keywords": ["数量", "个数", "多少"],
                "default_value": "",
            },
            {
                "name": "unit",
                "label": "单位",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "计量单位",
                "keywords": ["单位", "个", "件", "箱"],
                "default_value": "个",
            },
            {
                "name": "supplier",
                "label": "供应商",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "物品供应商名称",
                "keywords": ["供应商", "厂家", "来源"],
                "default_value": "",
            },
            {
                "name": "receiver",
                "label": "接收人",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "接收物品的人员",
                "keywords": ["接收人", "收货人", "验收人"],
                "default_value": "",
            },
            {
                "name": "in_date",
                "label": "入库日期",
                "field_type": "date",
                "required": False,
                "options": [],
                "description": "物品入库日期",
                "keywords": ["日期", "时间", "入库日期"],
                "default_value": "",
            },
            {
                "name": "remarks",
                "label": "备注",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "其他说明",
                "keywords": ["备注", "补充", "其他"],
                "default_value": "",
            },
        ],
        "conversation_ids": [],
        "is_active": True,
    },
    {
        "name": "请假申请",
        "description": "员工请假登记模板，记录请假类型、时间、原因等",
        "keywords": ["请假", "休假", "调休", "事假", "病假"],
        "fields": [
            {
                "name": "leave_type",
                "label": "请假类型",
                "field_type": "select",
                "required": True,
                "options": ["事假", "病假", "年假", "调休", "婚假", "产假", "丧假", "其他"],
                "description": "请假类型",
                "keywords": ["类型", "事假", "病假", "年假"],
                "default_value": "",
            },
            {
                "name": "start_date",
                "label": "开始日期",
                "field_type": "date",
                "required": True,
                "options": [],
                "description": "请假开始日期",
                "keywords": ["开始", "从", "日期"],
                "default_value": "",
            },
            {
                "name": "end_date",
                "label": "结束日期",
                "field_type": "date",
                "required": True,
                "options": [],
                "description": "请假结束日期",
                "keywords": ["结束", "到", "日期"],
                "default_value": "",
            },
            {
                "name": "days",
                "label": "请假天数",
                "field_type": "number",
                "required": False,
                "options": [],
                "description": "请假总天数",
                "keywords": ["天数", "几天", "多少天"],
                "default_value": "",
            },
            {
                "name": "reason",
                "label": "请假原因",
                "field_type": "text",
                "required": True,
                "options": [],
                "description": "请假原因说明",
                "keywords": ["原因", "理由", "因为"],
                "default_value": "",
            },
            {
                "name": "proxy",
                "label": "工作交接人",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "请假期间工作交接给谁",
                "keywords": ["交接", "代理人", "代班"],
                "default_value": "",
            },
        ],
        "conversation_ids": [],
        "is_active": True,
    },
    {
        "name": "报销申请",
        "description": "费用报销登记模板，记录报销项目、金额、票据等",
        "keywords": ["报销", "费用", "发票", "申请"],
        "fields": [
            {
                "name": "expense_type",
                "label": "费用类型",
                "field_type": "select",
                "required": True,
                "options": ["差旅费", "交通费", "餐饮费", "住宿费", "办公用品", "通讯费", "培训费", "其他"],
                "description": "报销费用类型",
                "keywords": ["类型", "费用", "差旅", "交通"],
                "default_value": "",
            },
            {
                "name": "amount",
                "label": "金额",
                "field_type": "number",
                "required": True,
                "options": [],
                "description": "报销金额（元）",
                "keywords": ["金额", "钱", "元", "费用"],
                "default_value": "",
            },
            {
                "name": "expense_date",
                "label": "消费日期",
                "field_type": "date",
                "required": False,
                "options": [],
                "description": "费用发生日期",
                "keywords": ["日期", "时间", "消费日期"],
                "default_value": "",
            },
            {
                "name": "description",
                "label": "费用说明",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "费用具体说明",
                "keywords": ["说明", "描述", "详情"],
                "default_value": "",
            },
            {
                "name": "has_invoice",
                "label": "是否有发票",
                "field_type": "boolean",
                "required": False,
                "options": [],
                "description": "是否提供发票",
                "keywords": ["发票", "票据", "凭证"],
                "default_value": "",
            },
            {
                "name": "invoice_number",
                "label": "发票号码",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "发票号码（如有）",
                "keywords": ["发票号", "号码", "票号"],
                "default_value": "",
            },
        ],
        "conversation_ids": [],
        "is_active": True,
    },
    {
        "name": "会议记录",
        "description": "会议纪要模板，记录会议主题、参会人、决议等",
        "keywords": ["会议", "纪要", "开会", "讨论"],
        "fields": [
            {
                "name": "topic",
                "label": "会议主题",
                "field_type": "text",
                "required": True,
                "options": [],
                "description": "会议主题或议题",
                "keywords": ["主题", "议题", "标题"],
                "default_value": "",
            },
            {
                "name": "meeting_date",
                "label": "会议日期",
                "field_type": "date",
                "required": False,
                "options": [],
                "description": "会议召开日期",
                "keywords": ["日期", "时间"],
                "default_value": "",
            },
            {
                "name": "attendees",
                "label": "参会人员",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "参会人员列表",
                "keywords": ["参会", "人员", "出席", "参加"],
                "default_value": "",
            },
            {
                "name": "content",
                "label": "会议内容",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "会议讨论的主要内容",
                "keywords": ["内容", "讨论", "议题"],
                "default_value": "",
            },
            {
                "name": "decisions",
                "label": "会议决议",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "会议达成的决议或结论",
                "keywords": ["决议", "结论", "决定", "结果"],
                "default_value": "",
            },
            {
                "name": "action_items",
                "label": "待办事项",
                "field_type": "text",
                "required": False,
                "options": [],
                "description": "会议确定的需要跟进的事项",
                "keywords": ["待办", "跟进", "行动", "任务"],
                "default_value": "",
            },
        ],
        "conversation_ids": [],
        "is_active": True,
    },
]


async def init_templates():
    """初始化预置模板"""
    col = get_templates_collection()

    created_count = 0
    skipped_count = 0

    for template_data in TEMPLATES:
        # 检查是否已存在同名模板
        existing = col.find_one({"name": template_data["name"]})
        if existing:
            print(f"  跳过（已存在）: {template_data['name']}")
            skipped_count += 1
            continue

        # 创建模板
        now = datetime.utcnow()
        doc = {
            **template_data,
            "created_at": now,
            "updated_at": now,
        }
        result = col.insert_one(doc)
        print(f"  创建成功: {template_data['name']} (id={result.inserted_id})")
        created_count += 1

    print(f"\n初始化完成: 新建 {created_count} 个模板, 跳过 {skipped_count} 个已存在模板")


if __name__ == "__main__":
    asyncio.run(init_templates())
