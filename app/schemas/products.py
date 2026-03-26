from datetime import datetime

from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    cod_grup_sp: str | None = Field(default=None, max_length=60)
    cod_grup_cia: str | None = Field(default=None, max_length=60)
    cod_grup_tipo: str | None = Field(default=None, max_length=60)
    cod_grup_familia: str | None = Field(default=None, max_length=60)
    cod_grup_segmento: str | None = Field(default=None, max_length=60)
    cod_grup_marca: str | None = Field(default=None, max_length=80)
    cod_grup_descricao: str = Field(min_length=1, max_length=255)
    cod_grup_sku: str = Field(min_length=1, max_length=120)
    status: str | None = Field(default=None, max_length=40)
    grup_prioridade: str | None = Field(default=None, max_length=80)
    price: float | None = Field(default=None)


class ProductCreate(ProductBase):
    legacy_id: int | None = None
    source_system: str | None = None


class ProductUpdate(BaseModel):
    cod_grup_sp: str | None = None
    cod_grup_cia: str | None = None
    cod_grup_tipo: str | None = None
    cod_grup_familia: str | None = None
    cod_grup_segmento: str | None = None
    cod_grup_marca: str | None = None
    cod_grup_descricao: str | None = None
    cod_grup_sku: str | None = None
    status: str | None = None
    grup_prioridade: str | None = None
    price: float | None = None


class ProductRead(ProductBase):
    id: int
    legacy_id: int | None = None
    source_system: str | None = None
    imported_at: datetime | None = None
    updated_at: datetime
    created_at: datetime | None = None


class ProductHistoryRead(BaseModel):
    id: int
    product_id: int
    field_name: str
    old_value: str | None = None
    new_value: str | None = None
    changed_by: str | None = None
    changed_at: datetime


class ProductImportItem(ProductCreate):
    pass


class ProductImportPayload(BaseModel):
    rows: list[ProductImportItem]
