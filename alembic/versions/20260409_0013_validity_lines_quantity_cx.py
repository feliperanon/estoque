"""Add quantity_cx to validity_lines (lançamento em caixas)

Revision ID: 20260409_0013
Revises: 20260406_0012
Create Date: 2026-04-09

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260409_0013"
down_revision: Union[str, None] = "20260406_0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "validity_lines",
        sa.Column("quantity_cx", sa.Integer(), nullable=False, server_default="0"),
        schema="app_core",
    )
    op.alter_column(
        "validity_lines",
        "quantity_cx",
        server_default=None,
        schema="app_core",
    )


def downgrade() -> None:
    op.drop_column("validity_lines", "quantity_cx", schema="app_core")
