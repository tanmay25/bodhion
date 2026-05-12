"""add service and service_settings tables

Revision ID: e7f9de0b12ab
Revises: f1e2d3c4b5a6
Create Date: 2026-03-20 00:00:00.000000
"""

from typing import Sequence, Union
import time
import uuid

from alembic import op
import sqlalchemy as sa

from bodhion.migrations.util import get_existing_tables

revision: str = "e7f9de0b12ab"
down_revision: Union[str, None] = "f1e2d3c4b5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_SERVICES = [
    {
        "id": "chat-engine",
        "type": "chat",
        "name": "Chat Engine",
        "description": "Launch a new AI chat session with your available models and tools.",
        "route": "/chat-engine",
        "cta": "Open Chat",
        "status": "active",
        "icon": "chat",
        "sort_order": 10,
    },
    {
        "id": "resume-analyzer",
        "type": "resume",
        "name": "Resume Analyzer",
        "description": "Review and score resumes with structured feedback and improvement suggestions.",
        "route": "/services/resume-analyzer",
        "cta": "Open Service",
        "status": "active",
        "icon": "resume",
        "sort_order": 20,
    },
    {
        "id": "it-help-desk",
        "type": "support",
        "name": "IT Help Desk",
        "description": "Triage incidents, gather context, and speed up internal support workflows.",
        "route": "/services/it-help-desk",
        "cta": "Open Service",
        "status": "active",
        "icon": "it",
        "sort_order": 30,
    },
    {
        "id": "knowledge-assistant",
        "type": "knowledge",
        "name": "Knowledge Assistant",
        "description": "Search and summarize internal documentation with grounded answers.",
        "route": "/services/knowledge-assistant",
        "cta": "Coming Soon",
        "status": "coming-soon",
        "icon": "sparkles",
        "sort_order": 40,
    },
    {
        "id": "workflow-automation",
        "type": "workflow",
        "name": "Workflow Automation",
        "description": "Build repeatable AI workflows for approvals, routing, and follow-ups.",
        "route": "/services/workflow-automation",
        "cta": "Coming Soon",
        "status": "coming-soon",
        "icon": "sparkles",
        "sort_order": 50,
    },
    {
        "id": "TestModelService",
        "type": "generic",
        "name": "MyService",
        "description": "This is test service just to check the dynamic service configuration",
        "route": "/myservice",
        "cta": "Open Service",
        "status": "coming-soon",
        "icon": "sparkles",
        "sort_order": 101,
    },
]


def upgrade() -> None:
    existing_tables = set(get_existing_tables())

    if "service" not in existing_tables:
        op.create_table(
            "service",
            sa.Column("id", sa.Text(), nullable=False, primary_key=True),
            sa.Column("user_id", sa.Text(), nullable=False),
            sa.Column("type", sa.Text(), nullable=False, server_default="generic"),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("route", sa.Text(), nullable=False),
            sa.Column("icon", sa.Text(), nullable=True),
            sa.Column("cta", sa.Text(), nullable=True),
            sa.Column("status", sa.Text(), nullable=False, server_default="active"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("updated_at", sa.BigInteger(), nullable=False),
            sa.Column("created_at", sa.BigInteger(), nullable=False),
        )
        op.create_index("idx_service_is_active", "service", ["is_active"])
        op.create_index("idx_service_sort_order", "service", ["sort_order"])

    if "service_setting" not in existing_tables:
        op.create_table(
            "service_setting",
            sa.Column("id", sa.Text(), nullable=False, primary_key=True),
            sa.Column("service_id", sa.Text(), nullable=False),
            sa.Column("tab", sa.Text(), nullable=False),
            sa.Column("data", sa.JSON(), nullable=False),
            sa.Column("updated_at", sa.BigInteger(), nullable=False),
            sa.Column("created_at", sa.BigInteger(), nullable=False),
            sa.UniqueConstraint("service_id", "tab", name="uq_service_setting_service_tab"),
        )
        op.create_index(
            "idx_service_setting_service_id", "service_setting", ["service_id"]
        )

    conn = op.get_bind()
    now = int(time.time())

    # Seed default services if missing.
    for service in DEFAULT_SERVICES:
        existing = conn.execute(
            sa.text("SELECT id FROM service WHERE id = :id"),
            {"id": service["id"]},
        ).fetchone()
        if existing:
            continue

        conn.execute(
            sa.text(
                """
                INSERT INTO service (
                    id, user_id, type, name, description, route, icon, cta, status,
                    is_active, sort_order, created_at, updated_at
                )
                VALUES (
                    :id, :user_id, :type, :name, :description, :route, :icon, :cta, :status,
                    :is_active, :sort_order, :created_at, :updated_at
                )
                """
            ),
            {
                "id": service["id"],
                "user_id": "system",
                "type": service["type"],
                "name": service["name"],
                "description": service["description"],
                "route": service["route"],
                "icon": service["icon"],
                "cta": service["cta"],
                "status": service["status"],
                "is_active": True,
                "sort_order": service["sort_order"],
                "created_at": now,
                "updated_at": now,
            },
        )

    # Seed public read grants for default services for backward compatibility.
    if "access_grant" in existing_tables:
        for service in DEFAULT_SERVICES:
            existing_grant = conn.execute(
                sa.text(
                    """
                    SELECT id FROM access_grant
                    WHERE resource_type = 'service'
                      AND resource_id = :resource_id
                      AND principal_type = 'user'
                      AND principal_id = '*'
                      AND permission = 'read'
                    """
                ),
                {"resource_id": service["id"]},
            ).fetchone()
            if existing_grant:
                continue

            conn.execute(
                sa.text(
                    """
                    INSERT INTO access_grant (
                        id, resource_type, resource_id, principal_type, principal_id, permission, created_at
                    )
                    VALUES (
                        :id, 'service', :resource_id, 'user', '*', 'read', :created_at
                    )
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "resource_id": service["id"],
                    "created_at": now,
                },
            )


def downgrade() -> None:
    existing_tables = set(get_existing_tables())

    if "access_grant" in existing_tables:
        conn = op.get_bind()
        conn.execute(
            sa.text("DELETE FROM access_grant WHERE resource_type = 'service'")
        )

    if "service_setting" in existing_tables:
        try:
            op.drop_index("idx_service_setting_service_id", table_name="service_setting")
        except Exception:
            pass
        op.drop_table("service_setting")

    if "service" in existing_tables:
        try:
            op.drop_index("idx_service_sort_order", table_name="service")
        except Exception:
            pass
        try:
            op.drop_index("idx_service_is_active", table_name="service")
        except Exception:
            pass
        op.drop_table("service")
