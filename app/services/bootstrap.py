from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models import User


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
