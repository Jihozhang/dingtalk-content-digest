from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId

from app.models.report import PyObjectId


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
