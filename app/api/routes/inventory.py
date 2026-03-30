@router.delete("/imports/{import_id}", status_code=204)
def delete_import(
    import_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin")),
):
    _ensure_inventory_tables()
    inv_import = session.get(InventoryImport, import_id)
    if not inv_import:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
    # Remove todos os itens relacionados
    session.exec(
        select(InventoryImportItem).where(InventoryImportItem.inventory_import_id == import_id)
    ).delete()
    session.delete(inv_import)
    session.commit()
    return
import logging
import re
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel, Session, select

from app.api.deps import require_roles
from app.db.session import engine
from app.db.session import get_session
from app.models import Product, User, InventoryImport, InventoryImportItem
from app.schemas.inventory import InventoryImportRead, InventoryImportDetailRead

router = APIRouter(prefix="/inventory", tags=["inventory"])
logger = logging.getLogger(__name__)


def _ensure_inventory_tables() -> None:
    SQLModel.metadata.create_all(
        engine,
        tables=[InventoryImport.__table__, InventoryImportItem.__table__],
        checkfirst=True,
    )


@router.post("/import-txt", response_model=InventoryImportRead)
async def import_inventory_txt(
    reference_date: date = Form(...),
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("administrativo", "admin", "conferente")),
) -> InventoryImportRead:
    _ensure_inventory_tables()
    filename = (file.filename or "").lower()
    if not filename.endswith(".txt"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo .txt")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio")

    try:
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
                metrics={"raw": metrics},
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
    except SQLAlchemyError as exc:
        session.rollback()
        logger.exception("Falha SQL ao importar TXT de inventario")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha de banco ao importar TXT. Erro: {exc}",
        )


@router.get("/imports", response_model=list[InventoryImportRead])
def list_imports(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin", "conferente")),
) -> list[InventoryImport]:
    _ensure_inventory_tables()
    try:
        statement = select(InventoryImport).order_by(InventoryImport.imported_at.desc()).limit(100)
        return list(session.exec(statement).all())
    except SQLAlchemyError as exc:
        session.rollback()
        logger.exception("Falha SQL ao listar importacoes de inventario")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha de banco ao listar importacoes. Erro: {exc}",
        )
@router.get("/import-dates", response_model=list[date])
def list_import_dates(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin", "conferente")),
):
    _ensure_inventory_tables()
    # Busca datas únicas ordenadas decrescente
    dates = session.exec(
        select(InventoryImport.reference_date).distinct().order_by(InventoryImport.reference_date.desc())
    ).all()
    return [d[0] if isinstance(d, tuple) else d for d in dates]


@router.get("/imports/{import_id}", response_model=InventoryImportDetailRead)
def get_import_details(
    import_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin", "conferente")),
):
    _ensure_inventory_tables()
    inv_import = session.get(InventoryImport, import_id)
    if not inv_import:
        raise HTTPException(status_code=404, detail="Importação não encontrada")
        
    items = session.exec(
        select(InventoryImportItem).where(InventoryImportItem.inventory_import_id == import_id)
    ).all()

    details_items = []
    for item in items:
        product = session.exec(select(Product).where(Product.cod_produto == item.cod_produto)).first()
        pre_registered = bool(product and (product.source_system or "") == "txt_import")
        details_items.append({
            "id": item.id,
            "inventory_import_id": item.inventory_import_id,
            "cod_produto": item.cod_produto,
            "descricao": item.descricao,
            "metrics": item.metrics,
            "created_at": item.created_at,
            "pre_registered": pre_registered,
            "product_id": product.id if product else None,
        })

    details_items.sort(key=lambda row: (not row["pre_registered"], row["cod_produto"]))

    return InventoryImportDetailRead(
        id=inv_import.id,
        reference_date=inv_import.reference_date,
        file_name=inv_import.file_name,
        total_products=inv_import.total_products,
        created_products=inv_import.created_products,
        imported_by=inv_import.imported_by,
        imported_at=inv_import.imported_at,
        items=details_items
    )
