import re
from typing import Optional
from app.models.report import ParsedContent, ReportCreate


class ReportParser:
    """日报解析器：使用规则引擎 + 正则表达式从自由文本中提取日报字段"""

    # 关键词模式（支持多种中文表达）
    KEYWORDS = {
        "today_work": [
            r"今日工作[：:]?\s*(.*?)(?=明日计划|明天计划|明日安排|遇到的问题|问题|风险|工作时长|工时|备注|$)",
            r"今天完成[：:]?\s*(.*?)(?=明日计划|明天计划|明日安排|遇到的问题|问题|风险|工作时长|工时|备注|$)",
            r"今日完成[：:]?\s*(.*?)(?=明日计划|明天计划|明日安排|遇到的问题|问题|风险|工作时长|工时|备注|$)",
        ],
        "tomorrow_plan": [
            r"明日计划[：:]?\s*(.*?)(?=遇到的问题|问题|风险|工作时长|工时|备注|$)",
            r"明天计划[：:]?\s*(.*?)(?=遇到的问题|问题|风险|工作时长|工时|备注|$)",
            r"明日安排[：:]?\s*(.*?)(?=遇到的问题|问题|风险|工作时长|工时|备注|$)",
            r"下一步[：:]?\s*(.*?)(?=遇到的问题|问题|风险|工作时长|工时|备注|$)",
        ],
        "problems": [
            r"遇到[的]?问题[：:]?\s*(.*?)(?=工作时长|工时|备注|$)",
            r"问题[：:]?\s*(.*?)(?=工作时长|工时|备注|$)",
            r"风险[：:]?\s*(.*?)(?=工作时长|工时|备注|$)",
            r"困难[：:]?\s*(.*?)(?=工作时长|工时|备注|$)",
            r"阻碍[：:]?\s*(.*?)(?=工作时长|工时|备注|$)",
        ],
        "work_hours": [
            r"工作时长[：:]?\s*(\d+(?:\.\d+)?)\s*[小时h]?",
            r"工时[：:]?\s*(\d+(?:\.\d+)?)\s*[小时h]?",
            r"工作\s*(\d+(?:\.\d+)?)\s*[小时h]",
            r"(\d+(?:\.\d+)?)\s*[小时h]\s*工作",
        ],
        "remarks": [
            r"备注[：:]?\s*(.*?)$",
            r"其他[：:]?\s*(.*?)$",
            r"补充[：:]?\s*(.*?)$",
        ],
    }

    @classmethod
    def parse(cls, text: str) -> ParsedContent:
        """解析日报文本，提取结构化字段"""
        result = ParsedContent()

        # 提取今日工作内容
        result.today_work = cls._extract_field(text, "today_work")

        # 提取明日计划
        result.tomorrow_plan = cls._extract_field(text, "tomorrow_plan")

        # 提取遇到的问题
        result.problems = cls._extract_field(text, "problems")

        # 提取工作时长
        result.work_hours = cls._extract_hours(text)

        # 提取备注
        result.remarks = cls._extract_field(text, "remarks")

        return result

    @classmethod
    def _extract_field(cls, text: str, field_name: str) -> str:
        """根据字段名使用正则表达式提取内容"""
        patterns = cls.KEYWORDS.get(field_name, [])
        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
            if match:
                content = match.group(1).strip()
                # 清理多余的换行和空格
                content = re.sub(r"\s+", " ", content)
                return content
        return ""

    @classmethod
    def _extract_hours(cls, text: str) -> Optional[float]:
        """提取工作时长"""
        patterns = cls.KEYWORDS.get("work_hours", [])
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1))
                except (ValueError, IndexError):
                    continue
        return None

    @classmethod
    def is_report_like(cls, text: str) -> bool:
        """判断文本是否像日报内容"""
        # 检查是否包含至少一个日报关键词
        report_keywords = [
            "今日", "今天", "明日", "明天", "工作", "计划", "完成",
            "进度", "项目", "任务", "问题", "风险", "工时", "小时"
        ]
        text_lower = text.lower()
        keyword_count = sum(1 for kw in report_keywords if kw in text_lower)
        return keyword_count >= 2

    @classmethod
    def create_report(cls, text: str, conversation_id: str, sender_staff_id: str,
                      sender_name: str = "", message_id: str = None) -> ReportCreate:
        """从消息文本创建日报记录"""
        parsed = cls.parse(text)
        parse_status = "success" if cls.is_report_like(text) else "failed"

        return ReportCreate(
            raw_content=text,
            parsed_content=parsed,
            parse_status=parse_status,
            conversation_id=conversation_id,
            sender_staff_id=sender_staff_id,
            sender_name=sender_name,
            message_id=message_id,
        )
