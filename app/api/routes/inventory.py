import logging
import re
from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlmodel import Session, select

from app.api.deps import require_roles
from app.db.session import get_session
from app.models import Product, User, InventoryImport, InventoryImportItem
from app.schemas.inventory import InventoryImportRead, InventoryImportDetailRead

router = APIRouter(prefix="/inventory", tags=["inventory"])
logger = logging.getLogger(__name__)


@router.post("/import-txt", response_model=InventoryImportRead)
async def import_inventory_txt(
    reference_date: date = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("administrativo", "admin", "conferente")),
) -> InventoryImportRead:
    filename = (file.filename or "").lower()
    if not filename.endswith(".txt"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo .txt")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio")

    text = content.decode("utf-8", errors="replace")

    new_import = InventoryImport(
        reference_date=reference_date,
        file_name=file.filename,
        imported_by=user.username,
        total_products=0,
        created_products=0,
    )
    session.add(new_import)
    session.flush()

    total_products = 0
    created_products = 0
    seen_in_txt = set()
    
    # Regex para capturar COD.RED, DESCRICAO, e colunas de métricas.
    pattern = re.compile(r"^(\d+)\s+(.+?)\s+((?:-?\d*I?|I)(?:\s+(?:-?\d*I?|I))*)$")

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
            
        match = pattern.search(line)
        if not match:
            continue
            
        cod = match.group(1).strip()
        desc = match.group(2).strip()
        metrics = match.group(3).split()

        total_products += 1

        # Salva o historico do item
        item = InventoryImportItem(
            inventory_import_id=new_import.id,
            cod_produto=cod,
            descricao=desc,
            metrics={"raw": metrics}
        )
        session.add(item)

        if cod not in seen_in_txt:
            seen_in_txt.add(cod)
            # Pre cadastro de produto
            existing = session.exec(select(Product).where(Product.cod_produto == cod)).first()
            if not existing:
                new_product = Product(
                    cod_produto=cod,
                    cod_grup_sku=cod,
                    cod_grup_descricao=desc,
                    status="ativo",
                )
                from app.services.imports import apply_common_source_fields
                apply_common_source_fields(new_product, None, "txt_import")
                session.add(new_product)
                created_products += 1
            
    new_import.total_products = total_products
    new_import.created_products = created_products
    
    session.commit()
    session.refresh(new_import)
    
    return new_import


@router.get("/imports", response_model=list[InventoryImportRead])
def list_imports(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin", "conferente")),
) -> list[InventoryImport]:
    statement = select(InventoryImport).order_by(InventoryImport.imported_at.desc()).limit(100)
    return list(session.exec(statement).all())


@router.get("/imports/{import_id}", response_model=InventoryImportDetailRead)
def get_import_details(
    import_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin", "conferente")),
):
    inv_import = session.get(InventoryImport, import_id)
    if not inv_import:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
        
    items = session.exec(
        select(InventoryImportItem).where(InventoryImportItem.inventory_import_id == import_id)
    ).all()
    
    return InventoryImportDetailRead(
        id=inv_import.id,
        reference_date=inv_import.reference_date,
        file_name=inv_import.file_name,
        total_products=inv_import.total_products,
        created_products=inv_import.created_products,
        imported_by=inv_import.imported_by,
        imported_at=inv_import.imported_at,
        items=items
    )
