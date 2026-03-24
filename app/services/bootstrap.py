from sqlalchemy import text
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
        return

    with engine.begin() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS legacy_snapshot"))
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS app_core"))
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS audit"))

    SQLModel.metadata.create_all(engine)


def ensure_admin_user(session: Session) -> bool:
    settings = get_settings()
    if not settings.admin_username or not settings.admin_password:
        return False

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
    session.commit()
    return True
