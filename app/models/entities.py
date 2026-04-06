from datetime import date, datetime, timezone

from sqlalchemy import JSON, Column, String, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class SourceTracked(SQLModel):
    legacy_id: int | None = Field(default=None, index=True)
    source_system: str | None = Field(default=None, max_length=100)
    imported_at: datetime | None = Field(default=None)
    updated_at: datetime = Field(default_factory=utcnow)


class Employee(SourceTracked, table=True):
    __tablename__ = "employees"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    registration_id: str | None = Field(default=None, max_length=50, index=True)
    seller_code: str | None = Field(default=None, max_length=50)
    name: str = Field(max_length=255, index=True)
    admission_date: date | None = Field(default=None)
    cost_center: str | None = Field(default=None, max_length=100)
    role: str | None = Field(default=None, max_length=100)
    birthday: date | None = Field(default=None)
    status: str | None = Field(default=None, max_length=30)
    work_shift: str | None = Field(default=None, max_length=50)
    work_days: str | None = Field(default=None, max_length=120)
    work_schedule: str | None = Field(default=None, max_length=120)
    mobile_access: bool = Field(default=False)
    mobile_access_separation: bool = Field(default=False)
    mobile_access_checklist: bool = Field(default=False)
    mobile_access_admin_start: bool = Field(default=False)
    mobile_access_returns: bool = Field(default=False)
    mobile_access_helper: bool = Field(default=False)
    mobile_access_gatehouse: bool = Field(default=False)
    mobile_access_escala: bool = Field(default=False)


class User(SourceTracked, table=True):
    __tablename__ = "users"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(max_length=100, index=True, sa_type=String, unique=True)
    full_name: str | None = Field(default=None, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    password_hash: str = Field(max_length=255)
    role: str | None = Field(default=None, max_length=50)
    is_active: bool = Field(default=True)
    employee_id: int | None = Field(default=None, foreign_key="app_core.employees.id")
    allowed_pages: list[str] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    google_sub: str | None = Field(default=None, max_length=255)


class ClientGroup(SourceTracked, table=True):
    __tablename__ = "client_groups"
    __table_args__ = (UniqueConstraint("name", name="uq_client_group_name"), {"schema": "app_core"})

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=150, index=True)


class Client(SourceTracked, table=True):
    __tablename__ = "clients"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=255, index=True)
    client_group_id: int | None = Field(default=None, foreign_key="app_core.client_groups.id")
    nb: str | None = Field(default=None, max_length=50)
    setor: str | None = Field(default=None, max_length=100)
    me: str | None = Field(default=None, max_length=100)
    sa: str | None = Field(default=None, max_length=100)
    visita: str | None = Field(default=None, max_length=100)
    nome_fantasia: str | None = Field(default=None, max_length=255)
    razao_social: str | None = Field(default=None, max_length=255)
    municipio: str | None = Field(default=None, max_length=120)
    bairro: str | None = Field(default=None, max_length=120)
    endereco: str | None = Field(default=None, max_length=255)
    fone: str | None = Field(default=None, max_length=30)
    fone_e164: str | None = Field(default=None, max_length=30)
    segmento: str | None = Field(default=None, max_length=120)
    status_cliente: str | None = Field(default=None, max_length=60)
    status_operacional: str | None = Field(default=None, max_length=60)
    logradouro: str | None = Field(default=None, max_length=255)
    numero: str | None = Field(default=None, max_length=30)
    complemento: str | None = Field(default=None, max_length=120)
    referencia: str | None = Field(default=None, max_length=255)
    observacoes_acesso: str | None = Field(default=None, max_length=500)
    fone_alternativo: str | None = Field(default=None, max_length=30)
    observacoes_contato: str | None = Field(default=None, max_length=500)
    janela_dias_semana: str | None = Field(default=None, max_length=120)
    janela_horario_inicio: str | None = Field(default=None, max_length=20)
    janela_horario_fim: str | None = Field(default=None, max_length=20)
    prioridade_logistica: int | None = Field(default=None)
    latitude: float | None = Field(default=None)
    longitude: float | None = Field(default=None)
    geocoding_status: str | None = Field(default=None, max_length=30)


class Vehicle(SourceTracked, table=True):
    __tablename__ = "vehicles"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    placa: str | None = Field(default=None, max_length=10, index=True)
    vehicle_type: str | None = Field(default=None, max_length=60)
    marca: str | None = Field(default=None, max_length=60)
    modelo: str | None = Field(default=None, max_length=80)
    renavam: str | None = Field(default=None, max_length=30)
    ano: int | None = Field(default=None)
    crv_number: str | None = Field(default=None, max_length=50)
    chassi: str | None = Field(default=None, max_length=50)
    is_active: bool = Field(default=True)
    in_workshop: bool = Field(default=False)
    sale_value: float | None = Field(default=None)
    sold_at: datetime | None = Field(default=None)
    odometer_km: int | None = Field(default=None)


