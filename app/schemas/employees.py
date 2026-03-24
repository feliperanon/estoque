from datetime import date, datetime

from pydantic import BaseModel


class EmployeeBase(BaseModel):
    registration_id: str | None = None
    seller_code: str | None = None
    name: str
    admission_date: date | None = None
    cost_center: str | None = None
    role: str | None = None
    birthday: date | None = None
    status: str | None = None
    work_shift: str | None = None
    work_days: str | None = None
    work_schedule: str | None = None
    mobile_access: bool = False
    mobile_access_separation: bool = False
    mobile_access_checklist: bool = False
    mobile_access_admin_start: bool = False
    mobile_access_returns: bool = False
    mobile_access_helper: bool = False
    mobile_access_gatehouse: bool = False
    mobile_access_escala: bool = False


class EmployeeCreate(EmployeeBase):
    legacy_id: int | None = None
    source_system: str | None = None


class EmployeeRead(EmployeeBase):
    id: int
    legacy_id: int | None = None
    source_system: str | None = None
    imported_at: datetime | None = None
    updated_at: datetime


class EmployeeImportItem(EmployeeCreate):
    pass


class EmployeeImportPayload(BaseModel):
    rows: list[EmployeeImportItem]
