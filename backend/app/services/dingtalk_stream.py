import threading
from typing import Optional

import dingtalk_stream
from dingtalk_stream import (
    DingTalkStreamClient,
    Credential,
    ChatbotHandler,
    ChatbotMessage,
    CallbackMessage,
    AckMessage,
)

from app.config import get_settings
from app.services.message_handler import handle_incoming_message, store_message

_settings = get_settings()


# 标准日报模板
DAILY_REPORT_TEMPLATE = """📋 日报标准模板

请按以下格式发送日报：

今日工作：
1. xxx
2. xxx

明日计划：
1. xxx
2. xxx

遇到的问题：
（如有请填写，没有填"无"）

工作时长：x小时

备注：
（其他补充信息）
"""


class DailyReportChatbotHandler(ChatbotHandler):
    """钉钉机器人消息处理器：接收群聊消息并解析日报"""

    def __init__(self):
        super().__init__()

    async def process(self, message: CallbackMessage):
        """处理接收到的 CallbackMessage"""
        print(f"[DingTalk Stream] Received CallbackMessage: topic={message.headers.topic}")

        # 从 CallbackMessage.data 中提取实际的聊天消息
        data = message.data if hasattr(message, 'data') else {}
        if not data:
            print("[DingTalk Stream] Empty data in callback message")
            return AckMessage.STATUS_OK, ""

        print(f"[DingTalk Stream] Message data: {str(data)[:200]}")

        # 转换为 ChatbotMessage
        try:
            chatbot_message = ChatbotMessage.from_dict(data)
        except Exception as e:
            print(f"[DingTalk Stream] Failed to parse ChatbotMessage: {e}")
            return AckMessage.STATUS_OK, ""

        # 处理消息类型：text 或 richText
        text_content = ""
        msg_type = chatbot_message.message_type or ""
        
        if msg_type == 'text':
            if chatbot_message.text and chatbot_message.text.content:
                text_content = chatbot_message.text.content
        elif msg_type == 'richText':
            # 从 richText 中提取文本内容
            try:
                rich_text = chatbot_message.rich_text_content
                if rich_text:
                    # richText 格式: {"richText": [{"text": {"content": "消息内容"}}]}
                    if hasattr(rich_text, 'rich_text'):
                        for item in rich_text.rich_text:
                            if hasattr(item, 'text') and hasattr(item.text, 'content'):
                                text_content += item.text.content
                    elif isinstance(rich_text, dict):
                        for item in rich_text.get('richText', []):
                            if 'text' in item and 'content' in item['text']:
                                text_content += item['text']['content']
            except Exception as e:
                print(f"[DingTalk Stream] Failed to extract richText: {e}")
        else:
            print(f"[DingTalk Stream] Ignored non-text message: {msg_type}")
            return AckMessage.STATUS_OK, ""

        if not text_content:
            print("[DingTalk Stream] Empty text content, ignored")
            return AckMessage.STATUS_OK, ""

        print(f"[DingTalk Stream] Text content: {text_content[:100]}...")

        # 提取关键字段
        conversation_id = chatbot_message.conversation_id or ""
        sender_staff_id = chatbot_message.sender_staff_id or ""
        sender_name = chatbot_message.sender_nick or ""
        message_id = chatbot_message.message_id or ""
        create_time = getattr(chatbot_message, "create_at", 0) or 0

        # 全量落库：无论是否命中日报模板，凡收到的文本消息都存入 messages 集合
        if conversation_id:
            try:
                store_message(
                    conversation_id=conversation_id,
                    sender_staff_id=sender_staff_id,
                    sender_name=sender_name,
                    text=text_content,
                    create_time=create_time,
                    message_id=message_id or None,
                    msg_type=msg_type or "text",
                    source="stream",
                )
            except Exception as e:
                print(f"[DingTalk Stream] Store message failed: {e}")

        # 检查是否是模板命令
        text_lower = text_content.strip().lower()
        if text_lower in ['模板', '日报模板', '帮助', 'help', '?']:
            try:
                self.reply_text(DAILY_REPORT_TEMPLATE, chatbot_message)
                print("[DingTalk Stream] Template sent successfully")
            except Exception as e:
                print(f"[DingTalk Stream] Template reply failed: {e}")
            return AckMessage.STATUS_OK, ""

        if not conversation_id or not sender_staff_id:
            print(f"[DingTalk Stream] Missing conversation_id or sender_staff_id, ignored")
            return AckMessage.STATUS_OK, ""

        # 调用消息处理器
        reply = None
        try:
            reply = handle_incoming_message(
                text_content=text_content,
                conversation_id=conversation_id,
                sender_staff_id=sender_staff_id,
                sender_name=sender_name,
                message_id=message_id,
            )
            print("[DingTalk Stream] Report saved successfully")
        except Exception as e:
            print(f"[DingTalk Stream] Error handling message: {e}")
            import traceback
            traceback.print_exc()

        # 发送确认回复（如果消息处理器有返回内容）
        if reply:
            try:
                self.reply_text(reply, chatbot_message)
                print("[DingTalk Stream] Reply sent successfully")
            except Exception as e:
                print(f"[DingTalk Stream] Reply failed: {e}")
                import traceback
                traceback.print_exc()

        # 返回空字符串作为 ack message，避免 raw_process 把回复内容通过 WebSocket 再次发送
        return AckMessage.STATUS_OK, ""


class DingTalkStreamManager:
    """钉钉 Stream 连接管理器：使用官方 SDK"""

    def __init__(self):
        self.app_key = _settings.DINGTALK_APP_KEY
        self.app_secret = _settings.DINGTALK_APP_SECRET
        self.client: Optional[DingTalkStreamClient] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False

    def start(self):
        """启动 Stream 连接（在后台线程中运行）"""
        if self._running:
            return
        if not self.app_key or not self.app_secret:
            print("[DingTalk Stream] APP_KEY or APP_SECRET not configured, skipping.")
            return

        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def stop(self):
        """停止 Stream 连接"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)

    def _run(self):
        """运行 Stream 连接的主循环"""
        try:
            credential = Credential(self.app_key, self.app_secret)
            self.client = DingTalkStreamClient(credential)

            # 注册消息处理器
            handler = DailyReportChatbotHandler()
            self.client.register_callback_handler(
                ChatbotMessage.TOPIC,
                handler
            )

            print("[DingTalk Stream] Starting official SDK client...")
            print(f"[DingTalk Stream] APP_KEY: {self.app_key[:8]}...")
            print(f"[DingTalk Stream] Subscribed topic: {ChatbotMessage.TOPIC}")
            self.client.start_forever()
        except Exception as e:
            print(f"[DingTalk Stream] Client error: {e}")
            import traceback
            traceback.print_exc()


# 全局单例
_stream_manager: Optional[DingTalkStreamManager] = None


def get_stream_manager() -> DingTalkStreamManager:
    global _stream_manager
    if _stream_manager is None:
        _stream_manager = DingTalkStreamManager()
    return _stream_manager
