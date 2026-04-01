"""Add validity_lines (lançamentos de validade por produto)

Revision ID: 20260401_0010
Revises: 20260330_0009
Create Date: 2026-04-01

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "20260401_0010"
down_revision: Union[str, None] = "20260330_0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "validity_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_event_id", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("cod_produto", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("expiration_date", sa.Date(), nullable=False),
        sa.Column("quantity_un", sa.Integer(), nullable=False),
        sa.Column("lot_code", sqlmodel.sql.sqltypes.AutoString(length=80), nullable=True),
        sa.Column("note", sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column("operational_date", sa.Date(), nullable=False),
        sa.Column("observed_at", sa.DateTime(), nullable=False),
        sa.Column("device_name", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=True),
        sa.Column("actor_username", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="app_core",
    )
    op.create_index(
        op.f("ix_app_core_validity_lines_client_event_id"),
        "validity_lines",
        ["client_event_id"],
        unique=True,
        schema="app_core",
    )
    op.create_index(
        op.f("ix_app_core_validity_lines_cod_produto"),
        "validity_lines",
        ["cod_produto"],
        unique=False,
        schema="app_core",
    )
    op.create_index(
        op.f("ix_app_core_validity_lines_operational_date"),
        "validity_lines",
        ["operational_date"],
        unique=False,
        schema="app_core",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_app_core_validity_lines_operational_date"),
        table_name="validity_lines",
        schema="app_core",
    )
    op.drop_index(
        op.f("ix_app_core_validity_lines_cod_produto"),
        table_name="validity_lines",
        schema="app_core",
    )
    op.drop_index(
        op.f("ix_app_core_validity_lines_client_event_id"),
        table_name="validity_lines",
        schema="app_core",
    )
    op.drop_table("validity_lines", schema="app_core")
