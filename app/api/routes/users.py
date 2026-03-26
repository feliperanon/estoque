from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from app.api.deps import get_current_user, require_roles
from app.core.security import get_password_hash
from app.db.session import get_session
from app.models import User
from app.schemas.users import UserCreate, UserRead
from app.services.audit import log_change
from app.services.bootstrap import ensure_database_ready
from app.services.imports import apply_common_source_fields

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)


def _normalize_allowed_pages(raw_allowed_pages) -> list[str] | None:
    if raw_allowed_pages is None:
        return None
    if isinstance(raw_allowed_pages, list):
        values = [str(page).strip().lower() for page in raw_allowed_pages if str(page).strip()]
        return values or None
    if isinstance(raw_allowed_pages, str):
        text = raw_allowed_pages.strip()
        if not text:
            return None
        if "," in text:
            values = [part.strip().lower() for part in text.split(",") if part.strip()]
            return values or None
        return [text.lower()]
    return None


def _sanitize_user_for_response(user: User) -> User:
    user.allowed_pages = _normalize_allowed_pages(user.allowed_pages)
    if getattr(user, "updated_at", None) is None:
        user.updated_at = datetime.now(timezone.utc)
    return user


def _to_user_read(user: User) -> UserRead:
    safe = _sanitize_user_for_response(user)
    username = (safe.username or "").strip().lower()
    return UserRead(
        id=safe.id or 0,
        username=username,
        full_name=safe.full_name,
        phone=safe.phone,
        role=safe.role,
        is_active=bool(safe.is_active),
        employee_id=safe.employee_id,
        allowed_pages=safe.allowed_pages,
        google_sub=safe.google_sub,
        legacy_id=safe.legacy_id,
        source_system=safe.source_system,
        imported_at=safe.imported_at,
        updated_at=safe.updated_at,
    )


def _serialize_users(users: list[User]) -> list[UserRead]:
    result: list[UserRead] = []
    for user in users:
        try:
            result.append(_to_user_read(user))
        except Exception:
            logger.exception("Registro de usuario invalido ignorado", extra={"user_id": getattr(user, "id", None)})
    return result


@router.get("", response_model=list[UserRead])
def list_users(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("admin")),
) -> list[UserRead]:
    try:
        users = list(session.exec(select(User).order_by(User.username)).all())
    except SQLAlchemyError:
        session.rollback()
        ensure_database_ready()
        users = list(session.exec(select(User).order_by(User.username)).all())
    except Exception:
        session.rollback()
        logger.exception("Falha inesperada ao listar usuarios")
        return []
    return _serialize_users(users)


@router.post("", response_model=UserRead)
def create_user(
    payload: UserCreate,
    session: Session = Depends(get_session),
    actor: User = Depends(require_roles("admin")),
) -> User:
    user = User(
        username=payload.username,
        full_name=payload.full_name,
        phone=payload.phone,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        employee_id=payload.employee_id,
        allowed_pages=payload.allowed_pages,
        google_sub=payload.google_sub,
    )
    apply_common_source_fields(user, payload.legacy_id, payload.source_system or "manual")
    session.add(user)
    session.flush()
    log_change(session, "users", user.id or 0, "create", actor.username, {"username": payload.username})
    session.commit()
    session.refresh(user)
    return user
