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


class ProductCreate(ProductBase):
    legacy_id: int | None = None
    source_system: str | None = None


class ProductRead(ProductBase):
    id: int
    legacy_id: int | None = None
    source_system: str | None = None
    imported_at: datetime | None = None
    updated_at: datetime


class ProductImportItem(ProductCreate):
    pass


class ProductImportPayload(BaseModel):
    rows: list[ProductImportItem]
