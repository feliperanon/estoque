# Quick scan for unclosed braces in app.js (ignores strings/comments roughly)
import sys

path = r"c:\Projeto\Estoque\app\static\app.js"
with open(path, "r", encoding="utf-8", errors="replace") as f:
    s = f.read()

stack = []
state = "code"
i = 0
q = ""
while i < len(s):
    c = s[i]
    n = s[i + 1] if i + 1 < len(s) else ""

    if state == "code":
        if c == "/" and n == "/":
            state = "line_comment"
            i += 2
            continue
        if c == "/" and n == "*":
            state = "block_comment"
            i += 2
            continue
        if c in ('"', "'"):
            q = c
            state = "string"
            i += 1
            continue
        if c == "`":
            state = "template"
            i += 1
            continue
        if c == "{":
            stack.append((i, "{"))
        elif c == "}":
            if not stack:
                print("extra } at byte", i)
                sys.exit(1)
            stack.pop()
        elif c == "(":
            stack.append((i, "("))
        elif c == ")":
            if stack and stack[-1][1] == "(":
                stack.pop()
        i += 1
        continue

    if state == "line_comment":
        if c == "\n":
            state = "code"
        i += 1
        continue

    if state == "block_comment":
        if c == "*" and n == "/":
            state = "code"
            i += 2
            continue
        i += 1
        continue

    if state == "string":
        if c == "\\":
            i += 2
            continue
        if c == q:
            state = "code"
        i += 1
        continue

    if state == "template":
        if c == "\\":
            i += 2
            continue
        if c == "`":
            state = "code"
            i += 1
            continue
        if c == "$" and n == "{":
            stack.append((i, "${"))
            state = "code"
            i += 2
            continue
        i += 1
        continue

print("unclosed:", len(stack), "state:", state)
for pos, typ in stack[-15:]:
    line = s[:pos].count("\n") + 1
    print(" ", typ, "line", line)
