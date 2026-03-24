from datetime import datetime

from pydantic import BaseModel


class VehicleBase(BaseModel):
    placa: str | None = None
    vehicle_type: str | None = None
    marca: str | None = None
    modelo: str | None = None
    renavam: str | None = None
    ano: int | None = None
    crv_number: str | None = None
    chassi: str | None = None
    is_active: bool = True
    in_workshop: bool = False
    sale_value: float | None = None
    sold_at: datetime | None = None
    odometer_km: int | None = None


class VehicleCreate(VehicleBase):
    legacy_id: int | None = None
    source_system: str | None = None


class VehicleRead(VehicleBase):
    id: int
    legacy_id: int | None = None
    source_system: str | None = None
    imported_at: datetime | None = None
    updated_at: datetime


class VehicleImportItem(VehicleCreate):
    pass


class VehicleImportPayload(BaseModel):
    rows: list[VehicleImportItem]
