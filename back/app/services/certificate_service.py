from uuid import UUID
from pathlib import Path
import re
from fastapi import HTTPException, UploadFile
from ..db import fetch_one, fetch_all, execute, get_conn
from ..config import settings


CERT_COLUMNS = [
    "certificate_number", "certificate_code", "certificate_revision", "certificate_validity",
    "document_type", "template_type", "md_required", "requires_hydraulic_chart",
    "previous_certificate_id", "reissue_reason", "responsible_name", "responsible_license",
    "asset_unit_code", "seal_number", "test_medium", "ambient_temperature",
    "client_id", "equipment_id", "purchase_order", "calibration_date", "expiration_date",
    "test_frequency_months", "element", "type_model", "brand", "serial_number",
    "range_value", "unit", "size_value", "test_type", "reference_method",
    "environmental_conditions", "measurement_unit", "observations", "conclusions",
    "trial_result", "approved_result", "final_comments", "is_paid", "payment_notes"
]


def get_certificate_or_404(cert_id: str):
    cert = fetch_one("select * from v_certificates_status where id=%s", [cert_id])
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
    return cert


def assert_client_scope(user, client_id):
    if user["role_code"] == "cliente":
        allowed = fetch_one(
            "select 1 from client_users where user_id=%s and client_id=%s and can_view=true",
            [user["id"], client_id],
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="No podés acceder a este cliente")


def can_view_certificate(user, cert):
    if user["role_code"] in ("admin", "aprobador", "certificador"):
        return True
    if user["role_code"] == "cliente":
        assert_client_scope(user, cert["client_id"])
        return True
    return False





def list_certificate_templates(user=None):
    return fetch_all(
        """
        select code, name, document_type, description, default_method, default_frequency_months, requires_hydraulic_chart
        from certificate_templates
        where active=true
        order by case code
          when 'pressure_gauge' then 1
          when 'pressure_head_sensor' then 2
          when 'relief_valve_set' then 3
          when 'hydrostatic_line' then 4
          else 99 end, name
        """,
        [],
    )


def get_client_template_requirement(client_id: str, template_type: str):
    if not client_id or not template_type:
        return None
    return fetch_one(
        """
        select *
        from client_certificate_requirements
        where client_id=%s and template_type=%s and active=true
        """,
        [client_id, template_type],
    )


def is_md_client(client_id: str | None) -> bool:
    if not client_id:
        return False
    client = fetch_one("select name, cuit from clients where id=%s", [client_id])
    if not client:
        return False
    name = str(client.get("name") or "").strip().upper().replace(" ", "")
    cuit = str(client.get("cuit") or "").strip()
    return cuit == "30710046898" or name in ("MD", "MDSRL", "MDS.R.L.")


def template_requires_hydraulic_chart(template_type: str | None) -> bool:
    code = template_type or "general_pressure"
    if code in ("relief_valve_set", "hydrostatic_line"):
        return True
    template = fetch_one("select requires_hydraulic_chart from certificate_templates where code=%s", [code])
    return bool(template and template.get("requires_hydraulic_chart"))


def apply_client_requirements(data: dict):
    # Estas reglas se calculan siempre en backend. El frontend ya no decide manualmente
    # si aplica MD o si el gráfico/carta hidráulica es obligatorio.
    client_id = str(data.get("client_id") or "")
    template_type = data.get("template_type") or "general_pressure"

    data["md_required"] = is_md_client(client_id)
    data["requires_hydraulic_chart"] = template_requires_hydraulic_chart(template_type)

    req = get_client_template_requirement(client_id, template_type)
    if req:
        data["md_required"] = True
        if req.get("requires_hydraulic_chart"):
            data["requires_hydraulic_chart"] = True
        if req.get("frequency_months"):
            data["test_frequency_months"] = req.get("frequency_months")

    # Para MD la frecuencia se fuerza a 12 meses, salvo que exista una regla específica
    # con una frecuencia más estricta en client_certificate_requirements.
    if data["md_required"] and not (req and req.get("frequency_months")):
        data["test_frequency_months"] = 12

    return data


