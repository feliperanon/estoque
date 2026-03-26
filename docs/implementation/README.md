# Pacote de implementacao

Este pacote contem os artefatos solicitados para iniciar desenvolvimento do novo fluxo operacional de estoque.

## Migracoes SQL (ordem de execucao)

1. `migrations/001_create_core_tables.sql`
2. `migrations/002_create_inventory_tables.sql`
3. `migrations/003_create_audit_sync_tables.sql`
4. `migrations/004_create_indexes_and_seed.sql`

## Colecao de requests

- `postman/estoque_operacao.postman_collection.json`

## Historias de usuario (Gherkin)

- `gherkin/estoque_operacao.feature`
