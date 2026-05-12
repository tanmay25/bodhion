"""Add content_type and source_url to skill table

Revision ID: c1d2e3f4a5b6
Revises: aa7c3f1d9b2e
Create Date: 2026-05-05 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, None] = "aa7c3f1d9b2e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("skill") as batch_op:
        batch_op.add_column(
            sa.Column(
                "content_type",
                sa.String(),
                nullable=False,
                server_default="python",
            )
        )
        batch_op.add_column(
            sa.Column("source_url", sa.Text(), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("skill") as batch_op:
        batch_op.drop_column("source_url")
        batch_op.drop_column("content_type")
