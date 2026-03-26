from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel, Session, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import engine
from app.models import *  # noqa: F401,F403
from app.models import User

DEFAULT_ADMIN_USERNAME = "feliperanon@live.com"
DEFAULT_ADMIN_PASSWORD = "571232Ce!"
DEFAULT_ADMIN_ALLOWED_PAGES = [
    "contagem",
    "count",
    "recount",
    "pull",
    "return",
    "break",
    "direct-sale",
    "cadastro",
    "cadastro-produto",
    "produtos",
    "preco-produtos",
    "parametros-produto",
    "acesso",
]


def ensure_database_ready() -> None:
    settings = get_settings()

    if settings.sqlalchemy_database_url.startswith("sqlite"):
        for table in SQLModel.metadata.tables.values():
            table.schema = None
        SQLModel.metadata.create_all(engine)
        _ensure_users_compat_columns(is_sqlite=True)
        _ensure_products_compat_columns(is_sqlite=True)
        return

    with engine.begin() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS legacy_snapshot"))
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS app_core"))
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS audit"))
    _ensure_users_compat_columns(is_sqlite=False)
    _ensure_products_compat_columns(is_sqlite=False)


def _ensure_users_compat_columns(*, is_sqlite: bool) -> None:
    inspector = inspect(engine)
    table_schema = None if is_sqlite else "app_core"
    if not inspector.has_table("users", schema=table_schema):
        return
    columns = {col["name"] for col in inspector.get_columns("users", schema=table_schema)}
    with engine.begin() as connection:
        if "full_name" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN full_name VARCHAR(150)"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150)"))
        if "phone" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN phone VARCHAR(30)"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)"))


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
        if "cod_produto" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE products ADD COLUMN cod_produto VARCHAR(120)"))
                connection.execute(
                    text(
                        "UPDATE products "
                        "SET cod_produto = COALESCE(NULLIF(TRIM(cod_grup_sku), ''), CAST(id AS TEXT)) "
                        "WHERE cod_produto IS NULL OR TRIM(cod_produto) = ''",
                    ),
                )
            else:
                connection.execute(
                    text("ALTER TABLE app_core.products ADD COLUMN IF NOT EXISTS cod_produto VARCHAR(120)"),
                )
                connection.execute(
                    text(
                        "UPDATE app_core.products "
                        "SET cod_produto = COALESCE(NULLIF(TRIM(cod_grup_sku), ''), id::text) "
                        "WHERE cod_produto IS NULL OR TRIM(cod_produto) = ''",
                    ),
                )


def ensure_admin_user(session: Session) -> bool:
    settings = get_settings()
    admin_username = settings.admin_username or DEFAULT_ADMIN_USERNAME
    admin_password = settings.admin_password or DEFAULT_ADMIN_PASSWORD

    # Defensive guard for environments where migrations completed partially:
    # ensure the users table exists before querying it during startup.
    bind = session.get_bind()
    inspector = inspect(bind)
    if not inspector.has_table(User.__tablename__, schema="app_core"):
        ensure_database_ready()
        # If users table is still missing, do not force create_all here because
        # model-level FK (users.employee_id -> employees.id) can break startup in
        # environments where legacy tables are not provisioned yet.
        inspector = inspect(bind)
        if not inspector.has_table(User.__tablename__, schema="app_core"):
            return False

    existing = session.exec(select(User).where(User.username == admin_username)).first()
    if existing:
        if (existing.role or "").strip().lower() != "admin":
            existing.role = "admin"
        existing.allowed_pages = DEFAULT_ADMIN_ALLOWED_PAGES
        if not existing.full_name:
            existing.full_name = "Felipe Ranon"
        if not existing.phone:
            existing.phone = ""
        session.add(existing)
        session.commit()
        return False

    admin = User(
        username=admin_username,
        full_name="Felipe Ranon",
        phone="",
        password_hash=get_password_hash(admin_password),
        role="admin",
        is_active=True,
        allowed_pages=DEFAULT_ADMIN_ALLOWED_PAGES,
        source_system="bootstrap",
    )
    session.add(admin)
    try:
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise
    return True
