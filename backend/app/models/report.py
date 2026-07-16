from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema, handler):
        field_schema.update(type="string")
        return field_schema


# ==================== User Model ====================

class UserBase(BaseModel):
    staff_id: str = Field(..., description="钉钉员工 staff_id")
    name: str = Field(..., description="员工姓名")
    avatar: Optional[str] = Field(default=None, description="头像 URL")
    union_id: Optional[str] = Field(default=None, description="钉钉 union_id")


class UserCreate(UserBase):
    pass


class UserInDB(UserBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    group_ids: list[str] = Field(default_factory=list, description="所属群聊 conversation_id 列表")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class UserResponse(UserBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    group_ids: list[str]

    class Config:
        populate_by_name = True


# ==================== Group Model ====================

class GroupBase(BaseModel):
    conversation_id: str = Field(..., description="群聊 conversation_id")
    name: str = Field(..., description="群聊名称")
    project_name: Optional[str] = Field(default=None, description="关联项目名称")
    project_id: Optional[str] = Field(default=None, description="关联项目 ID")


class GroupCreate(GroupBase):
    pass


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    project_name: Optional[str] = None
    project_id: Optional[str] = None


class GroupInDB(GroupBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    member_count: int = Field(default=0, description="群成员数量")
    is_active: bool = Field(default=True, description="是否激活")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class GroupResponse(GroupBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    member_count: int
    is_active: bool

    class Config:
        populate_by_name = True


# ==================== Report Model ====================

class ParsedContent(BaseModel):
    today_work: str = Field(default="", description="今日工作内容")
    tomorrow_plan: str = Field(default="", description="明日计划")
    problems: str = Field(default="", description="遇到的问题/风险")
    work_hours: Optional[float] = Field(default=None, description="工作时长")
    remarks: str = Field(default="", description="其他备注")


class ReportBase(BaseModel):
    raw_content: str = Field(..., description="原始消息内容")
    parsed_content: ParsedContent = Field(default_factory=ParsedContent, description="解析后的内容")
    parse_status: str = Field(default="pending", description="解析状态: pending/success/failed")
    conversation_id: str = Field(..., description="群聊 conversation_id")
    sender_staff_id: str = Field(..., description="发送者 staff_id")
    sender_name: str = Field(default="", description="发送者姓名")
    message_id: Optional[str] = Field(default=None, description="钉钉消息 ID")


class ReportCreate(ReportBase):
    pass


class ReportUpdate(BaseModel):
    parsed_content: Optional[ParsedContent] = None
    parse_status: Optional[str] = None


class ReportInDB(ReportBase):
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    report_date: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%d"), description="日报日期")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class ReportResponse(ReportBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    report_date: str

    class Config:
        populate_by_name = True


# ==================== Auth Model ====================

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    username: Optional[str] = None


class AdminLogin(BaseModel):
    username: str
    password: str


# ==================== Stats Model ====================

class DailyStats(BaseModel):
    date: str
    total_reports: int
    success_parse_count: int
    failed_parse_count: int


class GroupStats(BaseModel):
    group_id: str
    group_name: str
    total_reports: int
    member_count: int
    submission_rate: float


class UserStats(BaseModel):
    staff_id: str
    name: str
    total_reports: int
    success_parse_count: int
    last_report_date: Optional[str]
    message_count: int = Field(default=0, description="消息数量")
    active_days: int = Field(default=0, description="活跃天数")
