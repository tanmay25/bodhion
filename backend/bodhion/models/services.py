import logging
import time
import uuid
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import BigInteger, Boolean, Column, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Session

from bodhion.internal.db import Base, JSONField, get_db_context
from bodhion.models.access_grants import AccessGrantModel, AccessGrants
from bodhion.models.groups import Groups

log = logging.getLogger(__name__)


class Service(Base):
    __tablename__ = "service"

    id = Column(Text, primary_key=True, unique=True)
    user_id = Column(Text, nullable=False)
    type = Column(Text, nullable=False, default="generic")
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    route = Column(Text, nullable=False)
    icon = Column(Text, nullable=True)
    cta = Column(Text, nullable=True)
    status = Column(Text, nullable=False, default="active")
    is_active = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    updated_at = Column(BigInteger, nullable=False)
    created_at = Column(BigInteger, nullable=False)


class ServiceSetting(Base):
    __tablename__ = "service_setting"

    id = Column(Text, primary_key=True, unique=True)
    service_id = Column(Text, nullable=False)
    tab = Column(Text, nullable=False)
    data = Column(JSONField, nullable=False)
    updated_at = Column(BigInteger, nullable=False)
    created_at = Column(BigInteger, nullable=False)

    __table_args__ = (
        UniqueConstraint("service_id", "tab", name="uq_service_setting_service_tab"),
    )


class ServiceSettingModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    service_id: str
    tab: str
    data: dict = Field(default_factory=dict)
    updated_at: int
    created_at: int


class ServiceModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    type: str = "generic"
    name: str
    description: Optional[str] = None
    route: str
    icon: Optional[str] = None
    cta: Optional[str] = None
    status: str = "active"
    is_active: bool = True
    sort_order: int = 0
    access_grants: list[AccessGrantModel] = Field(default_factory=list)
    settings: dict = Field(default_factory=dict)
    is_accessible: bool = True
    access_reason: Optional[str] = None
    updated_at: int
    created_at: int


class ServiceForm(BaseModel):
    id: str
    type: str = "generic"
    name: str
    description: Optional[str] = None
    route: str
    icon: Optional[str] = None
    cta: Optional[str] = None
    status: str = "active"
    is_active: bool = True
    sort_order: int = 0
    access_grants: Optional[list[dict]] = None
    settings: dict = Field(default_factory=dict)


class ServiceUpdateForm(BaseModel):
    type: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    route: Optional[str] = None
    icon: Optional[str] = None
    cta: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    access_grants: Optional[list[dict]] = None
    settings: Optional[dict] = None


class ServiceAccessGrantsForm(BaseModel):
    access_grants: list[dict] = Field(default_factory=list)


class ServiceSettingsForm(BaseModel):
    settings: dict = Field(default_factory=dict)