def save_specific_results_tx(cur, cert_id, data: dict, replace=True):
    metrology_results = data.get("metrology_results")
    sensor_loop_results = data.get("sensor_loop_results")
    relief_valve_result = data.get("relief_valve_result")
    hydrostatic_result = data.get("hydrostatic_result")

    if metrology_results is not None:
        if replace:
            cur.execute("delete from certificate_metrology_results where certificate_id=%s", [cert_id])
        for row in metrology_results:
            cur.execute(
                """
                insert into certificate_metrology_results
                (certificate_id,row_order,point_label,direction,pattern_pressure,instrument_reading,error_value,max_allowed_error,uncertainty,unit,result,observations)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                [cert_id, row.get("row_order"), row.get("point_label"), row.get("direction"), row.get("pattern_pressure"), row.get("instrument_reading"), row.get("error_value"), row.get("max_allowed_error"), row.get("uncertainty"), row.get("unit"), row.get("result"), row.get("observations")],
            )

    if sensor_loop_results is not None:
        if replace:
            cur.execute("delete from certificate_sensor_loop_results where certificate_id=%s", [cert_id])
        for row in sensor_loop_results:
            cur.execute(
                """
                insert into certificate_sensor_loop_results
                (certificate_id,row_order,pressure_applied,pattern_reading,expected_signal,measured_signal,signal_unit,display_reading,error_value,max_allowed_error,result,observations)
                values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                [cert_id, row.get("row_order"), row.get("pressure_applied"), row.get("pattern_reading"), row.get("expected_signal"), row.get("measured_signal"), row.get("signal_unit"), row.get("display_reading"), row.get("error_value"), row.get("max_allowed_error"), row.get("result"), row.get("observations")],
            )

    if relief_valve_result is not None:
        cur.execute("delete from certificate_relief_valve_results where certificate_id=%s", [cert_id])
        cur.execute(
            """
            insert into certificate_relief_valve_results
            (certificate_id,set_pressure_required,opening_pressure,tolerance_percent,reclosing_pressure,leak_test_pressure,leak_test_result,seal_number,test_medium,ambient_temperature,result,observations)
            values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            [cert_id, relief_valve_result.get("set_pressure_required"), relief_valve_result.get("opening_pressure"), relief_valve_result.get("tolerance_percent"), relief_valve_result.get("reclosing_pressure"), relief_valve_result.get("leak_test_pressure"), relief_valve_result.get("leak_test_result"), relief_valve_result.get("seal_number"), relief_valve_result.get("test_medium"), relief_valve_result.get("ambient_temperature"), relief_valve_result.get("result"), relief_valve_result.get("observations")],
        )

    if hydrostatic_result is not None:
        cur.execute("delete from certificate_hydrostatic_results where certificate_id=%s", [cert_id])
        cur.execute(
            """
            insert into certificate_hydrostatic_results
            (certificate_id,work_pressure,test_pressure,hold_minutes,pressure_drop,test_medium,thickness_control,thickness_method,thickness_values,result,observations)
            values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            [cert_id, hydrostatic_result.get("work_pressure"), hydrostatic_result.get("test_pressure"), hydrostatic_result.get("hold_minutes"), hydrostatic_result.get("pressure_drop"), hydrostatic_result.get("test_medium"), hydrostatic_result.get("thickness_control"), hydrostatic_result.get("thickness_method"), hydrostatic_result.get("thickness_values"), hydrostatic_result.get("result"), hydrostatic_result.get("observations")],
        )


