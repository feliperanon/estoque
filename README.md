# Estoque

Aplicativo de contagem de estoque com modo offline-first.

## Principais recursos

- Login com autenticacao legada.
- Contagem de estoque no dashboard com salvamento imediato no dispositivo.
- Funcionamento sem internet para continuar contando sem perder dados.
- Fila de sincronizacao: quando a conexao voltar, os eventos pendentes sao enviados para a API.
- Backup manual em JSON (exportar/importar) para contingencia.

## Como executar localmente

1. Crie o ambiente virtual e instale dependencias:

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
```

2. Copie o arquivo de ambiente e ajuste variaveis:

```bash
copy .env.example .env
```

3. Rode a aplicacao:

```bash
uvicorn app.main:app --reload
```

4. Acesse:

```text
http://localhost:8000
```

## Fluxo offline de contagem

1. Faca login no app.
2. No painel de contagem, registre item e quantidade.
3. Cada registro e salvo no localStorage do navegador imediatamente.
4. Se ficar offline, a contagem continua normalmente.
5. Ao voltar online, o app tenta sincronizar automaticamente.
6. Se precisar, use "Sincronizar agora" manualmente.

## Endpoints relevantes

- `POST /api/auth/login-legacy`
- `POST /api/audit/count-events`
- `GET /api/audit/changes`

## Modulo de cadastro de produtos

Cadastro manual e importacao por planilha disponiveis no painel principal.

Campos de produto:

- Cod Grup SP
- Cod Grup Cia
- Cod Grup Tipo
- Cod Grup Familia
- Cod Grup Segmento
- Cod Grup Marca
- Cod Grup Descricao
- Cod Grup SKU
- Status
- Grup Prioridade

Endpoints:

- `GET /api/products`
- `POST /api/products`
- `POST /api/products/import`
- `POST /api/products/import-excel`

## Observacoes de operacao

- O primeiro carregamento da aplicacao ainda requer internet para login.
- Depois de carregada, a interface web funciona offline via service worker.
- Para maior seguranca operacional, exporte backup periodicamente em turnos longos.
