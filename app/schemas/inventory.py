from datetime import date, datetime
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class InventoryImportItemBase(BaseModel):
    cod_produto: str
    descricao: str
    metrics: Optional[Dict[str, Any]] = None

class InventoryImportItemRead(InventoryImportItemBase):
    id: int
    inventory_import_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class InventoryImportRead(BaseModel):
    id: int
    reference_date: date
    file_name: Optional[str] = None
    total_products: int
    created_products: int
    imported_by: Optional[str] = None
    imported_at: datetime

    class Config:
        from_attributes = True

class InventoryImportDetailRead(InventoryImportRead):
    items: List[InventoryImportItemRead] = []
