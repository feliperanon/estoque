import pathlib
import subprocess

app = pathlib.Path(r"c:\Projeto\Estoque\app\static\app.js").read_text(encoding="utf-8")
if app.startswith("\ufeff"):
    app = app[1:]
lines = app.splitlines(True)
esbuild = pathlib.Path(r"C:\Users\SOUZAP~1\AppData\Local\Temp\package\esbuild.exe")
n = len(lines)
chunks = 12
size = (n + chunks - 1) // chunks
for ci in range(chunks):
    a = ci * size
    b = min(n, (ci + 1) * size)
    body = "".join(lines[a:b])
    wrapped = "function __chunk" + str(ci) + "() {\n" + body + "\n}\n"
    p = pathlib.Path(r"C:\Users\Souza Pinto\AppData\Local\Temp\chunk_test.js")
    p.write_text(wrapped, encoding="utf-8")
    r = subprocess.run(
        [str(esbuild), str(p), "--bundle", "--outfile=C:/Users/SOUZAP~1/AppData/Local/Temp/chunk_out.js"],
        capture_output=True,
        text=True,
    )
    err = (r.stderr or "") + (r.stdout or "")
    if r.returncode != 0:
        print("CHUNK", ci, "lines", a + 1, "-", b, "FAIL")
        for ln in err.splitlines()[:8]:
            print(" ", ln)
    else:
        print("CHUNK", ci, "lines", a + 1, "-", b, "OK")
