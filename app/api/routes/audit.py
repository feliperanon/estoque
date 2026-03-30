import hashlib
from datetime import datetime, timezone
import re

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.api.deps import get_current_user, require_roles
from app.db.session import get_session
from app.models import ChangeLog, InventoryImport, InventoryImportItem, User

router = APIRouter(prefix="/audit", tags=["audit"])


class CountEventInput(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=100)
    item_code: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=1, le=500000)
    observed_at: str
    device_name: str | None = Field(default=None, max_length=120)


class CountEventsPayload(BaseModel):
    events: list[CountEventInput]


def _normalize_item_code(value: str | None) -> str:
    raw = (value or "").strip().upper()
    raw = re.sub(r"\s+", " ", raw)
    raw = re.sub(r"\s*\[(UN|CX)\]\s*$", "", raw)
    return raw


def _extract_count_type(value: str | None) -> str:
    raw = (value or "").strip().upper()
    if raw.endswith("[UN]"):
        return "unidade"
    return "caixa"


def _parse_inventory_metric_token(token: str) -> int:
    tok = (token or "").strip().upper()
    if not tok:
        return 0
    if tok == "I":
        return 0
    tok = tok.replace("I", "")
    if tok in {"", "+", "-"}:
        return 0
    try:
        return int(tok)
    except Exception:
        return 0


def _extract_import_quantities(raw_metrics: list[str]) -> tuple[int, int]:
    metrics = [str(tok) for tok in raw_metrics]
    caixa = _parse_inventory_metric_token(metrics[0]) if len(metrics) >= 1 else 0
    unidade = _parse_inventory_metric_token(metrics[1]) if len(metrics) >= 2 else 0
    return caixa, unidade


