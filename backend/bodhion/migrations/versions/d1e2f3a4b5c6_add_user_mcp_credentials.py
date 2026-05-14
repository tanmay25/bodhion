"""Add user_mcp_credential table

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-05-13 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, None] = "c1d2e3f4a5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_mcp_credential",
        sa.Column("id", sa.Text(), primary_key=True, nullable=False, unique=True),
        sa.Column(
            "user_id",
            sa.Text(),
            sa.ForeignKey("user.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("server_id", sa.Text(), nullable=False),
        sa.Column("auth_type", sa.Text(), nullable=False, server_default="none"),
        sa.Column("encrypted_api_key", sa.Text(), nullable=True),
        sa.Column("oauth_access_token", sa.Text(), nullable=True),
        sa.Column("oauth_refresh_token", sa.Text(), nullable=True),
        sa.Column("token_expires_at", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.BigInteger(), nullable=False),
        sa.Column("updated_at", sa.BigInteger(), nullable=False),
        sa.UniqueConstraint("user_id", "server_id", name="uq_user_mcp_credential"),
    )

    op.create_index(
        "idx_user_mcp_credential_user_id", "user_mcp_credential", ["user_id"]
    )
    op.create_index(
        "idx_user_mcp_credential_server_id", "user_mcp_credential", ["server_id"]
    )


def downgrade() -> None:
    op.drop_index("idx_user_mcp_credential_server_id", table_name="user_mcp_credential")
    op.drop_index("idx_user_mcp_credential_user_id", table_name="user_mcp_credential")
    op.drop_table("user_mcp_credential")
