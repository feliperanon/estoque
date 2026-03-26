from sqlalchemy import inspect

from app.db.session import SessionLocal
from app.services.bootstrap import ensure_admin_user, ensure_database_ready


def _assert_critical_tables() -> None:
    with SessionLocal() as session:
        inspector = inspect(session.get_bind())
        missing_tables = [
            table_name
            for table_name in ("employees", "users", "products")
            if not inspector.has_table(table_name, schema="app_core")
        ]
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