class ServicesTable:
    def user_can_access_service(
        self,
        service: ServiceModel,
        user_id: str,
        user_role: str,
        permission: str = "read",
        user_group_ids: Optional[set[str]] = None,
        db: Optional[Session] = None,
    ) -> tuple[bool, str]:
        if user_role == "admin":
            return True, "admin"

        if service.user_id == user_id:
            return True, "owner"

        group_ids = (
            user_group_ids
            if user_group_ids is not None
            else {group.id for group in Groups.get_groups_by_member_id(user_id, db=db)}
        )
        has_access = AccessGrants.has_access(
            user_id=user_id,
            resource_type="service",
            resource_id=service.id,
            permission=permission,
            user_group_ids=group_ids,
            db=db,
        )
        return (True, "grant") if has_access else (False, "none")

    def _get_access_grants(
        self, service_id: str, db: Optional[Session] = None
    ) -> list[AccessGrantModel]:
        return AccessGrants.get_grants_by_resource("service", service_id, db=db)

    def _get_settings_map(
        self, service_id: str, db: Optional[Session] = None
    ) -> dict[str, dict]:
        with get_db_context(db) as db:
            rows = (
                db.query(ServiceSetting)
                .filter(ServiceSetting.service_id == service_id)
                .all()
            )
            return {row.tab: row.data or {} for row in rows}

    def _to_service_model(
        self,
        service: Service,
        access_grants: Optional[list[AccessGrantModel]] = None,
        settings: Optional[dict] = None,
        db: Optional[Session] = None,
    ) -> ServiceModel:
        service_data = ServiceModel.model_validate(service).model_dump(
            exclude={"access_grants", "settings"}
        )
        service_data["access_grants"] = (
            access_grants
            if access_grants is not None
            else self._get_access_grants(service.id, db=db)
        )
        service_data["settings"] = (
            settings if settings is not None else self._get_settings_map(service.id, db=db)
        )
        return ServiceModel.model_validate(service_data)

    def _set_settings(
        self, service_id: str, settings: dict, db: Optional[Session] = None
    ) -> None:
        with get_db_context(db) as db:
            now = int(time.time())
            for tab, data in (settings or {}).items():
                existing = (
                    db.query(ServiceSetting)
                    .filter(
                        ServiceSetting.service_id == service_id, ServiceSetting.tab == tab
                    )
                    .first()
                )
                if existing:
                    existing.data = data if isinstance(data, dict) else {}
                    existing.updated_at = now
                else:
                    db.add(
                        ServiceSetting(
                            id=str(uuid.uuid4()),
                            service_id=service_id,
                            tab=tab,
                            data=data if isinstance(data, dict) else {},
                            created_at=now,
                            updated_at=now,
                        )
                    )
            db.commit()

    def get_service_by_id(
        self, service_id: str, db: Optional[Session] = None
    ) -> Optional[ServiceModel]:
        with get_db_context(db) as db:
            service = db.query(Service).filter(Service.id == service_id).first()
            return self._to_service_model(service, db=db) if service else None

    def get_services(
        self, active_only: bool = True, db: Optional[Session] = None
    ) -> list[ServiceModel]:
        with get_db_context(db) as db:
            query = db.query(Service)
            if active_only:
                query = query.filter(Service.is_active == True)
            query = query.order_by(Service.sort_order.asc(), Service.created_at.asc())
            services = query.all()
            service_ids = [service.id for service in services]
            grants_map = AccessGrants.get_grants_by_resources("service", service_ids, db=db)
            return [
                self._to_service_model(
                    service,
                    access_grants=grants_map.get(service.id, []),
                    db=db,
                )
                for service in services
            ]

    def get_services_by_user_id(
        self,
        user_id: str,
        permission: str = "read",
        active_only: bool = True,
        db: Optional[Session] = None,
    ) -> list[ServiceModel]:
        services = self.get_services(active_only=active_only, db=db)
        user_group_ids = {
            group.id for group in Groups.get_groups_by_member_id(user_id, db=db)
        }
        return [
            service
            for service in services
            if self.user_can_access_service(
                service=service,
                user_id=user_id,
                user_role="user",
                permission=permission,
                user_group_ids=user_group_ids,
                db=db,
            )[0]
        ]

    def insert_new_service(
        self, form_data: ServiceForm, user_id: str, db: Optional[Session] = None
    ) -> Optional[ServiceModel]:
        with get_db_context(db) as db:
            now = int(time.time())
            service = Service(
                **{
                    **form_data.model_dump(
                        exclude={"access_grants", "settings"},
                    ),
                    "user_id": user_id,
                    "created_at": now,
                    "updated_at": now,
                }
            )
            db.add(service)
            db.commit()
            db.refresh(service)

            AccessGrants.set_access_grants(
                "service", service.id, form_data.access_grants, db=db
            )
            self._set_settings(service.id, form_data.settings, db=db)
            return self._to_service_model(service, db=db)

    def update_service_by_id(
        self, service_id: str, form_data: ServiceUpdateForm, db: Optional[Session] = None
    ) -> Optional[ServiceModel]:
        with get_db_context(db) as db:
            service = db.query(Service).filter(Service.id == service_id).first()
            if not service:
                return None

            update = form_data.model_dump(exclude_unset=True)
            access_grants = update.pop("access_grants", None)
            settings = update.pop("settings", None)

            for key, value in update.items():
                setattr(service, key, value)
            service.updated_at = int(time.time())
            db.commit()
            db.refresh(service)

            if access_grants is not None:
                AccessGrants.set_access_grants("service", service_id, access_grants, db=db)
            if settings is not None:
                self._set_settings(service_id, settings, db=db)

            return self._to_service_model(service, db=db)

    def set_service_access_grants(
        self,
        service_id: str,
        access_grants: list[dict],
        db: Optional[Session] = None,
    ) -> Optional[ServiceModel]:
        with get_db_context(db) as db:
            service = db.query(Service).filter(Service.id == service_id).first()
            if not service:
                return None
            AccessGrants.set_access_grants("service", service_id, access_grants, db=db)
            return self._to_service_model(service, db=db)

    def set_service_settings(
        self, service_id: str, settings: dict, db: Optional[Session] = None
    ) -> Optional[ServiceModel]:
        with get_db_context(db) as db:
            service = db.query(Service).filter(Service.id == service_id).first()
            if not service:
                return None
            self._set_settings(service_id, settings, db=db)
            service.updated_at = int(time.time())
            db.commit()
            return self._to_service_model(service, db=db)

    def deactivate_service_by_id(
        self, service_id: str, db: Optional[Session] = None
    ) -> bool:
        with get_db_context(db) as db:
            service = db.query(Service).filter(Service.id == service_id).first()
            if not service:
                return False
            service.is_active = False
            service.updated_at = int(time.time())
            db.commit()
            return True


Services = ServicesTable()
