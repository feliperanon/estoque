"""Add mate_couro_troca_logs (auditoria Base de Troca)

Revision ID: 20260406_0012
Revises: 20260402_0011
Create Date: 2026-04-06

"""

from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

revision: str = "20260406_0012"
down_revision: Union[str, None] = "20260402_0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "mate_couro_troca_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("client_event_id", sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column("kind", sqlmodel.sql.sqltypes.AutoString(length=24), nullable=False),
        sa.Column("cod_produto", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=False),
        sa.Column("qty_cx_in", sa.Integer(), nullable=False),
        sa.Column("qty_un_in", sa.Integer(), nullable=False),
        sa.Column("pend_cx_before", sa.Integer(), nullable=False),
        sa.Column("pend_un_before", sa.Integer(), nullable=False),
        sa.Column("pend_cx_after", sa.Integer(), nullable=False),
        sa.Column("pend_un_after", sa.Integer(), nullable=False),
        sa.Column("excess_cx", sa.Integer(), nullable=False),
        sa.Column("excess_un", sa.Integer(), nullable=False),
        sa.Column("device_name", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=True),
        sa.Column("actor_username", sqlmodel.sql.sqltypes.AutoString(length=120), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema="app_core",
    )
    op.create_index(
        op.f("ix_app_core_mate_couro_troca_logs_client_event_id"),
        "mate_couro_troca_logs",
        ["client_event_id"],
        unique=True,
        schema="app_core",
    )
    op.create_index(
        op.f("ix_app_core_mate_couro_troca_logs_cod_produto"),
        "mate_couro_troca_logs",
        ["cod_produto"],
        unique=False,
        schema="app_core",
    )
    op.create_index(
        op.f("ix_app_core_mate_couro_troca_logs_kind"),
        "mate_couro_troca_logs",
        ["kind"],
        unique=False,
        schema="app_core",
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_app_core_mate_couro_troca_logs_kind"),
        table_name="mate_couro_troca_logs",
        schema="app_core",
    )
    op.drop_index(
        op.f("ix_app_core_mate_couro_troca_logs_cod_produto"),
        table_name="mate_couro_troca_logs",
        schema="app_core",
    )
    op.drop_index(
        op.f("ix_app_core_mate_couro_troca_logs_client_event_id"),
        table_name="mate_couro_troca_logs",
        schema="app_core",
    )
    op.drop_table("mate_couro_troca_logs", schema="app_core")
