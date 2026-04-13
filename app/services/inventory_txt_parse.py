"""Parser de linhas do TXT legado de estoque (colunas fixas, sufixo I em quantidades)."""

from __future__ import annotations

import re

# Linha de produto: código, descrição (texto), bloco numérico com tokens tipo 347, 5I, I.
# Entre texto e colunas o mapa usa padding de 2+ espaços; um único espaço pode ser parte do nome
# (ex.: "PESSEGO 1" antes do SLD.INICIAL) e não deve iniciar o bloco numérico.
_LINE_RE = re.compile(
    r"^(\d+)\s+(.+?)\s{2,}((?:-?\d*I?|I)(?:\s+(?:-?\d*I?|I))*)$",
)

# Mapa diário sintético (VDER0004): após o texto, o bloco numérico é largura fixa por
# grupo (SLD.INICIAL, ENTRADAS, SAÍDAS, SALDO FÍSICO, CONT.FÍSICA, DIFERENÇA, INFORMATIVO).
# Cada grupo = par CX + UN (13 caracteres no layout analisado).
_NUMERIC_GROUP_WIDTH = 13
# Grupo fixo (0-based índice 3) ≈ SALDO FÍSICO quando o bloco de 13 cols está alinhado.
_SALDO_FISICO_GROUP_INDEX = 3
# Após o saldo vêm, em geral: contagem física, diferença, informativo (3 pares). Linhas curtas (8
# tokens) costumam omitir o par do informativo → 2 pares de cauda.
_TAIL_PAIR_BLOCKS_FULL = 3
_TAIL_PAIR_BLOCKS_SHORT = 2
# Linha “curta” típica: 4 pares numéricos (8 tokens), saldo no índice 2.
_SHORT_TOKEN_LINE = 8


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
    # Um único token no recorte costuma indicar colunas deslocadas (ex.: 10I lido como CX em vez
    # de 0 CX / 10 UN em colunas vizinhas). Força fallback por par de tokens.
    if len(parts) < 2:
        return None
    cx = parse_inventory_metric_token(parts[0])
    un = parse_inventory_metric_token(parts[1])
    return cx, un


def _first_negative_value_token_index(tokens: list[str]) -> int | None:
    """Índice do primeiro token cujo valor inteiro é negativo (coluna diferença / ajuste)."""
    for i, t in enumerate(tokens):
        if parse_inventory_metric_token(t) < 0:
            return i
    return None


def _saldo_from_zero_caixa_token_before_diff(tokens: list[str]) -> tuple[int, int] | None:
    """
    Layout VDER deslocado: o par SALDO FÍSICO aparece como token literal ``0`` + ``N``/``NI``,
    mas o índice do par pode ser 3–4 em vez de 4–5 (ex. 3401 vs 3301). Procura o último par
    ``0`` + quantidade positiva imediatamente antes do primeiro valor negativo (diferença).
    Não usa ``parse == 0`` genérico (evita ``I`` + ``28`` na linha 3154).
    """
    if len(tokens) < 4:
        return None
    neg_at = _first_negative_value_token_index(tokens)
    if neg_at is None:
        return None
    upper = min(neg_at, len(tokens) - 2)
    for i in range(upper, -1, -1):
        if tokens[i] != "0":
            continue
        b = parse_inventory_metric_token(tokens[i + 1])
        if b > 0:
            return 0, b
    return None


def saldo_fisico_pair_index(token_count: int) -> int:
    """
    Índice do par (CX, UN) do SALDO FÍSICO na lista de tokens do bloco numérico.

    Assume pares na ordem do mapa: movimentação (1–3 pares), saldo, contagem física, diferença,
    informativo. O tamanho da lista varia com o alinhamento das colunas; a cauda fixa de 3 pares
    falha em linhas de 8 tokens (sem informativo), onde usamos 2 pares de cauda.
    """
    if token_count < 4:
        return 0
    pairs = token_count // 2
    tail = _TAIL_PAIR_BLOCKS_SHORT if token_count == _SHORT_TOKEN_LINE else _TAIL_PAIR_BLOCKS_FULL
    return max(0, pairs - tail)


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
    Compatibilidade com JSON antigo (só ``raw``): par do saldo físico por tamanho da lista,
    não o último par numérico (evita INFORMATIVO / últimos números).

    Menos de 8 tokens não cobrem até o quarto par do layout completo; evita ler o 1º par como saldo.
    """
    if len(tokens) < _SHORT_TOKEN_LINE:
        return 0, 0
    idx = saldo_fisico_pair_index(len(tokens))
    return extract_caixa_unidade_from_tokens_pair_index(tokens, idx)


def resolve_saldo_fisico_caixa_unidade(numeric_tail: str | None, raw_tokens: list[str]) -> tuple[int, int]:
    """
    Saldo físico CX/UN: corte fixo (13 cols) quando o recorte tem dois tokens; se tiver só um token,
    par ``0`` + UN antes da diferença negativa; senão par por tamanho da lista de tokens.
    """
    idx = saldo_fisico_pair_index(len(raw_tokens))
    cx_tok, un_tok = (
        extract_caixa_unidade_from_tokens_pair_index(raw_tokens, idx)
        if len(raw_tokens) >= _SHORT_TOKEN_LINE
        else (0, 0)
    )
    if numeric_tail:
        got = extract_caixa_unidade_from_numeric_tail(numeric_tail)
        if got is not None:
            return got
    drift = _saldo_from_zero_caixa_token_before_diff(raw_tokens)
    if drift is not None:
        return drift
    return cx_tok, un_tok


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
    caixa, unidade = resolve_saldo_fisico_caixa_unidade(numeric_tail, raw_tokens)
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
    caixa, unidade = resolve_saldo_fisico_caixa_unidade(numeric_tail, raw_tokens)
    out: dict[str, object] = {"raw": raw_tokens, "caixa": caixa, "unidade": unidade}
    if numeric_tail is not None:
        out["numeric_tail"] = numeric_tail
    return out
