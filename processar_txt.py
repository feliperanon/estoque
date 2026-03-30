import re

# Caminho do arquivo TXT de entrada
txt_path = "ESTOQUE 27-03-2026.TXT"

# Regex para capturar as linhas de produto
linha_produto = re.compile(r"^\s*(\d+)\s+([A-Z0-9 .\-/]+?)\s+(\d+)\s+((\d+)I)?\s+I\s+(\d+)?\s*I\s+(\d+)?\s*I\s+(\d+)\s+((\d+)I)?\s+I\s+(-?\d+)\s+((-?\d+)I)?")

# Regex alternativo para linhas com menos campos (produtos sem saldo)
linha_simples = re.compile(r"^\s*(\d+)\s+([A-Z0-9 .\-/]+?)\s+(\d+)?\s*((\d+)I)?\s+I\s+(\d+)?\s*I\s+(\d+)?\s*I\s+(\d+)?\s*((\d+)I)?")

def extrair_produtos(txt_path):
    produtos = []
    with open(txt_path, encoding="latin1") as f:
        for linha in f:
            # Tenta casar linha completa
            m = linha_produto.match(linha)
            if m:
                cod = m.group(1)
                desc = m.group(2).strip()
                saldo_cx = m.group(8) or "0"
                saldo_uni = m.group(9) or "0"
                saldo_uni = saldo_uni.replace("I", "").strip()
                produtos.append(f"{cod} {desc} CX {saldo_cx} UNI {saldo_uni}")
                continue
            # Tenta casar linha simples
            m2 = linha_simples.match(linha)
            if m2:
                cod = m2.group(1)
                desc = m2.group(2).strip()
                saldo_cx = m2.group(8) or "0"
                saldo_uni = m2.group(9) or "0"
                saldo_uni = saldo_uni.replace("I", "").strip()
                produtos.append(f"{cod} {desc} CX {saldo_cx} UNI {saldo_uni}")
    return produtos

if __name__ == "__main__":
    produtos = extrair_produtos(txt_path)
    for p in produtos:
        print(p)
