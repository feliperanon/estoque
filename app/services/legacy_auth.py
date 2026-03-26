"""Serviço de autenticação contra o Portal Operacional legado.

O legado usa login por formulário web com sessão/cookies em ``/login``.
Após autenticar, o acesso a ``/admin/users`` depende dessa sessão.
"""

from urllib.parse import parse_qs, urlparse

import httpx

from app.core.config import get_settings


def _extract_error_from_location(location: str | None) -> str | None:
    if not location:
        return None
    parsed = urlparse(location)
    error_values = parse_qs(parsed.query).get("error", [])
    return error_values[0] if error_values else None


def authenticate_with_legacy(username: str, password: str) -> dict | None:
    settings = get_settings()
    base_url = settings.legacy_api_base_url.rstrip("/")

    try:
        with httpx.Client(timeout=10.0, follow_redirects=False) as client:
            login_resp = client.post(
                f"{base_url}/login",
                data={"email": username, "password": password, "remember": "on"},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            location = login_resp.headers.get("location")
            error_message = _extract_error_from_location(location)
            if error_message:
                return None

            if login_resp.status_code not in (200, 302, 303):
                return None

            # Nao use rota administrativa para validar login: usuarios comuns
            # podem autenticar com sucesso e ainda assim nao ter permissao em /admin/users.
            probe_resp = client.get(f"{base_url}/", follow_redirects=False)
            if probe_resp.status_code not in (200, 302, 303):
                return None

            # Se redirecionar para /login, sessao nao foi criada.
            redirected_to = probe_resp.headers.get("location", "")
            if "/login" in redirected_to:
                return None

            return {
                "username": username,
                "name": username.split("@")[0] if "@" in username else username,
                "email": username,
                "role": "legacy-user",
            }

    except httpx.RequestError:
        return None
