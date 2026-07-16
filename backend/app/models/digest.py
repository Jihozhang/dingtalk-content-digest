from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from bson import ObjectId

from app.models.report import PyObjectId


# ==================== Digest (定时智能汇总) Model ====================

class TodoItem(BaseModel):
    content: str = Field(default="", description="待办事项内容")
    owner: str = Field(default="", description="负责人")


class HotTopic(BaseModel):
    title: str = Field(default="", description="话题标题")
    summary: str = Field(default="", description="话题摘要")


class DigestBase(BaseModel):
    conversation_id: str = Field(..., description="群聊 conversation_id")
    period_type: str = Field(default="daily", description="周期类型: daily/weekly/custom")
    start_date: str = Field(..., description="开始日期 (YYYY-MM-DD)")
    end_date: str = Field(..., description="结束日期 (YYYY-MM-DD)")


class DigestCreate(BaseModel):
    conversation_id: str
    period_type: str = "custom"
    start_date: str
    end_date: str


class DigestInDB(DigestBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(default=None)
    status: str = Field(default="pending", description="pending/processing/completed/failed")
    error_message: Optional[str] = Field(default=None)

    group_name: str = Field(default="", description="群聊名称")
    overview: str = Field(default="", description="整体概览")
    hot_topics: List[HotTopic] = Field(default_factory=list, description="热点话题")
    todos: List[TodoItem] = Field(default_factory=list, description="待办事项")
    risks: List[str] = Field(default_factory=list, description="风险/问题")
    key_conclusions: List[str] = Field(default_factory=list, description="关键结论")

    raw_message_count: int = Field(default=0, description="原始消息数量")
    pushed: bool = Field(default=False, description="是否已回推到群")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class DigestResponse(DigestBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    completed_at: Optional[datetime]
    status: str
    error_message: Optional[str]
    group_name: str
    overview: str
    hot_topics: List[HotTopic]
    todos: List[TodoItem]
    risks: List[str]
    key_conclusions: List[str]
    raw_message_count: int
    pushed: bool

    class Config:
        populate_by_name = True
