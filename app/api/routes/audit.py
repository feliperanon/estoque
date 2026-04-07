import hashlib
import re
import logging
from collections import defaultdict
from itertools import groupby
from datetime import date, datetime, time, timezone, timedelta
from io import BytesIO
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, SQLModel, select

from app.api.deps import require_roles, require_stock_analysis_access
from app.db.session import engine, get_session
from app.models import (
    ChangeLog,
    InventoryImport,
    InventoryImportItem,
    MateCouroTrocaLog,
    Product,
    RecountSignal,
    User,
    ValidityLine,
)
from app.services.inventory_txt_parse import (
    extract_caixa_unidade_from_numeric_tail,
    extract_caixa_unidade_from_txt_tokens,
)

router = APIRouter(prefix="/audit", tags=["audit"])
logger = logging.getLogger(__name__)
_BR = ZoneInfo("America/Sao_Paulo")


def _ensure_validity_lines_table() -> None:
    """Garante DDL (Railway/deploy sem alembic ou migração pendente). Idempotente."""
    try:
        SQLModel.metadata.create_all(
            engine,
            tables=[ValidityLine.__table__],
            checkfirst=True,
        )
    except SQLAlchemyError:
        logger.exception("Falha ao garantir tabela validity_lines")
        raise


def _validity_observed_at_iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    try:
        if dt.tzinfo is None:
            u = dt.replace(tzinfo=timezone.utc)
        else:
            u = dt.astimezone(timezone.utc)
        return u.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    except Exception:
        return None


def _parse_iso_date_arg(value: str | None) -> date | None:
    if not value or not str(value).strip():
        return None
    try:
        return date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        return None


def _brazil_date_from_observed_at(observed_at: str | None) -> date | None:
    if not observed_at:
        return None
    try:
        s = str(observed_at).strip()
        if s.endswith("Z"):
            s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(_BR).date()
    except Exception:
        return None


def _parse_and_validate_observed_at(observed_at: str) -> tuple[datetime, date]:
    """Valida ISO8601; retorna instante UTC-normalizado e data em America/Sao_Paulo."""
    try:
        s = str(observed_at).strip()
        if s.endswith("Z"):
            s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        br_date = dt.astimezone(_BR).date()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"observed_at invalido: {exc}",
        ) from exc
    now_br = datetime.now(timezone.utc).astimezone(_BR)
    if br_date > now_br.date():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Data da operacao (America/Sao_Paulo) nao pode ser futura.",
        )
    if dt > datetime.now(timezone.utc) + timedelta(hours=2):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="observed_at muito no futuro em relacao ao servidor.",
        )
    return dt, br_date


class CountEventInput(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=100)
    item_code: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=-500000, le=500000)
    observed_at: str
    device_name: str | None = Field(default=None, max_length=120)


class CountEventsPayload(BaseModel):
    events: list[CountEventInput]


class BreakEventInput(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=100)
    item_code: str = Field(min_length=1, max_length=120)
    quantity: int = Field(ge=-500_000, le=500_000)
    observed_at: str
    device_name: str | None = Field(default=None, max_length=120)
    reason: str | None = Field(default=None, max_length=120)
    operational_date: str | None = Field(
        default=None,
        description="YYYY-MM-DD (America/Sao_Paulo). Se omitido, deriva de observed_at.",
    )


class BreakEventsPayload(BaseModel):
    events: list[BreakEventInput]


class ValidityEventInput(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=100)
    cod_produto: str = Field(min_length=1, max_length=120)
    expiration_date: date
    quantity_un: int = Field(ge=0, le=500_000)
    lot_code: str | None = Field(default=None, max_length=80)
    note: str | None = Field(default=None, max_length=500)
    observed_at: str
    device_name: str | None = Field(default=None, max_length=120)


class ValidityEventsPayload(BaseModel):
    events: list[ValidityEventInput]
    reference_date: str | None = Field(
        default=None,
        description="YYYY-MM-DD da importação TXT usada para teto de UN (mesmo filtro da contagem).",
    )


def _un_balance_map_for_validity(session: Session, reference_date: date | None) -> dict[str, int]:
    """Saldo UN agregado por código (última importação para a data informada)."""
    current_import = None
    if reference_date is not None:
        current_import = session.exec(
            select(InventoryImport)
            .where(InventoryImport.reference_date == reference_date)
            .order_by(InventoryImport.imported_at.desc())
            .limit(1)
        ).first()
    else:
        current_import = session.exec(
            select(InventoryImport).order_by(InventoryImport.imported_at.desc()).limit(1)
        ).first()

    out: dict[str, int] = {}
    if not current_import:
        return out

    import_items = list(
        session.exec(
            select(InventoryImportItem).where(InventoryImportItem.inventory_import_id == current_import.id)
        ).all()
    )
    for item in import_items:
        code = _normalize_item_code(item.cod_produto)
        if not code:
            continue
        _cx, un = _extract_import_quantities(item.metrics if isinstance(item.metrics, dict) else None)
        out[code] = out.get(code, 0) + int(un)
    return out


def _normalize_item_code(value: str | None) -> str:
    raw = (value or "").strip().upper()
    raw = re.sub(r"\s+", " ", raw)
    raw = re.sub(r"\s*\[(UN|CX)\]\s*$", "", raw)
    return raw


def _format_first_second_name(full_name: str | None, fallback_login: str | None) -> str:
    """Primeiro nome completo; se houver segundo token, só a inicial e ponto (ex.: Felipe R.). Senão login."""
    fn = (full_name or "").strip()
    if fn:
        parts = fn.split()
        if len(parts) >= 2:
            initial = (parts[1] or "")[:1]
            if initial:
                return f"{parts[0]} {initial.upper()}."
            return parts[0]
        if parts:
            return parts[0]
    fb = (fallback_login or "").strip()
    return fb if fb else "—"


def _display_name_map_for_logins(session: Session, logins: set[str]) -> dict[str, str]:
    """username (login) → rótulo para exibição (primeiro nome + inicial do segundo)."""
    out: dict[str, str] = {}
    clean = {x.strip() for x in logins if x and str(x).strip()}
    if not clean:
        return out
    users = list(session.exec(select(User).where(User.username.in_(list(clean)))).all())
    for u in users:
        lu = (u.username or "").strip()
        if lu:
            out[lu] = _format_first_second_name(u.full_name, u.username)
    for login in clean:
        if login not in out:
            out[login] = login
    return out


def _actor_csv_to_display_labels(actor_csv: str | None, name_map: dict[str, str]) -> str | None:
    if actor_csv is None or not str(actor_csv).strip():
        return None
    parts = [p.strip() for p in re.split(r",\s*", str(actor_csv).strip()) if p.strip()]
    if not parts:
        return None
    return ", ".join(name_map.get(p, p) for p in parts)


def _extract_count_type(value: str | None) -> str:
    raw = (value or "").strip().upper()
    if raw.endswith("[UN]"):
        return "unidade"
    return "caixa"


def _aggregate_count_events_by_code(
    session: Session,
    count_on_date: date | None = None,
) -> dict[str, dict[str, int]]:
    """Soma CX/UN por produto (ChangeLog). Se count_on_date, filtra pela data observada em America/Sao_Paulo."""
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
        if count_on_date is not None:
            od = payload.get("observed_at")
            br_d = _brazil_date_from_observed_at(str(od) if od is not None else "")
            if br_d is None or br_d != count_on_date:
                continue
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
    return counted_by_code


def _parse_payload_observed_at_utc(od: object) -> datetime | None:
    if od is None:
        return None
    try:
        s = str(od).strip()
        if not s:
            return None
        if s.endswith("Z"):
            s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        else:
            dt = dt.astimezone(timezone.utc)
        return dt
    except Exception:
        return None


def _count_day_activity_meta(session: Session, count_on_date: date) -> dict:
    """Atores e intervalo de observed_at (UTC ISO) dos eventos do dia operacional em SP."""
    count_logs = list(
        session.exec(
            select(ChangeLog).where(
                ChangeLog.entity_name == "stock_count",
                ChangeLog.action == "count_event",
            )
        ).all()
    )
    actors: set[str] = set()
    observed_utc: list[datetime] = []
    event_count = 0
    for log in count_logs:
        payload = log.payload if isinstance(log.payload, dict) else {}
        od = payload.get("observed_at")
        br_d = _brazil_date_from_observed_at(str(od) if od is not None else "")
        if br_d is None or br_d != count_on_date:
            continue
        event_count += 1
        a = (log.actor or "").strip()
        if a:
            actors.add(a)
        pdt = _parse_payload_observed_at_utc(od)
        if pdt:
            observed_utc.append(pdt)
    first_iso: str | None = None
    last_iso: str | None = None
    if observed_utc:
        mn = min(observed_utc)
        mx = max(observed_utc)
        first_iso = mn.replace(microsecond=0).isoformat().replace("+00:00", "Z")
        last_iso = mx.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    return {
        "count_date": count_on_date.isoformat(),
        "actors": sorted(actors),
        "first_observed_at": first_iso,
        "last_observed_at": last_iso,
        "event_count": event_count,
    }


