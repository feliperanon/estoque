import json
import logging
import math
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel, Session, select

from app.api.deps import require_roles
from app.db.session import engine
from app.db.session import get_session
from app.models import Product, User, InventoryImport, InventoryImportItem
from app.schemas.inventory import InventoryImportRead, InventoryImportDetailRead
from app.services.inventory_txt_parse import build_import_item_metrics, parse_inventory_txt_line

router = APIRouter(prefix="/inventory", tags=["inventory"])
logger = logging.getLogger(__name__)


def _ensure_inventory_tables() -> None:
    SQLModel.metadata.create_all(
        engine,
        tables=[InventoryImport.__table__, InventoryImportItem.__table__],
        checkfirst=True,
    )


def _normalize_import_item_metrics(metrics: Any) -> dict[str, Any] | None:
    """Garante dict para o schema Pydantic (evita 500 se o JSON veio como str no banco)."""
    if metrics is None:
        return None
    if isinstance(metrics, dict):
        return metrics
    if isinstance(metrics, str):
        try:
            parsed = json.loads(metrics)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            logger.warning("metrics JSON inválido em item de importação; usando fallback vazio")
        return {"raw": [], "caixa": 0, "unidade": 0, "metrics_parse_error": True}
    logger.warning("metrics com tipo inesperado %s; usando fallback", type(metrics).__name__)
    return {"raw": [], "caixa": 0, "unidade": 0, "metrics_parse_error": True}


def _sanitize_json_value(obj: Any, _depth: int = 0) -> Any:
    """
    Evita falha na serialização JSON da resposta (NaN/inf, date/datetime aninhados, chaves não-str).
    """
    if _depth > 48:
        return None
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (bytes, bytearray)):
        return obj.decode("utf-8", errors="replace")
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, int) and not isinstance(obj, bool):
        return obj
    if isinstance(obj, str):
        return obj
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, dict):
        out: dict[str, Any] = {}
        for k, v in obj.items():
            out[str(k)] = _sanitize_json_value(v, _depth + 1)
        return out
    if isinstance(obj, (list, tuple, set)):
        return [_sanitize_json_value(v, _depth + 1) for v in obj]
    return str(obj)


def _unwrap_import_item_row(row: Any) -> InventoryImportItem:
    """Compat: alguns drivers/versões devolvem Row/tuple em vez do modelo."""
    if isinstance(row, InventoryImportItem):
        return row
    if isinstance(row, (list, tuple)) and len(row) > 0:
        first = row[0]
        if isinstance(first, InventoryImportItem):
            return first
    raise TypeError(f"Linha de item de importação inesperada: {type(row).__name__}")


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

        for line in text.splitlines():
            parsed = parse_inventory_txt_line(line)
            if not parsed:
                continue

            cod = str(parsed["cod_produto"])
            desc = str(parsed["descricao"])
            raw_tokens = parsed["raw"]
            if not isinstance(raw_tokens, list):
                continue

            total_products += 1

            numeric_tail = parsed.get("numeric_tail")
            nt = str(numeric_tail) if numeric_tail is not None else None

            # Salva o historico do item
            item = InventoryImportItem(
                inventory_import_id=new_import.id,
                cod_produto=cod,
                descricao=desc,
                metrics=build_import_item_metrics([str(t) for t in raw_tokens], nt),
            )
            session.add(item)

            if cod not in seen_in_txt:
                seen_in_txt.add(cod)
                # Pre cadastro de produto
                existing = session.exec(select(Product).where(Product.cod_produto == cod)).first()
                if not existing:
                    # Não entra na contagem (só ativos); regularização no Cadastro.
                    new_product = Product(
                        cod_produto=cod,
                        cod_grup_sku=cod,
                        cod_grup_descricao=desc,
                        status="inativo",
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
    try:
        inv_import = session.get(InventoryImport, import_id)
        if not inv_import:
            raise HTTPException(status_code=404, detail="Importação não encontrada")

        raw_rows = session.exec(
            select(InventoryImportItem).where(InventoryImportItem.inventory_import_id == import_id)
        ).all()
        items = [_unwrap_import_item_row(r) for r in raw_rows]

        codes = sorted({(it.cod_produto or "").strip() for it in items if (it.cod_produto or "").strip()})
        products_by_cod: dict[str, Product] = {}
        if codes:
            prod_rows = session.exec(select(Product).where(Product.cod_produto.in_(codes))).all()
            for row in prod_rows:
                p = row[0] if isinstance(row, (list, tuple)) and row else row
                if not isinstance(p, Product):
                    continue
                ck = (p.cod_produto or "").strip()
                if ck:
                    products_by_cod[ck] = p

        details_items: list[dict[str, Any]] = []
        for item in items:
            cod = (item.cod_produto or "").strip()
            desc = (item.descricao or "").strip()
            product = products_by_cod.get(cod) if cod else None
            pre_registered = bool(product and (product.source_system or "") == "txt_import")
            norm_metrics = _normalize_import_item_metrics(item.metrics)
            details_items.append({
                "id": item.id,
                "inventory_import_id": item.inventory_import_id,
                "cod_produto": cod,
                "descricao": desc,
                "metrics": _sanitize_json_value(norm_metrics) if norm_metrics is not None else None,
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
            items=details_items,
        )
    except HTTPException:
        raise
    except ValidationError as exc:
        logger.exception("Validação Pydantic ao montar detalhe da importação %s", import_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Falha ao montar resposta da importação (dados inconsistentes).",
        ) from exc
    except SQLAlchemyError as exc:
        session.rollback()
        logger.exception("Falha SQL ao carregar detalhe da importação %s", import_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha de banco ao carregar importação. Erro: {exc}",
        ) from exc
    except Exception as exc:
        session.rollback()
        logger.exception("Erro inesperado ao carregar detalhe da importação %s", import_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro ao carregar importação. Verifique os logs do servidor.",
        ) from exc
