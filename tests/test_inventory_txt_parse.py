"""Parser TXT de inventário: bloco SALDO FÍSICO por coluna fixa (13 chars) e sufixo I."""

from app.api.routes.audit import _extract_import_quantities
from app.services.inventory_txt_parse import (
    extract_caixa_unidade_from_numeric_tail,
    extract_caixa_unidade_from_txt_tokens,
    parse_inventory_metric_token,
    parse_inventory_txt_line,
)

EXAMPLE_LINE = (
    "17 MATE COURO PET 2L ABA       373    5I            I      26    I       "
    "347    5I     347   5I               I             I"
)

# Linha real (VDER0004): saldo físico = 572 CX | 1 UN, não 1 e 50 do informativo.
LINE_10_MATE_COURO = (
    "10 MATE COURO PET 2L TRA       870    2I      79   5I     378    I       "
    "572    1I     572   1I               I      50     I"
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
    nt = str(parsed.get("numeric_tail") or "")
    seg = nt[39:52]
    assert "347" in seg and "5I" in seg


def test_line10_saldo_fisico_572_1_not_informativo_1_50() -> None:
    """Regressão: não usar últimos números (1, 50); SALDO FÍSICO é o 4º bloco de 13 cols."""
    parsed = parse_inventory_txt_line(LINE_10_MATE_COURO)
    assert parsed is not None
    assert parsed["caixa"] == 572
    assert parsed["unidade"] == 1
    assert (parsed["caixa"], parsed["unidade"]) != (1, 50)
    nt = str(parsed["numeric_tail"] or "")
    assert extract_caixa_unidade_from_numeric_tail(nt) == (572, 1)


def test_metric_token_strips_i_suffix() -> None:
    assert parse_inventory_metric_token("5I") == 5
    assert parse_inventory_metric_token("2I") == 2
    assert parse_inventory_metric_token("11I") == 11
    assert parse_inventory_metric_token("0I") == 0


def test_standalone_i_is_zero() -> None:
    assert parse_inventory_metric_token("I") == 0
    assert extract_caixa_unidade_from_txt_tokens(["I", "I"]) == (0, 0)


def test_tokens_without_fourth_pair_return_zero() -> None:
    """Menos de 8 tokens não formam o 4º par (SALDO FÍSICO)."""
    assert extract_caixa_unidade_from_txt_tokens(["42", "I"]) == (0, 0)


def test_pair_index_3_not_last_two_numbers() -> None:
    """Últimos inteiros na linha podem ser informativo; o 4º par é SALDO FÍSICO."""
    toks = ["870", "2I", "79", "5I", "378", "I", "572", "1I", "572", "1I", "I", "50", "I"]
    assert extract_caixa_unidade_from_txt_tokens(toks) == (572, 1)


def test_audit_extract_prefers_stored_caixa_unidade() -> None:
    assert _extract_import_quantities({"raw": ["9", "9"], "caixa": 347, "unidade": 5}) == (347, 5)


def test_audit_extract_numeric_tail_when_no_caixa_fields() -> None:
    nt = (
        "870    2I      79   5I     378    I       572    1I     572   1I               I      50     I"
    )
    assert _extract_import_quantities({"raw": [], "numeric_tail": nt}) == (572, 1)


def test_audit_extract_from_legacy_raw_only_pair3() -> None:
    """Importações antigas só tinham raw: 4º par (índice 3), não último par."""
    legacy = {
        "raw": ["870", "2I", "79", "5I", "378", "I", "572", "1I", "572", "1I", "I", "50", "I"],
    }
    assert _extract_import_quantities(legacy) == (572, 1)
