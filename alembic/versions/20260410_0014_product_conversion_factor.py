"""Add conversion_factor to products (UN por 1 CX)

Revision ID: 20260410_0014
Revises: 20260409_0013
Create Date: 2026-04-10

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260410_0014"
down_revision: Union[str, None] = "20260409_0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("conversion_factor", sa.Double(), nullable=True),
        schema="app_core",
    )


def downgrade() -> None:
    op.drop_column("products", "conversion_factor", schema="app_core")
