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


# ==================== Template Field Model ====================

class TemplateField(BaseModel):
    """模板字段定义"""
    name: str = Field(..., description="字段标识（英文，如 repair_content）")
    label: str = Field(..., description="显示名称（如 报修内容）")
    field_type: str = Field(default="text", description="字段类型: text/number/select/date/boolean")
    required: bool = Field(default=False, description="是否必填")
    options: list[str] = Field(default_factory=list, description="选项值列表（select类型用）")
    description: str = Field(default="", description="字段说明")
    keywords: list[str] = Field(default_factory=list, description="匹配关键词（如 ['报修', '坏了']）")
    default_value: str = Field(default="", description="默认值")


class TemplateFieldCreate(BaseModel):
    """创建模板字段"""
    name: str
    label: str
    field_type: str = "text"
    required: bool = False
    options: list[str] = []
    description: str = ""
    keywords: list[str] = []
    default_value: str = ""


# ==================== Template Model ====================

class Template(BaseModel):
    """完整的模板模型（用于解析器内部使用）"""
    id: Optional[str] = None
    name: str = Field(..., description="模板名称（如 IT报修登记）")
    description: str = Field(default="", description="模板描述")
    keywords: list[str] = Field(default_factory=list, description="全局触发关键词（如 ['报修', '维修']）")
    fields: list[TemplateField] = Field(default_factory=list, description="字段列表")
    conversation_ids: list[str] = Field(default_factory=list, description="绑定的群聊（空表示不限制）")
    is_active: bool = Field(default=True, description="是否启用")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class TemplateBase(BaseModel):
    """模板基础信息"""
    name: str = Field(..., description="模板名称（如 IT报修登记）")
    description: str = Field(default="", description="模板描述")
    keywords: list[str] = Field(default_factory=list, description="全局触发关键词（如 ['报修', '维修']）")
    fields: list[TemplateField] = Field(default_factory=list, description="字段列表")
    conversation_ids: list[str] = Field(default_factory=list, description="绑定的群聊（空表示不限制）")
    is_active: bool = Field(default=True, description="是否启用")


class TemplateCreate(TemplateBase):
    """创建模板"""
    pass


class TemplateUpdate(BaseModel):
    """更新模板"""
    name: Optional[str] = None
    description: Optional[str] = None
    keywords: Optional[list[str]] = None
    fields: Optional[list[TemplateField]] = None
    conversation_ids: Optional[list[str]] = None
    is_active: Optional[bool] = None


class TemplateInDB(TemplateBase):
    """数据库中的模板"""
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class TemplateResponse(TemplateBase):
    """模板响应"""
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True


# ==================== Data Record Model ====================

class DataRecordBase(BaseModel):
    """数据记录基础"""
    template_id: str = Field(..., description="关联模板ID")
    template_name: str = Field(default="", description="模板名称（冗余存储）")
    conversation_id: str = Field(..., description="群聊ID")
    sender_staff_id: str = Field(..., description="发送者 staff_id")
    sender_name: str = Field(default="", description="发送者姓名")
    raw_content: str = Field(..., description="原始消息内容")
    parsed_data: dict = Field(default_factory=dict, description="AI解析后的结构化数据 {field_name: value}")
    parse_status: str = Field(default="pending", description="解析状态: pending/success/failed")
    message_id: Optional[str] = Field(default=None, description="钉钉消息ID")


class DataRecordCreate(DataRecordBase):
    """创建数据记录"""
    pass


class DataRecordUpdate(BaseModel):
    """更新数据记录"""
    parsed_data: Optional[dict] = None
    parse_status: Optional[str] = None


class DataRecordInDB(DataRecordBase):
    """数据库中的数据记录"""
    id: PyObjectId = Field(default_factory=PyObjectId, alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    record_date: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y-%m-%d"), description="记录日期")

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class DataRecordResponse(DataRecordBase):
    """数据记录响应"""
    id: str = Field(..., alias="_id")
    created_at: datetime
    record_date: str

    class Config:
        populate_by_name = True


# ==================== Template Match Result ====================

class TemplateMatchResult(BaseModel):
    """模板匹配结果"""
    template_id: str
    template_name: str
    match_score: float = Field(description="匹配分数 0-1")
    matched_keywords: list[str] = Field(default_factory=list, description="匹配到的关键词")