class Product(SourceTracked, table=True):
    __tablename__ = "products"
    __table_args__ = (UniqueConstraint("cod_produto", name="uq_product_cod"), {"schema": "app_core"})

    id: int | None = Field(default=None, primary_key=True)
    cod_grup_sp: str | None = Field(default=None, max_length=60, index=True)
    cod_grup_cia: str | None = Field(default=None, max_length=60, index=True)
    cod_grup_tipo: str | None = Field(default=None, max_length=60)
    cod_grup_familia: str | None = Field(default=None, max_length=60)
    cod_grup_segmento: str | None = Field(default=None, max_length=60)
    cod_grup_marca: str | None = Field(default=None, max_length=80)
    cod_produto: str | None = Field(default=None, max_length=120, index=True)
    cod_grup_descricao: str = Field(max_length=255)
    cod_grup_sku: str = Field(max_length=120, index=True)
    status: str | None = Field(default=None, max_length=40)
    grup_prioridade: str | None = Field(default=None, max_length=80)
    price: float | None = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow)


class ProductHistory(SQLModel, table=True):
    __tablename__ = "product_history"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    product_id: int = Field(foreign_key="app_core.products.id", index=True)
    field_name: str = Field(max_length=100)
    old_value: str | None = Field(default=None, max_length=500)
    new_value: str | None = Field(default=None, max_length=500)
    changed_by: str | None = Field(default=None, max_length=100)
    changed_at: datetime = Field(default_factory=utcnow)


class DriverVehicleAssignment(SQLModel, table=True):
    __tablename__ = "driver_vehicle_assignments"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    employee_id: int = Field(foreign_key="app_core.employees.id")
    vehicle_id: int = Field(foreign_key="app_core.vehicles.id")
    starts_at: datetime = Field(default_factory=utcnow)
    ends_at: datetime | None = Field(default=None)


class DeliverySession(SQLModel, table=True):
    __tablename__ = "delivery_sessions"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    employee_id: int | None = Field(default=None, foreign_key="app_core.employees.id")
    vehicle_id: int | None = Field(default=None, foreign_key="app_core.vehicles.id")
    starts_at: datetime | None = Field(default=None)
    ends_at: datetime | None = Field(default=None)


class GateCheck(SQLModel, table=True):
    __tablename__ = "gate_checks"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    delivery_session_id: int | None = Field(default=None, foreign_key="app_core.delivery_sessions.id")
    checked_at: datetime = Field(default_factory=utcnow)
    notes: str | None = Field(default=None, max_length=500)


class ImportJob(SQLModel, table=True):
    __tablename__ = "import_jobs"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    source_system: str = Field(max_length=100)
    entity_name: str = Field(max_length=100)
    status: str = Field(default="running", max_length=30)
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime | None = Field(default=None)
    total_rows: int = Field(default=0)
    success_rows: int = Field(default=0)
    failed_rows: int = Field(default=0)
    message: str | None = Field(default=None, max_length=500)


class SourceMap(SQLModel, table=True):
    __tablename__ = "source_map"
    __table_args__ = (
        UniqueConstraint("source_system", "entity_name", "legacy_id", name="uq_source_map_legacy"),
        {"schema": "app_core"},
    )

    id: int | None = Field(default=None, primary_key=True)
    source_system: str = Field(max_length=100)
    entity_name: str = Field(max_length=100)
    legacy_id: int = Field(index=True)
    app_id: int = Field(index=True)
    mapped_at: datetime = Field(default_factory=utcnow)


class EmployeeSnapshot(SQLModel, table=True):
    __tablename__ = "employee"
    __table_args__ = ({"schema": "legacy_snapshot"},)

    id: int | None = Field(default=None, primary_key=True)
    legacy_id: int = Field(index=True)
    payload: dict = Field(sa_column=Column(JSON, nullable=False))
    imported_at: datetime = Field(default_factory=utcnow)


class ClientSnapshot(SQLModel, table=True):
    __tablename__ = "client"
    __table_args__ = ({"schema": "legacy_snapshot"},)

    id: int | None = Field(default=None, primary_key=True)
    legacy_id: int = Field(index=True)
    payload: dict = Field(sa_column=Column(JSON, nullable=False))
    imported_at: datetime = Field(default_factory=utcnow)


