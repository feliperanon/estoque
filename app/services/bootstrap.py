from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel, Session, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import engine
from app.models import *  # noqa: F401,F403
from app.models import User


def ensure_database_ready() -> None:
    settings = get_settings()

    if settings.sqlalchemy_database_url.startswith("sqlite"):
        for table in SQLModel.metadata.tables.values():
            table.schema = None
        SQLModel.metadata.create_all(engine)
        _ensure_products_compat_columns(is_sqlite=True)
        return

    with engine.begin() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS legacy_snapshot"))
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS app_core"))
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS audit"))
    _ensure_products_compat_columns(is_sqlite=False)


def _ensure_products_compat_columns(*, is_sqlite: bool) -> None:
    """
    Ajusta bancos SQLite legados que foram criados antes de novas colunas.
    Evita erro 500 em queries quando o modelo ja possui campos adicionais.
    """
    inspector = inspect(engine)
    table_schema = None if is_sqlite else "app_core"
    if not inspector.has_table("products", schema=table_schema):
        return

    columns = {col["name"] for col in inspector.get_columns("products", schema=table_schema)}
    with engine.begin() as connection:
        if "price" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE products ADD COLUMN price FLOAT"))
            else:
                connection.execute(text("ALTER TABLE app_core.products ADD COLUMN IF NOT EXISTS price DOUBLE PRECISION"))
        if "created_at" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE products ADD COLUMN created_at DATETIME"))
                connection.execute(text("UPDATE products SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"))
            else:
                connection.execute(
                    text(
                        "ALTER TABLE app_core.products "
                        "ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()"
                    ),
                )
                connection.execute(
                    text("UPDATE app_core.products SET created_at = NOW() WHERE created_at IS NULL"),
                )


def ensure_admin_user(session: Session) -> bool:
    settings = get_settings()
    if not settings.admin_username or not settings.admin_password:
        return False

    # Defensive guard for environments where migrations completed partially:
    # ensure the users table exists before querying it during startup.
    bind = session.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table(User.__tablename__, schema="app_core"):
        ensure_database_ready()
        SQLModel.metadata.create_all(bind=bind, tables=[User.__table__], checkfirst=True)

    existing = session.exec(select(User).where(User.username == settings.admin_username)).first()
    if existing:
        return False

    admin = User(
        username=settings.admin_username,
        password_hash=get_password_hash(settings.admin_password),
        role="admin",
        is_active=True,
        source_system="bootstrap",
    )
    session.add(admin)
    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise
    return True
