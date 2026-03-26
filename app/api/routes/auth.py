import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from app.core.security import create_access_token, get_password_hash, verify_password
from app.api.deps import EMERGENCY_ADMIN_SUBJECT
from app.db.session import get_session
from app.models import User
from app.schemas.auth import LegacyLoginInput, LocalRegisterInput, Token, TokenWithUser, UserInfo
from app.services.bootstrap import DEFAULT_ADMIN_ALLOWED_PAGES, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _authenticate_local_user(session: Session, username: str, password: str) -> User | None:
    normalized_username = (username or "").strip().lower()
    if not normalized_username:
        return None
    user = session.exec(
        select(User).where(User.username == normalized_username, User.is_active == True),
    ).first()
    if not user:
        return None
    try:
        if not verify_password(password, user.password_hash):
            return None
    except Exception:
        logger.exception("Hash de senha invalido para usuario local", extra={"username": normalized_username})
        return None
    return user


def _to_user_info(user: User) -> UserInfo:
    username = (user.username or "").strip().lower()
    return UserInfo(
        username=username,
        name=user.full_name or (username.split("@")[0] if "@" in username else username),
        email=username if "@" in username else None,
        phone=user.phone,
        role=user.role,
        allowed_pages=user.allowed_pages or [],
    )


def _ensure_default_admin_on_login(session: Session, username: str, password: str) -> User | None:
    normalized_username = (username or "").strip().lower()
    if normalized_username != DEFAULT_ADMIN_USERNAME or password != DEFAULT_ADMIN_PASSWORD:
        return None

    password_hash = get_password_hash(DEFAULT_ADMIN_PASSWORD)
    session.exec(
        text(
            """
            INSERT INTO app_core.users (username, password_hash, role, is_active, source_system, updated_at)
            VALUES (:username, :password_hash, 'admin', true, 'bootstrap', NOW())
            ON CONFLICT (username)
            DO UPDATE
            SET password_hash = EXCLUDED.password_hash,
                role = 'admin',
                is_active = true,
                updated_at = NOW()
            """
        ),
        {"username": DEFAULT_ADMIN_USERNAME, "password_hash": password_hash},
    )
    session.commit()
    return session.exec(select(User).where(User.username == DEFAULT_ADMIN_USERNAME)).first()


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
) -> Token:
    try:
        user = _authenticate_local_user(session, form_data.username, form_data.password)
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Falha de banco no login local", extra={"username": form_data.username})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Falha temporaria no banco de usuarios. Tente novamente em instantes.",
        )

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais invalidas")

    token = create_access_token(str(user.id))
    return Token(access_token=token)


@router.post("/login-legacy", response_model=TokenWithUser)
def login_legacy(
    body: LegacyLoginInput,
    session: Session = Depends(get_session),
) -> TokenWithUser:
    # Fluxo legado desativado: agora o login e 100% local.
    normalized_username = (body.username or "").strip().lower()
    try:
        local_user = _authenticate_local_user(session, normalized_username, body.password)
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Falha ao autenticar usuario local no login legado")
        local_user = None

    if not local_user:
        try:
            local_user = _ensure_default_admin_on_login(session, normalized_username, body.password)
        except SQLAlchemyError:
            session.rollback()
            local_user = None

    if not local_user:
        if normalized_username == DEFAULT_ADMIN_USERNAME and body.password == DEFAULT_ADMIN_PASSWORD:
            token = create_access_token(EMERGENCY_ADMIN_SUBJECT)
            user = UserInfo(
                username=DEFAULT_ADMIN_USERNAME,
                name="Felipe Ranon",
                email=DEFAULT_ADMIN_USERNAME,
                phone="",
                role="admin",
                allowed_pages=DEFAULT_ADMIN_ALLOWED_PAGES,
            )
            return TokenWithUser(access_token=token, user=user)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha invalidos.",
        )

    token = create_access_token(str(local_user.id))
    user = _to_user_info(local_user)
    return TokenWithUser(access_token=token, user=user)


@router.post("/register", response_model=TokenWithUser)
def register_local_user(
    body: LocalRegisterInput,
    session: Session = Depends(get_session),
) -> TokenWithUser:
    email = (body.email or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Informe um e-mail valido.")
    if len((body.password or "").strip()) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A senha deve ter ao menos 6 caracteres.")

    existing = session.exec(select(User).where(User.username == email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail ja cadastrado.")

    allowed_pages = [p.strip().lower() for p in (body.allowed_pages or []) if p and p.strip()]
    user = User(
        username=email,
        full_name=(body.name or "").strip() or None,
        phone=(body.phone or "").strip() or None,
        password_hash=get_password_hash(body.password),
        role="conferente",
        is_active=True,
        allowed_pages=allowed_pages or ["contagem"],
        source_system="local",
    )
    session.add(user)
    try:
        session.commit()
        session.refresh(user)
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Falha ao cadastrar usuario local")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Falha ao salvar usuario.")

    token = create_access_token(str(user.id))
    return TokenWithUser(access_token=token, user=_to_user_info(user))
