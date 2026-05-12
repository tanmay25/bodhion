"""merge service and scim heads

Revision ID: aa7c3f1d9b2e
Revises: b2c3d4e5f6a7, e7f9de0b12ab
Create Date: 2026-03-20 00:00:01.000000
"""

from typing import Sequence, Union


revision: str = "aa7c3f1d9b2e"
down_revision: Union[str, Sequence[str], None] = (
    "b2c3d4e5f6a7",
    "e7f9de0b12ab",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Merge-point migration only. No schema/data change.
    pass


def downgrade() -> None:
    # Merge-point migration only. No schema/data change.
    pass
