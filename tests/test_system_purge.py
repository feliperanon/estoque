"""Purge: garante DDL e execução sem erro em SQLite."""
import os

import pytest


@pytest.fixture()
def sqlite_memory_env(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    # Engine/cache precisam ver a URL nova
    import app.core.config as cfg
    import app.db.session as db

    cfg.get_settings.cache_clear()
    db._engine = None  # noqa: SLF001
    db._SessionLocal = None  # noqa: SLF001


def test_purge_all_except_users_runs_on_empty_db(sqlite_memory_env):
    import importlib

    import app.db.session as db

    importlib.reload(db)
    from app.services.bootstrap import ensure_database_ready
    from app.db.session import SessionLocal
    from app.services.system_purge import purge_all_except_users

    ensure_database_ready()
    with SessionLocal() as session:
        out = purge_all_except_users(session)
    assert out["ok"] is True
    assert "deleted" in out
