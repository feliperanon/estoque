"""initial

Revision ID: 20260324_0001
Revises: 
Create Date: 2026-03-24 00:00:00

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260324_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS legacy_snapshot")
    op.execute("CREATE SCHEMA IF NOT EXISTS app_core")
    op.execute("CREATE SCHEMA IF NOT EXISTS audit")

    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("registration_id", sa.String(length=50), nullable=True),
        sa.Column("seller_code", sa.String(length=50), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("admission_date", sa.Date(), nullable=True),
        sa.Column("cost_center", sa.String(length=100), nullable=True),
        sa.Column("role", sa.String(length=100), nullable=True),
        sa.Column("birthday", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=True),
        sa.Column("work_shift", sa.String(length=50), nullable=True),
        sa.Column("work_days", sa.String(length=120), nullable=True),
        sa.Column("work_schedule", sa.String(length=120), nullable=True),
        sa.Column("mobile_access", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mobile_access_separation", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mobile_access_checklist", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mobile_access_admin_start", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mobile_access_returns", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mobile_access_helper", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mobile_access_gatehouse", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("mobile_access_escala", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("legacy_id", sa.Integer(), nullable=True),
        sa.Column("source_system", sa.String(length=100), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="app_core",
    )
    op.create_index("ix_app_core_employees_name", "employees", ["name"], unique=False, schema="app_core")

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=100), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("employee_id", sa.Integer(), nullable=True),
        sa.Column("allowed_pages", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("google_sub", sa.String(length=255), nullable=True),
        sa.Column("legacy_id", sa.Integer(), nullable=True),
        sa.Column("source_system", sa.String(length=100), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["employee_id"], ["app_core.employees.id"]),
        schema="app_core",
    )

    op.create_table(
        "client_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("legacy_id", sa.Integer(), nullable=True),
        sa.Column("source_system", sa.String(length=100), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("name", name="uq_client_group_name"),
        schema="app_core",
    )

    op.create_table(
        "clients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("client_group_id", sa.Integer(), nullable=True),
        sa.Column("nb", sa.String(length=50), nullable=True),
        sa.Column("setor", sa.String(length=100), nullable=True),
        sa.Column("me", sa.String(length=100), nullable=True),
        sa.Column("sa", sa.String(length=100), nullable=True),
        sa.Column("visita", sa.String(length=100), nullable=True),
        sa.Column("nome_fantasia", sa.String(length=255), nullable=True),
        sa.Column("razao_social", sa.String(length=255), nullable=True),
        sa.Column("municipio", sa.String(length=120), nullable=True),
        sa.Column("bairro", sa.String(length=120), nullable=True),
        sa.Column("endereco", sa.String(length=255), nullable=True),
        sa.Column("fone", sa.String(length=30), nullable=True),
        sa.Column("fone_e164", sa.String(length=30), nullable=True),
        sa.Column("segmento", sa.String(length=120), nullable=True),
        sa.Column("status_cliente", sa.String(length=60), nullable=True),
        sa.Column("status_operacional", sa.String(length=60), nullable=True),
        sa.Column("logradouro", sa.String(length=255), nullable=True),
        sa.Column("numero", sa.String(length=30), nullable=True),
        sa.Column("complemento", sa.String(length=120), nullable=True),
        sa.Column("referencia", sa.String(length=255), nullable=True),
        sa.Column("observacoes_acesso", sa.String(length=500), nullable=True),
        sa.Column("fone_alternativo", sa.String(length=30), nullable=True),
        sa.Column("observacoes_contato", sa.String(length=500), nullable=True),
        sa.Column("janela_dias_semana", sa.String(length=120), nullable=True),
        sa.Column("janela_horario_inicio", sa.String(length=20), nullable=True),
        sa.Column("janela_horario_fim", sa.String(length=20), nullable=True),
        sa.Column("prioridade_logistica", sa.Integer(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("geocoding_status", sa.String(length=30), nullable=True),
        sa.Column("legacy_id", sa.Integer(), nullable=True),
        sa.Column("source_system", sa.String(length=100), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_group_id"], ["app_core.client_groups.id"]),
        schema="app_core",
    )

    op.create_table(
        "vehicles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("placa", sa.String(length=10), nullable=True),
        sa.Column("vehicle_type", sa.String(length=60), nullable=True),
        sa.Column("marca", sa.String(length=60), nullable=True),
        sa.Column("modelo", sa.String(length=80), nullable=True),
        sa.Column("renavam", sa.String(length=30), nullable=True),
        sa.Column("ano", sa.Integer(), nullable=True),
        sa.Column("crv_number", sa.String(length=50), nullable=True),
        sa.Column("chassi", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("in_workshop", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sale_value", sa.Float(), nullable=True),
        sa.Column("sold_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("odometer_km", sa.Integer(), nullable=True),
        sa.Column("legacy_id", sa.Integer(), nullable=True),
        sa.Column("source_system", sa.String(length=100), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        schema="app_core",
    )

    op.create_table(
        "driver_vehicle_assignments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=False),
        sa.Column("vehicle_id", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["employee_id"], ["app_core.employees.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["app_core.vehicles.id"]),
        schema="app_core",
    )

    op.create_table(
        "delivery_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("employee_id", sa.Integer(), nullable=True),
        sa.Column("vehicle_id", sa.Integer(), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["employee_id"], ["app_core.employees.id"]),
        sa.ForeignKeyConstraint(["vehicle_id"], ["app_core.vehicles.id"]),
        schema="app_core",
    )

    op.create_table(
        "gate_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("delivery_session_id", sa.Integer(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["delivery_session_id"], ["app_core.delivery_sessions.id"]),
        schema="app_core",
    )

    op.create_table(
        "import_jobs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_system", sa.String(length=100), nullable=False),
        sa.Column("entity_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_rows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("success_rows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("failed_rows", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("message", sa.String(length=500), nullable=True),
        schema="app_core",
    )

    op.create_table(
        "source_map",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_system", sa.String(length=100), nullable=False),
        sa.Column("entity_name", sa.String(length=100), nullable=False),
        sa.Column("legacy_id", sa.Integer(), nullable=False),
        sa.Column("app_id", sa.Integer(), nullable=False),
        sa.Column("mapped_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("source_system", "entity_name", "legacy_id", name="uq_source_map_legacy"),
        schema="app_core",
    )

    op.create_table(
        "employee",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("legacy_id", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        schema="legacy_snapshot",
    )

    op.create_table(
        "client",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("legacy_id", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        schema="legacy_snapshot",
    )

    op.create_table(
        "vehicle",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("legacy_id", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False),
        schema="legacy_snapshot",
    )

    op.create_table(
        "change_log",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("entity_name", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=30), nullable=False),
        sa.Column("actor", sa.String(length=120), nullable=True),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="audit",
    )

    op.create_table(
        "sync_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_system", sa.String(length=100), nullable=False),
        sa.Column("entity_name", sa.String(length=100), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("details", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema="audit",
    )

    op.create_table(
        "failed_import_rows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_system", sa.String(length=100), nullable=False),
        sa.Column("entity_name", sa.String(length=100), nullable=False),
        sa.Column("legacy_id", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.String(length=500), nullable=False),
        sa.Column("row_payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        schema="audit",
    )


def downgrade() -> None:
    op.drop_table("failed_import_rows", schema="audit")
    op.drop_table("sync_runs", schema="audit")
    op.drop_table("change_log", schema="audit")
    op.drop_table("vehicle", schema="legacy_snapshot")
    op.drop_table("client", schema="legacy_snapshot")
    op.drop_table("employee", schema="legacy_snapshot")
    op.drop_table("source_map", schema="app_core")
    op.drop_table("import_jobs", schema="app_core")
    op.drop_table("gate_checks", schema="app_core")
    op.drop_table("delivery_sessions", schema="app_core")
    op.drop_table("driver_vehicle_assignments", schema="app_core")
    op.drop_table("vehicles", schema="app_core")
    op.drop_table("clients", schema="app_core")
    op.drop_table("client_groups", schema="app_core")
    op.drop_table("users", schema="app_core")
    op.drop_table("employees", schema="app_core")

    op.execute("DROP SCHEMA IF EXISTS audit CASCADE")
    op.execute("DROP SCHEMA IF EXISTS app_core CASCADE")
    op.execute("DROP SCHEMA IF EXISTS legacy_snapshot CASCADE")
