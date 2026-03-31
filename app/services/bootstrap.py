from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel, Session, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import engine, get_engine
from app.services.sqlite_product_constraints import apply_sqlite_product_unique_constraints
from app.models import *  # noqa: F401,F403
from app.models import ChangeLog, Employee, Product, ProductHistory, User

DEFAULT_ADMIN_USERNAME = "feliperanon@live.com"
DEFAULT_ADMIN_PASSWORD = "571232Ce!"
DEFAULT_ADMIN_ALLOWED_PAGES = [
    "contagem",
    "count",
    "pull",
    "return",
    "break",
    "direct-sale",
    "cadastro",
    "cadastro-produto",
    "produtos",
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
    # Garantia defensiva para ambientes novos (ex.: Railway) sem predeploy.
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
    _ensure_users_compat_columns(is_sqlite=False)
    _ensure_products_compat_columns(is_sqlite=False)


def _ensure_users_compat_columns(*, is_sqlite: bool) -> None:
    inspector = inspect(get_engine())
    table_schema = None if is_sqlite else "app_core"
    if not inspector.has_table("users", schema=table_schema):
        return
    columns = {col["name"] for col in inspector.get_columns("users", schema=table_schema)}
    with engine.begin() as connection:
        if "legacy_id" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN legacy_id INTEGER"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS legacy_id INTEGER"))
        if "source_system" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN source_system VARCHAR(100)"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS source_system VARCHAR(100)"))
        if "imported_at" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN imported_at DATETIME"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ"))
        if "updated_at" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN updated_at DATETIME"))
            else:
                connection.execute(
                    text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"),
                )
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
        if "role" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(50)"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS role VARCHAR(50)"))
        if "is_active" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE"))
        if "employee_id" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN employee_id INTEGER"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS employee_id INTEGER"))
        if "allowed_pages" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN allowed_pages TEXT"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS allowed_pages JSONB"))
        if "google_sub" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255)"))
            else:
                connection.execute(text("ALTER TABLE app_core.users ADD COLUMN IF NOT EXISTS google_sub VARCHAR(255)"))
        if is_sqlite:
            connection.execute(text("UPDATE users SET is_active = 1 WHERE is_active IS NULL"))
            connection.execute(text("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"))
        else:
            connection.execute(text("UPDATE app_core.users SET is_active = TRUE WHERE is_active IS NULL"))
            connection.execute(text("UPDATE app_core.users SET updated_at = NOW() WHERE updated_at IS NULL"))


def _ensure_products_compat_columns(*, is_sqlite: bool) -> None:
    """
    Ajusta bancos SQLite legados que foram criados antes de novas colunas.
    Evita erro 500 em queries quando o modelo ja possui campos adicionais.
    """
    inspector = inspect(get_engine())
    table_schema = None if is_sqlite else "app_core"
    if not inspector.has_table("products", schema=table_schema):
        return

    columns = {col["name"] for col in inspector.get_columns("products", schema=table_schema)}
    with engine.begin() as connection:
        if "legacy_id" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE products ADD COLUMN legacy_id INTEGER"))
            else:
                connection.execute(text("ALTER TABLE app_core.products ADD COLUMN IF NOT EXISTS legacy_id INTEGER"))
        if "source_system" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE products ADD COLUMN source_system VARCHAR(100)"))
            else:
                connection.execute(text("ALTER TABLE app_core.products ADD COLUMN IF NOT EXISTS source_system VARCHAR(100)"))
        if "imported_at" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE products ADD COLUMN imported_at DATETIME"))
            else:
                connection.execute(text("ALTER TABLE app_core.products ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ"))
        if "updated_at" not in columns:
            if is_sqlite:
                connection.execute(text("ALTER TABLE products ADD COLUMN updated_at DATETIME"))
            else:
                connection.execute(
                    text("ALTER TABLE app_core.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()"),
                )
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
        if is_sqlite:
            connection.execute(text("UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL"))
            apply_sqlite_product_unique_constraints(connection)
        else:
            connection.execute(text("UPDATE app_core.products SET updated_at = NOW() WHERE updated_at IS NULL"))


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
