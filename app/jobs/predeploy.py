from sqlalchemy import inspect
from sqlmodel import SQLModel

from app.db.session import engine
from app.db.session import SessionLocal
from app.models import Employee, Product, User
from app.services.bootstrap import ensure_admin_user, ensure_database_ready


def _missing_critical_tables() -> list[str]:
    with SessionLocal() as session:
        inspector = inspect(session.get_bind())
        return [
            table_name
            for table_name in ("employees", "users", "products")
            if not inspector.has_table(table_name, schema="app_core")
        ]


def _ensure_critical_tables() -> None:
    # Fallback defensivo: em alguns ambientes o schema existe, mas as tabelas
    # críticas não ficam visíveis após migração (deploy interrompido/estado parcial).
    SQLModel.metadata.create_all(
        engine,
        tables=[Employee.__table__, User.__table__, Product.__table__],
        checkfirst=True,
    )


def _assert_critical_tables() -> None:
    missing_tables = _missing_critical_tables()
    if not missing_tables:
        return

    _ensure_critical_tables()
    missing_tables = _missing_critical_tables()
    if missing_tables:
        missing = ", ".join(f"app_core.{name}" for name in missing_tables)
        raise RuntimeError(f"Pre-deploy validation failed. Missing tables: {missing}")


def main() -> None:
    ensure_database_ready()
    _assert_critical_tables()
    with SessionLocal() as session:
        ensure_admin_user(session)


if __name__ == "__main__":
    main()