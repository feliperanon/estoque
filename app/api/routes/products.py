from io import BytesIO
import re
import unicodedata

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from openpyxl import load_workbook
from sqlmodel import Session, select

from app.api.deps import get_current_user, require_roles
from app.db.session import get_session
from app.models import Product, User
from app.schemas.products import ProductCreate, ProductImportPayload, ProductRead
from app.services.audit import log_change
from app.services.imports import apply_common_source_fields

router = APIRouter(prefix="/products", tags=["products"])


def _norm_header(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", (value or "").strip().lower())
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized).strip("_")
    return normalized


HEADER_ALIASES = {
    "cod_grup_sp": "cod_grup_sp",
    "grup_sp": "cod_grup_sp",
    "cod_sp": "cod_grup_sp",
    "cod_grup_cia": "cod_grup_cia",
    "grup_cia": "cod_grup_cia",
    "cod_cia": "cod_grup_cia",
    "cod_grup_tipo": "cod_grup_tipo",
    "grup_tipo": "cod_grup_tipo",
    "cod_tipo": "cod_grup_tipo",
    "cod_grup_familia": "cod_grup_familia",
    "grup_familia": "cod_grup_familia",
    "cod_familia": "cod_grup_familia",
    "cod_grup_segmento": "cod_grup_segmento",
    "grup_segmento": "cod_grup_segmento",
    "cod_segmento": "cod_grup_segmento",
    "cod_grup_marca": "cod_grup_marca",
    "grup_marca": "cod_grup_marca",
    "cod_marca": "cod_grup_marca",
    "cod_grup_descricao": "cod_grup_descricao",
    "grup_descricao": "cod_grup_descricao",
    "descricao": "cod_grup_descricao",
    "descricao": "cod_grup_descricao",
    "cod_grup_sku": "cod_grup_sku",
    "grup_sku": "cod_grup_sku",
    "sku": "cod_grup_sku",
    "status": "status",
    "grup_prioridade": "grup_prioridade",
    "prioridade": "grup_prioridade",
}

REQUIRED_FIELDS = {"cod_grup_descricao", "cod_grup_sku"}


def _map_headers(raw_headers: tuple) -> tuple[list[str | None], int]:
    mapped: list[str | None] = []
    for header in raw_headers:
        normalized = _norm_header(str(header or ""))
        mapped.append(HEADER_ALIASES.get(normalized))

    # score por quantidade de campos reconhecidos (sem duplicidade)
    recognized = {item for item in mapped if item}
    return mapped, len(recognized)


@router.get("", response_model=list[ProductRead])
def list_products(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin")),
    q: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=1000),
) -> list[Product]:
    statement = select(Product)
    if q:
        statement = statement.where(
            Product.cod_grup_descricao.contains(q) | Product.cod_grup_sku.contains(q),
        )
    return list(session.exec(statement.order_by(Product.cod_grup_descricao).limit(limit)).all())


@router.post("", response_model=ProductRead)
def create_product(
    payload: ProductCreate,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("administrativo", "admin")),
) -> Product:
    existing = session.exec(select(Product).where(Product.cod_grup_sku == payload.cod_grup_sku)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU ja cadastrado")

    product = Product.model_validate(payload)
    apply_common_source_fields(product, payload.legacy_id, payload.source_system or "manual")
    session.add(product)
    session.flush()
    log_change(session, "products", product.id or 0, "create", user.username, payload.model_dump())
    session.commit()
    session.refresh(product)
    return product


@router.post("/import", response_model=dict)
def import_products_payload(
    payload: ProductImportPayload,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("administrativo", "admin")),
) -> dict:
    created = 0
    updated = 0

    for row in payload.rows:
        existing = session.exec(select(Product).where(Product.cod_grup_sku == row.cod_grup_sku)).first()
        if existing:
            data = row.model_dump(exclude={"legacy_id", "source_system"})
            for key, value in data.items():
                setattr(existing, key, value)
            apply_common_source_fields(existing, row.legacy_id, row.source_system or "excel")
            updated += 1
            continue

        product = Product.model_validate(row)
        apply_common_source_fields(product, row.legacy_id, row.source_system or "excel")
        session.add(product)
        created += 1

    session.flush()
    log_change(
        session,
        "products",
        0,
        "import",
        user.username,
        {"created": created, "updated": updated, "rows": len(payload.rows)},
    )
    session.commit()
    return {"created": created, "updated": updated, "rows": len(payload.rows)}


@router.post("/import-excel", response_model=dict)
async def import_products_excel(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("administrativo", "admin")),
) -> dict:
    filename = (file.filename or "").lower()
    if not (filename.endswith(".xlsx") or filename.endswith(".xlsm")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Envie um arquivo .xlsx")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Arquivo vazio")

    try:
        wb = load_workbook(filename=BytesIO(content), data_only=True, read_only=True)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Falha ao ler planilha: {exc}")

    ws = wb.active
    all_rows = list(ws.iter_rows(values_only=True))
    if not all_rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Planilha sem cabecalho")

    header_row_index = -1
    mapped_headers: list[str | None] = []
    best_score = 0

    # Algumas planilhas trazem titulo/descricao antes do cabecalho.
    for idx, row in enumerate(all_rows[:15]):
        current_mapped, score = _map_headers(row)
        if score > best_score:
            best_score = score
            mapped_headers = current_mapped
            header_row_index = idx

    if best_score < 2 or header_row_index < 0:
        first_line_preview = [str(v or "").strip() for v in all_rows[0][:12]]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "Nao foi possivel reconhecer colunas de produto no cabecalho. "
                f"Cabecalho lido: {first_line_preview}"
            ),
        )

    created = 0
    updated = 0
    ignored = 0
    failed = 0
    created_in_batch: dict[str, Product] = {}

    for row in all_rows[header_row_index + 1 :]:
        row_data: dict[str, str | None] = {}
        for idx, value in enumerate(row):
            mapped = mapped_headers[idx] if idx < len(mapped_headers) else None
            if not mapped:
                continue
            if value is None:
                row_data[mapped] = None
            else:
                row_data[mapped] = str(value).strip()

        if not any(row_data.values()):
            continue

        if any(not row_data.get(field) for field in REQUIRED_FIELDS):
            ignored += 1
            continue

        sku = (row_data.get("cod_grup_sku") or "").strip()
        if not sku:
            ignored += 1
            continue

        row_data["cod_grup_sku"] = sku

        try:
            # Evita erro de unicidade quando o mesmo SKU aparece mais de uma vez no mesmo arquivo.
            if sku in created_in_batch:
                staged = created_in_batch[sku]
                for key, value in row_data.items():
                    setattr(staged, key, value)
                apply_common_source_fields(staged, None, "excel")
                updated += 1
                continue

            existing = session.exec(select(Product).where(Product.cod_grup_sku == sku)).first()

            if existing:
                for key, value in row_data.items():
                    setattr(existing, key, value)
                apply_common_source_fields(existing, None, "excel")
                updated += 1
            else:
                product = Product(**row_data)
                apply_common_source_fields(product, None, "excel")
                session.add(product)
                created_in_batch[sku] = product
                created += 1
        except Exception:
            failed += 1
            continue

    try:
        session.flush()
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Falha ao salvar importacao. Verifique duplicidades/formatos. Erro: {exc}",
        )

    log_change(
        session,
        "products",
        0,
        "import_excel",
        user.username,
        {"created": created, "updated": updated, "ignored": ignored, "failed": failed},
    )
    session.commit()
    return {"created": created, "updated": updated, "ignored": ignored, "failed": failed}
