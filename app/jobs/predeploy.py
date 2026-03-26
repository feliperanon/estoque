from sqlalchemy import inspect
from sqlmodel import SQLModel

from app.db.session import engine
from app.db.session import SessionLocal
from app.models import ChangeLog, Employee, Product, ProductHistory, User
from app.services.bootstrap import ensure_admin_user, ensure_database_ready


def _missing_critical_tables() -> list[str]:
    with SessionLocal() as session:
        inspector = inspect(session.get_bind())
        missing: list[str] = []
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
    SQLModel.metadata.create_all(
        engine,
        tables=[
            Employee.__table__,
            User.__table__,
            Product.__table__,
            ProductHistory.__table__,
            ChangeLog.__table__,
        ],
        checkfirst=True,
    )


def _assert_critical_tables() -> None:
    missing_tables = _missing_critical_tables()
    if not missing_tables:
        return

    _ensure_critical_tables()
    missing_tables = _missing_critical_tables()
    if missing_tables:
        missing = ", ".join(missing_tables)
        raise RuntimeError(f"Pre-deploy validation failed. Missing tables: {missing}")


def main() -> None:
    ensure_database_ready()
    _assert_critical_tables()
    with SessionLocal() as session:
        ensure_admin_user(session)


if __name__ == "__main__":
    main()