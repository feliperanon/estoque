from sqlalchemy import inspect, text
from sqlmodel import SQLModel

from app.db.session import engine
from app.db.session import SessionLocal
from app.models import ChangeLog, Employee, Product, ProductHistory, User
from app.services.bootstrap import ensure_admin_user, ensure_database_ready


def _missing_critical_tables() -> list[str]:
    from app.core.config import get_settings
    settings = get_settings()
    is_sqlite = settings.sqlalchemy_database_url.startswith("sqlite")

    with SessionLocal() as session:
        inspector = inspect(session.get_bind())
        missing: list[str] = []
        if is_sqlite:
            # SQLite não tem schemas — verifica sem schema
            for table_name in ("employees", "users", "products", "product_history"):
                if not inspector.has_table(table_name):
                    missing.append(f"app_core.{table_name}")
            if not inspector.has_table("change_log"):
                missing.append("audit.change_log")
        else:
            app_core_required = ("employees", "users", "products", "product_history")
            for table_name in app_core_required:
                if not inspector.has_table(table_name, schema="app_core"):
                    missing.append(f"app_core.{table_name}")
            if not inspector.has_table("change_log", schema="audit"):
                missing.append("audit.change_log")
        return missing


def _ensure_critical_tables() -> None:
    # Fallback defensivo: em alguns ambientes o schema existe, mas as tabelas
    # críticas não ficam visíveis após migração (deploy interrompido/estado parcial).
    # Criamos na ordem correta para respeitar FK constraints.
    for table in [
        Employee.__table__,
        User.__table__,
        Product.__table__,
        ProductHistory.__table__,
        ChangeLog.__table__,
    ]:
        try:
            SQLModel.metadata.create_all(engine, tables=[table], checkfirst=True)
        except Exception:
            # Tabela pode ter dependência não satisfeita; seguir adiante.
            pass


_BASE_CRITICAL = {"app_core.employees", "app_core.users", "app_core.products"}


def _fix_product_constraints() -> None:
    """Remove uq_product_sku e garante uq_product_cod de forma idempotente.

    A migration 0007/0009 pode nao ter executado se o banco foi criado via
    create_all (bootstrap) antes das migrations. Esta funcao executa o DDL
    diretamente como garantia extra, independente do estado do Alembic.
    Segura para rodar em qualquer estado do banco.
    """
    with engine.begin() as conn:
        dialect = conn.dialect.name
        if dialect != "postgresql":
            return

        # 1. Remove constraint legada que impede multiplos produtos com mesmo SKU.
        has_uq_sku = conn.execute(
            text(
                """
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_schema = 'app_core'
                  AND table_name        = 'products'
                  AND constraint_name   = 'uq_product_sku'
                  AND constraint_type   = 'UNIQUE'
                """
            )
        ).fetchone()
        if has_uq_sku:
            print("[predeploy] Removendo constraint legada uq_product_sku...")
            conn.execute(
                text("ALTER TABLE app_core.products DROP CONSTRAINT uq_product_sku")
            )
            print("[predeploy] uq_product_sku removida.")

        # 2. Garante que cod_produto nao tem NULLs (necessario para a unique).
        conn.execute(
            text(
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
        )

        # 3. Resolve duplicatas de cod_produto antes de criar constraint.
        conn.execute(
            text(
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
        )

        # 4. Cria uq_product_cod se ainda nao existe.
        has_uq_cod = conn.execute(
            text(
                """
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_schema = 'app_core'
                  AND table_name        = 'products'
                  AND constraint_name   = 'uq_product_cod'
                  AND constraint_type   = 'UNIQUE'
                """
            )
        ).fetchone()
        if not has_uq_cod:
            print("[predeploy] Criando constraint uq_product_cod...")
            conn.execute(
                text(
                    "ALTER TABLE app_core.products ADD CONSTRAINT uq_product_cod UNIQUE (cod_produto)"
                )
            )
            print("[predeploy] uq_product_cod criada.")


def _assert_critical_tables() -> None:
    missing_tables = _missing_critical_tables()
    if not missing_tables:
        return

    _ensure_critical_tables()
    missing_tables = _missing_critical_tables()

    # Apenas as tabelas base impedem o deploy. Tabelas de auditoria/histórico
    # podem ser criadas pelo Alembic ou bootstrap sem bloquear a inicialização.
    blocking = [t for t in missing_tables if t in _BASE_CRITICAL]
    if blocking:
        missing = ", ".join(blocking)
        raise RuntimeError(f"Pre-deploy validation failed. Missing critical tables: {missing}")


def main() -> None:
    ensure_database_ready()
    _assert_critical_tables()
    with SessionLocal() as session:
        ensure_admin_user(session)


if __name__ == "__main__":
    main()