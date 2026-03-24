from datetime import datetime

from pydantic import BaseModel


class UserBase(BaseModel):
    username: str
    role: str | None = None
    is_active: bool = True
    employee_id: int | None = None
    allowed_pages: list[str] | None = None
    google_sub: str | None = None


class UserCreate(UserBase):
    password: str
    legacy_id: int | None = None
    source_system: str | None = None


class UserRead(UserBase):
    id: int
    legacy_id: int | None = None
    source_system: str | None = None
    imported_at: datetime | None = None
    updated_at: datetime
