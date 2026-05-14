"""add_mcp_health_log

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-05-14

"""
from typing import Union, Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mcp_health_log",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("server_id", sa.Text(), nullable=False),
        sa.Column("server_name", sa.Text(), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("latency_ms", sa.BigInteger(), nullable=True),
        sa.Column("timestamp", sa.BigInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("id"),
    )
    op.create_index("idx_mcp_health_server_id", "mcp_health_log", ["server_id"])
    op.create_index("idx_mcp_health_timestamp", "mcp_health_log", ["timestamp"])


def downgrade() -> None:
    op.drop_index("idx_mcp_health_timestamp", table_name="mcp_health_log")
    op.drop_index("idx_mcp_health_server_id", table_name="mcp_health_log")
    op.drop_table("mcp_health_log")
