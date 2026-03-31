"""Parser de linhas do TXT legado de estoque (colunas fixas, sufixo I em quantidades)."""

from __future__ import annotations

import re

# Linha de produto: código, descrição (texto), bloco numérico com tokens tipo 347, 5I, I.
_LINE_RE = re.compile(
    r"^(\d+)\s+(.+?)\s+((?:-?\d*I?|I)(?:\s+(?:-?\d*I?|I))*)$"
)


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


def extract_caixa_unidade_from_txt_tokens(tokens: list[str]) -> tuple[int, int]:
    """
    Saldo CX/UN do relatório: usa o último par numérico da linha (bloco final de saldo).

    Tokens isolados ``I`` são ignorados. Sufixos tipo ``5I`` viram unidade 5.
    Ex.: ... 373 5I ... 347 5I 347 5I ... → (347, 5).
    """
    clean: list[str] = []
    for tok in tokens:
        t = (tok or "").strip()
        if not t or t == "I":
            continue
        clean.append(t)
    nums: list[int] = []
    for tok in clean:
        nums.append(parse_inventory_metric_token(tok))
    if len(nums) >= 2:
        return nums[-2], nums[-1]
    if len(nums) == 1:
        return nums[0], 0
    return 0, 0


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
    raw_tokens = m.group(3).split()
    caixa, unidade = extract_caixa_unidade_from_txt_tokens(raw_tokens)
    return {
        "cod_produto": cod,
        "descricao": desc,
        "caixa": caixa,
        "unidade": unidade,
        "raw": raw_tokens,
    }


def build_import_item_metrics(raw_tokens: list[str]) -> dict[str, object]:
    """Payload JSON para InventoryImportItem.metrics (histórico + saldo interpretado)."""
    caixa, unidade = extract_caixa_unidade_from_txt_tokens(raw_tokens)
    return {"raw": raw_tokens, "caixa": caixa, "unidade": unidade}
