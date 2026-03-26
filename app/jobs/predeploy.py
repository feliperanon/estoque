from app.db.session import SessionLocal
from app.services.bootstrap import ensure_admin_user, ensure_database_ready


def main() -> None:
    ensure_database_ready()
    with SessionLocal() as session:
        ensure_admin_user(session)


if __name__ == "__main__":
    main()