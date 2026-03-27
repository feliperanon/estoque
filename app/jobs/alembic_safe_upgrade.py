"""
Executa `alembic upgrade head` de forma segura para bancos que já foram
populados pelo bootstrap antes das migrations serem aplicadas.

Fluxo:
1. Verifica se a tabela alembic_version existe em app_core.
2. Se nao existe mas tabelas criticas ja existem → `alembic stamp head`
   (registra o estado atual como "atualizado" sem rodar DDL).
3. Executa `alembic upgrade head` normalmente.
"""

import subprocess
import sys

from sqlalchemy import inspect, text

from app.core.config import get_settings
from app.db.session import engine


def _has_alembic_version() -> bool:
    settings = get_settings()
    is_sqlite = settings.sqlalchemy_database_url.startswith("sqlite")
    with engine.connect() as conn:
        insp = inspect(conn)
        schema = None if is_sqlite else "app_core"
        return insp.has_table("alembic_version", schema=schema)


def _has_critical_tables() -> bool:
    settings = get_settings()
    is_sqlite = settings.sqlalchemy_database_url.startswith("sqlite")
    with engine.connect() as conn:
        insp = inspect(conn)
        if is_sqlite:
            return insp.has_table("users") and insp.has_table("products")
        return insp.has_table("users", schema="app_core") and insp.has_table(
            "products", schema="app_core"
        )


def _run(cmd: list[str]) -> int:
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode


def main() -> None:
    if not _has_alembic_version() and _has_critical_tables():
        print(
            "[alembic_safe_upgrade] Banco populado sem registro de versao Alembic. "
            "Executando 'alembic stamp head' para registrar estado atual..."
        )
        rc = _run([sys.executable, "-m", "alembic", "stamp", "head"])
        if rc != 0:
            print("[alembic_safe_upgrade] AVISO: stamp falhou, tentando upgrade mesmo assim.")

    print("[alembic_safe_upgrade] Executando 'alembic upgrade head'...")
    rc = _run([sys.executable, "-m", "alembic", "upgrade", "head"])
    if rc != 0:
        print("[alembic_safe_upgrade] ERRO: alembic upgrade head falhou.")
        sys.exit(rc)

    print("[alembic_safe_upgrade] Migrations aplicadas com sucesso.")


if __name__ == "__main__":
    main()
