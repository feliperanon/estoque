from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def _validate_conversion_factor(v: float | None) -> float | None:
    if v is not None and v <= 0:
        raise ValueError("Fator de conversao deve ser maior que zero")
    return v


class ProductBase(BaseModel):
    cod_grup_sp: str | None = Field(default=None, max_length=60)
    cod_grup_cia: str | None = Field(default=None, max_length=60)
    cod_grup_tipo: str | None = Field(default=None, max_length=60)
    cod_grup_familia: str | None = Field(default=None, max_length=60)
    cod_grup_segmento: str | None = Field(default=None, max_length=60)
    cod_grup_marca: str | None = Field(default=None, max_length=80)
    cod_produto: str = Field(min_length=1, max_length=120)
    cod_grup_descricao: str = Field(min_length=1, max_length=255)
    cod_grup_sku: str = Field(min_length=1, max_length=120)
    status: str | None = Field(default=None, max_length=40)
    grup_prioridade: str | None = Field(default=None, max_length=80)
    price: float | None = Field(default=None)
    conversion_factor: float | None = Field(
        default=None,
        description="Unidades por 1 caixa/embalagem (ex.: 1 caixa = 6 unidades → 6).",
    )
    pallet_conversion_factor: float | None = Field(
        default=None,
        description="Caixas por 1 palete (ex.: 1 palete = 100 caixas → 100).",
    )

    @field_validator("conversion_factor", "pallet_conversion_factor")
    @classmethod
    def _positive_factor_ok(cls, v: float | None) -> float | None:
        return _validate_conversion_factor(v)


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
    cod_produto: str | None = None
    cod_grup_descricao: str | None = None
    cod_grup_sku: str | None = None
    status: str | None = None
    grup_prioridade: str | None = None
    price: float | None = None
    conversion_factor: float | None = None
    pallet_conversion_factor: float | None = None

    @field_validator("conversion_factor", "pallet_conversion_factor")
    @classmethod
    def _positive_factor_ok_update(cls, v: float | None) -> float | None:
        return _validate_conversion_factor(v)


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