def _last_count_snapshot_per_code(session: Session) -> dict[str, dict]:
    """
    Por produto: totais de CX/UN do dia da última contagem registrada no sistema
    (maior data America/Sao_Paulo em observed_at entre eventos de contagem).
    """
    count_logs = list(
        session.exec(
            select(ChangeLog).where(
                ChangeLog.entity_name == "stock_count",
                ChangeLog.action == "count_event",
            )
        ).all()
    )
    per_day: dict[tuple[str, date], dict[str, int]] = {}
    for log in count_logs:
        payload = log.payload if isinstance(log.payload, dict) else {}
        od = payload.get("observed_at")
        br_d = _brazil_date_from_observed_at(str(od) if od is not None else "")
        if br_d is None:
            continue
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
        key = (code, br_d)
        if key not in per_day:
            per_day[key] = {"caixa": 0, "unidade": 0}
        per_day[key][count_type] = per_day[key].get(count_type, 0) + qty

    by_code: dict[str, tuple[date, dict[str, int]]] = {}
    for (code, br_d), rec in per_day.items():
        if code not in by_code or br_d > by_code[code][0]:
            by_code[code] = (br_d, dict(rec))

    out: dict[str, dict] = {}
    for code, (best_d, rec) in by_code.items():
        out[code] = {
            "caixa": int(rec.get("caixa", 0)),
            "unidade": int(rec.get("unidade", 0)),
            "count_date": best_d.isoformat(),
        }
    return out


def _extract_import_quantities(metrics: dict | list | None) -> tuple[int, int]:
    """CX/UN a partir do JSON do item (preferência: caixa/unidade gravados na importação)."""
    if metrics is None:
        return 0, 0
    if isinstance(metrics, dict):
        caixa = metrics.get("caixa")
        unidade = metrics.get("unidade")
        if caixa is not None and unidade is not None:
            try:
                return int(caixa), int(unidade)
            except (TypeError, ValueError):
                pass
        nt = metrics.get("numeric_tail")
        if isinstance(nt, str):
            got = extract_caixa_unidade_from_numeric_tail(nt)
            if got is not None:
                return got
        raw = metrics.get("raw")
        if isinstance(raw, list):
            return extract_caixa_unidade_from_txt_tokens([str(x) for x in raw])
        return 0, 0
    if isinstance(metrics, list):
        return extract_caixa_unidade_from_txt_tokens([str(x) for x in metrics])
    return 0, 0


@router.get("/import-balances")
def import_balances(
    reference_date: str | None = Query(default=None),
    only_active: bool = Query(default=True, alias="only_active"),
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """
    Saldo CX/UN por produto conforme importação TXT (mesma base da análise de contagem).
    has_txt_import=false quando não há arquivo (fallback catálogo 0/0) — a UI não deve validar “bateu”.
    """
    from app.api.routes.products import _catalog_status_is_ativo_clause

    current_import = None
    if reference_date:
        current_import = session.exec(
            select(InventoryImport)
            .where(InventoryImport.reference_date == reference_date)
            .order_by(InventoryImport.imported_at.desc())
            .limit(1)
        ).first()
    else:
        current_import = session.exec(
            select(InventoryImport).order_by(InventoryImport.imported_at.desc()).limit(1)
        ).first()

    use_catalog_fallback = False
    imported_by_code: dict[str, dict] = {}
    import_meta: dict | None = None

    if current_import:
        import_items = list(
            session.exec(
                select(InventoryImportItem).where(InventoryImportItem.inventory_import_id == current_import.id)
            ).all()
        )
        for item in import_items:
            code = _normalize_item_code(item.cod_produto)
            if not code:
                continue
            import_caixa, import_unidade = _extract_import_quantities(
                item.metrics if isinstance(item.metrics, dict) else None
            )
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
        import_meta = {
            "id": current_import.id,
            "reference_date": current_import.reference_date,
            "file_name": current_import.file_name,
            "imported_at": current_import.imported_at,
            "total_products": current_import.total_products,
            "created_products": current_import.created_products,
        }
    elif only_active:
        use_catalog_fallback = True
        prods = list(
            session.exec(
                select(Product.cod_produto, Product.cod_grup_descricao)
                .where(_catalog_status_is_ativo_clause())
                .order_by(Product.cod_grup_descricao)
            ).all()
        )
        for cod_raw, desc in prods:
            code = _normalize_item_code(cod_raw)
            if not code:
                continue
            imported_by_code[code] = {
                "cod_produto": code,
                "descricao": (desc or "").strip(),
                "import_caixa": 0,
                "import_unidade": 0,
            }
        ref_label = (reference_date or "").strip()
        file_note = (
            f"Sem importação TXT para {ref_label} — saldo 0 CX / 0 UN (somente ativos)"
            if ref_label
            else "Sem importação TXT — saldo 0 CX / 0 UN (somente produtos ativos)"
        )
        import_meta = {
            "id": None,
            "reference_date": reference_date or None,
            "file_name": file_note,
            "imported_at": None,
            "total_products": len(imported_by_code),
            "created_products": 0,
        }
    else:
        return {"has_txt_import": False, "import": None, "balances": {}}

    has_txt_import = bool(current_import) and not use_catalog_fallback

    balances: dict[str, dict[str, int]] = {}
    for code, rec in imported_by_code.items():
        balances[code] = {
            "import_caixa": int(rec.get("import_caixa", 0)),
            "import_unidade": int(rec.get("import_unidade", 0)),
        }

    return {
        "has_txt_import": has_txt_import,
        "import": import_meta,
        "balances": balances,
    }


@router.get("/last-count-per-product")
def last_count_per_product(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """
    Última contagem consolidada por produto (ChangeLog): CX/UN do dia mais recente
    em que houve lançamento de contagem para aquele código.
    """
    balances = _last_count_snapshot_per_code(session)
    return {"balances": balances}


@router.get("/count-server-totals")
def count_server_totals(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
    count_date: str | None = Query(
        default=None,
        description="YYYY-MM-DD: soma apenas eventos cuja data observada (America/Sao_Paulo) é esse dia. Padrão: hoje em SP.",
    ),
) -> dict:
    """
    Totais CX/UN já sincronizados no servidor (ChangeLog), somando conferentes.
    Filtrado por dia operacional (America/Sao_Paulo) para não misturar contagens de dias anteriores.
    """
    br_today = datetime.now(timezone.utc).astimezone(_BR).date()
    d = _parse_iso_date_arg(count_date) if count_date else br_today
    if d is None:
        d = br_today
    counted_by_code = _aggregate_count_events_by_code(session, count_on_date=d)
    balances: dict[str, dict[str, int]] = {}
    for code, rec in counted_by_code.items():
        balances[code] = {
            "caixa": int(rec.get("caixa", 0)),
            "unidade": int(rec.get("unidade", 0)),
        }
    meta = _count_day_activity_meta(session, d)
    return {"balances": balances, "meta": meta}


def _compute_stock_analysis(
    session: Session,
    import_id: int | None,
    reference_date: str | None,
    only_diff: bool,
    only_active_products: bool,
    limit: int,
) -> dict:
    from app.api.routes.products import _catalog_status_is_ativo_clause

    current_import = None
    if import_id is not None:
        current_import = session.get(InventoryImport, import_id)
    elif reference_date:
        # Busca importação pela data de referência exata
        current_import = session.exec(
            select(InventoryImport)
            .where(InventoryImport.reference_date == reference_date)
            .order_by(InventoryImport.imported_at.desc())
            .limit(1)
        ).first()
    else:
        current_import = session.exec(
            select(InventoryImport).order_by(InventoryImport.imported_at.desc()).limit(1)
        ).first()

    use_catalog_fallback = False
    imported_by_code: dict[str, dict] = {}
    import_meta: dict | None = None

    if current_import:
        import_items = list(
            session.exec(
                select(InventoryImportItem).where(InventoryImportItem.inventory_import_id == current_import.id)
            ).all()
        )
        for item in import_items:
            code = _normalize_item_code(item.cod_produto)
            if not code:
                continue
            import_caixa, import_unidade = _extract_import_quantities(
                item.metrics if isinstance(item.metrics, dict) else None
            )
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
        import_meta = {
            "id": current_import.id,
            "reference_date": current_import.reference_date,
            "file_name": current_import.file_name,
            "imported_at": current_import.imported_at,
            "total_products": current_import.total_products,
            "created_products": current_import.created_products,
        }
    elif only_active_products:
        # Sem TXT: baseia a análise no catálogo de produtos ativos com saldo 0 CX / 0 UN
        use_catalog_fallback = True
        prods = list(
            session.exec(
                select(Product.cod_produto, Product.cod_grup_descricao)
                .where(_catalog_status_is_ativo_clause())
                .order_by(Product.cod_grup_descricao)
            ).all()
        )
        for cod_raw, desc in prods:
            code = _normalize_item_code(cod_raw)
            if not code:
                continue
            imported_by_code[code] = {
                "cod_produto": code,
                "descricao": (desc or "").strip(),
                "import_caixa": 0,
                "import_unidade": 0,
            }
        ref_label = (reference_date or "").strip()
        file_note = (
            f"Sem importação TXT para {ref_label} — saldo 0 CX / 0 UN (somente ativos)"
            if ref_label
            else "Sem importação TXT — saldo 0 CX / 0 UN (somente produtos ativos)"
        )
        import_meta = {
            "id": None,
            "reference_date": reference_date or None,
            "file_name": file_note,
            "imported_at": None,
            "total_products": len(imported_by_code),
            "created_products": 0,
        }
    else:
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

    active_set: set[str] | None = None
    if only_active_products:
        if use_catalog_fallback:
            active_set = set(imported_by_code.keys())
        else:
            active_rows = session.exec(select(Product.cod_produto).where(_catalog_status_is_ativo_clause())).all()
            active_set = {_normalize_item_code(c) for c in active_rows if c}

    # Contagem comparada ao saldo: apenas eventos do mesmo dia de referência (America/Sao_Paulo).
    br_today = datetime.now(timezone.utc).astimezone(_BR).date()
    if current_import:
        rd = current_import.reference_date
        count_day = rd if isinstance(rd, date) else _parse_iso_date_arg(str(rd))
        if count_day is None:
            count_day = br_today
    else:
        count_day = _parse_iso_date_arg(reference_date) or br_today
    counted_by_code = _aggregate_count_events_by_code(session, count_on_date=count_day)

    all_codes = set(imported_by_code.keys()) | set(counted_by_code.keys())
    rows: list[dict] = []
    equal_items = 0
    divergent_items = 0
    missing_in_count = 0
    extra_in_count = 0

    grupos_by_code: dict[str, str] = {}
    if only_active_products:
        prod_grup = session.exec(
            select(Product.cod_produto, Product.cod_grup_familia, Product.cod_grup_segmento).where(
                _catalog_status_is_ativo_clause()
            )
        ).all()
        for cod_raw, fam, seg in prod_grup:
            c = _normalize_item_code(cod_raw)
            if not c:
                continue
            label = (str(fam or "").strip() or str(seg or "").strip())
            grupos_by_code[c] = label if label else "Sem grupo"

    for code in all_codes:
        if active_set is not None and code not in active_set:
            continue
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
                "grupo": grupos_by_code.get(code, "Sem grupo"),
            }
        )

    def _status_rank(st: str) -> int:
        return {"missing_in_count": 0, "divergent": 1, "extra_in_count": 2, "ok": 3}.get(st, 9)

    rows.sort(
        key=lambda r: (
            _status_rank(str(r["status"])),
            -int(r["difference_abs"]),
            (r.get("grupo") or "Sem grupo").lower(),
            str(r["cod_produto"]),
        )
    )
    rows = rows[:limit]

    def _len_codes(mapping: dict[str, dict]) -> int:
        if active_set is None:
            return len(mapping)
        return sum(1 for c in mapping if c in active_set)

    return {
        "import": import_meta,
        "summary": {
            "total_import_items": _len_codes(imported_by_code),
            "counted_items": _len_codes(counted_by_code),
            "equal_items": equal_items,
            "divergent_items": divergent_items,
            "missing_in_count": missing_in_count,
            "extra_in_count": extra_in_count,
        },
        "rows": rows,
    }


