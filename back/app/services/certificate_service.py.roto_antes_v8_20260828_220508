from uuid import UUID
from pathlib import Path
import re
from fastapi import HTTPException, UploadFile
from ..db import fetch_one, fetch_all, execute, get_conn
from ..config import settings


DEFAULT_FREQUENCY_MONTHS = 12
DEFAULT_RESPONSIBLE_NAME = "Walter Cisterna"
DEFAULT_RESPONSIBLE_LICENSE = "Jefe Tecnico"
DEFAULT_AMBIENT_TEMPERATURE = "20° Centigrados"

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
    # Regla global SIP: ningún certificado exige gráfico/carta hidráulica.
    return False

