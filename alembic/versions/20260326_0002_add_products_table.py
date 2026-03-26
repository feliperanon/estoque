"""add products table

Revision ID: 20260326_0002
Revises: 20260324_0001
Create Date: 2026-03-26 10:40:00

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260326_0002"
down_revision = "20260324_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("cod_grup_sp", sa.String(length=60), nullable=True),
        sa.Column("cod_grup_cia", sa.String(length=60), nullable=True),
        sa.Column("cod_grup_tipo", sa.String(length=60), nullable=True),
        sa.Column("cod_grup_familia", sa.String(length=60), nullable=True),
        sa.Column("cod_grup_segmento", sa.String(length=60), nullable=True),
        sa.Column("cod_grup_marca", sa.String(length=80), nullable=True),
        sa.Column("cod_grup_descricao", sa.String(length=255), nullable=False),
        sa.Column("cod_grup_sku", sa.String(length=120), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=True),
        sa.Column("grup_prioridade", sa.String(length=80), nullable=True),
        sa.Column("legacy_id", sa.Integer(), nullable=True),
        sa.Column("source_system", sa.String(length=100), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("cod_grup_sku", name="uq_product_sku"),
        schema="app_core",
    )
    op.create_index("ix_app_core_products_cod_grup_sp", "products", ["cod_grup_sp"], unique=False, schema="app_core")
    op.create_index("ix_app_core_products_cod_grup_cia", "products", ["cod_grup_cia"], unique=False, schema="app_core")
    op.create_index("ix_app_core_products_cod_grup_sku", "products", ["cod_grup_sku"], unique=False, schema="app_core")


def downgrade() -> None:
    op.drop_index("ix_app_core_products_cod_grup_sku", table_name="products", schema="app_core")
    op.drop_index("ix_app_core_products_cod_grup_cia", table_name="products", schema="app_core")
    op.drop_index("ix_app_core_products_cod_grup_sp", table_name="products", schema="app_core")
    op.drop_table("products", schema="app_core")