def _safe_int(value: object) -> int:
    try:
        return int(value)
    except Exception:
        return 0


def _timeline_count_events_for_code(
    session: Session,
    item_code: str,
    count_on_date: date | None = None,
) -> list[dict]:
    code = _normalize_item_code(item_code)
    if not code:
        return []

    count_logs = list(
        session.exec(
            select(ChangeLog).where(
                ChangeLog.entity_name == "stock_count",
                ChangeLog.action == "count_event",
            )
        ).all()
    )

    events: list[dict] = []
    for log in count_logs:
        payload = log.payload if isinstance(log.payload, dict) else {}
        raw_item_code = str(payload.get("item_code") or "")
        if _normalize_item_code(raw_item_code) != code:
            continue

        observed_at = str(payload.get("observed_at") or "").strip() or None
        if count_on_date is not None:
            br_d = _brazil_date_from_observed_at(observed_at)
            if br_d is None or br_d != count_on_date:
                continue

        changed_at = _validity_observed_at_iso(log.changed_at)
        events.append(
            {
                "log_id": log.id,
                "actor": (log.actor or "").strip() or None,
                "observed_at": observed_at,
                "changed_at": changed_at,
                "device_name": (payload.get("device_name") or "") or None,
                "count_type": _extract_count_type(raw_item_code),
                "quantity_delta": _safe_int(payload.get("quantity", 0)),
                "_sort_observed": observed_at or "",
                "_sort_changed": changed_at or "",
            }
        )

    events.sort(key=lambda e: (e["_sort_observed"], e["_sort_changed"], int(e.get("log_id") or 0)))

    total_caixa = 0
    total_unidade = 0
    history: list[dict] = []
    for event in events:
        prev_caixa = total_caixa
        prev_unidade = total_unidade
        qty = int(event["quantity_delta"])
        if event["count_type"] == "unidade":
            total_unidade += qty
        else:
            total_caixa += qty

        history.append(
            {
                "log_id": event["log_id"],
                "actor": event["actor"],
                "observed_at": event["observed_at"],
                "changed_at": event["changed_at"],
                "device_name": event["device_name"],
                "count_type": event["count_type"],
                "quantity_delta": qty,
                "previous_value": prev_unidade if event["count_type"] == "unidade" else prev_caixa,
                "current_value": total_unidade if event["count_type"] == "unidade" else total_caixa,
                "previous_caixa": prev_caixa,
                "current_caixa": total_caixa,
                "previous_unidade": prev_unidade,
                "current_unidade": total_unidade,
            }
        )

    return history


def _audit_status_label_pt(status: str) -> str:
    return {
        "ok": "OK",
        "missing_in_count": "Sem contagem",
        "extra_in_count": "Só na contagem",
        "divergent": "Divergência",
    }.get(status, status)


def _build_stock_analysis_excel_workbook(
    data: dict,
    emitted_at_br: datetime,
    emitted_by: str,
) -> BytesIO:
    """Monta planilha formatada com cabeçalho, resumo e linhas da análise."""
    wb = Workbook()
    ws = wb.active
    ws.title = "Análise"

    title_font = Font(name="Calibri", size=18, bold=True, color="FFFFFF")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(
        start_color="1B4332",
        end_color="1B4332",
        fill_type="solid",
    )
    sub_fill = PatternFill(
        start_color="D8F3DC",
        end_color="D8F3DC",
        fill_type="solid",
    )
    thin = Side(style="thin", color="B7B7B7")
    border_all = Border(left=thin, right=thin, top=thin, bottom=thin)
    wrap = Alignment(wrap_text=True, vertical="center", horizontal="left")
    center = Alignment(horizontal="center", vertical="center")

    ncols = 11
    last_col = get_column_letter(ncols)

    ws.merge_cells(f"A1:{last_col}1")
    c1 = ws["A1"]
    c1.value = "Análise de Contagem · Estoque"
    c1.font = title_font
    c1.fill = header_fill
    c1.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 28

    ws.merge_cells(f"A2:{last_col}2")
    ws["A2"].value = (
        f"Emitido em: {emitted_at_br.strftime('%d/%m/%Y %H:%M:%S')}  ·  "
        f"Emitido por: {emitted_by}"
    )
    ws["A2"].font = Font(name="Calibri", size=11, bold=True, color="1B4332")
    ws["A2"].fill = sub_fill
    ws["A2"].alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[2].height = 22

    imp = data.get("import") or {}
    ref_line = ""
    if imp:
        ref = imp.get("reference_date") or "—"
        fname = imp.get("file_name") or "—"
        ref_line = f"Base de saldo: data ref. {ref}  |  {fname}"
    else:
        ref_line = "Base de saldo: não disponível"

    ws.merge_cells(f"A3:{last_col}3")
    ws["A3"].value = ref_line
    ws["A3"].font = Font(name="Calibri", size=10)
    ws["A3"].alignment = wrap

    s = data.get("summary") or {}
    summary_text = (
        f"Resumo — Itens com saldo: {s.get('total_import_items', 0)}  |  "
        f"Com contagem: {s.get('counted_items', 0)}  |  "
        f"Conferidos: {s.get('equal_items', 0)}  |  "
        f"Divergências: {s.get('divergent_items', 0)}  |  "
        f"Sem contagem: {s.get('missing_in_count', 0)}  |  "
        f"Só na contagem: {s.get('extra_in_count', 0)}"
    )
    ws.merge_cells(f"A4:{last_col}4")
    ws["A4"].value = summary_text
    ws["A4"].font = Font(name="Calibri", size=10, italic=True)
    ws["A4"].alignment = wrap

    headers = [
        "Código",
        "Grupo",
        "Produto",
        "Situação",
        "Saldo CX",
        "Saldo UN",
        "Contagem CX",
        "Contagem UN",
        "Dif. CX",
        "Dif. UN",
        "|Dif| total",
    ]
    start_row = 6
    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=start_row, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.border = border_all
        cell.alignment = center

    rows = data.get("rows") or []
    for i, row in enumerate(rows, start=start_row + 1):
        status = _audit_status_label_pt(str(row.get("status") or ""))
        vals = [
            row.get("cod_produto") or "",
            row.get("grupo") or "",
            row.get("descricao") or "",
            status,
            int(row.get("import_caixa") or 0),
            int(row.get("import_unidade") or 0),
            int(row.get("counted_caixa") or 0),
            int(row.get("counted_unidade") or 0),
            int(row.get("difference_caixa") or 0),
            int(row.get("difference_unidade") or 0),
            int(row.get("difference_abs") or 0),
        ]
        for j, v in enumerate(vals, start=1):
            cell = ws.cell(row=i, column=j, value=v)
            cell.border = border_all
            if j > 4:
                cell.alignment = Alignment(horizontal="right", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

    widths = [14, 18, 42, 16, 10, 10, 12, 12, 10, 10, 12]
    for idx, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(idx)].width = w

    ws.freeze_panes = f"A{start_row + 1}"

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


