BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS estoque;

CREATE TABLE IF NOT EXISTS estoque.perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS estoque.usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  perfil_id UUID NOT NULL REFERENCES estoque.perfil(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque.permissao_acao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id UUID NOT NULL REFERENCES estoque.perfil(id),
  modulo VARCHAR(40) NOT NULL,
  acao VARCHAR(40) NOT NULL,
  allow BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (perfil_id, modulo, acao)
);

CREATE TABLE IF NOT EXISTS estoque.produto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(60) NOT NULL UNIQUE,
  ean VARCHAR(30),
  descricao VARCHAR(255) NOT NULL,
  unidade VARCHAR(20) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  exige_lote_validade BOOLEAN NOT NULL DEFAULT FALSE,
  dias_alerta_vencimento INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estoque.local_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  tipo VARCHAR(30) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS estoque.motivo_operacional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo VARCHAR(40) NOT NULL,
  codigo VARCHAR(40) NOT NULL,
  descricao VARCHAR(180) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (modulo, codigo)
);

COMMIT;
