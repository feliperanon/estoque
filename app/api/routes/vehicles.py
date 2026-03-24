from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import User, Vehicle
from app.schemas.vehicles import VehicleCreate, VehicleRead
from app.services.audit import log_change
from app.services.imports import apply_common_source_fields

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("", response_model=list[VehicleRead])
def list_vehicles(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
    q: str | None = Query(default=None),
) -> list[Vehicle]:
    statement = select(Vehicle)
    if q:
        statement = statement.where(Vehicle.placa.contains(q))
    return list(session.exec(statement.order_by(Vehicle.placa)).all())


@router.post("", response_model=VehicleRead)
def create_vehicle(
    payload: VehicleCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Vehicle:
    vehicle = Vehicle.model_validate(payload)
    apply_common_source_fields(vehicle, payload.legacy_id, payload.source_system or "manual")
    session.add(vehicle)
    session.flush()
    log_change(session, "vehicles", vehicle.id or 0, "create", user.username, payload.model_dump())
    session.commit()
    session.refresh(vehicle)
    return vehicle