@router.get("/stock-analysis")
def stock_analysis(
    import_id: int | None = Query(default=None, ge=1),
    reference_date: str | None = Query(default=None),
    only_diff: bool = Query(default=False),
    only_active_products: bool = Query(default=True, alias="only_active"),
    limit: int = Query(default=500, ge=1, le=5000),
    session: Session = Depends(get_session),
    _: User = Depends(require_stock_analysis_access),
) -> dict:
    return _compute_stock_analysis(
        session,
        import_id=import_id,
        reference_date=reference_date,
        only_diff=only_diff,
        only_active_products=only_active_products,
        limit=limit,
    )


@router.get("/stock-analysis/detail")
def stock_analysis_detail(
    item_code: str = Query(..., min_length=1, max_length=120),
    import_id: int | None = Query(default=None, ge=1),
    reference_date: str | None = Query(default=None),
    only_active_products: bool = Query(default=True, alias="only_active"),
    session: Session = Depends(get_session),
    _: User = Depends(require_stock_analysis_access),
) -> dict:
    normalized = _normalize_item_code(item_code)
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Codigo do produto invalido para detalhamento.",
        )

    data = _compute_stock_analysis(
        session,
        import_id=import_id,
        reference_date=reference_date,
        only_diff=False,
        only_active_products=only_active_products,
        limit=50_000,
    )

    row = next(
        (
            item
            for item in data.get("rows", [])
            if _normalize_item_code(str(item.get("cod_produto") or "")) == normalized
        ),
        None,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Produto nao encontrado na analise.")

    import_meta = data.get("import") or {}
    count_day = _parse_iso_date_arg(str(import_meta.get("reference_date") or reference_date or ""))
    if count_day is None:
        count_day = datetime.now(timezone.utc).astimezone(_BR).date()

    history = _timeline_count_events_for_code(session, normalized, count_on_date=count_day)
    actors = sorted({str(h.get("actor") or "").strip() for h in history if str(h.get("actor") or "").strip()})
    devices = sorted(
        {str(h.get("device_name") or "").strip() for h in history if str(h.get("device_name") or "").strip()}
    )

    return {
        "item_code": normalized,
        "count_date": count_day.isoformat(),
        "analysis": row,
        "import": import_meta,
        "history": history,
        "summary": {
            "launches": len(history),
            "actors": actors,
            "devices": devices,
            "last_observed_at": history[-1]["observed_at"] if history else None,
            "last_actor": history[-1]["actor"] if history else None,
        },
    }


@router.get("/stock-analysis/export.xlsx")
def export_stock_analysis_excel(
    import_id: int | None = Query(default=None, ge=1),
    reference_date: str | None = Query(default=None),
    only_diff: bool = Query(default=False),
    only_active_products: bool = Query(default=True, alias="only_active"),
    limit: int = Query(default=20000, ge=1, le=50000),
    session: Session = Depends(get_session),
    user: User = Depends(require_stock_analysis_access),
) -> StreamingResponse:
    """Exporta a mesma análise da tela em Excel com layout e metadados de emissão."""
    data = _compute_stock_analysis(
        session,
        import_id=import_id,
        reference_date=reference_date,
        only_diff=only_diff,
        only_active_products=only_active_products,
        limit=limit,
    )
    emitted_at_br = datetime.now(timezone.utc).astimezone(ZoneInfo("America/Sao_Paulo"))
    emitted_by = (user.full_name or "").strip() or (user.username or "—")
    if user.username and user.username not in emitted_by and "@" in (user.username or ""):
        emitted_by = f"{emitted_by} ({user.username})"

    buf = _build_stock_analysis_excel_workbook(data, emitted_at_br, emitted_by)
    stamp = emitted_at_br.strftime("%Y%m%d_%H%M%S")
    filename = f"analise-contagem_{stamp}.xlsx"

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
    max_pg_int = 2_147_483_647

    try:
        for event in payload.events:
            if event.quantity == 0:
                # Ignora eventos neutros para evitar ruido e validacao desnecessaria.
                continue
            dt_utc, _br_date = _parse_and_validate_observed_at(event.observed_at)
            obs_stored = dt_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")

            event_hash = hashlib.sha256(event.client_event_id.encode("utf-8")).hexdigest()
            # Mantem entity_id dentro do limite do INTEGER do PostgreSQL.
            entity_id = (int(event_hash[:16], 16) % max_pg_int) + 1

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
                    "observed_at": obs_stored,
                    "device_name": event.device_name,
                },
            )
            session.add(log)
            synced_ids.append(event.client_event_id)

        session.commit()
        return {"received": len(payload.events), "synced": len(synced_ids), "synced_ids": synced_ids}
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        logger.exception("Falha ao sincronizar eventos de contagem")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao sincronizar contagem: {exc}",
        )


def _aggregate_break_events_by_code(session: Session, operational_date: date) -> dict[str, dict[str, int]]:
    """Soma CX/UN de quebra por produto (ChangeLog), filtrando pelo dia operacional."""
    logs = list(
        session.exec(
            select(ChangeLog).where(
                ChangeLog.entity_name == "stock_break",
                ChangeLog.action == "break_event",
            )
        ).all()
    )
    out: dict[str, dict[str, int]] = {}
    for log in logs:
        payload = log.payload if isinstance(log.payload, dict) else {}
        od = payload.get("operational_date")
        if od:
            try:
                d = date.fromisoformat(str(od)[:10])
            except ValueError:
                continue
            if d != operational_date:
                continue
        else:
            br_d = _brazil_date_from_observed_at(str(payload.get("observed_at") or ""))
            if br_d is None or br_d != operational_date:
                continue
        item_code = str(payload.get("item_code") or "")
        code = _normalize_item_code(item_code)
        if not code:
            continue
        try:
            qty = int(payload.get("quantity", 0))
        except Exception:
            qty = 0
        if qty == 0:
            continue
        ct = _extract_count_type(item_code)
        if code not in out:
            out[code] = {"caixa": 0, "unidade": 0}
        out[code][ct] = out[code].get(ct, 0) + qty
    return out


