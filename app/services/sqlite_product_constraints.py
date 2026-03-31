"""Ajuste de constraints de produtos em SQLite (dev / bancos legados).

A migration 0002 criou UNIQUE em cod_grup_sku; o negócio passou a usar unicidade
por cod_produto. No Postgres isso foi corrigido nas migrations 0007/0009; em SQLite
as migrations equivalentes não rodam. O índice único pode se chamar uq_product_sku
ou sqlite_autoindex_* conforme origem (Alembic vs SQLAlchemy create_all).
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text

logger = logging.getLogger(__name__)


def _dialect_name(bind: Any) -> str:
    d = getattr(bind, "dialect", None)
    if d is not None:
        return d.name
    get_bind = getattr(bind, "get_bind", None)
    if callable(get_bind):
        b = get_bind()
        if b is not None and getattr(b, "dialect", None) is not None:
            return b.dialect.name
    return ""


def _drop_sqlite_unique_indexes_on_cod_grup_sku_only(bind: Any) -> None:
    """Remove qualquer índice UNIQUE que cubra somente cod_grup_sku (nome variável no SQLite).

    Índices ``sqlite_autoindex_*`` pertencem a UNIQUE/PK implícitos: o SQLite **não** permite
    ``DROP INDEX`` neles; é preciso recriar a tabela. Aqui só removemos índices nomeados
    (ex.: ``uq_product_sku``) e ignoramos os auto com aviso.
    """
    bind.execute(text("DROP INDEX IF EXISTS uq_product_sku"))

    rows = bind.execute(text("PRAGMA index_list('products')")).fetchall()
    for row in rows:
        idx_name = row[1]
        is_unique = row[2]
        if not is_unique:
            continue
        name_str = str(idx_name)
        if name_str.startswith("sqlite_autoindex_"):
            info_rows = bind.execute(text(f'PRAGMA index_info("{idx_name}")')).fetchall()
            col_names = [r[2] for r in info_rows if r[2] is not None]
            if col_names == ["cod_grup_sku"]:
                logger.warning(
                    "SQLite: UNIQUE em cod_grup_sku via %s nao pode ser removido com "
                    "DROP INDEX; unicidade legada pode permanecer ate recriar a tabela.",
                    name_str,
                )
            continue
        info_rows = bind.execute(text(f'PRAGMA index_info("{idx_name}")')).fetchall()
        col_names = [r[2] for r in info_rows if r[2] is not None]
        if col_names == ["cod_grup_sku"]:
            bind.execute(text(f'DROP INDEX IF EXISTS "{idx_name}"'))


def apply_sqlite_product_unique_constraints(bind: Any) -> None:
    """Remove UNIQUE legada em cod_grup_sku e garante UNIQUE em cod_produto (idempotente).

    `bind` pode ser Connection (bootstrap) ou Session (rotas); ambos expõem .execute no SA2.
    """
    if _dialect_name(bind) != "sqlite":
        return

    _drop_sqlite_unique_indexes_on_cod_grup_sku_only(bind)

    bind.execute(
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
    bind.execute(
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

    row = bind.execute(
        text("SELECT 1 FROM sqlite_master WHERE type='index' AND name='uq_product_cod'")
    ).fetchone()
    if not row:
        try:
            bind.execute(text("CREATE UNIQUE INDEX uq_product_cod ON products(cod_produto)"))
        except Exception:
            logger.exception(
                "Nao foi possivel criar uq_product_cod em SQLite; verifique duplicatas em cod_produto"
            )
            raise
