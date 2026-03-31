"""Regressão: remoção de UNIQUE legada em cod_grup_sku no SQLite."""
from sqlalchemy import create_engine, text

from app.services.sqlite_product_constraints import apply_sqlite_product_unique_constraints


def test_sqlite_drops_sku_unique_and_allows_duplicate_sku():
    e = create_engine("sqlite:///:memory:")
    with e.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE products (
                    id INTEGER PRIMARY KEY,
                    cod_grup_sku VARCHAR(120) NOT NULL,
                    cod_produto VARCHAR(120),
                    cod_grup_descricao VARCHAR(255) NOT NULL DEFAULT ''
                )
                """
            )
        )
        conn.execute(text("CREATE UNIQUE INDEX uq_product_sku ON products (cod_grup_sku)"))
        conn.execute(
            text(
                "INSERT INTO products (cod_grup_sku, cod_produto, cod_grup_descricao) "
                "VALUES ('600ML', '1', 'a')"
            )
        )

    with e.begin() as conn:
        apply_sqlite_product_unique_constraints(conn)

    with e.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO products (cod_grup_sku, cod_produto, cod_grup_descricao) "
                "VALUES ('600ML', '135', 'b')"
            )
        )
