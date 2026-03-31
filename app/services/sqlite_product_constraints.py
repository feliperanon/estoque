"""Ajuste de constraints de produtos em SQLite (dev / bancos legados).

A migration 0002 criou UNIQUE em cod_grup_sku; o negócio passou a usar unicidade
por cod_produto. No Postgres isso foi corrigido nas migrations 0007/0009; em SQLite
as migrations equivalentes não rodam, e o bootstrap pode deixar uq_product_sku.
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection

logger = logging.getLogger(__name__)


def apply_sqlite_product_unique_constraints(connection: Connection) -> None:
    """Remove UNIQUE legada em cod_grup_sku e garante UNIQUE em cod_produto (idempotente)."""
    dialect = connection.dialect.name
    if dialect != "sqlite":
        return

    connection.execute(text("DROP INDEX IF EXISTS uq_product_sku"))
    connection.execute(
        text(
            """
            UPDATE products
            SET cod_produto = COALESCE(
                NULLIF(TRIM(cod_produto), ''),
                NULLIF(TRIM(cod_grup_sku), ''),
                CAST(id AS TEXT)
            )
            WHERE cod_produto IS NULL OR TRIM(cod_produto) = ''
            """
        )
    )
    connection.execute(
        text(
            """
            UPDATE products AS p1
            SET cod_produto = TRIM(p1.cod_produto) || '-dup-' || CAST(p1.id AS TEXT)
            WHERE EXISTS (
                SELECT 1 FROM products p2
                WHERE TRIM(COALESCE(p2.cod_produto, '')) = TRIM(COALESCE(p1.cod_produto, ''))
                  AND p2.id < p1.id
            )
            """
        )
    )

    row = connection.execute(
        text("SELECT 1 FROM sqlite_master WHERE type='index' AND name='uq_product_cod'")
    ).fetchone()
    if not row:
        try:
            connection.execute(text("CREATE UNIQUE INDEX uq_product_cod ON products(cod_produto)"))
        except Exception:
            logger.exception(
                "Nao foi possivel criar uq_product_cod em SQLite; verifique duplicatas em cod_produto"
            )
            raise
