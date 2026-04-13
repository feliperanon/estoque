"""Rough JS lexer: CODE / template / ${ expr } — detect unclosed structures at EOF."""
import pathlib

path = pathlib.Path(r"c:\Projeto\Estoque\app\static\app.js")
s = path.read_text(encoding="utf-8", errors="replace")
if s.startswith("\ufeff"):
    s = s[1:]

# context: 'code' | 'tmpl' | ('expr', depth)
ctx = "code"
stack = []  # template / ${ expr }
bal = []  # { ( [ in code mode only
i = 0
line = 1

CLOSE = {"(": ")", "[": "]", "{": "}"}


def adv():
    global i, line
    if i < len(s) and s[i] == "\n":
        line += 1
    i += 1


def skip_line_comment():
    global i, line
    adv()
    adv()
    while i < len(s) and s[i] != "\n":
        adv()


def skip_block_comment():
    global i, line
    adv()
    adv()
    while i + 1 < len(s) and not (s[i] == "*" and s[i + 1] == "/"):
        adv()
    if i + 1 < len(s):
        adv()
        adv()


def skip_string_dq():
    global i, line, ctx
    adv()
    while i < len(s):
        c = s[i]
        if c == "\\":
            adv()
            if i < len(s):
                adv()
            continue
        if c == '"':
            adv()
            return
        adv()


def skip_string_sq():
    global i, line
    adv()
    while i < len(s):
        c = s[i]
        if c == "\\":
            adv()
            if i < len(s):
                adv()
            continue
        if c == "'":
            adv()
            return
        adv()


while i < len(s):
    c = s[i]
    n = s[i + 1] if i + 1 < len(s) else ""

    if ctx == "code":
        if c == "/" and n == "/":
            skip_line_comment()
            continue
        if c == "/" and n == "*":
            skip_block_comment()
            continue
        if c == '"':
            skip_string_dq()
            continue
        if c == "'":
            skip_string_sq()
            continue
        if c == "`":
            stack.append("tmpl")
            ctx = "tmpl"
            adv()
            continue
        if c in "({[":
            bal.append(c)
            adv()
            continue
        if c in ")}]":
            if not bal:
                print("extra closer", repr(c), "line", line)
            else:
                o = bal.pop()
                want = CLOSE[o]
                if c != want:
                    print("mismatch want", want, "got", c, "line", line)
            adv()
            continue
        adv()
        continue

    if ctx == "tmpl":
        if c == "\\":
            adv()
            if i < len(s):
                adv()
            continue
        if c == "`":
            if not stack or stack[-1] != "tmpl":
                print("orphan ` line", line)
                break
            stack.pop()
            ctx = "code"
            if stack:
                top = stack[-1]
                if top == "tmpl":
                    ctx = "tmpl"
                elif isinstance(top, tuple) and top[0] == "expr":
                    ctx = "expr"
            adv()
            continue
        if c == "$" and n == "{":
            stack.append(("expr", 1))
            ctx = "expr"
            adv()
            adv()
            continue
        adv()
        continue

    if ctx == "expr":
        if c == "/" and n == "/":
            skip_line_comment()
            continue
        if c == "/" and n == "*":
            skip_block_comment()
            continue
        if c == '"':
            skip_string_dq()
            continue
        if c == "'":
            skip_string_sq()
            continue
        if c == "`":
            stack.append("tmpl")
            ctx = "tmpl"
            adv()
            continue
        if c == "{":
            top = stack[-1]
            if isinstance(top, tuple) and top[0] == "expr":
                d = top[1] + 1
                stack[-1] = ("expr", d)
            adv()
            continue
        if c == "}":
            top = stack[-1]
            if isinstance(top, tuple) and top[0] == "expr":
                d = top[1] - 1
                if d <= 0:
                    stack.pop()
                    ctx = "tmpl" if stack and stack[-1] == "tmpl" else "code"
                    if stack:
                        if stack[-1] == "tmpl":
                            ctx = "tmpl"
                        elif isinstance(stack[-1], tuple):
                            ctx = "expr"
                else:
                    stack[-1] = ("expr", d)
            adv()
            continue
        adv()
        continue

print("EOF ctx=", ctx, "tstack=", stack, "bal=", bal)
if ctx != "code" or stack:
    print("UNCLOSED template")
if bal:
    print("UNCLOSED braces/parens", bal[-10:])
