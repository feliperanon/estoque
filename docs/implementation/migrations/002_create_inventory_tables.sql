BEGIN;

CREATE TABLE IF NOT EXISTS estoque.lote_validade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES estoque.produto(id),
  lote VARCHAR(80) NOT NULL,
  validade DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'BOM',
  UNIQUE (produto_id, lote, validade)
);

CREATE TABLE IF NOT EXISTS estoque.saldo_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES estoque.produto(id),
  local_id UUID NOT NULL REFERENCES estoque.local_estoque(id),
  lote_validade_id UUID REFERENCES estoque.lote_validade(id),
  qtd_fisica NUMERIC(14,3) NOT NULL DEFAULT 0,
  qtd_bloqueada NUMERIC(14,3) NOT NULL DEFAULT 0,
  qtd_disponivel NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (produto_id, local_id, lote_validade_id)
);

CREATE TABLE IF NOT EXISTS estoque.contagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id UUID NOT NULL REFERENCES estoque.local_estoque(id),
  status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
  criado_por UUID NOT NULL REFERENCES estoque.usuario(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque.contagem_item (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contagem_id UUID NOT NULL REFERENCES estoque.contagem(id),
  produto_id UUID NOT NULL REFERENCES estoque.produto(id),
  lote_validade_id UUID REFERENCES estoque.lote_validade(id),
  qtd_contada NUMERIC(14,3) NOT NULL,
  UNIQUE (contagem_id, produto_id, lote_validade_id)
);

CREATE TABLE IF NOT EXISTS estoque.recontagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contagem_id UUID NOT NULL REFERENCES estoque.contagem(id),
  status VARCHAR(20) NOT NULL DEFAULT 'ABERTA',
  criado_por UUID NOT NULL REFERENCES estoque.usuario(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque.puxada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_origem_id UUID NOT NULL REFERENCES estoque.local_estoque(id),
  local_destino_id UUID NOT NULL REFERENCES estoque.local_estoque(id),
  status VARCHAR(20) NOT NULL DEFAULT 'CRIADA',
  criado_por UUID NOT NULL REFERENCES estoque.usuario(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque.devolucao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_origem VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  criado_por UUID NOT NULL REFERENCES estoque.usuario(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque.quebra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE_APROVACAO',
  criado_por UUID NOT NULL REFERENCES estoque.usuario(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque.venda_direta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id UUID NOT NULL REFERENCES estoque.local_estoque(id),
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMADA',
  criado_por UUID NOT NULL REFERENCES estoque.usuario(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
