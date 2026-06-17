from fastapi import APIRouter, HTTPException
from ..db import fetch_one, fetch_all, execute

router = APIRouter(prefix="/public", tags=["Public validation"])


@router.get("/validate/{validation_hash}")
def validate_certificate(validation_hash: str):
    cert = fetch_one("select * from v_certificates_status where validation_hash=%s", [validation_hash])
    if not cert:
        raise HTTPException(status_code=404, detail="Certificado no encontrado o hash inválido")
    execute("select add_certificate_audit(%s,null,'viewed_public',%s,null,null)", [cert["id"], "Consulta pública de validación."])
    patterns = fetch_all(
        """
        select pattern_name, pattern_serial_number, pattern_certificate_number, pattern_range_value,
               pattern_unit, pattern_calibration_date, pattern_recalibration_date
        from certificate_pattern_usage
        where certificate_id=%s
        order by created_at
        """,
        [cert["id"]],
    )
    return {
        "valid": cert["status"] == "approved" and cert["visible_status"] in ("vigente", "por_vencer_30_dias", "por_vencer_60_dias"),
        "certificate_number": cert["certificate_number"],
        "visible_status": cert["visible_status"],
        "status": cert["status"],
        "client_name": cert["client_name"],
        "client_cuit": cert["client_cuit"],
        "element": cert["element"],
        "brand": cert["brand"],
        "serial_number": cert["serial_number"],
        "calibration_date": cert["calibration_date"],
        "expiration_date": cert["expiration_date"],
        "trial_result": cert["trial_result"],
        "approved_result": cert["approved_result"],
        "pdf_url": cert["pdf_url"],
        "qr_url": cert["qr_url"],
        "validation_hash": cert["validation_hash"],
        "patterns": patterns,
    }