def validate_certificate_before_approval(cert_id: str, cert: dict):
    template_type = cert.get("template_type") or "general_pressure"

    if cert.get("requires_hydraulic_chart") or template_type in ("relief_valve_set", "hydrostatic_line"):
        chart = _get_hydraulic_chart_row(cert_id)
        if not chart:
            raise HTTPException(status_code=400, detail="Este tipo de certificado requiere adjuntar el gráfico/carta de prueba hidráulica antes de aprobar.")

    if template_type == "pressure_gauge":
        rows = fetch_all("select * from certificate_metrology_results where certificate_id=%s", [cert_id])
        if len(rows) == 0:
            raise HTTPException(status_code=400, detail="Para manómetros se requiere tabla metrológica patrón vs instrumento.")

    if template_type == "pressure_head_sensor":
        rows = fetch_all("select * from certificate_sensor_loop_results where certificate_id=%s", [cert_id])
        if len(rows) == 0:
            raise HTTPException(status_code=400, detail="Para cabezas de presión/sensores se requiere tabla de lazo eléctrico.")

    if template_type == "relief_valve_set":
        row = fetch_one("select * from certificate_relief_valve_results where certificate_id=%s", [cert_id])
        if not row:
            raise HTTPException(status_code=400, detail="Para válvulas relief/PRV se requieren resultados de apertura, cierre, hermeticidad y precinto.")

    if template_type == "hydrostatic_line":
        row = fetch_one("select * from certificate_hydrostatic_results where certificate_id=%s", [cert_id])
        if not row:
            raise HTTPException(status_code=400, detail="Para líneas/mangueras/bridas se requieren parámetros de ensayo hidrostático.")


def get_next_certificate_number(prefix: str = "SIP", year: int | None = None):
    """Devuelve el próximo número correlativo tipo SIP 26-033.

    Se calcula desde la base de datos para no depender del navegador.
    La restricción UNIQUE de certificates.certificate_number sigue siendo la garantía final.
    """
    from datetime import datetime

    yy = str(year or datetime.now().year)[-2:]
    normalized_prefix = (prefix or "SIP").strip().upper()
    regex = rf"^{normalized_prefix} {yy}-([0-9]+)$"
    row = fetch_one(
        """
        select coalesce(max((substring(certificate_number from %s))::int), 0) + 1 as next_seq
        from certificates
        where certificate_number ~ %s
        """,
        [regex, regex],
    )
    next_seq = int(row["next_seq"] or 1)
    return {
        "certificate_number": f"{normalized_prefix} {yy}-{next_seq:03d}",
        "prefix": normalized_prefix,
        "year_suffix": yy,
        "next_sequence": next_seq,
    }

def list_certificates(user, status=None, client_id=None, q=None):
    params = []
    where = []

    if user["role_code"] == "cliente":
        where.append("client_id in (select client_id from client_users where user_id=%s and can_view=true)")
        params.append(user["id"])

    if status:
        where.append("visible_status = %s")
        params.append(status)

    if client_id:
        where.append("client_id = %s")
        params.append(client_id)

    if q:
        like = f"%{q}%"
        where.append("(certificate_number ilike %s or client_name ilike %s or serial_number ilike %s or element ilike %s)")
        params.extend([like, like, like, like])

    sql = "select * from v_certificates_status"
    if where:
        sql += " where " + " and ".join(where)
    sql += " order by created_at desc limit 500"
    return fetch_all(sql, params)


