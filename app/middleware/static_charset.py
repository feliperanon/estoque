"""Garante charset=utf-8 em arquivos de texto servidos em /static (evita mojibake no JS/CSS/JSON)."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

_STATIC_TEXT_SUFFIXES = frozenset(
    (".js", ".mjs", ".css", ".json", ".svg", ".txt", ".map", ".webmanifest")
)


class StaticUtf8CharsetMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        path = request.url.path
        if not path.startswith("/static/"):
            return response
        lower_path = path.lower()
        if not any(lower_path.endswith(s) for s in _STATIC_TEXT_SUFFIXES):
            return response
        ct = response.headers.get("content-type", "")
        if not ct or "charset=" in ct.lower():
            return response
        base = ct.split(";")[0].strip()
        if not base:
            return response
        response.headers["content-type"] = f"{base}; charset=utf-8"
        return response
