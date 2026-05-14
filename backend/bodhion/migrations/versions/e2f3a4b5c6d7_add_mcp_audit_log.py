"""Add mcp_audit_log table

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-05-13 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mcp_audit_log",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False, unique=True),
        sa.Column("user_id", sa.Text(), nullable=True),
        sa.Column("server_id", sa.Text(), nullable=True),
        sa.Column("server_name", sa.Text(), nullable=True),
        sa.Column("tool_name", sa.Text(), nullable=True),
        sa.Column("input_summary", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False, server_default="success"),
        sa.Column("error_type", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.BigInteger(), nullable=True),
        sa.Column("chat_id", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.BigInteger(), nullable=False),
    )

    op.create_index("idx_mcp_audit_user_id", "mcp_audit_log", ["user_id"])
    op.create_index("idx_mcp_audit_server_id", "mcp_audit_log", ["server_id"])
    op.create_index("idx_mcp_audit_timestamp", "mcp_audit_log", ["timestamp"])
    op.create_index("idx_mcp_audit_status", "mcp_audit_log", ["status"])


def downgrade() -> None:
    op.drop_index("idx_mcp_audit_status", table_name="mcp_audit_log")
    op.drop_index("idx_mcp_audit_timestamp", table_name="mcp_audit_log")
    op.drop_index("idx_mcp_audit_server_id", table_name="mcp_audit_log")
    op.drop_index("idx_mcp_audit_user_id", table_name="mcp_audit_log")
    op.drop_table("mcp_audit_log")
