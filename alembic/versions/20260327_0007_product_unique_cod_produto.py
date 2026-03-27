"""unicidade por cod_produto (antes cod_grup_sku)

Revision ID: 20260327_0007
Revises: 20260326_0006
Create Date: 2026-03-27

"""

import sqlalchemy as sa
from alembic import op


revision = "20260327_0007"
down_revision = "20260326_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        """
        UPDATE app_core.products
        SET cod_produto = COALESCE(
            NULLIF(TRIM(cod_produto), ''),
            NULLIF(TRIM(cod_grup_sku), ''),
            id::text
        )
        WHERE cod_produto IS NULL OR TRIM(cod_produto) = ''
        """,
    )
    op.execute(
        """
        UPDATE app_core.products AS p1
        SET cod_produto = TRIM(p1.cod_produto) || '-' || p1.id::text
        WHERE EXISTS (
            SELECT 1 FROM app_core.products p2
            WHERE TRIM(COALESCE(p2.cod_produto, '')) = TRIM(COALESCE(p1.cod_produto, ''))
              AND p2.id < p1.id
        )
        """,
    )
    op.drop_constraint("uq_product_sku", "products", schema="app_core", type_="unique")
    op.create_unique_constraint("uq_product_cod", "products", ["cod_produto"], schema="app_core")
    op.alter_column(
        "products",
        "cod_produto",
        existing_type=sa.String(length=120),
        nullable=False,
        schema="app_core",
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.alter_column(
        "products",
        "cod_produto",
        existing_type=sa.String(length=120),
        nullable=True,
        schema="app_core",
    )
    op.drop_constraint("uq_product_cod", "products", schema="app_core", type_="unique")
    op.create_unique_constraint("uq_product_sku", "products", ["cod_grup_sku"], schema="app_core")
