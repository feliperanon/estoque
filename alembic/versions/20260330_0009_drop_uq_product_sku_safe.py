"""drop uq_product_sku se ainda existir (idempotente)

A migration 0007 deveria ter removido esta constraint, mas pode nao ter
executado no ambiente de producao. Esta migration verifica a existencia
antes de tentar remover, evitando erro em bancos ja corrigidos.

Revision ID: 20260330_0009
Revises: 20260330_0008
Create Date: 2026-03-30

"""

import sqlalchemy as sa
from alembic import op


revision = "20260330_0009"
down_revision = "0008_inventory_imports"
branch_labels = None
depends_on = None


def _constraint_exists(bind, constraint_name: str, table_name: str, schema: str) -> bool:
    result = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.table_constraints
            WHERE constraint_schema = :schema
              AND table_name        = :table
              AND constraint_name   = :name
              AND constraint_type   = 'UNIQUE'
            """
        ),
        {"schema": schema, "table": table_name, "name": constraint_name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    # Remove constraint legada apenas se ainda existir (idempotente).
    if _constraint_exists(bind, "uq_product_sku", "products", "app_core"):
        op.drop_constraint("uq_product_sku", "products", schema="app_core", type_="unique")

    # Garante que uq_product_cod existe (pode ter sido criada pela 0007 ou nao).
    if not _constraint_exists(bind, "uq_product_cod", "products", "app_core"):
        # Resolve duplicatas de cod_produto antes de criar constraint.
        op.execute(
            """
            UPDATE app_core.products
            SET cod_produto = COALESCE(
                NULLIF(TRIM(cod_produto), ''),
                NULLIF(TRIM(cod_grup_sku), ''),
                id::text
            )
            WHERE cod_produto IS NULL OR TRIM(cod_produto) = ''
            """
        )
        op.execute(
            """
            UPDATE app_core.products AS p1
            SET cod_produto = TRIM(p1.cod_produto) || '-dup-' || p1.id::text
            WHERE EXISTS (
                SELECT 1 FROM app_core.products p2
                WHERE TRIM(COALESCE(p2.cod_produto, '')) = TRIM(COALESCE(p1.cod_produto, ''))
                  AND p2.id < p1.id
            )
            """
        )
        op.create_unique_constraint("uq_product_cod", "products", ["cod_produto"], schema="app_core")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    if _constraint_exists(bind, "uq_product_cod", "products", "app_core"):
        op.drop_constraint("uq_product_cod", "products", schema="app_core", type_="unique")

    if not _constraint_exists(bind, "uq_product_sku", "products", "app_core"):
        op.create_unique_constraint("uq_product_sku", "products", ["cod_grup_sku"], schema="app_core")
