from typing import List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.models.report import GroupResponse, GroupCreate, GroupUpdate
from app.routers.auth import get_current_user
from app.services.mongo_client import get_groups_collection

router = APIRouter(prefix="/groups", tags=["群聊管理"])


def serialize_group(doc: dict) -> dict:
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("", response_model=List[GroupResponse])
async def list_groups(
    current_user: str = Depends(get_current_user),
):
    """获取所有群聊列表"""
    collection = get_groups_collection()
    cursor = collection.find().sort("created_at", -1)
    return [serialize_group(doc) for doc in cursor]


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: str, current_user: str = Depends(get_current_user)):
    """获取单个群聊详情"""
    collection = get_groups_collection()
    try:
        doc = collection.find_one({"_id": ObjectId(group_id)})
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的群聊 ID")

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="群聊不存在")

    return serialize_group(doc)


@router.post("", response_model=GroupResponse)
async def create_group(
    group_data: GroupCreate,
    current_user: str = Depends(get_current_user),
):
    """手动添加群聊（通常由消息接收自动创建）"""
    collection = get_groups_collection()

    # 检查是否已存在
    if collection.find_one({"conversation_id": group_data.conversation_id}):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该群聊已存在")

    from datetime import datetime
    doc = group_data.model_dump()
    doc["created_at"] = datetime.utcnow()
    doc["updated_at"] = datetime.utcnow()
    doc["member_count"] = 0
    doc["is_active"] = True

    result = collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    return serialize_group(doc)


@router.put("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: str,
    update_data: GroupUpdate,
    current_user: str = Depends(get_current_user),
):
    """更新群聊信息（如关联项目）"""
    collection = get_groups_collection()
    try:
        obj_id = ObjectId(group_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的群聊 ID")

    update_dict = {k: v for k, v in update_data.model_dump(exclude_unset=True).items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="没有提供更新数据")

    from datetime import datetime
    update_dict["updated_at"] = datetime.utcnow()

    result = collection.update_one({"_id": obj_id}, {"$set": update_dict})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="群聊不存在")

    doc = collection.find_one({"_id": obj_id})
    return serialize_group(doc)


@router.delete("/{group_id}")
async def delete_group(group_id: str, current_user: str = Depends(get_current_user)):
    """删除群聊（软删除，标记为不活跃）"""
    collection = get_groups_collection()
    try:
        obj_id = ObjectId(group_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="无效的群聊 ID")

    from datetime import datetime
    result = collection.update_one(
        {"_id": obj_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="群聊不存在")

    return {"message": "群聊已标记为不活跃"}
