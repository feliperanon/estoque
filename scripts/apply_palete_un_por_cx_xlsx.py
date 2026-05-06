"""
Atualiza conversion_factor (UN por 1 CX) a partir de planilha com colunas
Código e Fator de conversão (UN por 1 CX), como em Palete.xlsx.

Uso (na raiz do projeto, com DATABASE_URL no ambiente ou .env):
  python scripts/apply_palete_un_por_cx_xlsx.py "C:\\Users\\...\\Palete.xlsx"
  python scripts/apply_palete_un_por_cx_xlsx.py caminho.xlsx --dry-run

Não altera pallet_conversion_factor (CX por 1 PL).
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

# Raiz do repositório no sys.path
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

os.chdir(_ROOT)

from dotenv import load_dotenv
from openpyxl import load_workbook
from sqlmodel import Session, select

load_dotenv()

from app.api.routes.products import (  # noqa: E402
    HEADER_ALIASES,
    _coerce_conversion_factor_in_row,
    _ensure_product_pallet_conversion_factor_column,
    _norm_header,
    _normalize_codigo_import,
    _safe_log_change,
)
from app.db.session import SessionLocal  # noqa: E402
from app.models import Product, ProductHistory  # noqa: E402
from app.models.entities import utcnow  # noqa: E402


def _norm_cod_cell(raw) -> str:
    d: dict = {"cod_produto": raw}
    _normalize_codigo_import(d)
    return (d.get("cod_produto") or "").strip()


def _factor_from_cell(raw) -> float | None:
    d: dict = {"conversion_factor": raw}
    _coerce_conversion_factor_in_row(d)
    v = d.get("conversion_factor")
    return float(v) if v is not None else None


def _code_lookup_variants(code: str) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()

    def add(x: str) -> None:
        x = (x or "").strip()
        if x and x not in seen:
            seen.add(x)
            out.append(x)

    add(code)
    try:
        n = int(float(code.replace(",", ".")))
        s = str(n)
        add(s)
        for w in (2, 3, 4, 5, 6):
            add(s.zfill(w))
    except (ValueError, OverflowError):
        pass
    return out


def _find_product(session: Session, code: str) -> Product | None:
    for key in _code_lookup_variants(code):
        p = session.exec(select(Product).where(Product.cod_produto == key)).first()
        if p:
            return p
    return None


def _record_history(session: Session, product_id: int, field: str, old_val, new_val, actor: str) -> None:
    session.add(
        ProductHistory(
            product_id=product_id,
            field_name=field,
            old_value=str(old_val) if old_val is not None else None,
            new_value=str(new_val) if new_val is not None else None,
            changed_by=actor,
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Aplica fatores UN/CX de planilha ao cadastro.")
    parser.add_argument("xlsx", type=Path, help="Caminho do .xlsx (ex.: Palete.xlsx)")
    parser.add_argument("--dry-run", action="store_true", help="Só lista alterações, sem gravar")
    parser.add_argument(
        "--actor",
        default="script:apply_palete_un_por_cx",
        help="Identificador gravado em product_history / auditoria",
    )
    args = parser.parse_args()
    path: Path = args.xlsx.expanduser()
    if not path.is_file():
        print(f"Arquivo não encontrado: {path}", file=sys.stderr)
        return 1

    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active
    first = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not first:
        print("Planilha vazia.", file=sys.stderr)
        return 1

    mapped = [HEADER_ALIASES.get(_norm_header(str(h or ""))) for h in first]
    try:
        i_cod = mapped.index("cod_produto")
        i_fac = mapped.index("conversion_factor")
    except ValueError:
        print("Cabeçalhos esperados: coluna de código + fator UN por 1 CX.", file=sys.stderr)
        print(f"Mapeado: {list(zip(first, mapped))}", file=sys.stderr)
        return 1

    rows_data: dict[str, float] = {}
    order: list[str] = []
    dup: list[str] = []

    for row in ws.iter_rows(min_row=2, values_only=True):
        raw_cod = row[i_cod] if i_cod < len(row) else None
        raw_fac = row[i_fac] if i_fac < len(row) else None
        cod = _norm_cod_cell(raw_cod)
        if not cod:
            continue
        fac = _factor_from_cell(raw_fac)
        if fac is None:
            print(f"Aviso: fator inválido ou vazio para código {cod!r} — linha ignorada.", file=sys.stderr)
            continue
        if cod in rows_data:
            dup.append(cod)
        else:
            order.append(cod)
        rows_data[cod] = fac

    if dup:
        print(f"Aviso: códigos repetidos na planilha (último fator vence): {sorted(set(dup))}", file=sys.stderr)

    updated = 0
    unchanged = 0
    missing: list[str] = []

    session: Session = SessionLocal()
    try:
        _ensure_product_pallet_conversion_factor_column(session)
        pending: list[tuple[Product, float, float]] = []

        for cod in order:
            fac = rows_data[cod]
            p = _find_product(session, cod)
            if not p:
                missing.append(cod)
                continue
            old = p.conversion_factor
            if old is not None and fac is not None and math.isclose(float(old), float(fac), rel_tol=0, abs_tol=1e-9):
                unchanged += 1
                continue
            pending.append((p, old, fac))

        print(f"Planilha: {len(rows_data)} linhas com código+fator | já iguais: {unchanged} | a atualizar: {len(pending)}")
        if missing:
            print(f"Produtos não encontrados no banco ({len(missing)}): {missing[:30]}{'…' if len(missing) > 30 else ''}")

        if args.dry_run:
            for p, old, fac in pending[:50]:
                print(f"  {p.cod_produto!r}: conversion_factor {old!r} -> {fac!r} | {p.cod_grup_descricao[:50]!r}")
            if len(pending) > 50:
                print(f"  … e mais {len(pending) - 50} linhas.")
            return 0

        for p, old, fac in pending:
            _record_history(session, p.id or 0, "conversion_factor", old, fac, args.actor)
            p.conversion_factor = fac
            p.updated_at = utcnow()
            session.add(p)
            updated += 1

        if updated:
            _safe_log_change(
                session,
                "products",
                0,
                "bulk_conversion_factor_xlsx",
                args.actor,
                {"file": str(path), "updated": updated, "missing_codes": missing},
            )
            session.commit()
        print(f"Gravado: {updated} produto(s) atualizado(s).")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