def _merge_break_event_rows_for_operational_day(raw: list[dict]) -> list[dict]:
    """Consolida lançamentos do dia: uma linha por produto com totais líquidos CX e UN no mesmo registro."""
    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in raw:
        code = str(r.get("cod_produto") or "")
        if not code:
            continue
        buckets[code].append(r)

    merged: list[dict] = []
    for code in sorted(buckets.keys()):
        items = buckets[code]
        total_cx = sum(
            int(x.get("quantity") or 0)
            for x in items
            if str(x.get("qty_type") or "caixa") == "caixa"
        )
        total_un = sum(
            int(x.get("quantity") or 0)
            for x in items
            if str(x.get("qty_type") or "caixa") == "unidade"
        )
        if total_cx == 0 and total_un == 0:
            continue
        observed_list = [str(x.get("observed_at") or "") for x in items if x.get("observed_at")]
        observed_max = max(observed_list) if observed_list else None
        actors_set: set[str] = set()
        for x in items:
            a = (x.get("actor") or "").strip()
            if a:
                actors_set.add(a)
        reasons_set: set[str] = set()
        for x in items:
            rs = x.get("reason")
            if rs is not None and str(rs).strip():
                reasons_set.add(str(rs).strip())
        reason_out: str | None = None
        if len(reasons_set) == 1:
            reason_out = next(iter(reasons_set))
        actor_out: str | None = None
        if len(actors_set) == 1:
            actor_out = next(iter(actors_set))
        elif len(actors_set) > 1:
            actor_out = ", ".join(sorted(actors_set))

        merged.append(
            {
                "cod_produto": code,
                "cx": int(total_cx),
                "un": int(total_un),
                "observed_at": observed_max,
                "actor": actor_out,
                "reason": reason_out,
                "client_event_id": None,
                "device_name": None,
            }
        )
    return merged


def _break_event_rows_for_operational_day(session: Session, operational_date: date) -> list[dict]:
    logs = list(
        session.exec(
            select(ChangeLog).where(
                ChangeLog.entity_name == "stock_break",
                ChangeLog.action == "break_event",
            )
        ).all()
    )
    raw: list[dict] = []
    for log in logs:
        payload = log.payload if isinstance(log.payload, dict) else {}
        od = payload.get("operational_date")
        if od:
            try:
                d = date.fromisoformat(str(od)[:10])
            except ValueError:
                continue
            if d != operational_date:
                continue
        else:
            br_d = _brazil_date_from_observed_at(str(payload.get("observed_at") or ""))
            if br_d is None or br_d != operational_date:
                continue
        item_code = str(payload.get("item_code") or "")
        code = _normalize_item_code(item_code)
        if not code:
            continue
        try:
            qty = int(payload.get("quantity", 0))
        except Exception:
            qty = 0
        if qty == 0:
            continue
        ct = _extract_count_type(item_code)
        raw.append(
            {
                "cod_produto": code,
                "item_code_raw": item_code,
                "quantity": qty,
                "qty_type": ct,
                "observed_at": payload.get("observed_at"),
                "actor": (log.actor or "").strip() or None,
                "reason": payload.get("reason"),
                "client_event_id": payload.get("client_event_id"),
                "device_name": payload.get("device_name"),
            }
        )

    return _merge_break_event_rows_for_operational_day(raw)


