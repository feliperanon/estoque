"""Add recount_signals (solicitação analista → conferente por dia)

Revision ID: 20260402_0011
Revises: 20260401_0010
Create Date: 2026-04-02

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "20260402_0011"
down_revision: Union[str, None] = "20260401_0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recount_signals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("operational_date", sa.Date(), nullable=False),
        sa.Column("cod_produto", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("requested_by", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=True),
        sa.Column("requested_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("operational_date", "cod_produto", name="uq_recount_signal_day_cod"),
        schema="app_core",
    )
    op.create_index(
        op.f("ix_app_core_recount_signals_cod_produto"),
        "recount_signals",
        ["cod_produto"],
        unique=False,
        schema="app_core",
    )
    op.create_index(
        op.f("ix_app_core_recount_signals_operational_date"),
        "recount_signals",
        ["operational_date"],
        unique=False,
        schema="app_core",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_app_core_recount_signals_operational_date"),
        table_name="recount_signals",
        schema="app_core",
    )
    op.drop_index(
        op.f("ix_app_core_recount_signals_cod_produto"),
        table_name="recount_signals",
        schema="app_core",
    )
    op.drop_table("recount_signals", schema="app_core")
