"""Testes dos helpers de importação Excel (custo BR e código numérico)."""

from app.api.routes.products import (
    _map_headers,
    _normalize_codigo_import,
    _parse_br_price,
)


def test_parse_br_price() -> None:
    assert _parse_br_price(None) is None
    assert _parse_br_price(60.03) == 60.03
    assert _parse_br_price(140) == 140.0
    assert _parse_br_price("60,03") == 60.03
    assert _parse_br_price("R$ 60,03") == 60.03
    assert _parse_br_price("R$ 1.234,56") == 1234.56
    assert _parse_br_price("  80,66  ") == 80.66


def test_normalize_codigo_import() -> None:
    d = {"cod_produto": "140.0"}
    _normalize_codigo_import(d)
    assert d["cod_produto"] == "140"

    d2 = {"cod_produto": "602"}
    _normalize_codigo_import(d2)
    assert d2["cod_produto"] == "602"


def test_map_headers_bi_model() -> None:
    row = ("Cia", "Tipo", "Segmento", "Marca", "Produto", "Codigo", "SKU", "Custo")
    mapped, score = _map_headers(row)
    assert score >= 8
    assert "cod_grup_cia" in mapped
    assert "cod_grup_descricao" in mapped
    assert "cod_produto" in mapped
    assert "price" in mapped
