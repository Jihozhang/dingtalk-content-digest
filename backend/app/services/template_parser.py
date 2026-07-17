import json
import re
from typing import Optional, List, Dict, Any
from datetime import datetime

from app.config import get_settings
from app.models.template import Template, TemplateField, TemplateMatchResult
from app.services.mongo_client import get_templates_collection

_settings = get_settings()


class TemplateParser:
    """模板解析器：根据关键词匹配模板，使用 AI 按模板解析消息"""

    def __init__(self):
        self._templates_cache: Optional[List[Template]] = None
        self._cache_time: Optional[datetime] = None
        self._cache_ttl_seconds = 60  # 缓存60秒

    def _get_active_templates(self) -> List[Template]:
        """获取所有启用的模板（带缓存）"""
        now = datetime.utcnow()
        if (
            self._templates_cache is not None
            and self._cache_time is not None
            and (now - self._cache_time).total_seconds() < self._cache_ttl_seconds
        ):
            return self._templates_cache

        col = get_templates_collection()
        docs = list(col.find({"is_active": True}))
        templates = []
        for doc in docs:
            doc_id = str(doc.pop("_id", ""))
            doc["id"] = doc_id
            try:
                templates.append(Template(**doc))
            except Exception:
                continue

        self._templates_cache = templates
        self._cache_time = now
        return templates

    def match_template(self, text: str, conversation_id: str) -> Optional[TemplateMatchResult]:
        """
        根据关键词匹配模板
        
        匹配策略：
        1. 先按群聊绑定的模板过滤
        2. 再按模板关键词匹配
        3. 返回匹配度最高的模板
        """
        text_lower = text.lower()
        templates = self._get_active_templates()

        if not templates:
            return None

        candidates = []
        for template in templates:
            # 如果模板绑定了群聊，先检查群聊是否匹配
            if template.conversation_ids and conversation_id not in template.conversation_ids:
                continue

            # 计算匹配分数
            score = 0.0
            matched_keywords = []

            # 全局关键词匹配
            for kw in template.keywords:
                if kw.lower() in text_lower:
                    score += 0.3
                    matched_keywords.append(kw)

            # 字段关键词匹配
            for field in template.fields:
                for kw in field.keywords:
                    if kw.lower() in text_lower:
                        score += 0.2
                        matched_keywords.append(kw)

            # 字段标签匹配
            for field in template.fields:
                if field.label.lower() in text_lower:
                    score += 0.1

            if score > 0:
                candidates.append(TemplateMatchResult(
                    template_id=str(template.id) if hasattr(template, 'id') else "",
                    template_name=template.name,
                    match_score=score,
                    matched_keywords=list(set(matched_keywords)),
                ))

        if not candidates:
            return None

        # 返回匹配度最高的
        candidates.sort(key=lambda x: x.match_score, reverse=True)
        best = candidates[0]

        # 阈值检查
        threshold = float(getattr(_settings, 'TEMPLATE_MATCH_THRESHOLD', 0.3))
        if best.match_score < threshold:
            return None

        return best

    def parse_with_template(self, text: str, template: Template) -> Dict[str, Any]:
        """
        使用 DeepSeek AI 按模板字段解析消息
        
        如果 DeepSeek API 未配置，使用简单的规则解析
        """
        # 尝试使用 AI 解析
        if _settings.DEEPSEEK_API_KEY:
            try:
                return self._parse_with_ai(text, template)
            except Exception as e:
                print(f"[TemplateParser] AI parse failed: {e}, fallback to rule-based")

        # 回退到规则解析
        return self._parse_with_rules(text, template)

    def _parse_with_ai(self, text: str, template: Template) -> Dict[str, Any]:
        """使用 DeepSeek AI 解析"""
        from openai import OpenAI

        client = OpenAI(
            api_key=_settings.DEEPSEEK_API_KEY,
            base_url=_settings.DEEPSEEK_API_BASE or "https://api.deepseek.com",
        )

        # 构建字段描述
        fields_desc = []
        for i, field in enumerate(template.fields, 1):
            required = "必填" if field.required else "选填"
            options = f"，选项: {', '.join(field.options)}" if field.options else ""
            desc = f"{i}. {field.label} ({field.name}) - {required}{options}"
            if field.description:
                desc += f" - {field.description}"
            fields_desc.append(desc)

        prompt = f"""你是一个专业的数据提取助手。请从以下消息中提取指定字段，输出 JSON 格式。

模板名称：{template.name}

需要提取的字段：
{chr(10).join(fields_desc)}

消息内容：
{text}

要求：
1. 按字段名称（name）作为 JSON 键
2. 如果字段未提及，值为空字符串 ""
3. 对于 select 类型，必须从选项中选择一个
4. 对于 number 类型，只输出数字
5. 对于 date 类型，输出 YYYY-MM-DD 格式
6. 不要添加任何解释，只输出 JSON

输出格式：
{{"字段名1": "值1", "字段名2": "值2", ...}}"""

        response = client.chat.completions.create(
            model=_settings.DEEPSEEK_MODEL or "deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一个数据提取助手，只输出 JSON 格式数据。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=2000,
        )

        content = response.choices[0].message.content

        # 提取 JSON
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        # 如果 JSON 解析失败，回退到规则解析
        return self._parse_with_rules(text, template)

    def _parse_with_rules(self, text: str, template: Template) -> Dict[str, Any]:
        """使用规则解析（回退方案）"""
        result = {}

        for field in template.fields:
            value = ""

            # 尝试按字段标签匹配
            patterns = [
                rf'{field.label}[：:]\s*(.+?)(?:\n|$)',  # 标签：值
                rf'{field.label}\s*(.+?)(?:\n|$)',  # 标签 值
            ]

            # 添加关键词匹配
            for kw in field.keywords:
                patterns.append(rf'{kw}[：:]\s*(.+?)(?:\n|$)')
                patterns.append(rf'{kw}\s*(.+?)(?:\n|$)')

            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    value = match.group(1).strip()
                    break

            # 类型转换
            if field.field_type == "number" and value:
                try:
                    value = float(value)
                except ValueError:
                    value = 0
            elif field.field_type == "boolean" and value:
                value = value.lower() in ["是", "yes", "true", "1", "有"]

            result[field.name] = value

        return result

    def build_reply(self, template: Template, parsed_data: Dict[str, Any]) -> str:
        """构建确认回复消息"""
        lines = [f"已记录「{template.name}」"]

        for field in template.fields:
            value = parsed_data.get(field.name, "")
            if not value and field.required:
                value = "未填写（必填）"
            elif not value:
                value = "未填写"

            lines.append(f"• {field.label}: {value}")

        return "\n".join(lines)


# 全局单例
_template_parser: Optional[TemplateParser] = None


def get_template_parser() -> TemplateParser:
    global _template_parser
    if _template_parser is None:
        _template_parser = TemplateParser()
    return _template_parser
