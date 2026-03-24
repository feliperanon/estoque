"""
Script de setup para ambiente local de desenvolvimento com SQLite.
Cria todas as tabelas e garante que o usuário admin existe.

Uso:
    .venv\\Scripts\\python setup_local.py
"""

import os
os.environ.setdefault("DATABASE_URL", "sqlite:///./estoque_local.db")

from sqlmodel import SQLModel, create_engine, Session
from app.core.config import get_settings
from app.models import *  # garante que todos os modelos estão registrados  # noqa: F401,F403
from app.services.bootstrap import ensure_admin_user

settings = get_settings()
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})

# SQLite não suporta schemas — remove-os temporariamente para criação local
for table in SQLModel.metadata.tables.values():
    table.schema = None

SQLModel.metadata.create_all(engine)
print("✅ Tabelas criadas com sucesso.")

with Session(engine) as session:
    ensure_admin_user(session)
    print("✅ Usuário admin garantido.")

print("\n🚀 Pronto! Rode agora:")
print("   .venv\\Scripts\\uvicorn app.main:app --reload")
print("   Acesse: http://localhost:8000")