def certificate_detail(cert_id: str, user=None):
    cert = get_certificate_or_404(cert_id)
    if user:
        can_view_certificate(user, cert)
    rows = fetch_all("select * from certificate_test_rows where certificate_id=%s order by row_order", [cert_id])
    patterns = fetch_all("select * from certificate_pattern_usage where certificate_id=%s order by created_at", [cert_id])
    comments = fetch_all(
        """
        select cc.*, u.full_name as user_name
        from certificate_comments cc
        left join app_users u on u.id = cc.user_id
        where certificate_id=%s
        order by cc.created_at desc
        """,
        [cert_id],
    )
    audit = fetch_all(
        """
        select al.*, u.full_name as user_name
        from certificate_audit_log al
        left join app_users u on u.id = al.user_id
        where certificate_id=%s
        order by al.created_at desc
        """,
        [cert_id],
    )
    files = fetch_all("select * from certificate_files where certificate_id=%s order by created_at desc", [cert_id])
    hydraulic_chart = next((f for f in files if f.get("file_type") == "hydraulic_test_chart"), None)
    metrology_results = fetch_all("select * from certificate_metrology_results where certificate_id=%s order by row_order", [cert_id])
    sensor_loop_results = fetch_all("select * from certificate_sensor_loop_results where certificate_id=%s order by row_order", [cert_id])
    relief_valve_result = fetch_one("select * from certificate_relief_valve_results where certificate_id=%s", [cert_id])
    hydrostatic_result = fetch_one("select * from certificate_hydrostatic_results where certificate_id=%s", [cert_id])
    return {
        "certificate": cert,
        "test_rows": rows,
        "patterns": patterns,
        "comments": comments,
        "audit": audit,
        "files": files,
        "hydraulic_test_chart": hydraulic_chart,
        "metrology_results": metrology_results,
        "sensor_loop_results": sensor_loop_results,
        "relief_valve_result": relief_valve_result,
        "hydrostatic_result": hydrostatic_result,
    }

def snapshot_client_and_equipment(client_id, equipment_id):
    client = fetch_one("select * from clients where id=%s", [client_id])
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    equipment = None
    if equipment_id:
        equipment = fetch_one("select * from equipment where id=%s", [equipment_id])
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return client, equipment