class VehicleSnapshot(SQLModel, table=True):
    __tablename__ = "vehicle"
    __table_args__ = ({"schema": "legacy_snapshot"},)

    id: int | None = Field(default=None, primary_key=True)
    legacy_id: int = Field(index=True)
    payload: dict = Field(sa_column=Column(JSON, nullable=False))
    imported_at: datetime = Field(default_factory=utcnow)


class InventoryImport(SQLModel, table=True):
    __tablename__ = "inventory_imports"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    reference_date: date = Field(index=True)
    file_name: str | None = Field(default=None, max_length=255)
    total_products: int = Field(default=0)
    created_products: int = Field(default=0)
    imported_by: str | None = Field(default=None, max_length=120)
    imported_at: datetime = Field(default_factory=utcnow)


class InventoryImportItem(SQLModel, table=True):
    __tablename__ = "inventory_import_items"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    inventory_import_id: int = Field(foreign_key="app_core.inventory_imports.id", index=True)
    cod_produto: str = Field(max_length=120, index=True)
    descricao: str = Field(max_length=255)
    metrics: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_at: datetime = Field(default_factory=utcnow)


class ValidityLine(SQLModel, table=True):
    """Lançamento de validade por produto (múltiplas linhas por item; dia operacional em SP)."""

    __tablename__ = "validity_lines"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    client_event_id: str = Field(max_length=100, index=True, unique=True)
    cod_produto: str = Field(max_length=120, index=True)
    expiration_date: date
    quantity_un: int = Field(ge=0)
    lot_code: str | None = Field(default=None, max_length=80)
    note: str | None = Field(default=None, max_length=500)
    operational_date: date = Field(index=True)
    observed_at: datetime = Field(default_factory=utcnow)
    device_name: str | None = Field(default=None, max_length=120)
    actor_username: str | None = Field(default=None, max_length=120)


class ChangeLog(SQLModel, table=True):
    __tablename__ = "change_log"
    __table_args__ = ({"schema": "audit"},)

    id: int | None = Field(default=None, primary_key=True)
    entity_name: str = Field(max_length=100)
    entity_id: int = Field(index=True)
    action: str = Field(max_length=30)
    actor: str | None = Field(default=None, max_length=120)
    changed_at: datetime = Field(default_factory=utcnow)
    payload: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))


class SyncRun(SQLModel, table=True):
    __tablename__ = "sync_runs"
    __table_args__ = ({"schema": "audit"},)

    id: int | None = Field(default=None, primary_key=True)
    source_system: str = Field(max_length=100)
    entity_name: str = Field(max_length=100)
    started_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime | None = Field(default=None)
    status: str = Field(default="running", max_length=30)
    details: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))


class FailedImportRow(SQLModel, table=True):
    __tablename__ = "failed_import_rows"
    __table_args__ = ({"schema": "audit"},)

    id: int | None = Field(default=None, primary_key=True)
    source_system: str = Field(max_length=100)
    entity_name: str = Field(max_length=100)
    legacy_id: int | None = Field(default=None, index=True)
    error_message: str = Field(max_length=500)
    row_payload: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_at: datetime = Field(default_factory=utcnow)


class RecountSignal(SQLModel, table=True):
    """Solicitação de recontagem em tempo real (analista → conferente), por dia operacional."""

    __tablename__ = "recount_signals"
    __table_args__ = (
        UniqueConstraint("operational_date", "cod_produto", name="uq_recount_signal_day_cod"),
        {"schema": "app_core"},
    )

    id: int | None = Field(default=None, primary_key=True)
    operational_date: date = Field(index=True)
    cod_produto: str = Field(max_length=120, index=True)
    requested_by: str | None = Field(default=None, max_length=120)
    requested_at: datetime = Field(default_factory=utcnow)


class MateCouroTrocaLog(SQLModel, table=True):
    """Auditoria na Base de Troca (Mate couro): chegadas e ajustes de pendente."""

    __tablename__ = "mate_couro_troca_logs"
    __table_args__ = ({"schema": "app_core"},)

    id: int | None = Field(default=None, primary_key=True)
    client_event_id: str = Field(max_length=100, index=True, unique=True)
    kind: str = Field(max_length=24, index=True)
    cod_produto: str = Field(max_length=120, index=True)
    qty_cx_in: int = Field(default=0)
    qty_un_in: int = Field(default=0)
    pend_cx_before: int = Field(default=0)
    pend_un_before: int = Field(default=0)
    pend_cx_after: int = Field(default=0)
    pend_un_after: int = Field(default=0)
    excess_cx: int = Field(default=0)
    excess_un: int = Field(default=0)
    device_name: str | None = Field(default=None, max_length=120)
    actor_username: str | None = Field(default=None, max_length=120)
    created_at: datetime = Field(default_factory=utcnow)

