from uuid import UUID
from fastapi import HTTPException
from ..db import fetch_one, fetch_all, execute, get_conn
from ..config import settings


CERT_COLUMNS = [
    "certificate_number", "certificate_code", "certificate_revision", "certificate_validity",
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
    return {"certificate": cert, "test_rows": rows, "patterns": patterns, "comments": comments, "audit": audit, "files": files}


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
