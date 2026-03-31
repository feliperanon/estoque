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
    """Remove índices UNIQUE nomeados que cubram somente cod_grup_sku.

    Índices ``sqlite_autoindex_*`` vêm de UNIQUE na definição da tabela; não podem ser
    removidos com ``DROP INDEX`` — nesse caso :func:`_rebuild_sqlite_products_without_sku_unique`
    recria a tabela sem esse UNIQUE.
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
            continue
        info_rows = bind.execute(text(f'PRAGMA index_info("{idx_name}")')).fetchall()
        col_names = [r[2] for r in info_rows if r[2] is not None]
        if col_names == ["cod_grup_sku"]:
            bind.execute(text(f'DROP INDEX IF EXISTS "{idx_name}"'))


def _sqlite_unique_index_is_only_cod_grup_sku(bind: Any, idx_name: str) -> bool:
    info_rows = bind.execute(text(f'PRAGMA index_info("{idx_name}")')).fetchall()
    col_names = [r[2] for r in info_rows if r[2] is not None]
    return col_names == ["cod_grup_sku"]


def _needs_rebuild_sqlite_products_for_sku_unique(bind: Any) -> bool:
    """True se ainda existe unicidade apenas em cod_grup_sku (incl. sqlite_autoindex_*)."""
    rows = bind.execute(text("PRAGMA index_list('products')")).fetchall()
    for row in rows:
        is_unique = row[2]
        if not is_unique:
            continue
        idx_name = str(row[1])
        if _sqlite_unique_index_is_only_cod_grup_sku(bind, idx_name):
            return True
    return False


def _build_create_products_table_sql_from_pragma(bind: Any, new_name: str) -> str:
    """CREATE TABLE sem UNIQUE em cod_grup_sku; PK em id preservada."""
    rows = bind.execute(text("PRAGMA table_info(products)")).fetchall()
    col_defs: list[str] = []
    for _cid, name, col_type, notnull, dflt, pk in rows:
        ctype = (col_type or "TEXT").strip() or "TEXT"
        qn = f'"{name}"'
        if pk:
            if str(name).lower() == "id":
                col_defs.append(f"{qn} INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT")
            else:
                nn = " NOT NULL" if notnull else ""
                col_defs.append(f"{qn} {ctype}{nn} PRIMARY KEY")
            continue
        parts = [qn, ctype]
        if notnull:
            parts.append("NOT NULL")
        if dflt is not None:
            parts.append(f"DEFAULT {dflt}")
        col_defs.append(" ".join(parts))
    return f'CREATE TABLE "{new_name}" ({", ".join(col_defs)})'


def _recreate_sqlite_product_secondary_indexes(bind: Any) -> None:
    """Índices não únicos esperados pelo modelo (unicidade de cod_produto vem depois)."""
    rows = bind.execute(text("PRAGMA table_info(products)")).fetchall()
    cols = {str(r[1]) for r in rows}
    for idx_name, col in (
        ("ix_products_legacy_id", "legacy_id"),
        ("ix_products_cod_grup_sp", "cod_grup_sp"),
        ("ix_products_cod_grup_cia", "cod_grup_cia"),
        ("ix_products_cod_produto", "cod_produto"),
        ("ix_products_cod_grup_sku", "cod_grup_sku"),
    ):
        if col not in cols:
            continue
        bind.execute(
            text(f'CREATE INDEX IF NOT EXISTS "{idx_name}" ON products("{col}")'),
        )


def _rebuild_sqlite_products_without_sku_unique(bind: Any) -> None:
    """Recria ``products`` copiando linhas, sem UNIQUE legado em cod_grup_sku (FK product_history preserva ids)."""
    tmp = "products__rebuild_no_sku_uq"
    create_sql = _build_create_products_table_sql_from_pragma(bind, tmp)
    bind.execute(text("PRAGMA foreign_keys=OFF"))
    try:
        bind.execute(text(f"DROP TABLE IF EXISTS {tmp}"))
        bind.execute(text(create_sql))
        bind.execute(text(f"INSERT INTO {tmp} SELECT * FROM products"))
        bind.execute(text("DROP TABLE products"))
        bind.execute(text(f'ALTER TABLE "{tmp}" RENAME TO products'))
    finally:
        bind.execute(text("PRAGMA foreign_keys=ON"))
    _recreate_sqlite_product_secondary_indexes(bind)
    logger.info(
        "SQLite: tabela products recriada sem UNIQUE em cod_grup_sku; "
        "indices secundarios e FKs (product_history) preservados por id."
    )


def apply_sqlite_product_unique_constraints(bind: Any) -> None:
    """Remove UNIQUE legada em cod_grup_sku e garante UNIQUE em cod_produto (idempotente).

    `bind` pode ser Connection (bootstrap) ou Session (rotas); ambos expõem .execute no SA2.
    """
    if _dialect_name(bind) != "sqlite":
        return

    _drop_sqlite_unique_indexes_on_cod_grup_sku_only(bind)

    if _needs_rebuild_sqlite_products_for_sku_unique(bind):
        _rebuild_sqlite_products_without_sku_unique(bind)

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
