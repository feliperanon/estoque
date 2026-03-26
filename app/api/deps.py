from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.session import get_session
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    if payload.get("token_error") == "expired":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expirado")

    if "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalido")

    user = session.exec(select(User).where(User.id == user_id, User.is_active == True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuario nao encontrado")
    return user


def require_roles(*allowed_roles: str):
    allowed = {role.strip().lower() for role in allowed_roles if role and role.strip()}

    def _dependency(user: User = Depends(get_current_user)) -> User:
        user_role = (user.role or "").strip().lower()
        if user_role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sem permissao para este modulo")
        return user

    return _dependency


def require_import_secret(x_import_secret: str = Header(default="")) -> None:
    settings = get_settings()
    if x_import_secret != settings.import_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Importacao nao autorizada")
