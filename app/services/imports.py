from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.models import ImportJob, SourceMap


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def start_import_job(session: Session, source_system: str, entity_name: str) -> ImportJob:
    job = ImportJob(source_system=source_system, entity_name=entity_name)
    session.add(job)
    session.flush()
    return job


def finish_import_job(
    session: Session,
    job: ImportJob,
    status: str,
    total_rows: int,
    success_rows: int,
    failed_rows: int,
    message: str | None = None,
) -> None:
    job.status = status
    job.total_rows = total_rows
    job.success_rows = success_rows
    job.failed_rows = failed_rows
    job.message = message
    job.finished_at = now_utc()
    session.add(job)


def find_mapped_id(session: Session, source_system: str, entity_name: str, legacy_id: int) -> int | None:
    mapping = session.exec(
        select(SourceMap).where(
            SourceMap.source_system == source_system,
            SourceMap.entity_name == entity_name,
            SourceMap.legacy_id == legacy_id,
        )
    ).first()
    return mapping.app_id if mapping else None


def upsert_source_map(
    session: Session,
    source_system: str,
    entity_name: str,
    legacy_id: int,
    app_id: int,
) -> None:
    mapping = session.exec(
        select(SourceMap).where(
            SourceMap.source_system == source_system,
            SourceMap.entity_name == entity_name,
            SourceMap.legacy_id == legacy_id,
        )
    ).first()
    if mapping:
        mapping.app_id = app_id
        mapping.mapped_at = now_utc()
        session.add(mapping)
        return

    session.add(
        SourceMap(
            source_system=source_system,
            entity_name=entity_name,
            legacy_id=legacy_id,
            app_id=app_id,
        )
    )


def apply_common_source_fields(obj: Any, legacy_id: int | None, source_system: str) -> None:
    if legacy_id is not None:
        obj.legacy_id = legacy_id
        obj.imported_at = now_utc()
    obj.source_system = source_system
    obj.updated_at = now_utc()
