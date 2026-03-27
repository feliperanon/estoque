from sqlalchemy.orm import sessionmaker
from sqlmodel import Session, create_engine

from app.core.config import get_settings

settings = get_settings()

_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        _database_url = settings.sqlalchemy_database_url
        if not _database_url:
            raise RuntimeError("DATABASE_URL environment variable is not set")

        _is_sqlite = _database_url.startswith("sqlite")
        _connect_args = {"check_same_thread": False} if _is_sqlite else {}
        _engine = create_engine(_database_url, pool_pre_ping=True, connect_args=_connect_args)

        # SQLite não suporta schemas — remove-os para compatibilidade local
        if _is_sqlite:
            import app.models  # noqa: F401 — registra tabelas no metadata
            for table in SQLModel.metadata.tables.values():
                table.schema = None

    return _engine


def get_session_factory():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), class_=Session, autoflush=False, autocommit=False)
    return _SessionLocal


class _EngineProxy:
    """Delega ao Engine real só no primeiro uso (lazy), compatível com import direto de `engine`."""

    def __getattr__(self, name: str):
        return getattr(get_engine(), name)

    def __enter__(self):
        return get_engine().__enter__()

    def __exit__(self, *args):
        return get_engine().__exit__(*args)


engine = _EngineProxy()


def SessionLocal():
    """Factory function to create sessions"""
    factory = get_session_factory()
    return factory()


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
