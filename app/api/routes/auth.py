import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.api.deps import EMERGENCY_ADMIN_SUBJECT, get_current_user
from app.db.session import get_session
from app.models import User
from app.schemas.auth import LegacyLoginInput, LocalRegisterInput, Token, TokenWithUser, UserInfo
from app.services.bootstrap import DEFAULT_ADMIN_ALLOWED_PAGES, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)
settings = get_settings()


def _normalize_allowed_pages(raw_allowed_pages) -> list[str]:
    if isinstance(raw_allowed_pages, list):
        return [str(page).strip().lower() for page in raw_allowed_pages if str(page).strip()]
    if isinstance(raw_allowed_pages, str):
        candidate = raw_allowed_pages.strip()
        if not candidate:
            return []
        # Compatibilidade com bases legadas que persistiram texto em vez de JSON.
        if "," in candidate:
            return [part.strip().lower() for part in candidate.split(",") if part.strip()]
        return [candidate.lower()]
    return []


def _admin_credentials() -> tuple[str, str]:
    admin_username = (settings.admin_username or DEFAULT_ADMIN_USERNAME).strip().lower()
    admin_password = settings.admin_password or DEFAULT_ADMIN_PASSWORD
    return admin_username, admin_password


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
        allowed_pages=_normalize_allowed_pages(user.allowed_pages),
    )


def _ensure_default_admin_on_login(session: Session, username: str, password: str) -> User | None:
    """Cria ou regrava o admin padrão quando a senha confere (Postgres, SQLite e Railway).

    Evita SQL bruto em app_core.users, que quebra em SQLite (sem schema) e em bases legadas.
    """
    normalized_username = (username or "").strip().lower()
    admin_username, admin_password = _admin_credentials()
    if normalized_username != admin_username or password != admin_password:
        return None

    password_hash = get_password_hash(admin_password)
    try:
        user = session.exec(select(User).where(User.username == admin_username)).first()
        if user:
            user.password_hash = password_hash
            user.role = "admin"
            user.is_active = True
            user.allowed_pages = DEFAULT_ADMIN_ALLOWED_PAGES
            if not user.full_name:
                user.full_name = "Felipe Ranon"
            user.source_system = "bootstrap"
            session.add(user)
            session.commit()
            session.refresh(user)
            return user
        user = User(
            username=admin_username,
            full_name="Felipe Ranon",
            phone="",
            password_hash=password_hash,
            role="admin",
            is_active=True,
            allowed_pages=DEFAULT_ADMIN_ALLOWED_PAGES,
            source_system="bootstrap",
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return user
    except SQLAlchemyError:
        session.rollback()
        return None


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
    admin_username, admin_password = _admin_credentials()
    try:
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
            if normalized_username == admin_username and body.password == admin_password:
                token = create_access_token(EMERGENCY_ADMIN_SUBJECT)
                user = UserInfo(
                    username=admin_username,
                    name="Felipe Ranon",
                    email=admin_username,
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
    except HTTPException:
        raise
    except Exception:
        logger.exception("Falha inesperada no login legado")
        # Fallback operacional para nao travar acesso admin em incidente de banco.
        if normalized_username == admin_username and body.password == admin_password:
            token = create_access_token(EMERGENCY_ADMIN_SUBJECT)
            user = UserInfo(
                username=admin_username,
                name="Felipe Ranon",
                email=admin_username,
                phone="",
                role="admin",
                allowed_pages=DEFAULT_ADMIN_ALLOWED_PAGES,
            )
            return TokenWithUser(access_token=token, user=user)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Falha temporaria de autenticacao. Tente novamente em instantes.",
        )


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


@router.get("/me", response_model=UserInfo)
def read_current_user_profile(user: User = Depends(get_current_user)) -> UserInfo:
    """Valida o Bearer token e devolve o perfil; usado pelo front para sessão ao carregar a página."""
    return _to_user_info(user)
