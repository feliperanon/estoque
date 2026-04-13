# Find unclosed template literal (balanced ` with ${ ... })
path = r"c:\Projeto\Estoque\app\static\app.js"
with open(path, "r", encoding="utf-8", errors="replace") as f:
    s = f.read()

MODE_CODE = 0
MODE_DBL = 1
MODE_SGL = 2
MODE_TMPL = 3
MODE_TMPL_EXPR = 4  # inside ${ ... } within template

mode = MODE_CODE
i = 0
tmpl_start = None
expr_brace = 0

while i < len(s):
    c = s[i]
    n = s[i + 1] if i + 1 < len(s) else ""

    if mode == MODE_CODE:
        if c == "/" and n == "/":
            i += 2
            while i < len(s) and s[i] != "\n":
                i += 1
            continue
        if c == "/" and n == "*":
            i += 2
            while i + 1 < len(s) and not (s[i] == "*" and s[i + 1] == "/"):
                i += 1
            i = min(i + 2, len(s))
            continue
        if c == '"':
            mode = MODE_DBL
            i += 1
            continue
        if c == "'":
            mode = MODE_SGL
            i += 1
            continue
        if c == "`":
            mode = MODE_TMPL
            tmpl_start = i
            i += 1
            continue
        i += 1
        continue

    if mode == MODE_DBL:
        if c == "\\":
            i += 2
            continue
        if c == '"':
            mode = MODE_CODE
        i += 1
        continue

    if mode == MODE_SGL:
        if c == "\\":
            i += 2
            continue
        if c == "'":
            mode = MODE_CODE
        i += 1
        continue

    if mode == MODE_TMPL:
        if c == "\\":
            i += 2
            continue
        if c == "`":
            mode = MODE_CODE
            tmpl_start = None
            i += 1
            continue
        if c == "$" and n == "{":
            mode = MODE_TMPL_EXPR
            expr_brace = 1
            i += 2
            continue
        i += 1
        continue

    if mode == MODE_TMPL_EXPR:
        if c == "/" and n == "/":
            i += 2
            while i < len(s) and s[i] != "\n":
                i += 1
            continue
        if c == "/" and n == "*":
            i += 2
            while i + 1 < len(s) and not (s[i] == "*" and s[i + 1] == "/"):
                i += 1
            i = min(i + 2, len(s))
            continue
        if c == '"':
            mode = MODE_DBL
            i += 1
            continue
        if c == "'":
            mode = MODE_SGL
            i += 1
            continue
        if c == "`":
            # nested template in expression
            mode = MODE_TMPL
            tmpl_start = i
            i += 1
            continue
        if c == "{":
            expr_brace += 1
            i += 1
            continue
        if c == "}":
            expr_brace -= 1
            if expr_brace == 0:
                mode = MODE_TMPL
            i += 1
            continue
        i += 1
        continue

if mode != MODE_CODE:
    line = s[: tmpl_start if tmpl_start is not None else 0].count("\n") + 1
    print("Ended in mode", mode, "template may start near line", line)
else:
    print("Template literals appear balanced.")