@router.get("/break-day-totals")
def break_day_totals(
    operational_date: str | None = Query(
        default=None,
        description="YYYY-MM-DD do dia operacional (America/Sao_Paulo). Padrão: hoje.",
    ),
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    br_today = datetime.now(timezone.utc).astimezone(_BR).date()
    d = _parse_iso_date_arg(operational_date) if operational_date else br_today
    if d is None:
        d = br_today
    agg = _aggregate_break_events_by_code(session, d)
    balances: dict[str, dict[str, int]] = {}
    for code, rec in agg.items():
        balances[code] = {
            "caixa": int(rec.get("caixa", 0)),
            "unidade": int(rec.get("unidade", 0)),
        }
    return {"operational_date": d.isoformat(), "balances": balances}


@router.get("/break-events")
def list_break_events(
    operational_date: str | None = Query(
        default=None,
        description="YYYY-MM-DD do dia operacional (America/Sao_Paulo). Padrão: hoje.",
    ),
    limit: int = Query(default=2000, ge=1, le=5000),
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    br_today = datetime.now(timezone.utc).astimezone(_BR).date()
    d = _parse_iso_date_arg(operational_date) if operational_date else br_today
    if d is None:
        d = br_today
    rows = _break_event_rows_for_operational_day(session, d)[:limit]
    codes = list({str(r.get("cod_produto") or "") for r in rows if r.get("cod_produto")})
    desc_map: dict[str, str] = {}
    if codes:
        prod_rows = list(session.exec(select(Product).where(Product.cod_produto.in_(codes))).all())
        for p in prod_rows:
            c = (p.cod_produto or "").strip()
            if c:
                desc_map[c] = (p.cod_grup_descricao or "").strip()
    break_logins: set[str] = set()
    for r in rows:
        ac = r.get("actor")
        if ac and str(ac).strip():
            break_logins.update(p.strip() for p in re.split(r",\s*", str(ac).strip()) if p.strip())
    break_name_map = _display_name_map_for_logins(session, break_logins)
    for r in rows:
        c = str(r.get("cod_produto") or "")
        r["product_desc"] = desc_map.get(c) or None
        ac = r.get("actor")
        if ac:
            disp = _actor_csv_to_display_labels(str(ac), break_name_map)
            r["actor"] = disp if disp else ac
    return {"operational_date": d.isoformat(), "events": rows, "count": len(rows)}


@router.post("/break-events")
def ingest_break_events(
    payload: BreakEventsPayload,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    synced_ids: list[str] = []
    max_pg_int = 2_147_483_647

    try:
        for event in payload.events:
            if event.quantity == 0:
                continue
            dt_utc, br_date = _parse_and_validate_observed_at(event.observed_at)
            obs_stored = dt_utc.replace(microsecond=0).isoformat().replace("+00:00", "Z")

            op_d: date | None = None
            if event.operational_date:
                op_d = _parse_iso_date_arg(event.operational_date)
            if op_d is None:
                op_d = br_date

            event_hash = hashlib.sha256(event.client_event_id.encode("utf-8")).hexdigest()
            entity_id = (int(event_hash[:16], 16) % max_pg_int) + 1

            existing = session.exec(
                select(ChangeLog).where(
                    ChangeLog.entity_name == "stock_break",
                    ChangeLog.action == "break_event",
                    ChangeLog.entity_id == entity_id,
                )
            ).first()
            if existing:
                synced_ids.append(event.client_event_id)
                continue

            log = ChangeLog(
                entity_name="stock_break",
                entity_id=entity_id,
                action="break_event",
                actor=user.username,
                changed_at=datetime.now(timezone.utc),
                payload={
                    "client_event_id": event.client_event_id,
                    "item_code": event.item_code,
                    "quantity": event.quantity,
                    "observed_at": obs_stored,
                    "device_name": event.device_name,
                    "reason": event.reason,
                    "operational_date": op_d.isoformat(),
                },
            )
            session.add(log)
            synced_ids.append(event.client_event_id)

        session.commit()
        return {"received": len(payload.events), "synced": len(synced_ids), "synced_ids": synced_ids}
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        logger.exception("Falha ao sincronizar eventos de quebra")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao sincronizar quebra: {exc}",
        )


@router.get("/validity-lines")
def list_validity_lines(
    operational_date: str | None = Query(
        default=None,
        description="YYYY-MM-DD do dia operacional (America/Sao_Paulo). Padrão: hoje.",
    ),
    include_all_days: bool = Query(
        default=False,
        description="Quando true, retorna linhas de todas as datas operacionais.",
    ),
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    _ensure_validity_lines_table()
    br_today = datetime.now(timezone.utc).astimezone(_BR).date()
    d = _parse_iso_date_arg(operational_date) if operational_date else br_today
    if d is None:
        d = br_today
    try:
        stmt = select(ValidityLine)
        if not include_all_days:
            stmt = stmt.where(ValidityLine.operational_date == d)
        rows = list(
            session.exec(
                stmt.order_by(
                    ValidityLine.cod_produto,
                    ValidityLine.operational_date,
                    ValidityLine.expiration_date,
                    ValidityLine.id,
                )
            ).all()
        )
    except SQLAlchemyError as exc:
        logger.exception("Erro ao listar validity_lines")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao consultar validades: {exc}",
        ) from exc
    v_logins = {
        (r.actor_username or "").strip()
        for r in rows
        if r.actor_username and str(r.actor_username).strip()
    }
    v_name_map = _display_name_map_for_logins(session, v_logins)
    lines = []
    for r in rows:
        au = r.actor_username
        au_disp = (
            v_name_map.get((au or "").strip(), au)
            if au and str(au).strip()
            else au
        )
        lines.append(
            {
                "id": r.id,
                "client_event_id": r.client_event_id,
                "cod_produto": r.cod_produto,
                "expiration_date": r.expiration_date.isoformat(),
                "quantity_un": int(r.quantity_un),
                "lot_code": r.lot_code,
                "note": r.note,
                "operational_date": r.operational_date.isoformat(),
                "observed_at": _validity_observed_at_iso(r.observed_at),
                "device_name": r.device_name,
                "actor_username": au_disp,
            }
        )
    return {"operational_date": d.isoformat(), "lines": lines}


@router.get("/validity-last-launch-by-product")
def validity_last_launch_by_product(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """Última data operacional (America/Sao_Paulo) em que cada produto teve ao menos uma linha de validade."""
    _ensure_validity_lines_table()
    try:
        rows = session.exec(
            select(ValidityLine.cod_produto, func.max(ValidityLine.operational_date)).group_by(
                ValidityLine.cod_produto
            )
        ).all()
    except SQLAlchemyError as exc:
        logger.exception("Erro ao agregar ultima validade por produto")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao consultar ultimas validades: {exc}",
        ) from exc
    last_by_code: dict[str, str] = {}
    for cod_raw, d in rows:
        if d is None:
            continue
        cod = _normalize_item_code(cod_raw)
        if not cod:
            continue
        last_by_code[cod] = d.isoformat()
    return {"last_by_code": last_by_code}


@router.get("/validity-display-expiry-by-product")
def validity_display_expiry_by_product(
    session: Session = Depends(get_session),
    _: User = Depends(require_stock_analysis_access),
) -> dict:
    """
    Mapa código → data de vencimento para exibição (alinhado ao módulo Validade no front:
    primeiro vencimento hoje ou futuro; se só há linhas vencidas, a mais antiga).
    """
    _ensure_validity_lines_table()
    br_today = datetime.now(timezone.utc).astimezone(_BR).date()
    try:
        rows = session.exec(select(ValidityLine.cod_produto, ValidityLine.expiration_date)).all()
    except SQLAlchemyError as exc:
        logger.exception("Erro ao agregar validade por produto")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao consultar validades agregadas: {exc}",
        ) from exc
    by_code: dict[str, list[date]] = defaultdict(list)
    for cod_raw, exp in rows:
        if exp is None:
            continue
        cod = _normalize_item_code(cod_raw)
        if not cod:
            continue
        by_code[cod].append(exp)
    out: dict[str, str] = {}
    for cod, dates in by_code.items():
        uniq = sorted(set(dates))
        chosen: date | None = None
        for d in uniq:
            if d >= br_today:
                chosen = d
                break
        if chosen is None and uniq:
            chosen = uniq[0]
        if chosen is not None:
            out[cod] = chosen.isoformat()
    return {"today": br_today.isoformat(), "by_code": out}


@router.delete("/validity-lines/{line_id}", status_code=204)
def delete_validity_line(
    line_id: int,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> None:
    _ensure_validity_lines_table()
    br_today = datetime.now(timezone.utc).astimezone(_BR).date()
    row = session.get(ValidityLine, line_id)
    if not row:
        raise HTTPException(status_code=404, detail="Linha de validade nao encontrada")
    if row.operational_date != br_today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="So e permitido excluir lancamentos do dia corrente (America/Sao_Paulo).",
        )
    session.delete(row)
    session.commit()


@router.post("/validity-events")
def ingest_validity_events(
    payload: ValidityEventsPayload,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """Sincroniza lançamentos de validade (idempotente por client_event_id)."""
    _ensure_validity_lines_table()
    synced_ids: list[str] = []
    now_br = datetime.now(timezone.utc).astimezone(_BR)
    br_today = now_br.date()

    ref_d = _parse_iso_date_arg(payload.reference_date) if payload.reference_date else None
    un_map = _un_balance_map_for_validity(session, ref_d)
    count_day = ref_d if ref_d is not None else br_today
    counted_by_code = _aggregate_count_events_by_code(session, count_on_date=count_day)

    def _validity_un_cap(code: str) -> int:
        c = _normalize_item_code(code)
        if not c:
            return 0
        if c in counted_by_code:
            return int(counted_by_code[c].get("unidade", 0))
        return int(un_map.get(c, 0))

    # Quantidades já gravadas hoje por código (excluindo duplicatas de idempotência)
    existing_by_code: dict[str, int] = {}
    existing_rows = list(
        session.exec(select(ValidityLine).where(ValidityLine.operational_date == br_today)).all()
    )
    for er in existing_rows:
        c = _normalize_item_code(er.cod_produto)
        if not c:
            continue
        existing_by_code[c] = existing_by_code.get(c, 0) + int(er.quantity_un)

    # Novas quantidades por código neste batch (apenas eventos que virarão insert)
    new_by_code: dict[str, int] = {}
    events_to_insert: list[ValidityEventInput] = []

    try:
        for event in payload.events:
            if event.quantity_un < 0:
                continue
            dt_utc, br_date = _parse_and_validate_observed_at(event.observed_at)
            if br_date != br_today:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Lancamento de validade apenas para o dia corrente (America/Sao_Paulo).",
                )
            code = _normalize_item_code(event.cod_produto)
            if not code:
                continue

            dup = session.exec(
                select(ValidityLine).where(ValidityLine.client_event_id == event.client_event_id)
            ).first()
            if dup:
                synced_ids.append(event.client_event_id)
                continue

            events_to_insert.append(event)
            new_by_code[code] = new_by_code.get(code, 0) + int(event.quantity_un)

        # Teto UN: contagem do dia (se existir evento para o código) senão saldo UN do TXT da referência
        for code, add_qty in new_by_code.items():
            if add_qty <= 0:
                continue
            cap = _validity_un_cap(code)
            total_after = existing_by_code.get(code, 0) + add_qty
            if cap <= 0 and total_after > 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Produto {code}: base UN zero (contagem/TXT); nao e possivel classificar quantidade.",
                )
            if cap > 0 and total_after > cap:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Produto {code}: soma das quantidades por validade ({total_after} UN) "
                        f"excede a base ({cap} UN) da contagem ou do TXT."
                    ),
                )

        for event in events_to_insert:
            dt_utc, br_date = _parse_and_validate_observed_at(event.observed_at)
            code = _normalize_item_code(event.cod_produto)
            row = ValidityLine(
                client_event_id=event.client_event_id,
                cod_produto=code,
                expiration_date=event.expiration_date,
                quantity_un=int(event.quantity_un),
                lot_code=(event.lot_code or "").strip() or None,
                note=(event.note or "").strip() or None,
                operational_date=br_date,
                observed_at=dt_utc.replace(tzinfo=timezone.utc),
                device_name=event.device_name,
                actor_username=user.username,
            )
            session.add(row)
            synced_ids.append(event.client_event_id)

        session.commit()
        return {"received": len(payload.events), "synced": len(synced_ids), "synced_ids": synced_ids}
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        logger.exception("Falha ao sincronizar validade")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao sincronizar validade: {exc}",
        ) from exc


def _ensure_recount_signals_table() -> None:
    try:
        SQLModel.metadata.create_all(engine, tables=[RecountSignal.__table__], checkfirst=True)
    except SQLAlchemyError:
        logger.exception("Falha ao garantir tabela recount_signals")
        raise


def _brazil_today_date() -> date:
    return datetime.now(timezone.utc).astimezone(_BR).date()


class RecountSignalIn(BaseModel):
    cod_produto: str = Field(min_length=1, max_length=120)
    operational_date: date | None = None


class RecountSignalsOut(BaseModel):
    operational_date: date
    codes: list[str]


@router.post("/recount-signal")
def post_recount_signal(
    body: RecountSignalIn,
    session: Session = Depends(get_session),
    user: User = Depends(require_stock_analysis_access),
):
    """Analista solicita recontagem ao conferente para o dia operacional informado (ou hoje em SP)."""
    _ensure_recount_signals_table()
    cod = _normalize_item_code(body.cod_produto)
    if not cod:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Codigo do produto invalido.")
    op_date = body.operational_date or _brazil_today_date()
    existing = session.exec(
        select(RecountSignal).where(
            RecountSignal.operational_date == op_date,
            RecountSignal.cod_produto == cod,
        )
    ).first()
    now = datetime.now(timezone.utc)
    if existing:
        existing.requested_at = now
        existing.requested_by = user.username
        session.add(existing)
    else:
        session.add(
            RecountSignal(
                operational_date=op_date,
                cod_produto=cod,
                requested_by=user.username,
                requested_at=now,
            )
        )
    session.commit()
    return {"ok": True, "cod_produto": cod, "operational_date": op_date.isoformat()}


@router.get("/recount-signals", response_model=RecountSignalsOut)
def get_recount_signals(
    operational_date: date | None = Query(default=None),
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
):
    """Lista códigos com solicitação de recontagem ativa para o dia operacional (alinhado à #count-date)."""
    _ensure_recount_signals_table()
    op_date = operational_date or _brazil_today_date()
    rows = session.exec(select(RecountSignal).where(RecountSignal.operational_date == op_date)).all()
    codes = sorted({str(r.cod_produto) for r in rows})
    return RecountSignalsOut(operational_date=op_date, codes=codes)


MATE_COURO_CIA = "Mate couro"
_ALLOWED_MATE_TROCA_KINDS = frozenset(
    {"chegada", "definir", "zerar", "ajuste_pendente", "incorporacao_quebra"}
)
MAX_MATE_TROCA_BATCH_SCAN = 12_000


