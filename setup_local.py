"""
Script de setup para ambiente local de desenvolvimento com SQLite.
Cria todas as tabelas e garante que o usuario admin existe.

Uso:
    .venv\\Scripts\\python setup_local.py
"""

import os

os.environ["DATABASE_URL"] = "sqlite:///./estoque_local.db"
# Mesma regra do run.ps1: env do sistema não deve sobrescrever ADMIN_* do .env.
os.environ.pop("ADMIN_USERNAME", None)
os.environ.pop("ADMIN_PASSWORD", None)

from sqlmodel import SQLModel, create_engine, Session
from app.core.config import get_settings
from app.models import *  # garante que todos os modelos estão registrados  # noqa: F401,F403
from app.services.bootstrap import ensure_admin_user

settings = get_settings()
engine = create_engine(settings.sqlalchemy_database_url, connect_args={"check_same_thread": False})

# SQLite não suporta schemas — remove-os temporariamente para criação local
for table in SQLModel.metadata.tables.values():
    table.schema = None

SQLModel.metadata.create_all(engine)
print("Tabelas criadas com sucesso.")

with Session(engine) as session:
    ensure_admin_user(session)
    print("Usuario admin garantido.")

print("\nPronto! Rode agora:")
print("   .venv\\Scripts\\uvicorn app.main:app --reload")
print("   Acesse: http://localhost:8000")
