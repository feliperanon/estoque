"""DDL defensivo para validity_lines (Railway / deploy sem Alembic completo)."""

import logging

from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel

from app.core.config import get_settings
from app.db.session import get_engine
from app.models.entities import ValidityLine

logger = logging.getLogger(__name__)


def ensure_validity_lines_structures() -> None:
    """Cria tabela se faltar e garante colunas novas (ex.: quantity_cx) em bases antigas."""
    bind = get_engine()
    try:
        SQLModel.metadata.create_all(
            bind,
            tables=[ValidityLine.__table__],
            checkfirst=True,
        )
        settings = get_settings()
        is_sqlite = settings.sqlalchemy_database_url.startswith("sqlite")
        schema = None if is_sqlite else "app_core"
        insp = inspect(bind)
        if not insp.has_table("validity_lines", schema=schema):
            return
        cols = {c["name"] for c in insp.get_columns("validity_lines", schema=schema)}
        if "quantity_cx" in cols:
            return
        with bind.begin() as conn:
            if is_sqlite:
                conn.execute(
                    text("ALTER TABLE validity_lines ADD COLUMN quantity_cx INTEGER NOT NULL DEFAULT 0"),
                )
            else:
                conn.execute(
                    text(
                        "ALTER TABLE app_core.validity_lines "
                        "ADD COLUMN IF NOT EXISTS quantity_cx INTEGER NOT NULL DEFAULT 0",
                    ),
                )
    except SQLAlchemyError:
        logger.exception("Falha ao garantir estruturas de validity_lines")
        raise
