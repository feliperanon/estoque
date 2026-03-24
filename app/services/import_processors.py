from typing import Any

from sqlmodel import Session

from app.core.config import get_settings
from app.models import (
    Client,
    ClientSnapshot,
    Employee,
    EmployeeSnapshot,
    FailedImportRow,
    Vehicle,
    VehicleSnapshot,
)
from app.services.audit import log_change
from app.services.imports import apply_common_source_fields, find_mapped_id, upsert_source_map


def _record_failure(
    session: Session,
    source_system: str,
    entity_name: str,
    legacy_id: int | None,
    error_message: str,
    row_payload: dict,
) -> None:
    session.add(
        FailedImportRow(
            source_system=source_system,
            entity_name=entity_name,
            legacy_id=legacy_id,
            error_message=error_message,
            row_payload=row_payload,
        )
    )


def _apply_import(
    session: Session,
    entity_name: str,
    rows: list[dict[str, Any]],
    model_cls: type,
    snapshot_cls: type,
) -> tuple[int, int]:
    settings = get_settings()
    success = 0
    fail = 0

    for row_data in rows:
        legacy_id = row_data.get("legacy_id")
        try:
            app_id = (
                find_mapped_id(session, settings.legacy_source_system, entity_name, legacy_id)
                if legacy_id is not None
                else None
            )
            if app_id:
                obj = session.get(model_cls, app_id)
                if not obj:
                    raise ValueError("Mapeamento aponta para registro inexistente")
                for key, value in row_data.items():
                    if key in {"legacy_id", "source_system"}:
                        continue
                    setattr(obj, key, value)
            else:
                obj = model_cls.model_validate(row_data)
                session.add(obj)
                session.flush()

            apply_common_source_fields(obj, legacy_id, settings.legacy_source_system)
            session.add(snapshot_cls(legacy_id=legacy_id or 0, payload=row_data))
            session.flush()
            if legacy_id is not None:
                upsert_source_map(session, settings.legacy_source_system, entity_name, legacy_id, obj.id or 0)
            log_change(session, entity_name, obj.id or 0, "import", "legacy-sync", row_data)
            success += 1
        except Exception as exc:
            fail += 1
            _record_failure(session, settings.legacy_source_system, entity_name, legacy_id, str(exc), row_data)

    return success, fail


def import_employees_rows(session: Session, rows: list[dict[str, Any]]) -> tuple[int, int]:
    return _apply_import(session, "employees", rows, Employee, EmployeeSnapshot)


def import_clients_rows(session: Session, rows: list[dict[str, Any]]) -> tuple[int, int]:
    return _apply_import(session, "clients", rows, Client, ClientSnapshot)


def import_vehicles_rows(session: Session, rows: list[dict[str, Any]]) -> tuple[int, int]:
    return _apply_import(session, "vehicles", rows, Vehicle, VehicleSnapshot)
