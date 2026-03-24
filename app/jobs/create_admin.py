from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.db.session import engine
from app.models import User


def run() -> None:
    settings = get_settings()
    username = settings.admin_username or "admin"
    password = settings.admin_password or settings.import_secret

    with Session(engine) as session:
        existing = session.exec(select(User).where(User.username == username)).first()
        if existing:
            print("Admin ja existe.")
            return

        user = User(
            username=username,
            password_hash=get_password_hash(password),
            role="admin",
            is_active=True,
            source_system="bootstrap",
        )
        session.add(user)
        session.commit()
        print("Admin criado com sucesso.")


if __name__ == "__main__":
    run()
