from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import Client, User
from app.schemas.clients import ClientCreate, ClientRead
from app.services.audit import log_change
from app.services.imports import apply_common_source_fields

router = APIRouter(prefix="/clients", tags=["clients"])


@router.get("", response_model=list[ClientRead])
def list_clients(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
    q: str | None = Query(default=None),
) -> list[Client]:
    statement = select(Client)
    if q:
        statement = statement.where(Client.name.contains(q))
    return list(session.exec(statement.order_by(Client.name)).all())


@router.post("", response_model=ClientRead)
def create_client(
    payload: ClientCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Client:
    client = Client.model_validate(payload)
    apply_common_source_fields(client, payload.legacy_id, payload.source_system or "manual")
    session.add(client)
    session.flush()
    log_change(session, "clients", client.id or 0, "create", user.username, payload.model_dump())
    session.commit()
    session.refresh(client)
    return client
