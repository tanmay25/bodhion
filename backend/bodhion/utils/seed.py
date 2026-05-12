"""
Startup seed: ensures default services (and their public-read access grants)
are present in the database every time the application launches.

Idempotent — safe to call on every boot.  Inserts only what is missing;
never overwrites existing rows.
"""

import logging
import time
import uuid
from typing import Optional

from sqlalchemy.orm import Session

log = logging.getLogger(__name__)

# ── Default service definitions ────────────────────────────────────────────────
# Keep this list in sync with:
#   backend/bodhion/migrations/versions/e7f9de0b12ab_add_service_and_service_settings_tables.py

DEFAULT_SERVICES: list[dict] = [
    {
        "id": "chat-engine",
        "type": "chat",
        "name": "Chat Engine",
        "description": "Launch a new AI chat session with your available models and tools.",
        "route": "/chat-engine",
        "icon": "chat",
        "cta": "Open Chat",
        "status": "active",
        "sort_order": 10,
    },
    {
        "id": "resume-analyzer",
        "type": "resume",
        "name": "Resume Analyzer",
        "description": "Review and score resumes with structured feedback and improvement suggestions.",
        "route": "/services/resume-analyzer",
        "icon": "resume",
        "cta": "Open Service",
        "status": "active",
        "sort_order": 20,
    },
    {
        "id": "it-help-desk",
        "type": "support",
        "name": "IT Help Desk",
        "description": "Triage incidents, gather context, and speed up internal support workflows.",
        "route": "/services/it-help-desk",
        "icon": "it",
        "cta": "Open Service",
        "status": "active",
        "sort_order": 30,
    },
    {
        "id": "knowledge-assistant",
        "type": "knowledge",
        "name": "Knowledge Assistant",
        "description": "Search and summarize internal documentation with grounded answers.",
        "route": "/services/knowledge-assistant",
        "icon": "sparkles",
        "cta": "Coming Soon",
        "status": "coming-soon",
        "sort_order": 40,
    },
    {
        "id": "workflow-automation",
        "type": "workflow",
        "name": "Workflow Automation",
        "description": "Build repeatable AI workflows for approvals, routing, and follow-ups.",
        "route": "/services/workflow-automation",
        "icon": "sparkles",
        "cta": "Coming Soon",
        "status": "coming-soon",
        "sort_order": 50,
    },
    {
        "id": "TestModelService",
        "type": "generic",
        "name": "MyService",
        "description": "This is test service just to check the dynamic service configuration",
        "route": "/myservice",
        "icon": "sparkles",
        "cta": "Open Service",
        "status": "coming-soon",
        "sort_order": 101,
    },
]


def seed_default_services(db: Optional[Session] = None) -> None:
    """
    Insert any missing default services and their public-read access grants.

    Parameters
    ----------
    db : Session, optional
        An existing SQLAlchemy session.  When omitted a new session is
        opened and committed automatically via ``get_db_context``.
    """
    from bodhion.internal.db import get_db_context
    from bodhion.models.services import Service
    from bodhion.models.access_grants import AccessGrant

    services_inserted = 0
    grants_inserted = 0

    try:
        with get_db_context(db) as session:
            now = int(time.time())

            for svc in DEFAULT_SERVICES:
                # ── service row ────────────────────────────────────────────
                exists = (
                    session.query(Service)
                    .filter(Service.id == svc["id"])
                    .first()
                )
                if not exists:
                    session.add(
                        Service(
                            id=svc["id"],
                            user_id="system",
                            type=svc.get("type", "generic"),
                            name=svc["name"],
                            description=svc.get("description"),
                            route=svc["route"],
                            icon=svc.get("icon"),
                            cta=svc.get("cta"),
                            status=svc.get("status", "active"),
                            is_active=True,
                            sort_order=svc.get("sort_order", 0),
                            created_at=now,
                            updated_at=now,
                        )
                    )
                    services_inserted += 1

                # ── public-read access grant ───────────────────────────────
                grant_exists = (
                    session.query(AccessGrant)
                    .filter_by(
                        resource_type="service",
                        resource_id=svc["id"],
                        principal_type="user",
                        principal_id="*",
                        permission="read",
                    )
                    .first()
                )
                if not grant_exists:
                    session.add(
                        AccessGrant(
                            id=str(uuid.uuid4()),
                            resource_type="service",
                            resource_id=svc["id"],
                            principal_type="user",
                            principal_id="*",
                            permission="read",
                            created_at=now,
                        )
                    )
                    grants_inserted += 1

            session.commit()

    except Exception as exc:
        log.warning(f"[seed] seed_default_services encountered an error: {exc}")
        raise

    if services_inserted or grants_inserted:
        log.info(
            f"[seed] Seeded {services_inserted} service(s) and "
            f"{grants_inserted} access grant(s)."
        )
    else:
        log.debug("[seed] All default services already present — nothing inserted.")
