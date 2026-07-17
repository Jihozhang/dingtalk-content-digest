from datetime import datetime
from typing import Optional, List
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.models.template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
    TemplateInDB,
)
from app.routers.auth import get_current_user
from app.services.mongo_client import get_templates_collection, get_groups_collection

router = APIRouter(prefix="/templates", tags=["问卷模板"])


def serialize_template(doc: dict) -> dict:
    """序列化模板文档"""
    doc["_id"] = str(doc["_id"])
    return doc


@router.get("", response_model=List[TemplateResponse])
async def list_templates(
    is_active: Optional[bool] = Query(None),
    conversation_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: str = Depends(get_current_user),
):
    """获取模板列表"""
    col = get_templates_collection()
    query = {}
    if is_active is not None:
        query["is_active"] = is_active
    if conversation_id:
        query["conversation_ids"] = conversation_id

    skip = (page - 1) * page_size
    cursor = col.find(query).sort("created_at", -1).skip(skip).limit(page_size)
    return [serialize_template(doc) for doc in cursor]


@router.post("", response_model=TemplateResponse)
async def create_template(
    template_data: TemplateCreate,
    current_user: str = Depends(get_current_user),
):
    """创建模板"""
    col = get_templates_collection()

    # 验证字段名称唯一性
    field_names = [f.name for f in template_data.fields]
    if len(field_names) != len(set(field_names)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="字段标识（name）不能重复",
        )

    template = TemplateInDB(
        name=template_data.name,
        description=template_data.description,
        keywords=template_data.keywords,
        fields=template_data.fields,
        conversation_ids=template_data.conversation_ids,
        is_active=template_data.is_active,
    )

    template_dict = template.model_dump()
    template_dict["created_at"] = datetime.utcnow()
    template_dict["updated_at"] = datetime.utcnow()

    result = col.insert_one(template_dict)
    doc = col.find_one({"_id": result.inserted_id})

    # 如果绑定了群聊，更新群聊的 template_ids
    if template_data.conversation_ids:
        groups_col = get_groups_collection()
        for cid in template_data.conversation_ids:
            groups_col.update_one(
                {"conversation_id": cid},
                {"$addToSet": {"template_ids": str(result.inserted_id)}},
            )

    return serialize_template(doc)


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    current_user: str = Depends(get_current_user),
):
    """获取单个模板详情"""
    col = get_templates_collection()
    try:
        doc = col.find_one({"_id": ObjectId(template_id)})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的模板 ID",
        )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )

    return serialize_template(doc)


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: str,
    template_data: TemplateUpdate,
    current_user: str = Depends(get_current_user),
):
    """更新模板"""
    col = get_templates_collection()
    try:
        obj_id = ObjectId(template_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的模板 ID",
        )

    existing = col.find_one({"_id": obj_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )

    # 构建更新字段
    update_fields = {}
    if template_data.name is not None:
        update_fields["name"] = template_data.name
    if template_data.description is not None:
        update_fields["description"] = template_data.description
    if template_data.keywords is not None:
        update_fields["keywords"] = template_data.keywords
    if template_data.fields is not None:
        # 验证字段名称唯一性
        field_names = [f.name for f in template_data.fields]
        if len(field_names) != len(set(field_names)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="字段标识（name）不能重复",
            )
        update_fields["fields"] = [f.model_dump() for f in template_data.fields]
    if template_data.conversation_ids is not None:
        update_fields["conversation_ids"] = template_data.conversation_ids
    if template_data.is_active is not None:
        update_fields["is_active"] = template_data.is_active

    update_fields["updated_at"] = datetime.utcnow()

    col.update_one({"_id": obj_id}, {"$set": update_fields})

    # 更新群聊绑定
    if template_data.conversation_ids is not None:
        groups_col = get_groups_collection()
        # 先移除旧绑定
        old_cids = existing.get("conversation_ids", [])
        for cid in old_cids:
            if cid not in template_data.conversation_ids:
                groups_col.update_one(
                    {"conversation_id": cid},
                    {"$pull": {"template_ids": template_id}},
                )
        # 添加新绑定
        for cid in template_data.conversation_ids:
            groups_col.update_one(
                {"conversation_id": cid},
                {"$addToSet": {"template_ids": template_id}},
            )

    doc = col.find_one({"_id": obj_id})
    return serialize_template(doc)


@router.delete("/{template_id}")
async def delete_template(
    template_id: str,
    current_user: str = Depends(get_current_user),
):
    """删除模板"""
    col = get_templates_collection()
    try:
        obj_id = ObjectId(template_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的模板 ID",
        )

    existing = col.find_one({"_id": obj_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )

    # 从群聊中移除绑定
    groups_col = get_groups_collection()
    for cid in existing.get("conversation_ids", []):
        groups_col.update_one(
            {"conversation_id": cid},
            {"$pull": {"template_ids": template_id}},
        )

    col.delete_one({"_id": obj_id})
    return {"message": "模板已删除"}


@router.post("/{template_id}/bind-group")
async def bind_template_to_group(
    template_id: str,
    conversation_id: str,
    current_user: str = Depends(get_current_user),
):
    """绑定模板到群聊"""
    col = get_templates_collection()
    try:
        obj_id = ObjectId(template_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的模板 ID",
        )

    existing = col.find_one({"_id": obj_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )

    # 更新模板
    col.update_one(
        {"_id": obj_id},
        {
            "$addToSet": {"conversation_ids": conversation_id},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )

    # 更新群聊
    groups_col = get_groups_collection()
    groups_col.update_one(
        {"conversation_id": conversation_id},
        {"$addToSet": {"template_ids": template_id}},
    )

    doc = col.find_one({"_id": obj_id})
    return serialize_template(doc)


@router.post("/{template_id}/unbind-group")
async def unbind_template_from_group(
    template_id: str,
    conversation_id: str,
    current_user: str = Depends(get_current_user),
):
    """解绑模板从群聊"""
    col = get_templates_collection()
    try:
        obj_id = ObjectId(template_id)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无效的模板 ID",
        )

    existing = col.find_one({"_id": obj_id})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="模板不存在",
        )

    # 更新模板
    col.update_one(
        {"_id": obj_id},
        {
            "$pull": {"conversation_ids": conversation_id},
            "$set": {"updated_at": datetime.utcnow()},
        },
    )

    # 更新群聊
    groups_col = get_groups_collection()
    groups_col.update_one(
        {"conversation_id": conversation_id},
        {"$pull": {"template_ids": template_id}},
    )

    doc = col.find_one({"_id": obj_id})
    return serialize_template(doc)
