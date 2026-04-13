"""Corrige texto mojibake (UTF-8 lido como Latin-1) em arquivos JS do projeto."""
import pathlib

import ftfy

ROOT = pathlib.Path(r"c:\Projeto\Estoque\app\static")
FILES = [
    ROOT / "app.js",
    ROOT / "service-worker.js",
    ROOT / "pwa-install.js",
    ROOT / "sidebar-shell.js",
]


def fix_file(path: pathlib.Path) -> bool:
    raw = path.read_bytes()
    had_bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8")
    if had_bom:
        text = text[1:]
    fixed = ftfy.fix_text(text)
    if fixed == text:
        return False
    out = fixed.encode("utf-8")
    path.write_bytes(out)
    return True


def main():
    for path in FILES:
        if not path.exists():
            continue
        changed = fix_file(path)
        print(path.name, "OK" if changed else "unchanged")


if __name__ == "__main__":
    main()
