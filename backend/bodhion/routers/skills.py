import logging
from typing import Optional

from bodhion.models.groups import Groups
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from bodhion.internal.db import get_session
from bodhion.models.skills import (
    SkillForm,
    SkillMeta,
    SkillModel,
    SkillResponse,
    SkillUserResponse,
    SkillAccessResponse,
    SkillAccessListResponse,
    Skills,
)
from bodhion.models.access_grants import AccessGrants
from bodhion.utils.auth import get_admin_user, get_verified_user
from bodhion.utils.access_control import has_access, has_permission, filter_allowed_access_grants

from bodhion.config import BYPASS_ADMIN_ACCESS_CONTROL
from bodhion.constants import ERROR_MESSAGES

log = logging.getLogger(__name__)

PAGE_ITEM_COUNT = 30

router = APIRouter()


############################
# GetSkills
############################


@router.get("/", response_model=list[SkillUserResponse])
async def get_skills(
    request: Request,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL:
        skills = Skills.get_skills(db=db)
    else:
        user_group_ids = {
            group.id for group in Groups.get_groups_by_member_id(user.id, db=db)
        }
        all_skills = Skills.get_skills(db=db)
        skills = [
            skill
            for skill in all_skills
            if skill.user_id == user.id
            or AccessGrants.has_access(
                user_id=user.id,
                resource_type="skill",
                resource_id=skill.id,
                permission="read",
                user_group_ids=user_group_ids,
                db=db,
            )
        ]

    return skills


############################
# GetSkillList
############################


@router.get("/list", response_model=SkillAccessListResponse)
async def get_skill_list(
    query: Optional[str] = None,
    view_option: Optional[str] = None,
    page: Optional[int] = 1,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    limit = PAGE_ITEM_COUNT

    page = max(1, page)
    skip = (page - 1) * limit

    filter = {}
    if query:
        filter["query"] = query
    if view_option:
        filter["view_option"] = view_option

    if not (user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL):
        groups = Groups.get_groups_by_member_id(user.id, db=db)
        if groups:
            filter["group_ids"] = [group.id for group in groups]

        filter["user_id"] = user.id

    result = Skills.search_skills(user.id, filter=filter, skip=skip, limit=limit, db=db)

    return SkillAccessListResponse(
        items=[
            SkillAccessResponse(
                **skill.model_dump(),
                write_access=(
                    (user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL)
                    or user.id == skill.user_id
                    or AccessGrants.has_access(
                        user_id=user.id,
                        resource_type="skill",
                        resource_id=skill.id,
                        permission="write",
                        db=db,
                    )
                ),
            )
            for skill in result.items
        ],
        total=result.total,
    )


############################
# ExportSkills
############################


@router.get("/export", response_model=list[SkillModel])
async def export_skills(
    request: Request,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if user.role != "admin" and not has_permission(
        user.id,
        "workspace.skills",
        request.app.state.config.USER_PERMISSIONS,
        db=db,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    if user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL:
        return Skills.get_skills(db=db)
    else:
        return Skills.get_skills_by_user_id(user.id, "read", db=db)


############################
# CreateNewSkill
############################


@router.post("/create", response_model=Optional[SkillResponse])
async def create_new_skill(
    request: Request,
    form_data: SkillForm,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if user.role != "admin" and not has_permission(
        user.id, "workspace.skills", request.app.state.config.USER_PERMISSIONS, db=db
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    import re
    raw_id = (form_data.id or form_data.name).strip()
    form_data.id = re.sub(r"[^a-z0-9]+", "-", raw_id.lower()).strip("-")

    existing = Skills.get_skill_by_id(form_data.id, db=db)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.ID_TAKEN,
        )

    try:
        skill = Skills.insert_new_skill(user.id, form_data, db=db)
        if skill:
            return skill
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ERROR_MESSAGES.DEFAULT("Error creating skill"),
            )
    except Exception as e:
        log.exception(f"Failed to create skill: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.DEFAULT(str(e)),
        )


############################
# GetSkillById
############################


@router.get("/id/{id}", response_model=Optional[SkillAccessResponse])
async def get_skill_by_id(
    id: str, user=Depends(get_verified_user), db: Session = Depends(get_session)
):
    skill = Skills.get_skill_by_id(id, db=db)

    if skill:
        if (
            user.role == "admin"
            or skill.user_id == user.id
            or AccessGrants.has_access(
                user_id=user.id,
                resource_type="skill",
                resource_id=skill.id,
                permission="read",
                db=db,
            )
        ):
            return SkillAccessResponse(
                **skill.model_dump(),
                write_access=(
                    (user.role == "admin" and BYPASS_ADMIN_ACCESS_CONTROL)
                    or user.id == skill.user_id
                    or AccessGrants.has_access(
                        user_id=user.id,
                        resource_type="skill",
                        resource_id=skill.id,
                        permission="write",
                        db=db,
                    )
                ),
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERROR_MESSAGES.ACCESS_PROHIBITED,
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )


############################
# UpdateSkillById
############################


@router.post("/id/{id}/update", response_model=Optional[SkillModel])
async def update_skill_by_id(
    request: Request,
    id: str,
    form_data: SkillForm,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    skill = Skills.get_skill_by_id(id, db=db)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )

    if (
        skill.user_id != user.id
        and not AccessGrants.has_access(
            user_id=user.id,
            resource_type="skill",
            resource_id=skill.id,
            permission="write",
            db=db,
        )
        and user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    try:
        updated = {
            **form_data.model_dump(exclude={"id"}),
        }

        skill = Skills.update_skill_by_id(id, updated, db=db)

        if skill:
            return skill
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ERROR_MESSAGES.DEFAULT("Error updating skill"),
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.DEFAULT(str(e)),
        )


############################
# UpdateSkillAccessById
############################


class SkillAccessGrantsForm(BaseModel):
    access_grants: list[dict]


@router.post("/id/{id}/access/update", response_model=Optional[SkillModel])
async def update_skill_access_by_id(
    request: Request,
    id: str,
    form_data: SkillAccessGrantsForm,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    skill = Skills.get_skill_by_id(id, db=db)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )

    if (
        skill.user_id != user.id
        and not AccessGrants.has_access(
            user_id=user.id,
            resource_type="skill",
            resource_id=skill.id,
            permission="write",
            db=db,
        )
        and user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    form_data.access_grants = filter_allowed_access_grants(
        request.app.state.config.USER_PERMISSIONS,
        user.id,
        user.role,
        form_data.access_grants,
        "sharing.public_skills",
    )

    AccessGrants.set_access_grants("skill", id, form_data.access_grants, db=db)

    return Skills.get_skill_by_id(id, db=db)


############################
# ToggleSkillById
############################


@router.post("/id/{id}/toggle", response_model=Optional[SkillModel])
async def toggle_skill_by_id(
    id: str, user=Depends(get_verified_user), db: Session = Depends(get_session)
):
    skill = Skills.get_skill_by_id(id, db=db)
    if skill:
        if (
            user.role == "admin"
            or skill.user_id == user.id
            or AccessGrants.has_access(
                user_id=user.id,
                resource_type="skill",
                resource_id=skill.id,
                permission="write",
                db=db,
            )
        ):
            skill = Skills.toggle_skill_by_id(id, db=db)

            if skill:
                return skill
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=ERROR_MESSAGES.DEFAULT("Error toggling skill"),
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ERROR_MESSAGES.UNAUTHORIZED,
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )


############################
# DeleteSkillById
############################


@router.delete("/id/{id}/delete", response_model=bool)
async def delete_skill_by_id(
    request: Request,
    id: str,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    skill = Skills.get_skill_by_id(id, db=db)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ERROR_MESSAGES.NOT_FOUND,
        )

    if (
        skill.user_id != user.id
        and not AccessGrants.has_access(
            user_id=user.id,
            resource_type="skill",
            resource_id=skill.id,
            permission="write",
            db=db,
        )
        and user.role != "admin"
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    result = Skills.delete_skill_by_id(id, db=db)
    return result


############################
# GetSkillHubIndex
############################


@router.get("/hub/index")
async def get_skill_hub_index(
    request: Request,
    source: str = "https://github.com/NousResearch/hermes-agent",
    user=Depends(get_verified_user),
):
    from bodhion.utils.hermes_skills import get_hermes_hub_index

    # User-supplied token from X-GitHub-Token header overrides server env var.
    user_token = request.headers.get("X-GitHub-Token") or None

    try:
        skills = await get_hermes_hub_index(source_url=source, user_token=user_token)
        return skills
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        log.exception(f"Failed to fetch hub index: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Hub index unavailable. Try again later.",
        )


############################
# ImportSkillFromUrl
############################


class SkillImportForm(BaseModel):
    url: str


@router.post("/import/url", response_model=Optional[SkillResponse])
async def import_skill_from_url(
    request: Request,
    form_data: SkillImportForm,
    user=Depends(get_verified_user),
    db: Session = Depends(get_session),
):
    if user.role != "admin" and not has_permission(
        user.id,
        "workspace.skills",
        request.app.state.config.USER_PERMISSIONS,
        db=db,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ERROR_MESSAGES.UNAUTHORIZED,
        )

    from bodhion.utils.hermes_skills import fetch_skill_md

    try:
        parsed = await fetch_skill_md(form_data.url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        log.exception(f"Failed to fetch skill from URL: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not fetch skill: {e}",
        )

    name = parsed.get("name") or "imported-skill"
    skill_id = name.lower().replace(" ", "-")

    # Suffix with random hex if the ID is already taken
    if Skills.get_skill_by_id(skill_id, db=db):
        import uuid
        skill_id = f"{skill_id}-{uuid.uuid4().hex[:6]}"

    skill_form = SkillForm(
        id=skill_id,
        name=parsed.get("name") or skill_id,
        description=parsed.get("description") or None,
        content=parsed["content"],
        content_type="markdown",
        source_url=parsed.get("source_url"),
        meta=SkillMeta(
            tags=parsed.get("tags") or [],
            version=str(parsed["version"]) if parsed.get("version") else None,
            author=str(parsed["author"]) if parsed.get("author") else None,
            license=str(parsed["license"]) if parsed.get("license") else None,
            homepage=str(parsed["homepage"]) if parsed.get("homepage") else None,
            prerequisites=parsed.get("prerequisites"),
        ),
    )

    skill = Skills.insert_new_skill(user.id, skill_form, db=db)
    if not skill:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ERROR_MESSAGES.DEFAULT("Error importing skill"),
        )
    return skill
