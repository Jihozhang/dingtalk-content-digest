from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from bson import ObjectId

from app.models.report import PyObjectId


# ==================== AI Summary Task Model ====================

class AISummaryTaskBase(BaseModel):
    conversation_id: str = Field(..., description="群聊 conversation_id")
    start_date: str = Field(..., description="开始日期 (YYYY-MM-DD)")
    end_date: str = Field(..., description="结束日期 (YYYY-MM-DD)")
    task_name: Optional[str] = Field(default=None, description="任务名称")


class AISummaryTaskCreate(AISummaryTaskBase):
    pass


class AIReportItem(BaseModel):
    sender_name: str = Field(default="", description="员工姓名")
    sender_staff_id: str = Field(default="", description="员工 staff_id")
    today_work: str = Field(default="", description="今日工作内容")
    tomorrow_plan: str = Field(default="", description="明日计划")
    problems: str = Field(default="", description="遇到的问题")
    work_hours: Optional[float] = Field(default=None, description="工作时长")
    remarks: str = Field(default="", description="备注")
    applied: bool = Field(default=False, description="是否已入库")


class AISummaryTaskInDB(AISummaryTaskBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = Field(default=None, description="完成时间")
    status: str = Field(default="pending", description="任务状态: pending/processing/completed/failed")
    error_message: Optional[str] = Field(default=None, description="错误信息")
    generated_reports: List[AIReportItem] = Field(default_factory=list, description="AI 生成的日报列表")
    raw_message_count: int = Field(default=0, description="原始消息数量")
    api_cost_tokens: Optional[int] = Field(default=None, description="API 消耗 Token 数")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class AISummaryTaskResponse(AISummaryTaskBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    completed_at: Optional[datetime]
    status: str
    error_message: Optional[str]
    generated_reports: List[AIReportItem]
    raw_message_count: int
    api_cost_tokens: Optional[int]

    class Config:
        populate_by_name = True


class AISummaryTaskListParams(BaseModel):
    conversation_id: Optional[str] = None
    status: Optional[str] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
