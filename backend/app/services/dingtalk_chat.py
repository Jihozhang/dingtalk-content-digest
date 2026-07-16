import requests
import time
from typing import List, Optional, Dict
from datetime import datetime

from app.config import get_settings

_settings = get_settings()


class DingTalkChatClient:
    """钉钉群聊历史消息客户端"""

    def __init__(self):
        self.app_key = _settings.DINGTALK_APP_KEY
        self.app_secret = _settings.DINGTALK_APP_SECRET
        self.access_token: Optional[str] = None
        self.token_expire_time: float = 0

    def _get_access_token(self) -> str:
        """获取钉钉 Access Token"""
        if self.access_token and time.time() < self.token_expire_time - 300:
            return self.access_token

        url = "https://oapi.dingtalk.com/gettoken"
        params = {"appkey": self.app_key, "appsecret": self.app_secret}
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        if data.get("errcode") == 0:
            self.access_token = data["access_token"]
            self.token_expire_time = time.time() + data.get("expires_in", 7200)
            return self.access_token
        raise Exception(f"获取 Access Token 失败: {data}")

    def get_chat_messages(
        self,
        conversation_id: str,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        max_results: int = 100,
    ) -> List[Dict]:
        """
        获取群聊历史消息

        Args:
            conversation_id: 群聊会话 ID
            start_time: 开始时间戳（毫秒）
            end_time: 结束时间戳（毫秒）
            max_results: 最大返回消息数

        Returns:
            消息列表，每条消息包含 sender_name, sender_staff_id, text, create_time
        """
        token = self._get_access_token()

        # 使用钉钉开放平台查询群消息状态接口
        # 注意：钉钉官方 API 对聊天记录有严格限制，这里使用群消息查询接口
        url = "https://oapi.dingtalk.com/topapi/im/chat/roamingmessages/get"

        messages = []
        cursor = 0

        while len(messages) < max_results:
            payload = {
                "access_token": token,
                "conversation_id": conversation_id,
                "cursor": cursor,
                "count": min(100, max_results - len(messages)),
            }
            if start_time:
                payload["start_time"] = start_time
            if end_time:
                payload["end_time"] = end_time

            try:
                resp = requests.post(url, params={"access_token": token}, json=payload, timeout=15)
                data = resp.json()

                if data.get("errcode") != 0:
                    print(f"[DingTalk Chat] API error: {data}")
                    break

                result = data.get("result", {})
                msgs = result.get("messages", [])
                if not msgs:
                    break

                for msg in msgs:
                    # 只处理文本消息
                    if msg.get("msgtype") != "text":
                        continue

                    text_content = ""
                    if "text" in msg and isinstance(msg["text"], dict):
                        text_content = msg["text"].get("content", "")
                    elif "content" in msg:
                        text_content = msg["content"]

                    if not text_content:
                        continue

                    messages.append({
                        "sender_name": msg.get("sender_staff_id", "未知用户"),  # 钉钉返回的是 staff_id，需要映射
                        "sender_staff_id": msg.get("sender_staff_id", ""),
                        "text": text_content,
                        "create_time": msg.get("create_time", ""),
                        "message_id": msg.get("message_id", ""),
                    })

                # 检查是否还有下一页
                has_more = result.get("has_more", False)
                if not has_more:
                    break

                cursor = result.get("next_cursor", cursor + len(msgs))

            except Exception as e:
                print(f"[DingTalk Chat] Request error: {e}")
                break

        return messages

    def get_group_members(self, conversation_id: str) -> Dict[str, str]:
        """
        获取群成员列表，用于 staff_id 到姓名的映射

        Returns:
            {staff_id: name} 映射字典
        """
        token = self._get_access_token()
        url = "https://oapi.dingtalk.com/topapi/im/chat/member/list"

        try:
            resp = requests.post(
                url,
                params={"access_token": token},
                json={"open_conversation_id": conversation_id},
                timeout=10,
            )
            data = resp.json()

            if data.get("errcode") != 0:
                print(f"[DingTalk Chat] Get members error: {data}")
                return {}

            members = {}
            for member in data.get("result", {}).get("member_list", []):
                staff_id = member.get("staff_id", "")
                name = member.get("name", "")
                if staff_id:
                    members[staff_id] = name

            return members

        except Exception as e:
            print(f"[DingTalk Chat] Get members request error: {e}")
            return {}

    def send_group_message(self, conversation_id: str, text: str) -> bool:
        """
        通过机器人向群聊发送文本消息（用于回推汇总）。

        使用钉钉新版 robot/groupMessages/send 接口，需要机器人 RobotCode。
        """
        if not _settings.DINGTALK_ROBOT_CODE:
            print("[DingTalk Chat] ROBOT_CODE 未配置，无法回推群消息")
            return False

        token = self._get_access_token()
        url = "https://api.dingtalk.com/v1.0/robot/groupMessages/send"
        headers = {
            "x-acs-dingtalk-access-token": token,
            "Content-Type": "application/json",
        }
        payload = {
            "robotCode": _settings.DINGTALK_ROBOT_CODE,
            "openConversationId": conversation_id,
            "msgKey": "sampleText",
            "msgParam": __import__("json").dumps({"content": text}),
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=10)
            if resp.status_code == 200:
                return True
            print(f"[DingTalk Chat] Send group message failed: {resp.status_code} {resp.text}")
            return False
        except Exception as e:
            print(f"[DingTalk Chat] Send group message error: {e}")
            return False


# 全局单例
_chat_client: Optional[DingTalkChatClient] = None


def get_chat_client() -> DingTalkChatClient:
    global _chat_client
    if _chat_client is None:
        _chat_client = DingTalkChatClient()
    return _chat_client
