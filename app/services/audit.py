from sqlmodel import Session

from app.models import ChangeLog


def log_change(
    session: Session,
    entity_name: str,
    entity_id: int,
    action: str,
    actor: str | None,
    payload: dict | None = None,
) -> None:
    entry = ChangeLog(
        entity_name=entity_name,
        entity_id=entity_id,
        action=action,
        actor=actor,
        payload=payload,
    )
    session.add(entry)