def _ensure_mate_couro_troca_logs_table() -> None:
    try:
        SQLModel.metadata.create_all(engine, tables=[MateCouroTrocaLog.__table__], checkfirst=True)
    except SQLAlchemyError:
        logger.exception("Falha ao garantir tabela mate_couro_troca_logs")
        raise


class MateTrocaEventInput(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=100)
    kind: str = Field(max_length=24)
    cod_produto: str = Field(min_length=1, max_length=120)
    qty_cx_in: int = Field(default=0, ge=-500_000, le=500_000)
    qty_un_in: int = Field(default=0, ge=-500_000, le=500_000)
    pend_cx_before: int = Field(ge=0, le=500_000)
    pend_un_before: int = Field(ge=0, le=500_000)
    pend_cx_after: int = Field(ge=0, le=500_000)
    pend_un_after: int = Field(ge=0, le=500_000)
    excess_cx: int = Field(default=0, ge=0, le=500_000)
    excess_un: int = Field(default=0, ge=0, le=500_000)
    device_name: str | None = Field(default=None, max_length=120)


class MateTrocaEventsPayload(BaseModel):
    events: list[MateTrocaEventInput]


def _canonical_mate_couro_cod(session: Session, raw: str) -> str:
    c = _normalize_item_code(raw)
    if not c:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Codigo invalido.",
        )
    prod = session.exec(
        select(Product).where(Product.cod_grup_cia == MATE_COURO_CIA, Product.cod_produto == c)
    ).first()
    if prod:
        return _normalize_item_code(prod.cod_produto or c)
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Produto nao encontrado ou CIA diferente de {MATE_COURO_CIA}.",
    )


def _validate_mate_troca_payload(ev: MateTrocaEventInput) -> tuple[int, int]:
    """Retorna (excess_cx, excess_un) gravados; para chegada usa o calculo do servidor."""
    k = (ev.kind or "").strip()
    if k == "chegada":
        if ev.qty_cx_in < 0 or ev.qty_un_in < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="chegada exige quantidades nao negativas.",
            )
        ex_cx = max(0, ev.qty_cx_in - ev.pend_cx_before)
        ex_un = max(0, ev.qty_un_in - ev.pend_un_before)
        if ev.pend_cx_after != max(0, ev.pend_cx_before - ev.qty_cx_in):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="pend_cx_after inconsistente com chegada.",
            )
        if ev.pend_un_after != max(0, ev.pend_un_before - ev.qty_un_in):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="pend_un_after inconsistente com chegada.",
            )
        return ex_cx, ex_un
    if k in ("definir", "ajuste_pendente"):
        if ev.pend_cx_after != ev.qty_cx_in or ev.pend_un_after != ev.qty_un_in:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Pendente apos ajuste deve coincidir com qty_cx_in / qty_un_in.",
            )
        return 0, 0
    if k == "zerar":
        if ev.qty_cx_in != 0 or ev.qty_un_in != 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="zerar exige quantidades de entrada zero.",
            )
        if ev.pend_cx_after != 0 or ev.pend_un_after != 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="zerar exige pendente apos zero.",
            )
        return 0, 0
    if k == "incorporacao_quebra":
        exp_cx = max(0, ev.pend_cx_before + ev.qty_cx_in)
        exp_un = max(0, ev.pend_un_before + ev.qty_un_in)
        if ev.pend_cx_after != exp_cx or ev.pend_un_after != exp_un:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Pendente apos incorporacao_quebra inconsistente com delta.",
            )
        return 0, 0
    raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="kind invalido.")


@router.post("/mate-troca-events")
def ingest_mate_troca_events(
    payload: MateTrocaEventsPayload,
    session: Session = Depends(get_session),
    user: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """Sincroniza log de chegadas/ajustes da Base de Troca (idempotente por client_event_id)."""
    _ensure_mate_couro_troca_logs_table()
    synced_ids: list[str] = []

    try:
        for ev in payload.events:
            if (ev.kind or "").strip() not in _ALLOWED_MATE_TROCA_KINDS:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"kind invalido: {ev.kind}",
                )
            dup = session.exec(
                select(MateCouroTrocaLog).where(MateCouroTrocaLog.client_event_id == ev.client_event_id)
            ).first()
            if dup:
                synced_ids.append(ev.client_event_id)
                continue

            cod = _canonical_mate_couro_cod(session, ev.cod_produto)
            ex_cx, ex_un = _validate_mate_troca_payload(ev)

            row = MateCouroTrocaLog(
                client_event_id=ev.client_event_id,
                kind=(ev.kind or "").strip(),
                cod_produto=cod,
                qty_cx_in=int(ev.qty_cx_in),
                qty_un_in=int(ev.qty_un_in),
                pend_cx_before=int(ev.pend_cx_before),
                pend_un_before=int(ev.pend_un_before),
                pend_cx_after=int(ev.pend_cx_after),
                pend_un_after=int(ev.pend_un_after),
                excess_cx=int(ex_cx),
                excess_un=int(ex_un),
                device_name=(ev.device_name or "").strip() or None,
                actor_username=user.username,
                created_at=datetime.now(timezone.utc),
            )
            session.add(row)
            synced_ids.append(ev.client_event_id)

        session.commit()
        return {"received": len(payload.events), "synced": len(synced_ids), "synced_ids": synced_ids}
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        logger.exception("Falha ao sincronizar mate-troca-events")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao sincronizar base de troca: {exc}",
        ) from exc


