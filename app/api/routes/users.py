from datetime import datetime, timezone
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlmodel import Session, select

from app.api.deps import require_roles
from app.core.security import get_password_hash
from app.db.session import get_session
from app.models import User
from app.schemas.users import UserCreate, UserRead, UserUpdate
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


@router.patch("/{user_id}", response_model=UserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    session: Session = Depends(get_session),
    actor: User = Depends(require_roles("admin")),
) -> UserRead:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario nao encontrado.")

    data = payload.model_dump(exclude_unset=True)

    if "password" in data:
        pwd = (data.pop("password") or "").strip()
        if pwd:
            if len(pwd) < 6:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A senha deve ter ao menos 6 caracteres.",
                )
            user.password_hash = get_password_hash(pwd)

    if "username" in data:
        new_username = (data.pop("username") or "").strip().lower()
        if not new_username or "@" not in new_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Informe um e-mail valido como login.",
            )
        if new_username != (user.username or "").strip().lower():
            other = session.exec(select(User).where(User.username == new_username)).first()
            if other:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Este e-mail ja esta em uso por outro usuario.",
                )
            user.username = new_username

    if "full_name" in data:
        user.full_name = (data.pop("full_name") or "").strip() or None

    if "phone" in data:
        user.phone = (data.pop("phone") or "").strip() or None

    if "role" in data:
        role = (data.pop("role") or "").strip().lower() or None
        if role not in (None, "admin", "administrativo", "conferente"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Perfil invalido. Use admin, administrativo ou conferente.",
            )
        user.role = role

    if "is_active" in data:
        user.is_active = bool(data.pop("is_active"))

    if "allowed_pages" in data:
        raw = data.pop("allowed_pages")
        user.allowed_pages = _normalize_allowed_pages(raw)

    if data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Campos nao reconhecidos na atualizacao.")

    try:
        apply_common_source_fields(user, None, user.source_system or "manual")
        session.add(user)
        session.flush()
        log_change(session, "users", user.id or 0, "update", actor.username, {"user_id": user_id})
        session.commit()
        session.refresh(user)
    except IntegrityError:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Nao foi possivel salvar (dados duplicados ou conflito).",
        )
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Falha ao atualizar usuario", extra={"user_id": user_id})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Falha temporaria ao salvar usuario.",
        )

    return _to_user_read(user)
