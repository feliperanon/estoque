BEGIN;

CREATE INDEX IF NOT EXISTS ix_produto_codigo ON estoque.produto (codigo);
CREATE INDEX IF NOT EXISTS ix_produto_ean ON estoque.produto (ean);
CREATE INDEX IF NOT EXISTS ix_lote_validade_status ON estoque.lote_validade (status, validade);
CREATE INDEX IF NOT EXISTS ix_saldo_local_produto ON estoque.saldo_estoque (local_id, produto_id);
CREATE INDEX IF NOT EXISTS ix_mov_modulo_data ON estoque.movimentacao_estoque (modulo, occurred_at_server DESC);
CREATE INDEX IF NOT EXISTS ix_mov_produto_data ON estoque.movimentacao_estoque (produto_id, occurred_at_server DESC);
CREATE INDEX IF NOT EXISTS ix_auditoria_entidade_data ON estoque.log_auditoria (entidade, entidade_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_sync_status_created ON estoque.fila_sincronizacao (status, created_at);

INSERT INTO estoque.perfil (id, nome)
VALUES
  (gen_random_uuid(), 'operador'),
  (gen_random_uuid(), 'conferente'),
  (gen_random_uuid(), 'supervisor'),
  (gen_random_uuid(), 'administrativo'),
  (gen_random_uuid(), 'administrador')
ON CONFLICT (nome) DO NOTHING;

COMMIT;
