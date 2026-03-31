from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.session import get_session
from app.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
EMERGENCY_ADMIN_SUBJECT = "bootstrap-admin"


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

    token_subject = payload["sub"]
    if token_subject == EMERGENCY_ADMIN_SUBJECT:
        return User(
            id=0,
            username="feliperanon@live.com",
            full_name="Felipe Ranon",
            phone="",
            password_hash="",
            role="admin",
            is_active=True,
            allowed_pages=[
                "contagem",
                "count",
                "recount",
                "pull",
                "return",
                "break",
                "direct-sale",
                "cadastro",
                "cadastro-produto",
                "produtos",
                "preco-produtos",
                "parametros-produto",
                "acesso",
            ],
            source_system="bootstrap",
        )

    try:
        user_id = int(token_subject)
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


def _normalize_allowed_pages_list(raw) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(p).strip().lower() for p in raw if str(p).strip()]
    return []


# Chaves alinhadas a PAGE_KEYS_BY_MODULE.cadastro em app/static/app.js
_CADASTRO_PAGE_KEYS = frozenset(
    {
        "cadastro",
        "cadastro-produto",
        "produtos",
        "preco-produtos",
        "parametros-produto",
    }
)


def require_cadastro_access(user: User = Depends(get_current_user)) -> User:
    """Rotas de cadastro de produtos: mesmo critério que canAccessModule('cadastro') no front."""
    role = (user.role or "").strip().lower()
    if role in ("admin", "administrativo"):
        return user
    pages = _normalize_allowed_pages_list(user.allowed_pages)
    if pages and any(p in _CADASTRO_PAGE_KEYS for p in pages):
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Sem permissao para este modulo",
    )


def require_stock_analysis_access(user: User = Depends(get_current_user)) -> User:
    """GET /audit/stock-analysis: alinhado ao front — administrativo/admin ou allowed_pages com 'count-audit'."""
    role = (user.role or "").strip().lower()
    if role in ("admin", "administrativo"):
        return user
    pages = _normalize_allowed_pages_list(user.allowed_pages)
    if "count-audit" in pages:
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Sem permissao para analise de contagem",
    )


def require_import_secret(x_import_secret: str = Header(default="")) -> None:
    settings = get_settings()
    if x_import_secret != settings.import_secret:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Importacao nao autorizada")
