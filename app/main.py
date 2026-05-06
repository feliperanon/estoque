import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.api.router import api_router
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.middleware.static_charset import StaticUtf8CharsetMiddleware
from app.services.bootstrap import ensure_admin_user, ensure_database_ready

logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Sobe o servidor imediatamente para o healthcheck do provedor (ex.: Railway) responder em /api/health.
    Migrações leves + admin em thread: não bloqueiam o bind HTTP.
    """
    app.state.db_ready = False

    async def _background_startup() -> None:
        def _sync_startup() -> None:
            ensure_database_ready()
            with SessionLocal() as session:
                ensure_admin_user(session)

        try:
            await asyncio.to_thread(_sync_startup)
        except Exception:
            logger.exception("Falha na inicialização do banco (tarefa em background)")
        finally:
            app.state.db_ready = True

    asyncio.create_task(_background_startup())
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(api_router, prefix=settings.api_prefix)
# Declara UTF-8 em /static/*.js (etc.) para o navegador não interpretar string literals como Latin-1.
app.add_middleware(StaticUtf8CharsetMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "https://estoque-app-hrt2.onrender.com",
        "https://estoque-app-production-bfd0.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


@app.middleware("http")
async def db_init_gate(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    path = request.url.path.rstrip("/") or "/"
    if path == "/api/health":
        return await call_next(request)
    if path.startswith("/api") and not getattr(request.app.state, "db_ready", False):
        return JSONResponse(
            {"detail": "Servidor ainda inicializando o banco. Aguarde alguns segundos e tente de novo."},
            status_code=503,
        )
    return await call_next(request)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "app_name": settings.app_name})


@app.get("/app", response_class=HTMLResponse)
def app_shell(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "app_name": settings.app_name})


@app.get("/favicon.ico", include_in_schema=False)
def favicon() -> RedirectResponse:
    return RedirectResponse(url="/static/favicon.svg", status_code=307)
