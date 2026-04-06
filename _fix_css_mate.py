import re

path = r'c:\Projetos\Estoque\app\static\style.css'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()


def fix_line(line: str) -> str:
    if '#sub-mate-couro-troca, #sub-mate-couro-troca-historico' not in line:
        return line
    if re.search(r'#sub-mate-couro-troca, #sub-mate-couro-troca-historico,\s*$', line):
        return line
    if 'historico.count-audit-page' in line:
        return line.replace(
            '#sub-mate-couro-troca, #sub-mate-couro-troca-historico.count-audit-page',
            '#sub-mate-couro-troca.count-audit-page,\n#sub-mate-couro-troca-historico.count-audit-page',
        )
    if '#module-contagem #sub-mate-couro-troca, #sub-mate-couro-troca-historico.sub-section' in line:
        return line.replace(
            '#module-contagem #sub-mate-couro-troca, #sub-mate-couro-troca-historico.sub-section',
            '#module-contagem #sub-mate-couro-troca.sub-section,\n#module-contagem #sub-mate-couro-troca-historico.sub-section',
        )
    m = re.match(r'^(\s*)#sub-mate-couro-troca, #sub-mate-couro-troca-historico (.+)$', line.rstrip('\n'))
    if not m:
        return line
    indent, rest = m.groups()
    nl = '\n' if line.endswith('\n') else ''
    return f'{indent}#sub-mate-couro-troca {rest}, {indent}#sub-mate-couro-troca-historico {rest}{nl}'


out: list[str] = []
for line in lines:
    out.append(fix_line(line))

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(out)
print('ok')
