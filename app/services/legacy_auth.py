"""
Serviço de autenticação contra o sistema legado (analise-operacional).

Fluxo:
  1. POST /api/auth/login no legado com username/password (OAuth2 form).
  2. Se retornar token, busca dados do usuário em GET /admin/users.
  3. Retorna dict com dados do usuário ou None em caso de falha.
"""

import httpx

from app.core.config import get_settings


def authenticate_with_legacy(username: str, password: str) -> dict | None:
    settings = get_settings()
    base_url = settings.legacy_api_base_url.rstrip("/")

    try:
        with httpx.Client(timeout=10.0) as client:
            # Autenticar contra o endpoint padrão OAuth2 do sistema legado
            login_resp = client.post(
                f"{base_url}/api/auth/login",
                data={"username": username, "password": password},
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if login_resp.status_code != 200:
                return None

            legacy_token: str | None = login_resp.json().get("access_token")
            if not legacy_token:
                return None

            # Buscar dados detalhados do usuário no cadastro do sistema legado
            users_resp = client.get(
                f"{base_url}/admin/users",
                headers={"Authorization": f"Bearer {legacy_token}"},
            )

            user_data: dict = {"username": username}
            if users_resp.status_code == 200:
                payload = users_resp.json()
                users_list = payload if isinstance(payload, list) else payload.get("items", [])
                match = next(
                    (u for u in users_list if u.get("username") == username),
                    None,
                )
                if match:
                    user_data = match

            return user_data

    except httpx.RequestError:
        return None
