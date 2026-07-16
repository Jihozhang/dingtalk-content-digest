from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId

from app.models.report import PyObjectId


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
