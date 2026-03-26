"""add product price, created_at and product_history table

Revision ID: 20260326_0003
Revises: 20260326_0002
Create Date: 2026-03-26 18:00:00

"""

from alembic import op
import sqlalchemy as sa


revision = "20260326_0003"
down_revision = "20260326_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("price", sa.Float(), nullable=True), schema="app_core")
    op.add_column(
        "products",
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        schema="app_core",
    )

    op.create_table(
        "product_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("product_id", sa.Integer(), sa.ForeignKey("app_core.products.id"), nullable=False),
        sa.Column("field_name", sa.String(length=100), nullable=False),
        sa.Column("old_value", sa.String(length=500), nullable=True),
        sa.Column("new_value", sa.String(length=500), nullable=True),
        sa.Column("changed_by", sa.String(length=100), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema="app_core",
    )
    op.create_index(
        "ix_app_core_product_history_product_id",
        "product_history",
        ["product_id"],
        unique=False,
        schema="app_core",
    )


def downgrade() -> None:
    op.drop_index("ix_app_core_product_history_product_id", table_name="product_history", schema="app_core")
    op.drop_table("product_history", schema="app_core")
    op.drop_column("products", "created_at", schema="app_core")
    op.drop_column("products", "price", schema="app_core")
