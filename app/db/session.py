from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings

settings = get_settings()

_is_sqlite = settings.database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}
engine = create_engine(settings.database_url, pool_pre_ping=True, connect_args=_connect_args)

# SQLite não suporta schemas — remove-os para compatibilidade local
if _is_sqlite:
    # importação aqui para evitar ciclos; os modelos já devem estar carregados pelo app
    from app.models import *  # noqa: F401,F403
    for table in SQLModel.metadata.tables.values():
        table.schema = None

SessionLocal = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False)


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
