import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.api.deps import get_current_user, require_roles
from app.db.session import get_session
from app.models import ChangeLog, User

router = APIRouter(prefix="/audit", tags=["audit"])


class CountEventInput(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=100)
    item_code: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=1, le=500000)
    observed_at: str
    device_name: str | None = Field(default=None, max_length=120)


class CountEventsPayload(BaseModel):
    events: list[CountEventInput]


@router.get("/changes")
def list_changes(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin")),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[ChangeLog]:
    statement = select(ChangeLog).order_by(ChangeLog.changed_at.desc()).limit(limit)
    return list(session.exec(statement).all())


@router.post("/count-events")
def ingest_count_events(
    payload: CountEventsPayload,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    synced_ids: list[str] = []

    for event in payload.events:
        event_hash = hashlib.sha256(event.client_event_id.encode("utf-8")).hexdigest()
        entity_id = int(event_hash[:8], 16)

        existing = session.exec(
            select(ChangeLog).where(
                ChangeLog.entity_name == "stock_count",
                ChangeLog.action == "count_event",
                ChangeLog.entity_id == entity_id,
            )
        ).first()
        if existing:
            synced_ids.append(event.client_event_id)
            continue

        log = ChangeLog(
            entity_name="stock_count",
            entity_id=entity_id,
            action="count_event",
            actor=user.username,
            changed_at=datetime.now(timezone.utc),
            payload={
                "client_event_id": event.client_event_id,
                "item_code": event.item_code,
                "quantity": event.quantity,
                "observed_at": event.observed_at,
                "device_name": event.device_name,
            },
        )
        session.add(log)
        synced_ids.append(event.client_event_id)

    session.commit()
    return {"received": len(payload.events), "synced": len(synced_ids), "synced_ids": synced_ids}
