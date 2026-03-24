from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.api.router import api_router
from app.core.config import get_settings
from app.db.session import SessionLocal
from app.services.bootstrap import ensure_admin_user

settings = get_settings()
app = FastAPI(title=settings.app_name)
app.include_router(api_router, prefix=settings.api_prefix)

app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


@app.on_event("startup")
def startup_tasks() -> None:
    with SessionLocal() as session:
        ensure_admin_user(session)


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request, "app_name": settings.app_name})
