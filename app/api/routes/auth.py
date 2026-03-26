import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.db.session import get_session
from app.models import User
from app.schemas.auth import LegacyLoginInput, Token, TokenWithUser, UserInfo
from app.services.legacy_auth import authenticate_with_legacy

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
    # Usuarios criados via legado nao possuem hash local valido.
    if user.password_hash == "legacy-auth":
        return None
    try:
        if not verify_password(password, user.password_hash):
            return None
    except Exception:
        logger.exception("Hash de senha invalido para usuario local", extra={"username": normalized_username})
        return None
    return user


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
    """
    Autentica contra o sistema legado (analise-operacional) e retorna
    um token JWT local junto com os dados do usuário.
    """
    normalized_username = (body.username or "").strip().lower()
    try:
        local_user = _authenticate_local_user(session, normalized_username, body.password)
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Falha ao autenticar usuario local no login legado")
        local_user = None

    if local_user:
        token = create_access_token(str(local_user.id))
        user = UserInfo(
            username=local_user.username,
            name=local_user.username.split("@")[0] if "@" in local_user.username else local_user.username,
            email=local_user.username if "@" in local_user.username else None,
            role=local_user.role,
        )
        return TokenWithUser(access_token=token, user=user)

    user_data: dict | None = None
    try:
        user_data = authenticate_with_legacy(body.username, body.password)
    except Exception:
        logger.exception("Falha inesperada ao autenticar no legado")
        user_data = None

    if user_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nao foi possivel autenticar no legado e nao ha credencial local valida para este usuario.",
        )

    username = (user_data.get("username") or normalized_username).strip().lower()
    settings = get_settings()
    superusers = {item.strip().lower() for item in settings.dev_superusers.split(",") if item.strip()}
    username_short = username.split("@")[0]
    is_superuser = username in superusers or username_short in superusers
    role_for_user = "admin" if is_superuser else "conferente"

    try:
        existing = session.exec(select(User).where(User.username == username)).first()

        if existing:
            if not existing.is_active:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inativo")
            if is_superuser and (existing.role or "").strip().lower() != "admin":
                existing.role = "admin"
                session.add(existing)
                try:
                    session.commit()
                    session.refresh(existing)
                except SQLAlchemyError:
                    session.rollback()
                    logger.exception("Falha ao atualizar role de usuario legado")
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Falha temporaria ao atualizar usuario. Tente novamente.",
                    )
            user_model = existing
        else:
            # Usuário legado novo entra como conferente, exceto superusuários definidos.
            user_model = User(
                username=username,
                password_hash="legacy-auth",
                role=role_for_user,
                is_active=True,
                source_system="legacy",
            )
            session.add(user_model)
            try:
                session.commit()
                session.refresh(user_model)
            except SQLAlchemyError:
                session.rollback()
                # Corrida de concorrencia: outro request pode ter criado o mesmo usuario.
                fallback_user = session.exec(select(User).where(User.username == username)).first()
                if fallback_user:
                    user_model = fallback_user
                else:
                    logger.exception("Falha ao criar usuario legado local")
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Falha temporaria ao criar usuario. Tente novamente.",
                    )
    except HTTPException:
        raise
    except SQLAlchemyError:
        session.rollback()
        logger.exception("Falha de banco durante login legado")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Falha temporaria no banco de usuarios. Tente novamente em instantes.",
        )

    token = create_access_token(str(user_model.id))
    user = UserInfo(
        username=user_model.username,
        name=user_data.get("name") or user_data.get("full_name"),
        email=user_data.get("email"),
        role=user_model.role,
    )
    return TokenWithUser(access_token=token, user=user)
