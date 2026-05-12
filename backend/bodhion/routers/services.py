import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from bodhion.constants import ERROR_MESSAGES
from bodhion.internal.db import get_session
from bodhion.models.groups import Groups
from bodhion.models.services import (
    ServiceAccessGrantsForm,
    ServiceForm,
    ServiceModel,
    ServiceSettingsForm,
    ServiceUpdateForm,
    Services,
)
from bodhion.utils.auth import get_admin_user, get_verified_user

log = logging.getLogger(__name__)

router = APIRouter()


@router.get("/list", response_model=list[ServiceModel])
async def get_services(
    user=Depends(get_verified_user), db: Session = Depends(get_session)
):
    services = Services.get_services(active_only=True, db=db)

    if user.role == "admin":
        return [
            service.model_copy(update={"is_accessible": True, "access_reason": "admin"})
            for service in services
        ]

    user_group_ids = {group.id for group in Groups.get_groups_by_member_id(user.id, db=db)}
    return [
        service.model_copy(
            update={
                "is_accessible": allowed,
                "access_reason": reason,
            }
        )
        for service in services
        for allowed, reason in [
            Services.user_can_access_service(
                service=service,
                user_id=user.id,
                user_role=user.role,
                permission="read",
                user_group_ids=user_group_ids,
                db=db,
            )
        ]
    ]


@router.get("/workspace/list", response_model=list[ServiceModel])
async def get_workspace_services(
    user=Depends(get_admin_user), db: Session = Depends(get_session)
):
    return Services.get_services(active_only=True, db=db)


@router.get("/admin/list", response_model=list[ServiceModel])
async def get_admin_services(
    include_inactive: bool = True,
    user=Depends(get_admin_user),
    db: Session = Depends(get_session),
):
    return Services.get_services(active_only=not include_inactive, db=db)


@router.post("/admin/create", response_model=Optional[ServiceModel])
async def create_service(
    form_data: ServiceForm,
    user=Depends(get_admin_user),
    db: Session = Depends(get_session),
):
    existing = Services.get_service_by_id(form_data.id, db=db)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Service ID already exists",
        )
    return Services.insert_new_service(form_data=form_data, user_id=user.id, db=db)


@router.post("/admin/{service_id}/update", response_model=Optional[ServiceModel])
async def update_service(
    service_id: str,
    form_data: ServiceUpdateForm,
    user=Depends(get_admin_user),
    db: Session = Depends(get_session),
):
    service = Services.update_service_by_id(service_id, form_data, db=db)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )
    return service


@router.post("/admin/{service_id}/deactivate", response_model=bool)
async def deactivate_service(
    service_id: str, user=Depends(get_admin_user), db: Session = Depends(get_session)
):
    return Services.deactivate_service_by_id(service_id, db=db)


@router.post("/{service_id}/access", response_model=Optional[ServiceModel])
async def set_service_access(
    service_id: str,
    form_data: ServiceAccessGrantsForm,
    user=Depends(get_admin_user),
    db: Session = Depends(get_session),
):
    service = Services.set_service_access_grants(
        service_id=service_id, access_grants=form_data.access_grants, db=db
    )
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )
    return service


@router.get("/{service_id}/settings", response_model=Optional[ServiceModel])
async def get_service_settings(
    service_id: str,
    user=Depends(get_admin_user),
    db: Session = Depends(get_session),
):
    service = Services.get_service_by_id(service_id, db=db)
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )
    return service


@router.post("/{service_id}/settings", response_model=Optional[ServiceModel])
async def update_service_settings(
    service_id: str,
    form_data: ServiceSettingsForm,
    user=Depends(get_admin_user),
    db: Session = Depends(get_session),
):
    service = Services.set_service_settings(
        service_id=service_id, settings=form_data.settings, db=db
    )
    if not service:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )
    return service


@router.get("/{service_id}/can-access", response_model=bool)
async def can_access_service(
    service_id: str, user=Depends(get_verified_user), db: Session = Depends(get_session)
):
    service = Services.get_service_by_id(service_id, db=db)
    if not service or not service.is_active:
        return False

    user_group_ids = {group.id for group in Groups.get_groups_by_member_id(user.id, db=db)}
    allowed, _ = Services.user_can_access_service(
        service=service,
        user_id=user.id,
        user_role=user.role,
        permission="read",
        user_group_ids=user_group_ids,
        db=db,
    )
    return allowed
