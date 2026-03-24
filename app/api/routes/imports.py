from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.api.deps import require_import_secret
from app.core.config import get_settings
from app.db.session import get_session
from app.models import ImportJob
from app.schemas.clients import ClientImportPayload
from app.schemas.employees import EmployeeImportPayload
from app.schemas.vehicles import VehicleImportPayload
from app.services.import_processors import import_clients_rows, import_employees_rows, import_vehicles_rows
from app.services.imports import (
    finish_import_job,
    start_import_job,
)

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/legacy/employees")
def import_legacy_employees(
    payload: EmployeeImportPayload,
    _: None = Depends(require_import_secret),
    session: Session = Depends(get_session),
) -> dict:
    settings = get_settings()
    job = start_import_job(session, settings.legacy_source_system, "employees")
    session.flush()
    rows = [row.model_dump() for row in payload.rows]
    success, fail = import_employees_rows(session, rows)

    finish_import_job(session, job, "done", len(payload.rows), success, fail)
    session.commit()
    return {"job_id": job.id, "total": len(payload.rows), "success": success, "failed": fail}


@router.post("/legacy/clients")
def import_legacy_clients(
    payload: ClientImportPayload,
    _: None = Depends(require_import_secret),
    session: Session = Depends(get_session),
) -> dict:
    settings = get_settings()
    job = start_import_job(session, settings.legacy_source_system, "clients")
    session.flush()
    rows = [row.model_dump() for row in payload.rows]
    success, fail = import_clients_rows(session, rows)

    finish_import_job(session, job, "done", len(payload.rows), success, fail)
    session.commit()
    return {"job_id": job.id, "total": len(payload.rows), "success": success, "failed": fail}


@router.post("/legacy/vehicles")
def import_legacy_vehicles(
    payload: VehicleImportPayload,
    _: None = Depends(require_import_secret),
    session: Session = Depends(get_session),
) -> dict:
    settings = get_settings()
    job = start_import_job(session, settings.legacy_source_system, "vehicles")
    session.flush()
    rows = [row.model_dump() for row in payload.rows]
    success, fail = import_vehicles_rows(session, rows)

    finish_import_job(session, job, "done", len(payload.rows), success, fail)
    session.commit()
    return {"job_id": job.id, "total": len(payload.rows), "success": success, "failed": fail}


@router.get("/jobs")
def list_jobs(
    _: None = Depends(require_import_secret),
    session: Session = Depends(get_session),
) -> list[ImportJob]:
    statement = select(ImportJob).order_by(ImportJob.started_at.desc()).limit(100)
    return list(session.exec(statement).all())
