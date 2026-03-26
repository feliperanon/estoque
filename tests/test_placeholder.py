from datetime import datetime, timedelta, timezone

from jose import jwt

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token


def _set_test_env(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./test.db")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("IMPORT_SECRET", "test-import-secret")
    monkeypatch.setenv("ALGORITHM", "HS256")
    monkeypatch.setenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120")
    get_settings.cache_clear()


def test_decode_access_token_with_valid_token(monkeypatch) -> None:
    _set_test_env(monkeypatch)
    token = create_access_token("123")

    payload = decode_access_token(token)

    assert payload is not None
    assert payload["sub"] == "123"


def test_decode_access_token_with_invalid_token(monkeypatch) -> None:
    _set_test_env(monkeypatch)

    payload = decode_access_token("invalid.token.value")

    assert payload is None


def test_decode_access_token_with_expired_token(monkeypatch) -> None:
    _set_test_env(monkeypatch)
    settings = get_settings()
    expired_payload = {
        "sub": "123",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    expired_token = jwt.encode(expired_payload, settings.secret_key, algorithm=settings.algorithm)

    payload = decode_access_token(expired_token)

    assert payload == {"token_error": "expired"}
