from fastapi import APIRouter

from app.api.routes import audit, auth, clients, employees, health, imports, users, vehicles

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(employees.router)
api_router.include_router(clients.router)
api_router.include_router(vehicles.router)
api_router.include_router(imports.router)
api_router.include_router(audit.router)
