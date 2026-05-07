"""
Repara import de fatores em que valores de PALETE foram gravados em conversion_factor (UN por 1 CX).

Para cada linha em product_history (field_name=conversion_factor) no intervalo do dia informado:
  - Restaura products.conversion_factor a partir de old_value (ex.: 6).
  - Grava products.pallet_conversion_factor a partir de new_value (ex.: 100), se --move-new-to-pallet.
  - Remove a linha incorreta do histórico (--delete-history), para não confundir com CX por 1 PL.

Uso (raiz do repo, DATABASE_URL no .env ou ambiente):

  python scripts/repair_misimport_conversion_to_pallet.py --on-date 2026-05-06 --dry-run
  python scripts/repair_misimport_conversion_to_pallet.py --on-date 2026-05-06 --apply --move-new-to-pallet --delete-history

Filtros opcionais:
  --actor-contains feliperanon
  --require-new-value 100   (só linhas cujo new_value numérico = 100)
  --first-only-per-product   (padrão: ignora linhas extras do mesmo produto no mesmo dia)
"""
from __future__ import annotations

import argparse
import math
import os
import sys
from datetime import date, datetime, time, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
os.chdir(_ROOT)

from dotenv import load_dotenv
from sqlmodel import Session, select

load_dotenv()

from app.api.routes.products import _ensure_product_pallet_conversion_factor_column  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models import Product, ProductHistory  # noqa: E402
from app.models.entities import utcnow  # noqa: E402


def _day_range_utc_from_sp(day: date) -> tuple[datetime, datetime]:
    try:
        from zoneinfo import ZoneInfo

        sp = ZoneInfo("America/Sao_Paulo")
        start = datetime.combine(day, time(0, 0, 0), tzinfo=sp).astimezone(timezone.utc)
        end = datetime.combine(day, time(23, 59, 59, 999999), tzinfo=sp).astimezone(timezone.utc)
        return start, end
    except Exception:
        # Fallback: dia civil em UTC
        start = datetime.combine(day, time(0, 0, 0), tzinfo=timezone.utc)
        end = datetime.combine(day, time(23, 59, 59, 999999), tzinfo=timezone.utc)
        return start, end


def _parse_hist_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    t = str(raw).strip()
    if not t or t in ("—", "-", "None", "null", "NULL"):
        return None
    t = t.replace(",", ".")
    try:
        v = float(t)
    except ValueError:
        return None
    if not math.isfinite(v):
        return None
    return v


def _close_float(a: float | None, b: float | None) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return math.isclose(a, b, rel_tol=0, abs_tol=1e-9)


def main() -> int:
    p = argparse.ArgumentParser(description="Reverte UN/CX e move valor errado para CX/PL após import palete.")
    p.add_argument("--on-date", required=True, help="Dia da alteração incorreta (YYYY-MM-DD), America/Sao_Paulo.")
    p.add_argument("--apply", action="store_true", help="Aplica alterações (sem isto, só simula).")
    p.add_argument("--move-new-to-pallet", action="store_true", help="Grava new_value em pallet_conversion_factor.")
    p.add_argument("--delete-history", action="store_true", help="Apaga linhas de product_history processadas.")
    p.add_argument("--actor-contains", default="", help="Só linhas cujo changed_by contém este texto.")
    p.add_argument("--require-new-value", type=float, default=None, help="Só linhas com este new_value numérico.")
    p.add_argument(
        "--all-rows-per-product",
        action="store_true",
        help="Processa todas as linhas do dia por produto (padrão: só a primeira do dia).",
    )
    args = p.parse_args()
    first_only_per_product = not args.all_rows_per_product

    day = date.fromisoformat(args.on_date)
    start, end = _day_range_utc_from_sp(day)

    session: Session = SessionLocal()
    try:
        _ensure_product_pallet_conversion_factor_column(session)

        stmt = (
            select(ProductHistory)
            .where(ProductHistory.field_name == "conversion_factor")
            .where(ProductHistory.changed_at >= start)
            .where(ProductHistory.changed_at <= end)
            .order_by(ProductHistory.product_id, ProductHistory.changed_at)
        )
        rows = list(session.exec(stmt).all())

        if args.actor_contains:
            ac = args.actor_contains.strip().lower()
            rows = [r for r in rows if (r.changed_by or "").lower().find(ac) >= 0]

        if args.require_new_value is not None:
            req = float(args.require_new_value)
            rows = [r for r in rows if _close_float(_parse_hist_float(r.new_value), req)]

        seen_products: set[int] = set()
        to_process: list[ProductHistory] = []
        for r in rows:
            pid = int(r.product_id)
            if first_only_per_product:
                if pid in seen_products:
                    continue
                seen_products.add(pid)
            to_process.append(r)

        print(f"Dia SP {args.on_date} (UTC aprox. {start.isoformat()} .. {end.isoformat()})")
        print(f"Linhas de histórico (conversion_factor) encontradas: {len(to_process)}")

        updates = 0
        for r in to_process:
            old_v = _parse_hist_float(r.old_value)
            new_v = _parse_hist_float(r.new_value)
            prod = session.get(Product, r.product_id)
            cod = (prod.cod_produto or "?") if prod else "?"

            cur_cx = float(prod.conversion_factor) if prod and prod.conversion_factor is not None else None
            cur_pl = float(prod.pallet_conversion_factor) if prod and prod.pallet_conversion_factor is not None else None

            print(
                f"  id={r.id} product_id={r.product_id} cod={cod} "
                f"hist: {r.old_value!r} -> {r.new_value!r} | atual CX={cur_cx} PL={cur_pl}"
            )

            if not prod:
                print("    (produto não encontrado, ignorado)")
                continue

            if args.apply:
                prod.conversion_factor = old_v
                if args.move_new_to_pallet:
                    prod.pallet_conversion_factor = new_v
                prod.updated_at = utcnow()
                session.add(prod)
                updates += 1
                if args.delete_history:
                    session.delete(r)

        if args.apply:
            session.commit()
            print(f"Concluído: {updates} produto(s) atualizado(s).")
            if args.delete_history:
                print("Linhas de histórico incorretas removidas.")
        else:
            session.rollback()
            print("Dry-run: nenhuma alteração gravada. Use --apply para executar.")

        return 0
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
