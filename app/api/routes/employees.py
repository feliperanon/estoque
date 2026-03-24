from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select

from app.api.deps import get_current_user
from app.db.session import get_session
from app.models import Employee, User
from app.schemas.employees import EmployeeCreate, EmployeeRead
from app.services.audit import log_change
from app.services.imports import apply_common_source_fields

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeRead])
def list_employees(
    session: Session = Depends(get_session),
    _: User = Depends(get_current_user),
    q: str | None = Query(default=None),
) -> list[Employee]:
    statement = select(Employee)
    if q:
        statement = statement.where(Employee.name.contains(q))
    return list(session.exec(statement.order_by(Employee.name)).all())


@router.post("", response_model=EmployeeRead)
def create_employee(
    payload: EmployeeCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_current_user),
) -> Employee:
    employee = Employee.model_validate(payload)
    apply_common_source_fields(employee, payload.legacy_id, payload.source_system or "manual")
    session.add(employee)
    session.flush()
    log_change(session, "employees", employee.id or 0, "create", user.username, payload.model_dump())
    session.commit()
    session.refresh(employee)
    return employee
