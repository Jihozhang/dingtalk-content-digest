import json
import re
from typing import Optional, List
from openai import OpenAI

from app.config import get_settings

_settings = get_settings()


class AIReportParser:
    """基于 DeepSeek 大模型的日报智能解析器"""

    SYSTEM_PROMPT = """你是一位专业的日报整理助手。请将以下群聊聊天记录按员工整理为结构化日报。

要求：
1. 按员工分组，每人一条日报
2. 提取以下字段：
   - today_work: 今日工作内容（综合该员工所有工作相关发言）
   - tomorrow_plan: 明日计划（如有提及）
   - problems: 遇到的问题/困难（如有提及）
   - work_hours: 工作时长（数字，小时，如无明确提及则填 null）
   - remarks: 备注/其他信息
3. 如果某员工没有明确提到某字段，该字段留空字符串""
4. 工作时长统一为数字（小时），如"8小时"提取为8
5. 只输出 JSON 格式，不要任何解释性文字

输出格式：
{
  "reports": [
    {
      "sender_name": "员工姓名",
      "sender_staff_id": "员工ID",
      "today_work": "...",
      "tomorrow_plan": "...",
      "problems": "...",
      "work_hours": 8,
      "remarks": "..."
    }
  ]
}"""

    def __init__(self):
        self.client = OpenAI(
            api_key=_settings.DEEPSEEK_API_KEY,
            base_url=_settings.DEEPSEEK_API_BASE,
        )
        self.model = _settings.DEEPSEEK_MODEL

    def parse_chat_messages(self, messages: List[dict]) -> List[dict]:
        """使用 DeepSeek 解析群聊消息，生成结构化日报"""
        if not _settings.DEEPSEEK_API_KEY:
            raise ValueError("DeepSeek API Key 未配置")

        if not messages:
            return []

        # 格式化聊天记录
        chat_text = self._format_messages(messages)

        # 调用 DeepSeek API
        try:
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

        except Exception as e:
            print(f"[AI Parser] DeepSeek API error: {e}")
            raise

    def _format_messages(self, messages: List[dict]) -> str:
        """将消息列表格式化为文本"""
        lines = []
        for msg in messages:
            sender = msg.get("sender_name", "未知用户")
            text = msg.get("text", "")
            time = msg.get("create_time", "")
            lines.append(f"[{time}] {sender}: {text}")
        return "\n".join(lines)

    def _extract_json(self, content: str) -> List[dict]:
        """从 AI 响应中提取 JSON 数据"""
        # 尝试直接解析
        try:
            data = json.loads(content)
            if "reports" in data:
                return data["reports"]
            return data if isinstance(data, list) else []
        except json.JSONDecodeError:
            pass

        # 尝试从 markdown 代码块中提取
        code_block_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
        matches = re.findall(code_block_pattern, content)
        for match in matches:
            try:
                data = json.loads(match.strip())
                if "reports" in data:
                    return data["reports"]
                return data if isinstance(data, list) else []
            except json.JSONDecodeError:
                continue

        # 尝试从文本中提取 JSON 对象
        json_pattern = r'\{[\s\S]*\}'
        matches = re.findall(json_pattern, content)
        for match in matches:
            try:
                data = json.loads(match)
                if "reports" in data:
                    return data["reports"]
                return data if isinstance(data, list) else []
            except json.JSONDecodeError:
                continue

        print(f"[AI Parser] Failed to extract JSON from: {content[:200]}")
        return []


# 全局单例
_ai_parser: Optional[AIReportParser] = None


def get_ai_parser() -> AIReportParser:
    global _ai_parser
    if _ai_parser is None:
        _ai_parser = AIReportParser()
    return _ai_parser
