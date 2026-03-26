BEGIN;

CREATE TABLE IF NOT EXISTS estoque.movimentacao_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(80) NOT NULL UNIQUE,
  idempotency_key VARCHAR(120) NOT NULL UNIQUE,
  modulo VARCHAR(40) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  produto_id UUID REFERENCES estoque.produto(id),
  local_origem_id UUID REFERENCES estoque.local_estoque(id),
  local_destino_id UUID REFERENCES estoque.local_estoque(id),
  lote_validade_id UUID REFERENCES estoque.lote_validade(id),
  qtd_delta NUMERIC(14,3) NOT NULL DEFAULT 0,
  qtd_before NUMERIC(14,3),
  qtd_after NUMERIC(14,3),
  motivo_codigo VARCHAR(40),
  motivo_texto VARCHAR(255),
  referencia_tipo VARCHAR(40),
  referencia_id VARCHAR(80),
  usuario_id UUID NOT NULL REFERENCES estoque.usuario(id),
  device_id VARCHAR(120),
  occurred_at_device TIMESTAMPTZ NOT NULL,
  occurred_at_server TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approval_required BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'NA',
  approved_by UUID REFERENCES estoque.usuario(id),
  approved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS estoque.fila_sincronizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(80) NOT NULL,
  modulo VARCHAR(40) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  tentativas INTEGER NOT NULL DEFAULT 0,
  ultimo_erro VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque.conflito_sincronizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id VARCHAR(80) NOT NULL,
  motivo VARCHAR(255) NOT NULL,
  payload_local JSONB NOT NULL,
  payload_servidor JSONB,
  resolvido BOOLEAN NOT NULL DEFAULT FALSE,
  resolvido_por UUID REFERENCES estoque.usuario(id),
  resolvido_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS estoque.log_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo VARCHAR(40) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  entidade VARCHAR(60) NOT NULL,
  entidade_id VARCHAR(80) NOT NULL,
  valor_anterior JSONB,
  valor_novo JSONB,
  justificativa VARCHAR(255),
  origem_acao VARCHAR(30) NOT NULL,
  sync_status VARCHAR(20),
  usuario_id UUID NOT NULL REFERENCES estoque.usuario(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
