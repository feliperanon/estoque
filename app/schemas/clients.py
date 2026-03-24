from datetime import datetime

from pydantic import BaseModel


class ClientBase(BaseModel):
    name: str
    client_group_id: int | None = None
    nb: str | None = None
    setor: str | None = None
    me: str | None = None
    sa: str | None = None
    visita: str | None = None
    nome_fantasia: str | None = None
    razao_social: str | None = None
    municipio: str | None = None
    bairro: str | None = None
    endereco: str | None = None
    fone: str | None = None
    fone_e164: str | None = None
    segmento: str | None = None
    status_cliente: str | None = None
    status_operacional: str | None = None
    logradouro: str | None = None
    numero: str | None = None
    complemento: str | None = None
    referencia: str | None = None
    observacoes_acesso: str | None = None
    fone_alternativo: str | None = None
    observacoes_contato: str | None = None
    janela_dias_semana: str | None = None
    janela_horario_inicio: str | None = None
    janela_horario_fim: str | None = None
    prioridade_logistica: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    geocoding_status: str | None = None


class ClientCreate(ClientBase):
    legacy_id: int | None = None
    source_system: str | None = None


class ClientRead(ClientBase):
    id: int
    legacy_id: int | None = None
    source_system: str | None = None
    imported_at: datetime | None = None
    updated_at: datetime


class ClientImportItem(ClientCreate):
    pass


class ClientImportPayload(BaseModel):
    rows: list[ClientImportItem]
