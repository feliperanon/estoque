"""Add pallet_conversion_factor to products (CX por 1 PL)

Revision ID: 20260428_0015
Revises: 20260410_0014
Create Date: 2026-04-28

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260428_0015"
down_revision: Union[str, None] = "20260410_0014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column("pallet_conversion_factor", sa.Double(), nullable=True),
        schema="app_core",
    )


def downgrade() -> None:
    op.drop_column("products", "pallet_conversion_factor", schema="app_core")
