"""
Remove todos os dados operacionais do banco, preservando a tabela `users`.
Ordem respeita FKs (PostgreSQL e SQLite sem schema).
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import delete, text, update
from sqlmodel import Session, SQLModel, select

from app.core.config import get_settings
from app.models import (
    ChangeLog,
    Client,
    ClientGroup,
    ClientSnapshot,
    DeliverySession,
    DriverVehicleAssignment,
    Employee,
    EmployeeSnapshot,
    FailedImportRow,
    GateCheck,
    ImportJob,
    InventoryImport,
    InventoryImportItem,
    ValidityLine,
    Product,
    ProductHistory,
    SourceMap,
    SyncRun,
    User,
    Vehicle,
    VehicleSnapshot,
)

logger = logging.getLogger(__name__)

# Tabelas tocadas pelo purge (ordem irrelevante: create_all ordena por FK).
_PURGE_MODELS: tuple[type, ...] = (
    Employee,
    User,
    ClientGroup,
    Client,
    Vehicle,
    DriverVehicleAssignment,
    DeliverySession,
    GateCheck,
    Product,
    ProductHistory,
    InventoryImport,
    InventoryImportItem,
    ValidityLine,
    ImportJob,
    SourceMap,
    EmployeeSnapshot,
    ClientSnapshot,
    VehicleSnapshot,
    ChangeLog,
    SyncRun,
    FailedImportRow,
)


def _ensure_purge_tables_exist(session: Session) -> None:
    """
    Garante que o DDL exista antes do DELETE.

    Em PostgreSQL o bootstrap pode ter criado só um subconjunto de tabelas;
    sem isso o purge falha com relação inexistente (500).

    DDL roda na mesma conexão/transação da sessão do purge, evitando que
    CREATE TABLE em outra conexão fique invisível ao DELETE na sessão atual
    (comportamento de snapshot/transação no PostgreSQL).
    """
    settings = get_settings()
    conn = session.connection()
    if not settings.sqlalchemy_database_url.startswith("sqlite"):
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS legacy_snapshot"))
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS app_core"))
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS audit"))
    tables = [m.__table__ for m in _PURGE_MODELS]
    SQLModel.metadata.create_all(conn, tables=tables, checkfirst=True)


def purge_all_except_users(session: Session) -> dict[str, Any]:
    """
    Apaga dados de negócio; mantém linhas em `app_core.users` (ou `users` no SQLite).
    Zera vínculo employee_id dos usuários antes de apagar funcionários.
    """
    stats: dict[str, int] = {}

    _ensure_purge_tables_exist(session)

    def run_delete(model, label: str) -> None:
        res = session.exec(delete(model))
        rc = getattr(res, "rowcount", None)
        stats[label] = int(rc) if rc is not None and rc >= 0 else 0

    # 1) Dependentes de sessões / veículos
    run_delete(GateCheck, "gate_checks")
    run_delete(DeliverySession, "delivery_sessions")
    run_delete(DriverVehicleAssignment, "driver_vehicle_assignments")

    # 2) Importações de estoque TXT e validades lançadas
    run_delete(InventoryImportItem, "inventory_import_items")
    run_delete(InventoryImport, "inventory_imports")
    run_delete(ValidityLine, "validity_lines")

    # 3) Produtos
    run_delete(ProductHistory, "product_history")
    run_delete(Product, "products")

    # 4) Clientes e grupos
    run_delete(Client, "clients")
    run_delete(ClientGroup, "client_groups")

    # 5) Veículos (sem FK de users)
    run_delete(Vehicle, "vehicles")

    # 6) Usuários não são apagados — remove vínculo com funcionário
    session.exec(update(User).values(employee_id=None))
    stats["users_preserved"] = len(session.exec(select(User)).all())

    # 7) Funcionários
    run_delete(Employee, "employees")

    # 8) Jobs / mapas de import legado
    run_delete(ImportJob, "import_jobs")
    run_delete(SourceMap, "source_map")

    # 9) Snapshots legados
    run_delete(EmployeeSnapshot, "legacy_snapshot_employee")
    run_delete(ClientSnapshot, "legacy_snapshot_client")
    run_delete(VehicleSnapshot, "legacy_snapshot_vehicle")

    # 10) Auditoria
    run_delete(ChangeLog, "audit_change_log")
    run_delete(SyncRun, "audit_sync_runs")
    run_delete(FailedImportRow, "audit_failed_import_rows")

    session.commit()
    logger.warning("Purge completo exceto usuarios executado: %s", stats)
    return {"ok": True, "deleted": stats}