@router.get("/stock-analysis")
def stock_analysis(
    import_id: int | None = Query(default=None, ge=1),
    only_diff: bool = Query(default=True),
    limit: int = Query(default=500, ge=1, le=5000),
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    if import_id is None:
        current_import = session.exec(
            select(InventoryImport).order_by(InventoryImport.imported_at.desc()).limit(1)
        ).first()
    else:
        current_import = session.get(InventoryImport, import_id)

    if not current_import:
        return {
            "import": None,
            "summary": {
                "total_import_items": 0,
                "counted_items": 0,
                "equal_items": 0,
                "divergent_items": 0,
                "missing_in_count": 0,
                "extra_in_count": 0,
            },
            "rows": [],
        }

    import_items = list(
        session.exec(
            select(InventoryImportItem).where(InventoryImportItem.inventory_import_id == current_import.id)
        ).all()
    )

    imported_by_code: dict[str, dict] = {}
    for item in import_items:
        code = _normalize_item_code(item.cod_produto)
        if not code:
            continue
        raw_metrics = item.metrics.get("raw") if isinstance(item.metrics, dict) else []
        raw_metrics = raw_metrics if isinstance(raw_metrics, list) else []
        import_caixa, import_unidade = _extract_import_quantities(raw_metrics)
        if code not in imported_by_code:
            imported_by_code[code] = {
                "cod_produto": code,
                "descricao": item.descricao or "",
                "import_caixa": 0,
                "import_unidade": 0,
            }
        imported_by_code[code]["import_caixa"] += import_caixa
        imported_by_code[code]["import_unidade"] += import_unidade
        if not imported_by_code[code]["descricao"] and item.descricao:
            imported_by_code[code]["descricao"] = item.descricao

    # Busca todos os eventos de contagem sem filtro de data.
    # O usuário seleciona qual importação comparar; restringir por data
    # exclui contagens feitas antes do upload do TXT (problema recorrente).
    count_logs = list(
        session.exec(
            select(ChangeLog).where(
                ChangeLog.entity_name == "stock_count",
                ChangeLog.action == "count_event",
            )
        ).all()
    )

    counted_by_code: dict[str, dict[str, int]] = {}
    for log in count_logs:
        payload = log.payload if isinstance(log.payload, dict) else {}
        item_code = str(payload.get("item_code") or "")
        code = _normalize_item_code(item_code)
        if not code:
            continue
        count_type = _extract_count_type(item_code)
        qty_raw = payload.get("quantity", 0)
        try:
            qty = int(qty_raw)
        except Exception:
            qty = 0
        if code not in counted_by_code:
            counted_by_code[code] = {"caixa": 0, "unidade": 0}
        counted_by_code[code][count_type] = counted_by_code[code].get(count_type, 0) + qty

    all_codes = set(imported_by_code.keys()) | set(counted_by_code.keys())
    rows: list[dict] = []
    equal_items = 0
    divergent_items = 0
    missing_in_count = 0
    extra_in_count = 0

    for code in all_codes:
        imported = imported_by_code.get(code)
        import_caixa = int(imported.get("import_caixa", 0)) if imported else 0
        import_unidade = int(imported.get("import_unidade", 0)) if imported else 0
        counted = counted_by_code.get(code, {"caixa": 0, "unidade": 0})
        counted_caixa = int(counted.get("caixa", 0))
        counted_unidade = int(counted.get("unidade", 0))
        diff_caixa = counted_caixa - import_caixa
        diff_unidade = counted_unidade - import_unidade
        total_diff_abs = abs(diff_caixa) + abs(diff_unidade)
        status = "ok"
        if imported and counted_caixa == 0 and counted_unidade == 0:
            status = "missing_in_count"
            missing_in_count += 1
        elif not imported and (counted_caixa != 0 or counted_unidade != 0):
            status = "extra_in_count"
            extra_in_count += 1
        elif diff_caixa != 0 or diff_unidade != 0:
            status = "divergent"
            divergent_items += 1
        else:
            equal_items += 1

        if only_diff and status == "ok":
            continue

        rows.append(
            {
                "cod_produto": code,
                "descricao": (imported or {}).get("descricao") or "",
                "import_caixa": import_caixa,
                "import_unidade": import_unidade,
                "counted_caixa": counted_caixa,
                "counted_unidade": counted_unidade,
                "difference_caixa": diff_caixa,
                "difference_unidade": diff_unidade,
                "difference_abs": total_diff_abs,
                "status": status,
            }
        )

    rows.sort(key=lambda r: (int(r["difference_abs"]), r["cod_produto"]), reverse=True)
    rows = rows[:limit]

    return {
        "import": {
            "id": current_import.id,
            "reference_date": current_import.reference_date,
            "file_name": current_import.file_name,
            "imported_at": current_import.imported_at,
            "total_products": current_import.total_products,
            "created_products": current_import.created_products,
        },
        "summary": {
            "total_import_items": len(imported_by_code),
            "counted_items": len(counted_by_code),
            "equal_items": equal_items,
            "divergent_items": divergent_items,
            "missing_in_count": missing_in_count,
            "extra_in_count": extra_in_count,
        },
        "rows": rows,
    }


@router.get("/changes")
def list_changes(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("administrativo", "admin")),
    limit: int = Query(default=100, ge=1, le=500),
) -> list[ChangeLog]:
    statement = select(ChangeLog).order_by(ChangeLog.changed_at.desc()).limit(limit)
    return list(session.exec(statement).all())


@router.post("/count-events")
def ingest_count_events(
    payload: CountEventsPayload,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    synced_ids: list[str] = []

    for event in payload.events:
        event_hash = hashlib.sha256(event.client_event_id.encode("utf-8")).hexdigest()
        entity_id = int(event_hash[:8], 16)

        existing = session.exec(
            select(ChangeLog).where(
                ChangeLog.entity_name == "stock_count",
                ChangeLog.action == "count_event",
                ChangeLog.entity_id == entity_id,
            )
        ).first()
        if existing:
            synced_ids.append(event.client_event_id)
            continue

        log = ChangeLog(
            entity_name="stock_count",
            entity_id=entity_id,
            action="count_event",
            actor=user.username,
            changed_at=datetime.now(timezone.utc),
            payload={
                "client_event_id": event.client_event_id,
                "item_code": event.item_code,
                "quantity": event.quantity,
                "observed_at": event.observed_at,
                "device_name": event.device_name,
            },
        )
        session.add(log)
        synced_ids.append(event.client_event_id)

    session.commit()
    return {"received": len(payload.events), "synced": len(synced_ids), "synced_ids": synced_ids}
