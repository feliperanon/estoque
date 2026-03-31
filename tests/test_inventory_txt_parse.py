"""Parser TXT de inventário legado: último par CX/UN e limpeza do sufixo I."""

from app.api.routes.audit import _extract_import_quantities
from app.services.inventory_txt_parse import (
    extract_caixa_unidade_from_txt_tokens,
    parse_inventory_metric_token,
    parse_inventory_txt_line,
)


EXAMPLE_LINE = (
    "17 MATE COURO PET 2L ABA       373    5I            I      26    I       "
    "347    5I     347   5I               I             I"
)


def test_example_line_caixa_347_unidade_5() -> None:
    parsed = parse_inventory_txt_line(EXAMPLE_LINE)
    assert parsed is not None
    assert parsed["cod_produto"] == "17"
    assert parsed["descricao"] == "MATE COURO PET 2L ABA"
    assert parsed["caixa"] == 347
    assert parsed["unidade"] == 5
    assert parsed["raw"] == [
        "373",
        "5I",
        "I",
        "26",
        "I",
        "347",
        "5I",
        "347",
        "5I",
        "I",
        "I",
    ]


def test_metric_token_strips_i_suffix() -> None:
    assert parse_inventory_metric_token("5I") == 5
    assert parse_inventory_metric_token("2I") == 2
    assert parse_inventory_metric_token("11I") == 11
    assert parse_inventory_metric_token("0I") == 0


def test_standalone_i_is_zero() -> None:
    assert parse_inventory_metric_token("I") == 0
    assert extract_caixa_unidade_from_txt_tokens(["I", "I"]) == (0, 0)


def test_single_number_is_caixa_only() -> None:
    assert extract_caixa_unidade_from_txt_tokens(["42"]) == (42, 0)


def test_last_pair_used_when_multiple_blocks() -> None:
    toks = ["373", "5I", "26", "347", "5I", "347", "5I"]
    assert extract_caixa_unidade_from_txt_tokens(toks) == (347, 5)


def test_audit_extract_prefers_stored_caixa_unidade() -> None:
    assert _extract_import_quantities({"raw": ["9", "9"], "caixa": 347, "unidade": 5}) == (347, 5)


def test_audit_extract_from_legacy_raw_only() -> None:
    """Importações antigas só tinham raw; regra do último par aplica igualmente."""
    legacy = {
        "raw": ["373", "5I", "I", "26", "I", "347", "5I", "347", "5I", "I", "I"],
    }
    assert _extract_import_quantities(legacy) == (347, 5)
