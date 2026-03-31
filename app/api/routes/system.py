"""Manutenção perigosa do sistema (somente admin)."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.api.deps import require_roles
from app.db.session import get_session
from app.models import User
from app.services.system_purge import purge_all_except_users

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/system", tags=["system"])

CONFIRM_PHRASE = "APAGAR TUDO EXCETO USUARIOS"


class PurgeExceptUsersBody(BaseModel):
    confirm: str = Field(
        min_length=10,
        max_length=80,
        description=f'Digite exatamente: {CONFIRM_PHRASE}',
    )


@router.post("/purge-except-users")
def purge_except_users(
    body: PurgeExceptUsersBody,
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("admin")),
) -> dict:
    """
    Remove produtos, contagens, importações TXT, clientes, veículos, auditoria etc.
    Mantém a tabela de usuários (logins e permissões).
    """
    if (body.confirm or "").strip() != CONFIRM_PHRASE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Confirmacao invalida. Digite exatamente: {CONFIRM_PHRASE}",
        )
    try:
        return purge_all_except_users(session)
    except Exception as e:
        logger.exception("purge-except-users falhou")
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao limpar base: {e!s}",
        ) from e
