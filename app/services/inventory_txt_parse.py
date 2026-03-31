"""Parser de linhas do TXT legado de estoque (colunas fixas, sufixo I em quantidades)."""

from __future__ import annotations

import re

# Linha de produto: código, descrição (texto), bloco numérico com tokens tipo 347, 5I, I.
_LINE_RE = re.compile(
    r"^(\d+)\s+(.+?)\s+((?:-?\d*I?|I)(?:\s+(?:-?\d*I?|I))*)$",
)

# Mapa diário sintético (VDER0004): após o texto, o bloco numérico é largura fixa por
# grupo (SLD.INICIAL, ENTRADAS, SAÍDAS, SALDO FÍSICO, CONT.FÍSICA, DIFERENÇA, INFORMATIVO).
# Cada grupo = par CX + UN (13 caracteres no layout analisado).
_NUMERIC_GROUP_WIDTH = 13
# 4º grupo (0-based índice 3) = coluna SALDO FÍSICO (CX | UN), não o último par da linha.
_SALDO_FISICO_GROUP_INDEX = 3


def parse_inventory_metric_token(token: str) -> int:
    """Interpreta um token de métrica: remove 'I' residual; 'I' sozinho = vazio (0)."""
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
    except ValueError:
        return 0


def extract_caixa_unidade_from_numeric_tail(numeric_tail: str) -> tuple[int, int] | None:
    """
    Lê CX/UN do bloco SALDO FÍSICO (4º grupo de 13 caracteres) no trecho numérico bruto.

    Retorna None se o trecho for curto demais ou o segmento não tiver nenhum token.
    """
    start = _SALDO_FISICO_GROUP_INDEX * _NUMERIC_GROUP_WIDTH
    end = start + _NUMERIC_GROUP_WIDTH
    tail = numeric_tail or ""
    if len(tail) < end:
        return None
    segment = tail[start:end]
    parts = [p for p in segment.split() if p]
    if not parts:
        return None
    cx = parse_inventory_metric_token(parts[0])
    un = parse_inventory_metric_token(parts[1]) if len(parts) >= 2 else 0
    return cx, un


def extract_caixa_unidade_from_tokens_pair_index(tokens: list[str], pair_index: int) -> tuple[int, int]:
    """
    Fallback sem trecho bruto: assume pares sequenciais (CX, UN) na ordem do relatório.
    pair_index 3 = 4º par ≈ SALDO FÍSICO quando o espaçamento gera um token por coluna.
    """
    idx = pair_index * 2
    if len(tokens) < idx + 2:
        return 0, 0
    return parse_inventory_metric_token(tokens[idx]), parse_inventory_metric_token(tokens[idx + 1])


def extract_caixa_unidade_from_txt_tokens(tokens: list[str]) -> tuple[int, int]:
    """
    Compatibilidade com JSON antigo (só ``raw``): usa o 4º par de tokens, não o último par
    numérico da linha (evita pegar INFORMATIVO / últimos números).
    """
    return extract_caixa_unidade_from_tokens_pair_index(tokens, _SALDO_FISICO_GROUP_INDEX)


def _saldo_fisico_caixa_unidade(numeric_tail: str | None, raw_tokens: list[str]) -> tuple[int, int]:
    """Prioriza corte fixo no bloco SALDO FÍSICO; senão 4º par de tokens."""
    if numeric_tail:
        got = extract_caixa_unidade_from_numeric_tail(numeric_tail)
        if got is not None:
            return got
    return extract_caixa_unidade_from_tokens_pair_index(raw_tokens, _SALDO_FISICO_GROUP_INDEX)


def parse_inventory_txt_line(line: str) -> dict[str, object] | None:
    """
    Extrai código, descrição, caixas e unidades de uma linha de produto do TXT.
    Retorna None se a linha não casar com o padrão esperado.
    """
    line = (line or "").strip()
    if not line:
        return None
    m = _LINE_RE.search(line)
    if not m:
        return None
    cod = m.group(1).strip()
    desc = m.group(2).strip()
    numeric_tail = m.group(3)
    raw_tokens = numeric_tail.split()
    caixa, unidade = _saldo_fisico_caixa_unidade(numeric_tail, raw_tokens)
    return {
        "cod_produto": cod,
        "descricao": desc,
        "caixa": caixa,
        "unidade": unidade,
        "raw": raw_tokens,
        "numeric_tail": numeric_tail,
    }


def build_import_item_metrics(raw_tokens: list[str], numeric_tail: str | None = None) -> dict[str, object]:
    """Payload JSON para InventoryImportItem.metrics (histórico + saldo interpretado)."""
    caixa, unidade = _saldo_fisico_caixa_unidade(numeric_tail, raw_tokens)
    out: dict[str, object] = {"raw": raw_tokens, "caixa": caixa, "unidade": unidade}
    if numeric_tail is not None:
        out["numeric_tail"] = numeric_tail
    return out
