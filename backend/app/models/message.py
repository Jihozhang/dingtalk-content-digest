from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId

from app.models.report import PyObjectId


# ==================== Message Model ====================

class MessageBase(BaseModel):
    conversation_id: str = Field(..., description="群聊 conversation_id")
    sender_staff_id: str = Field(default="", description="发送者 staff_id")
    sender_name: str = Field(default="", description="发送者姓名")
    text: str = Field(default="", description="消息文本内容")
    msg_type: str = Field(default="text", description="消息类型: text/richText")
    create_time: int = Field(default=0, description="消息发送时间戳(毫秒)")
    message_id: Optional[str] = Field(default=None, description="钉钉消息 ID(去重用)")
    source: str = Field(default="stream", description="来源: stream/backfill")


class MessageInDB(MessageBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class MessageResponse(MessageBase):
    id: str = Field(..., alias="_id")
    created_at: datetime

    class Config:
        populate_by_name = True


# ==================== Content Stats Model ====================

class VolumePoint(BaseModel):
    date: str
    message_count: int
    active_users: int


class ActiveHourPoint(BaseModel):
    hour: int
    message_count: int


class ParticipantStat(BaseModel):
    sender_staff_id: str
    sender_name: str
    message_count: int
    active_days: int
    last_message_time: Optional[int] = None


class KeywordStat(BaseModel):
    word: str
    count: int


class GroupActivityStat(BaseModel):
    conversation_id: str
    group_name: str
    message_count: int
    active_users: int
    last_message_time: Optional[int] = None