def create_certificate(payload, user):
    data = payload.model_dump()
    test_rows = data.pop("test_rows", [])
    pattern_usages = data.pop("pattern_usages", [])
    specific_data = {
        "metrology_results": data.pop("metrology_results", []),
        "sensor_loop_results": data.pop("sensor_loop_results", []),
        "relief_valve_result": data.pop("relief_valve_result", None),
        "hydrostatic_result": data.pop("hydrostatic_result", None),
    }
    data = apply_client_requirements(data)
    client, equipment = snapshot_client_and_equipment(data["client_id"], data.get("equipment_id"))

    existing = fetch_one("select id from certificates where certificate_number=%s", [data["certificate_number"]])
    if existing:
        raise HTTPException(status_code=409, detail="El número de certificado ya existe. Actualizá el número y volvé a intentar.")

    if equipment:
        for key in ["element", "type_model", "brand", "serial_number", "range_value", "unit", "size_value"]:
            data[key] = data.get(key) or equipment.get(key)

    data["client_name_snapshot"] = client.get("name")
    data["client_cuit_snapshot"] = client.get("cuit")
    data["created_by"] = user["id"]
    data["status"] = "draft"

    validation_hash = fetch_one("select generate_certificate_validation_hash(%s) as h", [data["certificate_number"]])["h"]
    data["validation_hash"] = validation_hash
    data["public_validation_url"] = f"{settings.PUBLIC_BASE_URL}/public/validate/{validation_hash}"

    cols = list(data.keys())
    placeholders = ",".join(["%s"] * len(cols))
    sql = f"insert into certificates ({','.join(cols)}) values ({placeholders}) returning id"

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, [data[c] for c in cols])
            cert_id = cur.fetchone()["id"]

            for row in test_rows:
                cur.execute(
                    """
                    insert into certificate_test_rows
                    (certificate_id, row_order, pressure_label, range_value, unit, acceptance_criteria, result, observations)
                    values (%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    [cert_id, row["row_order"], row["pressure_label"], row.get("range_value"), row.get("unit"), row.get("acceptance_criteria"), row.get("result"), row.get("observations")],
                )

            for usage in pattern_usages:
                add_pattern_usage_tx(cur, cert_id, usage["pattern_id"])

            save_specific_results_tx(cur, cert_id, specific_data, replace=True)

            cur.execute(
                "select add_certificate_audit(%s,%s,'created',%s,null,'draft') as id",
                [cert_id, user["id"], "Certificado creado en borrador."],
            )
    return certificate_detail(str(cert_id), user)


def add_pattern_usage_tx(cur, cert_id, pattern_id):
    cur.execute("select * from measurement_patterns where id=%s", [pattern_id])
    p = cur.fetchone()
    if not p:
        raise HTTPException(status_code=404, detail="Patrón no encontrado")
    cur.execute(
        """
        insert into certificate_pattern_usage
        (certificate_id, pattern_id, pattern_name, pattern_serial_number, pattern_certificate_number,
         pattern_range_value, pattern_unit, pattern_calibration_date, pattern_recalibration_date, pattern_certificate_url)
        values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        on conflict (certificate_id, pattern_id) do nothing
        """,
        [cert_id, pattern_id, p.get("name"), p.get("serial_number"), p.get("certificate_number"), p.get("range_value"), p.get("unit"), p.get("calibration_date"), p.get("recalibration_date"), p.get("certificate_url")],
    )


def update_certificate(cert_id: str, payload, user):
    cert = get_certificate_or_404(cert_id)
    if cert["status"] not in ("draft", "rejected") and user["role_code"] != "admin":
        raise HTTPException(status_code=400, detail="Solo se pueden editar borradores o rechazados")

    data = payload.model_dump(exclude_unset=True)
    test_rows = data.pop("test_rows", None)
    pattern_usages = data.pop("pattern_usages", None)
    specific_data = {
        "metrology_results": data.pop("metrology_results", None),
        "sensor_loop_results": data.pop("sensor_loop_results", None),
        "relief_valve_result": data.pop("relief_valve_result", None),
        "hydrostatic_result": data.pop("hydrostatic_result", None),
    }
    if data.get("client_id") or data.get("template_type"):
        merged = dict(cert)
        merged.update(data)
        data = apply_client_requirements(merged)

    cert_data = {k: v for k, v in data.items() if k in CERT_COLUMNS}

    with get_conn() as conn:
        with conn.cursor() as cur:
            if cert_data:
                sets = ", ".join([f"{k}=%s" for k in cert_data.keys()])
                cur.execute(f"update certificates set {sets} where id=%s", list(cert_data.values()) + [cert_id])

            if test_rows is not None:
                cur.execute("delete from certificate_test_rows where certificate_id=%s", [cert_id])
                for row in test_rows:
                    cur.execute(
                        """
                        insert into certificate_test_rows
                        (certificate_id, row_order, pressure_label, range_value, unit, acceptance_criteria, result, observations)
                        values (%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        [cert_id, row["row_order"], row["pressure_label"], row.get("range_value"), row.get("unit"), row.get("acceptance_criteria"), row.get("result"), row.get("observations")],
                    )

            if pattern_usages is not None:
                cur.execute("delete from certificate_pattern_usage where certificate_id=%s", [cert_id])
                for usage in pattern_usages:
                    add_pattern_usage_tx(cur, cert_id, usage["pattern_id"])

            if any(value is not None for value in specific_data.values()):
                save_specific_results_tx(cur, cert_id, specific_data, replace=True)

            cur.execute("select add_certificate_audit(%s,%s,'updated',%s,%s,%s)", [cert_id, user["id"], "Certificado actualizado.", cert["status"], cert["status"]])

    return certificate_detail(cert_id, user)


def submit_certificate(cert_id: str, user):
    cert = get_certificate_or_404(cert_id)
    if cert["status"] not in ("draft", "rejected"):
        raise HTTPException(status_code=400, detail="Solo se pueden enviar certificados en borrador o rechazados")
    execute(
        """
        update certificates
        set status='submitted', submitted_by=%s, submitted_at=now(), rejection_reason=null
        where id=%s returning id
        """,
        [user["id"], cert_id],
    )
    execute("select add_certificate_audit(%s,%s,'submitted',%s,%s,'submitted')", [cert_id, user["id"], "Certificado enviado a aprobación.", cert["status"]])
    return certificate_detail(cert_id, user)


def approve_certificate(cert_id: str, user):
    cert = get_certificate_or_404(cert_id)
    if cert["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Solo se pueden aprobar certificados enviados")
    validate_certificate_before_approval(cert_id, cert)
    execute(
        """
        update certificates
        set status='approved', approved_by=%s, approved_at=now(), approved_result=coalesce(approved_result,true), trial_result=coalesce(trial_result,'Aprobado')
        where id=%s returning id
        """,
        [user["id"], cert_id],
    )
    execute("select add_certificate_audit(%s,%s,'approved',%s,%s,'approved')", [cert_id, user["id"], "Certificado aprobado.", cert["status"]])
    return certificate_detail(cert_id, user)


def reject_certificate(cert_id: str, reason: str, user):
    cert = get_certificate_or_404(cert_id)
    if cert["status"] != "submitted":
        raise HTTPException(status_code=400, detail="Solo se pueden rechazar certificados enviados")
    execute(
        """
        update certificates
        set status='rejected', rejected_by=%s, rejected_at=now(), rejection_reason=%s
        where id=%s returning id
        """,
        [user["id"], reason, cert_id],
    )
    execute("select add_certificate_audit(%s,%s,'rejected',%s,%s,'rejected')", [cert_id, user["id"], reason, cert["status"]])
    return certificate_detail(cert_id, user)


def annul_certificate(cert_id: str, reason: str, user):
    cert = get_certificate_or_404(cert_id)
    if cert["status"] == "annulled":
        raise HTTPException(status_code=400, detail="El certificado ya está anulado")
    execute(
        """
        update certificates
        set status='annulled', annulled_by=%s, annulled_at=now(), annulment_reason=%s
        where id=%s returning id
        """,
        [user["id"], reason, cert_id],
    )
    execute("select add_certificate_audit(%s,%s,'annulled',%s,%s,'annulled')", [cert_id, user["id"], reason, cert["status"]])
    return certificate_detail(cert_id, user)



def delete_certificate(cert_id: str, user, hard: bool = True):
    cert = get_certificate_or_404(cert_id)

    if user["role_code"] != "admin":
        raise HTTPException(status_code=403, detail="Solo un administrador puede eliminar certificados")

    if not hard:
        return annul_certificate(cert_id, "Certificado desactivado/anulado desde acciones.", user)

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("delete from certificate_metrology_results where certificate_id=%s", [cert_id])
            cur.execute("delete from certificate_sensor_loop_results where certificate_id=%s", [cert_id])
            cur.execute("delete from certificate_relief_valve_results where certificate_id=%s", [cert_id])
            cur.execute("delete from certificate_hydrostatic_results where certificate_id=%s", [cert_id])
            cur.execute("delete from certificate_test_rows where certificate_id=%s", [cert_id])
            cur.execute("delete from certificate_pattern_usage where certificate_id=%s", [cert_id])
            cur.execute("delete from certificate_comments where certificate_id=%s", [cert_id])
            cur.execute("delete from certificate_files where certificate_id=%s", [cert_id])
            cur.execute("delete from certificate_audit_log where certificate_id=%s", [cert_id])
            cur.execute("delete from certificates where id=%s returning id", [cert_id])
            deleted = cur.fetchone()

    if not deleted:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")

    return {"ok": True, "deleted_id": cert_id}


# =========================================================
# Adjuntos técnicos: gráfico prueba hidráulica
# =========================================================

HYDRAULIC_CHART_TYPE = "hydraulic_test_chart"
STATIC_ROOT = Path("app/static")
HYDRAULIC_CHART_DIR = STATIC_ROOT / "hydraulic-charts"
HYDRAULIC_CHART_DIR.mkdir(parents=True, exist_ok=True)


def _safe_file_stem(value: str) -> str:
    value = (value or "certificado").strip().replace(" ", "_")
    value = re.sub(r"[^A-Za-z0-9_\-]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "certificado"


def _public_static_url(relative_path: str) -> str:
    base = str(settings.PUBLIC_BASE_URL or "").rstrip("/")
    rel = relative_path if relative_path.startswith("/") else f"/{relative_path}"
    return f"{base}{rel}"


def _get_hydraulic_chart_row(cert_id: str):
    return fetch_one(
        """
        select *
        from certificate_files
        where certificate_id=%s and file_type=%s
        order by created_at desc
        limit 1
        """,
        [cert_id, HYDRAULIC_CHART_TYPE],
    )


def get_hydraulic_test_chart(cert_id: str, user):
    cert = get_certificate_or_404(cert_id)
    can_view_certificate(user, cert)
    row = _get_hydraulic_chart_row(cert_id)
    return {"hydraulic_test_chart": row}


async def _read_upload_bytes(upload: UploadFile) -> bytes:
    content = await upload.read()
    await upload.close()
    return content


def upload_hydraulic_test_chart(cert_id: str, file: UploadFile, user):
    cert = get_certificate_or_404(cert_id)
    can_view_certificate(user, cert)

    filename = file.filename or "grafico_prueba_hidraulica.pdf"
    content_type = (file.content_type or "").lower()
    if not filename.lower().endswith(".pdf") and content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="El gráfico de prueba hidráulica debe ser un archivo PDF")

    # UploadFile.read() es async. Como este servicio es sync, accedemos al file object directamente.
    file.file.seek(0)
    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="El archivo PDF está vacío")

    safe_cert = _safe_file_stem(cert.get("certificate_number") or cert_id)
    output_name = f"{safe_cert}_grafico_prueba_hidraulica.pdf"
    output_path = HYDRAULIC_CHART_DIR / output_name
    output_path.write_bytes(content)

    relative_url = f"/static/hydraulic-charts/{output_name}"
    public_url = _public_static_url(relative_url)

    old = _get_hydraulic_chart_row(cert_id)

    with get_conn() as conn:
        with conn.cursor() as cur:
            # Dejamos un solo adjunto activo de este tipo por certificado.
            cur.execute(
                "delete from certificate_files where certificate_id=%s and file_type=%s",
                [cert_id, HYDRAULIC_CHART_TYPE],
            )
            cur.execute(
                """
                insert into certificate_files
                (certificate_id, file_type, file_name, file_url, storage_path, uploaded_by)
                values (%s,%s,%s,%s,%s,%s)
                returning *
                """,
                [cert_id, HYDRAULIC_CHART_TYPE, filename, public_url, str(output_path), user["id"]],
            )
            row = cur.fetchone()
            cur.execute(
                "select add_certificate_audit(%s,%s,'updated',%s,null,null)",
                [
                    cert_id,
                    user["id"],
                    "Gráfico prueba hidráulica reemplazado." if old else "Gráfico prueba hidráulica subido.",
                ],
            )

    return {"ok": True, "hydraulic_test_chart": row, "file_url": public_url}


def delete_hydraulic_test_chart(cert_id: str, user):
    cert = get_certificate_or_404(cert_id)
    can_view_certificate(user, cert)
    old = _get_hydraulic_chart_row(cert_id)
    if not old:
        return {"ok": True, "deleted": False}

    storage_path = old.get("storage_path")
    if storage_path:
        try:
            Path(storage_path).unlink(missing_ok=True)
        except Exception:
            pass

    execute(
        "delete from certificate_files where certificate_id=%s and file_type=%s",
        [cert_id, HYDRAULIC_CHART_TYPE],
    )
    execute(
        "select add_certificate_audit(%s,%s,'updated',%s,null,null)",
        [cert_id, user["id"], "Gráfico prueba hidráulica eliminado."],
    )
    return {"ok": True, "deleted": True}
