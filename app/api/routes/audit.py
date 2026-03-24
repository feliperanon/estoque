from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import ChangeLog, User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/changes")
def list_changes(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[ChangeLog]:
    statement = select(ChangeLog).order_by(ChangeLog.changed_at.desc()).limit(limit)
    return list(session.exec(statement).all())
