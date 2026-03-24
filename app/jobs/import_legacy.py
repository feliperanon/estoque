from sqlalchemy import create_engine, text
from sqlmodel import Session

from app.db.session import engine as app_engine
from app.services.import_processors import import_clients_rows, import_employees_rows, import_vehicles_rows
from app.services.imports import finish_import_job, start_import_job
from app.core.config import get_settings


def _fetch_rows(legacy_conn, query: str, batch_size: int):
    result = legacy_conn.execution_options(stream_results=True).execute(text(query))
    while True:
        batch = result.fetchmany(batch_size)
        if not batch:
            break
        yield [dict(row._mapping) for row in batch]


def run() -> None:
    settings = get_settings()
    if not settings.legacy_database_url:
        raise RuntimeError("LEGACY_DATABASE_URL nao configurada")

    legacy_engine = create_engine(settings.legacy_database_url)

    employee_query = """
        SELECT
            id AS legacy_id,
            registration_id,
            seller_code,
            name,
            admission_date,
            cost_center,
            role,
            birthday,
            status,
            work_shift,
            work_days,
            work_schedule,
            mobile_access,
            mobile_access_separation,
            mobile_access_checklist,
            mobile_access_admin_start,
            mobile_access_returns,
            mobile_access_helper,
            mobile_access_gatehouse,
            mobile_access_escala
        FROM employee
    """

    client_query = """
        SELECT
            id AS legacy_id,
            name,
            client_group_id,
            nb,
            setor,
            me,
            sa,
            visita,
            nome_fantasia,
            razao_social,
            municipio,
            bairro,
            endereco,
            fone,
            fone_e164,
            segmento,
            status_cliente,
            status_operacional,
            logradouro,
            numero,
            complemento,
            referencia,
            observacoes_acesso,
            fone_alternativo,
            observacoes_contato,
            janela_dias_semana,
            janela_horario_inicio,
            janela_horario_fim,
            prioridade_logistica,
            latitude,
            longitude,
            geocoding_status
        FROM client
    """

    vehicle_query = """
        SELECT
            id AS legacy_id,
            placa,
            vehicle_type,
            marca,
            modelo,
            renavam,
            ano,
            crv_number,
            chassi,
            is_active,
            in_workshop,
            sale_value,
            sold_at,
            odometer_km
        FROM vehicle
    """

    with legacy_engine.connect() as legacy_conn, Session(app_engine) as session:
        for entity_name, query, handler in [
            ("employees", employee_query, import_employees_rows),
            ("clients", client_query, import_clients_rows),
            ("vehicles", vehicle_query, import_vehicles_rows),
        ]:
            job = start_import_job(session, settings.legacy_source_system, entity_name)
            session.flush()
            total = 0
            success = 0
            failed = 0

            for batch in _fetch_rows(legacy_conn, query, settings.legacy_batch_size):
                s, f = handler(session, batch)
                total += len(batch)
                success += s
                failed += f
                session.commit()

            finish_import_job(
                session,
                job,
                status="done",
                total_rows=total,
                success_rows=success,
                failed_rows=failed,
            )
            session.commit()
            print(f"{entity_name}: total={total} success={success} failed={failed}")


if __name__ == "__main__":
    run()
