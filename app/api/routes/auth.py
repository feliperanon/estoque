from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import create_access_token, verify_password
from app.db.session import get_session
from app.models import User
from app.schemas.auth import LegacyLoginInput, Token, TokenWithUser, UserInfo
from app.services.legacy_auth import authenticate_with_legacy

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
) -> Token:
    user = session.exec(select(User).where(User.username == form_data.username, User.is_active == True)).first()
    if not user or not verify_password(form_data.password, user.password_hash):
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
    user_data = authenticate_with_legacy(body.username, body.password)
    if user_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos no portal legado",
        )

    username = (user_data.get("username") or body.username).strip().lower()
    settings = get_settings()
    superusers = {item.strip().lower() for item in settings.dev_superusers.split(",") if item.strip()}
    role_for_user = "admin" if username in superusers else "conferente"

    existing = session.exec(select(User).where(User.username == username)).first()

    if existing:
        if not existing.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inativo")
        if username in superusers and (existing.role or "").strip().lower() != "admin":
            existing.role = "admin"
            session.add(existing)
            session.commit()
            session.refresh(existing)
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
        session.commit()
        session.refresh(user_model)

    token = create_access_token(str(user_model.id))
    user = UserInfo(
        username=user_model.username,
        name=user_data.get("name") or user_data.get("full_name"),
        email=user_data.get("email"),
        role=user_model.role,
    )
    return TokenWithUser(access_token=token, user=user)