@router.get("/mate-troca-events")
def list_mate_troca_events(
    date_from: str | None = Query(default=None, description="YYYY-MM-DD filtro em America/Sao_Paulo"),
    date_to: str | None = Query(default=None, description="YYYY-MM-DD inclusive em America/Sao_Paulo"),
    cod_produto: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """Lista auditoria da Base de Troca (Mate couro), mais recentes primeiro."""
    _ensure_mate_couro_troca_logs_table()
    stmt = select(MateCouroTrocaLog).order_by(MateCouroTrocaLog.created_at.desc())

    df = _parse_iso_date_arg(date_from) if date_from else None
    dt = _parse_iso_date_arg(date_to) if date_to else None
    if df is not None:
        start_utc = datetime.combine(df, time.min, tzinfo=_BR).astimezone(timezone.utc)
        stmt = stmt.where(MateCouroTrocaLog.created_at >= start_utc.replace(tzinfo=None))
    if dt is not None:
        end_br = dt + timedelta(days=1)
        end_utc = datetime.combine(end_br, time.min, tzinfo=_BR).astimezone(timezone.utc)
        stmt = stmt.where(MateCouroTrocaLog.created_at < end_utc.replace(tzinfo=None))

    if (cod_produto or "").strip():
        c = _normalize_item_code(cod_produto)
        stmt = stmt.where(MateCouroTrocaLog.cod_produto == c)

    rows = list(session.exec(stmt.limit(limit)).all())
    codes = list({str(r.cod_produto or "") for r in rows if r.cod_produto})
    desc_map: dict[str, str] = {}
    if codes:
        prods = list(session.exec(select(Product).where(Product.cod_produto.in_(codes))).all())
        for p in prods:
            cc = _normalize_item_code(p.cod_produto or "")
            if cc:
                desc_map[cc] = (p.cod_grup_descricao or "").strip()

    mt_logins = {
        (r.actor_username or "").strip()
        for r in rows
        if r.actor_username and str(r.actor_username).strip()
    }
    mt_name_map = _display_name_map_for_logins(session, mt_logins)

    def _iso(dt_val: datetime | None) -> str | None:
        if dt_val is None:
            return None
        u = dt_val if dt_val.tzinfo else dt_val.replace(tzinfo=timezone.utc)
        return u.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    events = []
    for r in rows:
        c = str(r.cod_produto or "")
        events.append(
            {
                "id": r.id,
                "client_event_id": r.client_event_id,
                "kind": r.kind,
                "cod_produto": c,
                "product_desc": desc_map.get(c) or None,
                "qty_cx_in": int(r.qty_cx_in),
                "qty_un_in": int(r.qty_un_in),
                "pend_cx_before": int(r.pend_cx_before),
                "pend_un_before": int(r.pend_un_before),
                "pend_cx_after": int(r.pend_cx_after),
                "pend_un_after": int(r.pend_un_after),
                "excess_cx": int(r.excess_cx),
                "excess_un": int(r.excess_un),
                "device_name": r.device_name,
                "actor_username": (
                    mt_name_map.get((r.actor_username or "").strip(), r.actor_username)
                    if r.actor_username
                    else None
                ),
                "created_at": _iso(r.created_at),
            }
        )

    return {"count": len(events), "events": events}


@router.get("/mate-troca-pending-by-product")
def get_mate_troca_pending_by_product(
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """Pendente CX/UN por produto a partir do último evento gravado no servidor.

    Inclui chegadas, ajustes, zeramentos e incorporações de quebra (Carregar dia) gravadas na API.
    """
    _ensure_mate_couro_troca_logs_table()
    sub = (
        select(MateCouroTrocaLog.cod_produto, func.max(MateCouroTrocaLog.id).label("mid"))
        .group_by(MateCouroTrocaLog.cod_produto)
    ).subquery()
    stmt = select(MateCouroTrocaLog).join(
        sub,
        (MateCouroTrocaLog.cod_produto == sub.c.cod_produto) & (MateCouroTrocaLog.id == sub.c.mid),
    )
    rows = list(session.exec(stmt).all())
    pending: dict[str, dict[str, int]] = {}
    for r in rows:
        cx = int(r.pend_cx_after or 0)
        un = int(r.pend_un_after or 0)
        if cx == 0 and un == 0:
            continue
        c = _normalize_item_code(str(r.cod_produto or ""))
        if c:
            pending[c] = {"cx": cx, "un": un}
    return {"pending": pending}


def _mate_troca_iso_utc(dt_val: datetime | None) -> str | None:
    if dt_val is None:
        return None
    u = dt_val if dt_val.tzinfo else dt_val.replace(tzinfo=timezone.utc)
    return u.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _mate_troca_batch_events_backward(session: Session, close: MateCouroTrocaLog) -> list[MateCouroTrocaLog]:
    if int(close.pend_cx_after or 0) != 0 or int(close.pend_un_after or 0) != 0:
        return []
    cod = str(close.cod_produto or "")
    prior = list(
        session.exec(
            select(MateCouroTrocaLog)
            .where(
                MateCouroTrocaLog.cod_produto == cod,
                MateCouroTrocaLog.created_at <= close.created_at,
            )
            .order_by(MateCouroTrocaLog.created_at.desc(), MateCouroTrocaLog.id.desc())
        ).all()
    )
    segment_rev: list[MateCouroTrocaLog] = []
    hit_close = False
    for r in prior:
        if not hit_close:
            if r.id != close.id:
                continue
            segment_rev.append(r)
            hit_close = True
            continue
        if int(r.pend_cx_after or 0) == 0 and int(r.pend_un_after or 0) == 0:
            break
        segment_rev.append(r)
    return list(reversed(segment_rev))


def _mate_logs_to_event_dicts(session: Session, rows: list[MateCouroTrocaLog]) -> list[dict]:
    codes = list({str(r.cod_produto or "") for r in rows if r.cod_produto})
    desc_map: dict[str, str] = {}
    if codes:
        prods = list(session.exec(select(Product).where(Product.cod_produto.in_(codes))).all())
        for p in prods:
            cc = _normalize_item_code(p.cod_produto or "")
            if cc:
                desc_map[cc] = (p.cod_grup_descricao or "").strip()
    mt_logins = {
        (r.actor_username or "").strip()
        for r in rows
        if r.actor_username and str(r.actor_username).strip()
    }
    mt_name_map = _display_name_map_for_logins(session, mt_logins)
    out = []
    for r in rows:
        c = str(r.cod_produto or "")
        out.append(
            {
                "id": r.id,
                "client_event_id": r.client_event_id,
                "kind": r.kind,
                "cod_produto": c,
                "product_desc": desc_map.get(c) or None,
                "qty_cx_in": int(r.qty_cx_in),
                "qty_un_in": int(r.qty_un_in),
                "pend_cx_before": int(r.pend_cx_before),
                "pend_un_before": int(r.pend_un_before),
                "pend_cx_after": int(r.pend_cx_after),
                "pend_un_after": int(r.pend_un_after),
                "excess_cx": int(r.excess_cx),
                "excess_un": int(r.excess_un),
                "device_name": r.device_name,
                "actor_username": (
                    mt_name_map.get((r.actor_username or "").strip(), r.actor_username)
                    if r.actor_username
                    else None
                ),
                "created_at": _mate_troca_iso_utc(r.created_at),
            }
        )
    return out


@router.get("/mate-troca-batches")
def list_mate_troca_batches(
    limit: int = Query(150, ge=1, le=400),
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """Trocas encerradas (pendente zerado no servidor), por produto Mate couro."""
    _ensure_mate_couro_troca_logs_table()
    rows_raw = list(
        session.exec(
            select(MateCouroTrocaLog)
            .order_by(MateCouroTrocaLog.created_at.desc(), MateCouroTrocaLog.id.desc())
            .limit(MAX_MATE_TROCA_BATCH_SCAN)
        ).all()
    )
    min_dt = datetime.min.replace(tzinfo=timezone.utc)

    def _row_sort_key(r: MateCouroTrocaLog):
        ca = r.created_at
        if ca is None:
            return (str(r.cod_produto or ""), min_dt, r.id or 0)
        u = ca if ca.tzinfo else ca.replace(tzinfo=timezone.utc)
        return (str(r.cod_produto or ""), u, r.id or 0)

    rows_raw.sort(key=_row_sort_key)
    closed_segments: list[list[MateCouroTrocaLog]] = []
    for _cod, git in groupby(rows_raw, key=lambda r: str(r.cod_produto or "")):
        cur: list[MateCouroTrocaLog] = []
        for ev in git:
            cur.append(ev)
            if int(ev.pend_cx_after or 0) == 0 and int(ev.pend_un_after or 0) == 0:
                closed_segments.append(cur)
                cur = []
    closed_segments.sort(
        key=lambda seg: seg[-1].created_at or min_dt,
        reverse=True,
    )
    closed_segments = closed_segments[:limit]
    summaries = []
    for seg in closed_segments:
        close = seg[-1]
        cid = close.id
        if cid is None:
            continue
        c = str(close.cod_produto or "")
        first = seg[0]
        sum_cx = sum(int(e.qty_cx_in or 0) for e in seg)
        sum_un = sum(int(e.qty_un_in or 0) for e in seg)
        summaries.append(
            {
                "batch_code": f"T-{int(cid):06d}",
                "close_log_id": int(cid),
                "cod_produto": c,
                "opened_at": _mate_troca_iso_utc(first.created_at),
                "closed_at": _mate_troca_iso_utc(close.created_at),
                "event_count": len(seg),
                "sum_qty_cx_in": sum_cx,
                "sum_qty_un_in": sum_un,
                "closing_kind": str(close.kind or "").strip(),
                "_closing_actor_login": (close.actor_username or "").strip() or None,
            }
        )
    codes = sorted({s["cod_produto"] for s in summaries if s.get("cod_produto")})
    desc_map: dict[str, str] = {}
    if codes:
        prods = list(session.exec(select(Product).where(Product.cod_produto.in_(codes))).all())
        for p in prods:
            cc = _normalize_item_code(p.cod_produto or "")
            if cc:
                desc_map[cc] = (p.cod_grup_descricao or "").strip()
    close_actor_logins = {
        s["_closing_actor_login"]
        for s in summaries
        if s.get("_closing_actor_login")
    }
    close_name_map = _display_name_map_for_logins(session, close_actor_logins)
    for s in summaries:
        s["product_desc"] = desc_map.get(s["cod_produto"]) or None
        lu = s.pop("_closing_actor_login", None)
        if lu:
            s["closed_by"] = close_name_map.get(lu, lu)
        else:
            s["closed_by"] = None
    return {"count": len(summaries), "batches": summaries}


@router.get("/mate-troca-batches/by-close/{close_log_id}")
def get_mate_troca_batch_by_close(
    close_log_id: int,
    session: Session = Depends(get_session),
    _: User = Depends(require_roles("conferente", "administrativo", "admin")),
) -> dict:
    """Detalhe de uma troca encerrada (lançamentos até zerar o pendente)."""
    _ensure_mate_couro_troca_logs_table()
    close = session.get(MateCouroTrocaLog, close_log_id)
    if close is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro nao encontrado.")
    if int(close.pend_cx_after or 0) != 0 or int(close.pend_un_after or 0) != 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Este evento nao encerra pendente zerado.",
        )
    segment = _mate_troca_batch_events_backward(session, close)
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote vazio.")
    events = _mate_logs_to_event_dicts(session, segment)
    lu_close = (close.actor_username or "").strip()
    cb_map = (
        _display_name_map_for_logins(session, {lu_close})
        if lu_close
        else {}
    )
    closed_by = cb_map.get(lu_close, lu_close) if lu_close else None
    return {
        "batch_code": f"T-{int(close_log_id):06d}",
        "close_log_id": int(close_log_id),
        "cod_produto": str(close.cod_produto or ""),
        "event_count": len(events),
        "closed_by": closed_by,
        "events": events,
    }
